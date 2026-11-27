// Panel de administración: contactos y parámetros. Todo texto que viene de un contacto se
// inserta con textContent (nunca como HTML), porque lo escribió un visitante.
import { hayBackend, llamar } from "./backend.js";
import { cargarParametros } from "./comun.js";

const $ = (id) => document.getElementById(id);
const ESTATUS = ["nuevo", "contactado", "visita", "propuesta", "ganado", "perdido"];
const ORIGEN = { sistema: "Cotizador", solar: "Solar", baterias: "Baterías", cogeneracion: "Cogeneración", contacto: "Contacto" };
const CLAVE_SESION = "bolt_panel_sesion";
let token = null;
let leads = [];
let elegido = null;

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "texto") n.textContent = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...hijos.filter((h) => h != null));
  return n;
}

// ---------------------------------------------------------------- Sesión

function mostrar(vista) {
  $("sin-backend").hidden = vista !== "sin-backend";
  $("form-entrar").hidden = vista !== "entrar";
  $("panel").hidden = vista !== "panel";
}

async function conSesion(tipo, ruta, args = {}) {
  try {
    return await llamar(tipo, ruta, { token, ...args });
  } catch (e) {
    if (/sesi[oó]n/i.test(e.message)) cerrarSesion("Tu sesión expiró. Vuelve a entrar.");
    throw e;
  }
}

function cerrarSesion(mensaje = "") {
  token = null;
  try { sessionStorage.removeItem(CLAVE_SESION); } catch { /* sin almacenamiento */ }
  $("entrar-error").textContent = mensaje;
  $("entrar-error").hidden = !mensaje;
  mostrar("entrar");
}

$("form-entrar").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const boton = ev.target.querySelector("button");
  const error = $("entrar-error");
  error.hidden = true;
  boton.disabled = true;
  try {
    const r = await llamar("action", "admin:entrar", { clave: $("clave").value });
    token = r.token;
    try { sessionStorage.setItem(CLAVE_SESION, token); } catch { /* sin almacenamiento */ }
    $("clave").value = "";
    await abrirPanel();
  } catch (e) {
    error.textContent = e.message;
    error.hidden = false;
  } finally {
    boton.disabled = false;
  }
});

$("salir").addEventListener("click", async () => {
  try { await llamar("mutation", "admin:salir", { token }); } catch { /* ya no existía */ }
  cerrarSesion();
});

// ---------------------------------------------------------------- Contactos

$("f-estatus").append(...ESTATUS.map((e) => el("option", { value: e, texto: e[0].toUpperCase() + e.slice(1) })));

async function cargarLeads() {
  $("contactos-cuenta").textContent = "Cargando…";
  leads = await conSesion("query", "leads:listar");
  pintarLeads();
}

function filtrados() {
  const q = $("f-buscar").value.trim().toLowerCase();
  const o = $("f-origen").value, p = $("f-prioridad").value, e = $("f-estatus").value;
  return leads.filter(
    (l) =>
      (!o || l.origen === o) && (!p || l.prioridad === p) && (!e || l.estatus === e) &&
      (!q || `${l.folio} ${l.nombre} ${l.whatsapp}`.toLowerCase().includes(q))
  );
}

const fecha = (ms) => new Date(ms).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function pintarLeads() {
  const lista = filtrados();
  $("conteos").replaceChildren(
    ...ESTATUS.map((e) => el("span", { class: "chip", texto: `${e[0].toUpperCase() + e.slice(1)}: ${leads.filter((l) => l.estatus === e).length}` }))
  );
  $("contactos-cuenta").textContent =
    leads.length === 0 ? "Todavía no hay contactos. Aparecerán aquí cuando alguien agende una visita o use el formulario de contacto."
      : `${lista.length} de ${leads.length} contactos`;

  $("tabla").tBodies[0].replaceChildren(
    ...lista.map((l) =>
      el("tr", { class: l._id === elegido ? "elegido" : null },
        el("td", {}, el("strong", { texto: l.folio })),
        el("td", { texto: fecha(l._creationTime) }),
        el("td", { texto: l.nombre }),
        el("td", {}, el("a", { href: `https://wa.me/52${l.whatsapp}`, target: "_blank", rel: "noopener", texto: l.whatsapp })),
        el("td", { texto: `${ORIGEN[l.origen] ?? l.origen} · ${l.mercado}` }),
        el("td", {}, el("span", { class: `prio prio--${l.prioridad}`, texto: l.prioridad })),
        el("td", {},
          el("select", { "aria-label": `Estatus de ${l.folio}`, onchange: (ev) => cambiarEstatus(l, ev.target.value) },
            ...ESTATUS.map((e) => el("option", { value: e, selected: e === l.estatus, texto: e[0].toUpperCase() + e.slice(1) })))),
        el("td", {}, el("button", { class: "btn btn--sec", type: "button", texto: "Ver", onclick: () => verDetalle(l._id) }))
      )
    )
  );
}

