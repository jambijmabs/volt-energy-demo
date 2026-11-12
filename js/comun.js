// Utilidades compartidas: parámetros, formato, folio, leads, WhatsApp e impresión.
import { prioridadLead } from "./calculos.js";
import { hayBackend, llamar } from "./backend.js";

let parametros;
let promesaParametros;

// Parámetros de fábrica (data/parametros.json) más lo que se haya editado en el panel.
export function cargarParametros() {
  promesaParametros ??= (async () => {
    const r = await fetch(new URL("../data/parametros.json", import.meta.url));
    let datos = await r.json();
    if (hayBackend) {
      try {
        const remoto = await llamar("query", "parametros:obtener", {}, { tiempoMs: 3000 });
        if (remoto) datos = combinar(datos, JSON.parse(remoto.datosJson));
      } catch {
        /* sin conexión al backend: se usan los de fábrica */
      }
    }
    parametros = datos;
    return datos;
  })();
  return promesaParametros;
}

// Lo editado manda; lo que falte (por ejemplo, un parámetro nuevo) se toma de fábrica.
function combinar(fabrica, editado) {
  const esObjeto = (v) => v && typeof v === "object" && !Array.isArray(v);
  if (!esObjeto(fabrica) || !esObjeto(editado)) return editado ?? fabrica;
  const salida = { ...fabrica };
  for (const [k, v] of Object.entries(editado)) salida[k] = esObjeto(v) && esObjeto(fabrica[k]) ? combinar(fabrica[k], v) : v;
  return salida;
}

const mxn = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });
const num = (d) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: d, minimumFractionDigits: 0 });
export const pesos = (n) => mxn.format(Math.round(n));
export const numero = (n, decimales = 0) => num(decimales).format(n);
export const rangoPesos = (r) => `${pesos(r.bajo)} – ${pesos(r.alto)}`;

export function leerNumero(form, nombre) {
  const v = form.elements[nombre]?.value;
  return v === "" || v == null ? null : Number(v);
}

export function semaforoHtml(color, texto) {
  return `<span class="semaforo semaforo--${color}">${texto}</span>`;
}

export function avisosHtml(avisos) {
  return avisos.map((a) => `<p class="aviso">${a}</p>`).join("");
}

// Banda de rango bajo / base / alto
export function bandaHtml(rango) {
  const min = rango.bajo * 0.8;
  const max = rango.alto * 1.1;
  const pos = (v) => `${((v - min) / (max - min)) * 100}%`;
  return `
    <div class="banda__pista">
      <div class="banda__rango" style="left:${pos(rango.bajo)};width:calc(${pos(rango.alto)} - ${pos(rango.bajo)})"></div>
      <div class="banda__base" style="left:calc(${pos(rango.base)} - 2px)"></div>
    </div>
    <div class="banda__nums">
      <div><span class="etq">Bajo</span><strong>${pesos(rango.bajo)}</strong></div>
      <div class="base"><span class="etq">Base</span><strong>${pesos(rango.base)}</strong></div>
      <div><span class="etq">Alto</span><strong>${pesos(rango.alto)}</strong></div>
    </div>`;
}

// ---------------------------------------------------------------- Folio y leads