async function cambiarEstatus(lead, estatus) {
  await conSesion("mutation", "leads:actualizar", { id: lead._id, estatus });
  lead.estatus = estatus;
  pintarLeads();
}

function bonito(json) {
  try { return JSON.stringify(JSON.parse(json), null, 2); } catch { return json; }
}

async function verDetalle(id) {
  elegido = id;
  pintarLeads();
  const caja = $("detalle");
  caja.hidden = false;
  caja.replaceChildren(el("p", { class: "nota", texto: "Cargando…" }));
  const l = await conSesion("query", "leads:detalle", { id });
  const notas = el("textarea", { class: "texto", rows: 3, "aria-label": "Notas" });
  notas.value = l.notas;
  const aviso = el("span", { class: "nota", "aria-live": "polite" });
  const dato = (dt, dd) => [el("dt", { texto: dt }), el("dd", { texto: dd })];
  caja.replaceChildren(
    el("h3", { texto: `${l.folio} · ${l.nombre}` }),
    el("p", { texto: l.resumen || "Sin resumen." }),
    el("dl", { class: "detalle__datos" },
      ...dato("Fecha", fecha(l._creationTime)), ...dato("WhatsApp", l.whatsapp),
      ...dato("Origen", `${ORIGEN[l.origen] ?? l.origen} · ${l.mercado}`), ...dato("Prioridad", l.prioridad), ...dato("Estatus", l.estatus)),
    el("label", { class: "campo", texto: "Notas internas" }), notas,
    el("div", { class: "acciones" },
      el("button", { class: "btn btn--pri", type: "button", texto: "Guardar notas", onclick: async () => {
        await conSesion("mutation", "leads:actualizar", { id, notas: notas.value });
        aviso.textContent = "Notas guardadas.";
      } }),
      el("a", { class: "btn btn--sec", href: `https://wa.me/52${l.whatsapp}`, target: "_blank", rel: "noopener", texto: "Abrir WhatsApp" }),
      aviso),
    el("details", {}, el("summary", { texto: "Datos que capturó" }), el("pre", { class: "json", texto: bonito(l.entradaJson) })),
    el("details", {}, el("summary", { texto: "Resultado que vio" }), el("pre", { class: "json", texto: bonito(l.resultadoJson) })),
    el("details", {}, el("summary", { texto: "Parámetros con los que se calculó" }), el("pre", { class: "json", texto: bonito(l.parametrosJson) }))
  );
  caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function descargarCsv() {
  const celda = (v) => {
    let t = String(v ?? "");
    if (/^[=+\-@]/.test(t)) t = "'" + t; // evita que una hoja de cálculo lo tome como fórmula
    return `"${t.replace(/"/g, '""')}"`;
  };
  const filas = [["Folio", "Fecha", "Nombre", "WhatsApp", "Origen", "Mercado", "Prioridad", "Estatus", "Resumen", "Notas"]].concat(
    filtrados().map((l) => [l.folio, new Date(l._creationTime).toISOString(), l.nombre, l.whatsapp, l.origen, l.mercado, l.prioridad, l.estatus, l.resumen ?? "", l.notas])
  );
  const csv = "﻿" + filas.map((f) => f.map(celda).join(",")).join("\r\n");
  const a = el("a", { href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), download: `contactos-${new Date().toISOString().slice(0, 10)}.csv` });
  document.body.append(a);
  a.click();
  a.remove();
}

for (const id of ["f-buscar", "f-origen", "f-prioridad", "f-estatus"]) $(id).addEventListener("input", pintarLeads);
$("recargar").addEventListener("click", cargarLeads);
$("csv").addEventListener("click", descargarCsv);

// ---------------------------------------------------------------- Parámetros

let base = null; // parámetros vigentes (de fábrica + editados)

function hojas(obj, ruta = []) {
  if (obj !== null && typeof obj === "object") return Object.entries(obj).flatMap(([k, v]) => hojas(v, [...ruta, k]));
  return [{ ruta, valor: obj }];
}
const etiqueta = (ruta) => ruta.map((p) => (/^\d+$/.test(p) ? `#${Number(p) + 1}` : p.replace(/_/g, " "))).join(" › ");