// Sin backend el folio no puede ser secuencial (BE-00001); usamos fecha + 4 caracteres.
export function nuevoFolio() {
  const d = new Date();
  const fecha = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const azar = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BE-${fecha}-${azar}`;
}

export function guardarLead(lead) {
  try {
    const lista = JSON.parse(localStorage.getItem("volt_leads") || "[]");
    lista.push(lead);
    localStorage.setItem("volt_leads", JSON.stringify(lista));
  } catch {
    /* almacenamiento bloqueado: el lead sigue por WhatsApp */
  }
}

// Registra el contacto. Con backend, el folio es consecutivo (BE-00001) y queda guardado en el
// servidor; sin backend o si falla la conexión, se usa un folio local y el contacto sigue por WhatsApp.
export async function crearLead({ origen, mercado, contacto, entrada, resultado, extra = {}, resumen = "" }) {
  const utm = Object.fromEntries([...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("utm_")));
  const lead = {
    folio: nuevoFolio(),
    fecha: new Date().toISOString(),
    origen,
    mercado,
    ...contacto,
    prioridad: prioridadLead({ origen, mercado, ...extra }),
    entrada,
    resultado,
    parametros,
    utm,
    estatus: "nuevo",
    enServidor: false,
  };
  if (hayBackend) {
    const extraLimpio = {};
    if (Number.isFinite(extra.gastoLuz)) extraLimpio.gastoLuz = extra.gastoLuz;
    if (Number.isFinite(extra.puntaje)) extraLimpio.puntaje = extra.puntaje;
    if (typeof extra.gas === "string") extraLimpio.gas = extra.gas;
    try {
      const r = await llamar("mutation", "leads:crear", {
        origen,
        mercado,
        nombre: contacto.nombre,
        whatsapp: contacto.whatsapp,
        entradaJson: JSON.stringify(entrada ?? null),
        resultadoJson: JSON.stringify(resultado ?? null),
        parametrosJson: JSON.stringify(parametros ?? null),
        utmJson: JSON.stringify(utm),
        resumen,
        extra: extraLimpio,
      });
      lead.folio = r.folio;
      lead.prioridad = r.prioridad;
      lead.enServidor = true;
    } catch (e) {
      console.warn("No se pudo guardar el contacto en el servidor:", e.message);
    }
  }
  guardarLead(lead);
  return lead;
}

// ---------------------------------------------------------------- WhatsApp e impresión

export function urlWhatsApp(texto) {
  const numero = (parametros?.config?.whatsapp_numero || "").replace(/\D/g, "");
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

export function imprimir({ folio, nombre }) {
  const enc = document.getElementById("impresion-encabezado");
  if (enc) {
    enc.innerHTML = `<strong>Bolt Energy</strong> · Estimado ${folio} · ${nombre} · ${new Date().toLocaleDateString("es-MX")}`;
  }
  window.print();
}

// ---------------------------------------------------------------- Formulario de contacto (modal)

const HTML_DIALOGO = `
<dialog id="dlg-lead" class="dialogo" aria-labelledby="dlg-lead-titulo">
  <form method="dialog" class="dialogo__form" novalidate>
    <h2 id="dlg-lead-titulo">Tus datos</h2>
    <p class="nota">Los usamos solo para enviarte este estimado y contactarte sobre él.</p>
    <label>Nombre<input name="nombre" autocomplete="name" required></label>
    <label>WhatsApp (10 dígitos)<input name="whatsapp" inputmode="numeric" autocomplete="tel-national" pattern="\\d{10}" maxlength="10" required></label>
    <label class="check"><input type="checkbox" name="consentimiento" required>
      <span>Acepto el <a href="aviso-de-privacidad.html" target="_blank">aviso de privacidad</a>.</span></label>
    <p class="error" hidden></p>
    <div class="acciones">
      <button value="cancelar" class="btn btn--sec" formnovalidate>Cancelar</button>
      <button value="ok" class="btn btn--pri">Continuar</button>
    </div>
  </form>
</dialog>`;

export function pedirContacto() {
  let dlg = document.getElementById("dlg-lead");
  if (!dlg) {
    document.body.insertAdjacentHTML("beforeend", HTML_DIALOGO);
    dlg = document.getElementById("dlg-lead");
  }
  const form = dlg.querySelector("form");
  const error = dlg.querySelector(".error");
  error.hidden = true;
  dlg.returnValue = "";
  dlg.showModal();

  return new Promise((resolve) => {
    // Se resuelve al enviar el formulario; el evento "close" solo cubre la tecla Esc.
    const terminar = (valor) => {
      form.removeEventListener("submit", alEnviar);
      resolve(valor);
    };
    const alEnviar = (ev) => {
      if (ev.submitter?.value !== "ok") return terminar(null);
      const nombre = form.nombre.value.trim();
      const whatsapp = form.whatsapp.value.replace(/\D/g, "");
      let msg = "";
      if (!nombre) msg = "Escribe tu nombre.";
      else if (whatsapp.length !== 10) msg = "El WhatsApp debe tener 10 dígitos.";
      else if (!form.consentimiento.checked) msg = "Necesitamos tu consentimiento para continuar.";
      if (msg) {
        ev.preventDefault();
        error.textContent = msg;
        error.hidden = false;
        return;
      }
      terminar({ nombre, whatsapp });
    };
    form.addEventListener("submit", alEnviar);
    dlg.addEventListener("close", () => terminar(null), { once: true });
  });
}

// Conecta los botones de acción de un resultado.
// obtener() regresa { origen, mercado, entrada, resultado, resumen, extra } del último cálculo.
// WhatsApp se abre con enlaces <a> reales (los pop-ups por script se bloquean en algunos navegadores).
// opciones.pdf(lead, contacto, datos): genera la propuesta en PDF; sin ella se usa la impresión del navegador.
export function conectarAcciones(contenedor, obtener, opciones = {}) {
  contenedor.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button[data-accion]");
    if (!btn) return;
    const datos = obtener();
    if (!datos) return;
    const contacto = await pedirContacto();
    if (!contacto) return;
    const lead = await crearLead({ ...datos, contacto });
    const texto = `Hola, soy ${contacto.nombre}. Quiero agendar una visita técnica.\nFolio ${lead.folio}\n${datos.resumen}`;
    mostrarFolio(contenedor, lead.folio, urlWhatsApp(texto));
    if (btn.dataset.accion === "pdf") {
      if (opciones.pdf) {
        const texto = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Generando propuesta…";
        try {
          await opciones.pdf(lead, contacto, datos);
        } catch (e) {
          console.warn("No se pudo generar el PDF:", e.message);
          imprimir({ folio: lead.folio, nombre: contacto.nombre });
        } finally {
          btn.disabled = false;
          btn.textContent = texto;
        }
      } else imprimir({ folio: lead.folio, nombre: contacto.nombre });
    }
  });
}

// Actualiza el enlace "Enviar por WhatsApp" con el resumen del último cálculo.
export function actualizarWhatsApp(contenedor, resumen) {
  contenedor.querySelectorAll("a[data-wa-resumen]").forEach((a) => {
    a.href = urlWhatsApp(`Hola, hice un estimado en Bolt Energy (no vinculante):\n${resumen}`);
  });
}

export function mostrarFolio(contenedor, folio, enlaceWa) {
  let p = contenedor.querySelector(".folio");
  if (!p) {
    p = document.createElement("div");
    p.className = "folio";
    contenedor.querySelector(".acciones")?.after(p);
  }
  const cal = parametros?.config?.calendly_url;
  p.innerHTML =
    `<p>Tu folio: <strong>${folio}</strong>. Envíanoslo para agendar la visita.</p>` +
    `<div class="acciones" style="margin-top:.5rem">` +
    `<a class="btn btn--pri" href="${enlaceWa}" target="_blank" rel="noopener">Enviar folio por WhatsApp</a>` +
    (cal ? `<a class="btn btn--sec" href="${cal}" target="_blank" rel="noopener">Elegir fecha</a>` : "") +
    `</div>`;
}

// La impresión a PDF solo funciona cuando el sitio no está dentro de un marco (iframe).
const puedeImprimir = (() => {
  try { return window.self === window.top; } catch { return false; }
})();

export function htmlAcciones({ propuesta = false } = {}) {
  return `
<div class="acciones">
  <button type="button" class="btn btn--pri" data-accion="visita">Agendar visita técnica</button>
  ${propuesta ? `<button type="button" class="btn btn--sec" data-accion="pdf">Descargar propuesta en PDF</button>` : puedeImprimir ? `<button type="button" class="btn btn--sec" data-accion="pdf">Descargar PDF</button>` : ""}
  <a class="btn btn--sec" data-wa-resumen href="#" target="_blank" rel="noopener">Enviar por WhatsApp</a>
</div>`;
}

// Enlaces de WhatsApp generales (encabezado y botón flotante)
cargarParametros().then(() => {
  document.querySelectorAll("[data-wa]").forEach((a) => {
    a.href = urlWhatsApp("Hola, quiero información de Bolt Energy.");
  });
});