async function cargarEditor() {
  const [fabrica, remoto] = await Promise.all([
    fetch(new URL("../data/parametros.json", import.meta.url)).then((r) => r.json()),
    llamar("query", "parametros:obtener"),
  ]);
  const editado = remoto ? JSON.parse(remoto.datosJson) : null;
  base = editado ? { ...fabrica, ...editado } : fabrica;
  $("param-estado").textContent = remoto
    ? `Usando valores editados el ${fecha(remoto.actualizado)}.`
    : "Usando los valores de fábrica (los del Excel). Cambia lo que necesites y guarda.";

  const grupos = {};
  for (const h of hojas(base)) (grupos[h.ruta[0]] ??= []).push(h);
  $("param-editor").replaceChildren(
    ...Object.entries(grupos).filter(([g]) => !g.startsWith("_")).map(([g, lista]) =>
      el("details", { class: "param-grupo", open: g === "config" },
        el("summary", { texto: g.replace(/_/g, " ") }),
        ...lista.map((h) => {
          const tipo = h.valor === null ? "nulo" : typeof h.valor;
          const entrada = el("input", tipo === "boolean" ? { type: "checkbox" } : { type: tipo === "number" ? "number" : "text", step: "any" });
          if (tipo === "boolean") entrada.checked = h.valor; else entrada.value = h.valor ?? "";
          entrada.dataset.ruta = JSON.stringify(h.ruta);
          entrada.dataset.tipo = tipo;
          entrada.addEventListener("input", () => entrada.classList.add("cambiado"));
          return el("label", { class: "param-fila" }, el("span", { texto: etiqueta(h.ruta.slice(1)) || g }), entrada);
        })
      )
    )
  );
}

function leerEditor() {
  const datos = structuredClone(base);
  for (const entrada of $("param-editor").querySelectorAll("input")) {
    const ruta = JSON.parse(entrada.dataset.ruta);
    const tipo = entrada.dataset.tipo;
    let valor;
    if (tipo === "boolean") valor = entrada.checked;
    else if (tipo === "number") {
      valor = Number(entrada.value);
      if (entrada.value === "" || !Number.isFinite(valor)) throw new Error(`"${etiqueta(ruta)}" debe ser un número.`);
    } else if (tipo === "nulo") valor = entrada.value === "" ? null : Number.isFinite(Number(entrada.value)) ? Number(entrada.value) : entrada.value;
    else valor = entrada.value;
    let nodo = datos;
    for (const p of ruta.slice(0, -1)) nodo = nodo[p];
    nodo[ruta.at(-1)] = valor;
  }
  return datos;
}

$("param-guardar").addEventListener("click", async () => {
  const msg = $("param-msg");
  try {
    const datos = leerEditor();
    await conSesion("mutation", "parametros:guardar", { datosJson: JSON.stringify(datos) });
    msg.textContent = "Guardado. Los cotizadores ya usan estos valores.";
    await cargarEditor();
  } catch (e) {
    msg.textContent = e.message;
  }
});

let confirmar = false;
$("param-restablecer").addEventListener("click", async (ev) => {
  if (!confirmar) {
    confirmar = true;
    ev.target.textContent = "¿Seguro? Haz clic otra vez para borrar tus cambios";
    setTimeout(() => { confirmar = false; ev.target.textContent = "Volver a los valores de fábrica"; }, 5000);
    return;
  }
  confirmar = false;
  ev.target.textContent = "Volver a los valores de fábrica";
  await conSesion("mutation", "parametros:restablecer");
  $("param-msg").textContent = "Listo. Se usan otra vez los valores de fábrica.";
  await cargarEditor();
});

// ---------------------------------------------------------------- Pestañas y arranque

function pestana(cual) {
  $("tab-contactos").setAttribute("aria-pressed", String(cual === "contactos"));
  $("tab-parametros").setAttribute("aria-pressed", String(cual === "parametros"));
  $("vista-contactos").hidden = cual !== "contactos";
  $("vista-parametros").hidden = cual !== "parametros";
}
$("tab-contactos").addEventListener("click", () => pestana("contactos"));
$("tab-parametros").addEventListener("click", () => pestana("parametros"));

async function abrirPanel() {
  mostrar("panel");
  await Promise.all([cargarLeads(), cargarEditor()]);
}

await cargarParametros();
if (!hayBackend) mostrar("sin-backend");
else {
  try { token = sessionStorage.getItem(CLAVE_SESION); } catch { /* sin almacenamiento */ }
  if (token) abrirPanel().catch(() => {});
  else mostrar("entrar");
}
