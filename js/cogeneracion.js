import { calcularGenerador, puntajeCogeneracion } from "./calculos.js";
import {
  cargarParametros, pesos, numero, avisosHtml, semaforoHtml, conectarAcciones, htmlAcciones, actualizarWhatsApp,
  bandaHtml, crearLead, urlWhatsApp,
} from "./comun.js";
import { montarEsquemasDeclarados } from "./esquemas.js";
import { conectarDeslizador, conectarDeslizadorLineal } from "./deslizador.js";

const P = await cargarParametros();
const G = P.generador_gas;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- Cambio de vista

function cambiarVista(vista) {
  $("modo-equipo").setAttribute("aria-pressed", String(vista === "equipo"));
  $("modo-planta").setAttribute("aria-pressed", String(vista === "planta"));
  $("vista-equipo").hidden = vista !== "equipo";
  $("vista-planta").hidden = vista !== "planta";
}
$("modo-equipo").addEventListener("click", () => cambiarVista("equipo"));
$("modo-planta").addEventListener("click", () => cambiarVista("planta"));
$("ir-planta").addEventListener("click", () => {
  cambiarVista("planta");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------------------------------------------------------------- Equipo hasta 200 kW

const formGen = $("form-gen");
let ultimoGen = null;

const deslCarga = conectarDeslizador({ rango: $("carga"), numero: $("carga-num"), min: 2, max: 400, paso: 1, alCambiar: () => calcularEquipo() });
conectarDeslizadorLineal({ rango: $("metros"), numero: $("metros-num"), alCambiar: () => calcularEquipo() }).fijar(10);
deslCarga.fijar(15, { silencioso: true });
$("metros-ayuda").textContent = `Incluimos los primeros ${G.metros_gas_incluidos} m de tubería.`;

formGen.addEventListener("change", () => calcularEquipo());
formGen.addEventListener("submit", (ev) => ev.preventDefault());

function calcularEquipo() {
  const e = {
    cargaKw: deslCarga.valor,
    gas: formGen.gas.value,
    metrosGas: Number($("metros-num").value) || 0,
    gabinete: formGen.gabinete.value === "si",
  };
  if (!(e.cargaKw > 0)) return;
  const r = calcularGenerador(e, P);
  $("gen-avisos").innerHTML = avisosHtml(r.avisos);
  $("gen-ok").hidden = r.excede;
  $("gen-excede").hidden = !r.excede;

  if (r.excede) {
    $("gen-excede-txt").textContent =
      `Para cubrir ${numero(e.cargaKw)} kW con margen se necesitan cerca de ${numero(r.necesarioKw)} kW, más que nuestro equipo estándar de ${r.maximo} kW. ` +
      `Ese tamaño se resuelve con un proyecto industrial de Cogeneración.`;
    ultimoGen = null;
    return;
  }

  $("g-kw").innerHTML = `${r.kw} <small>kW</small>`;
  $("g-kw-det").textContent = `tu carga + ${Math.round((G.factor_margen - 1) * 100)} % de margen`;
  $("g-gas").innerHTML = `${numero(r.gasM3h, 1)} <small>m³/h</small>`;
  $("g-m2").innerHTML = `${numero(r.espacioM2, 1)} <small>m²</small>`;
  $("g-mtto").textContent = pesos(r.mantenimientoAnual);

  const d = r.desglose;
  const partes = [
    [`Equipo de ${r.kw} kW`, d.equipo, "var(--noche)", "seg--1"],
    ["Instalación básica", d.instalacion, "var(--verde)", "seg--2"],
    ["Transferencia automática", d.transferencia, "var(--sol)", "seg--3"],
    [`Conexión de gas (${d.metrosExtra} m adicionales)`, d.conexionGas, "#8fa3bf", "seg--4"],
    ["Gabinete contra ruido", d.gabinete, "var(--verde-osc)", "seg--5"],
  ].filter((p) => p[1] > 0);
  const total = r.total.base;
  $("g-apilada").innerHTML = partes.map((p) => `<div class="${p[3]}" style="width:${(p[1] / total) * 100}%"></div>`).join("");
  $("g-desglose").innerHTML =
    partes.map((p) => `<tr><td style="--c:${p[2]}">${p[0]}</td><td>${pesos(p[1])}</td></tr>`).join("") +
    `<tr class="total"><td>Total base</td><td>${pesos(total)}</td></tr>`;
  $("g-banda").innerHTML = bandaHtml(r.total);
  $("g-iva").textContent = `Con IVA: ${pesos(r.totalConIva.bajo)} – ${pesos(r.totalConIva.alto)}. No incluye obra civil ni permisos.`;

  const acciones = $("gen-acciones");
  if (!acciones.dataset.listo) {
    acciones.innerHTML = htmlAcciones();
    acciones.dataset.listo = "1";
  }
  const resumen =
    `Cogeneración: equipo de ${r.kw} kW para ${numero(e.cargaKw)} kW de carga. ` +
    `Inversión ${pesos(r.total.bajo)} – ${pesos(r.total.alto)} + IVA.`;
  ultimoGen = { origen: "cogeneracion", mercado: "comercial", entrada: e, resultado: r, resumen, extra: { gas: e.gas === "si" ? "si_ducto" : e.gas } };
  actualizarWhatsApp($("res-equipo"), resumen);
}

conectarAcciones($("res-equipo"), () => ultimoGen);
calcularEquipo();

// ---------------------------------------------------------------- Planta industrial: pre-diagnóstico

const formCogen = $("form-cogen");
const deslGasto = conectarDeslizador({ rango: $("gasto"), numero: $("gasto-num"), min: 20000, max: 5000000, paso: 100 });
deslGasto.fijar(250000);

$("no-demanda").addEventListener("change", (ev) => {
  $("demanda").disabled = ev.target.checked;
  if (ev.target.checked) $("demanda").value = "";
});

formCogen.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const nombre = formCogen.nombre.value.trim();
  const whatsapp = formCogen.whatsapp.value.replace(/\D/g, "");
  const error = $("cogen-error");
  let msg = "";
  if (!(deslGasto.valor > 0)) msg = "Escribe cuánto pagas de luz al mes.";
  else if (!nombre) msg = "Escribe tu nombre.";
  else if (whatsapp.length !== 10) msg = "El WhatsApp debe tener 10 dígitos.";
  else if (!formCogen.consentimiento.checked) msg = "Necesitamos tu consentimiento para continuar.";
  error.textContent = msg;
  error.hidden = !msg;
  if (msg) return;

  const demanda = formCogen.demandaKw.value === "" || formCogen.noDemanda.checked ? null : Number(formCogen.demandaKw.value);
  const e = {
    gastoLuz: deslGasto.valor,
    demandaKw: demanda,
    horas: formCogen.horas.value,
    gas: formCogen.gasPlanta.value,
    calor: formCogen.calor.value,
    empresa: formCogen.empresa.value.trim(),
    ciudad: formCogen.ciudad.value.trim(),
  };
  const r = puntajeCogeneracion(e, P);
  const boton = formCogen.querySelector('button[type="submit"]');
  boton.disabled = true;
  const lead = await crearLead({
    origen: "cogeneracion",
    mercado: "industrial",
    contacto: { nombre, whatsapp },
    entrada: e,
    resultado: r,
    extra: { gastoLuz: e.gastoLuz, puntaje: r.puntaje, gas: e.gas },
    resumen: `Pre-diagnóstico de Cogeneración: ${r.puntaje} de 100. Recibo de ${pesos(e.gastoLuz)} al mes${e.empresa ? ", " + e.empresa : ""}.`,
  });
  boton.disabled = false;
  pintarDiagnostico(e, r, lead, nombre);
});

const ETIQUETA = { verde: "Buen candidato", amarillo: "Posible candidato", rojo: "No es el caso típico" };

function pintarDiagnostico(e, r, lead, nombre) {
  const caja = $("cogen-res");
  caja.hidden = false;
  const largo = Math.PI * 80;
  $("medidor").setAttribute("class", `medidor medidor--${r.color}`);
  $("medidor").setAttribute("aria-label", `Puntaje ${r.puntaje} de 100`);
  $("medidor-num").textContent = r.puntaje;
  // Reinicia y anima el arco
  $("medidor-valor").setAttribute("stroke-dasharray", `0 ${largo}`);
  requestAnimationFrame(() =>
    requestAnimationFrame(() => $("medidor-valor").setAttribute("stroke-dasharray", `${(r.puntaje / 100) * largo} ${largo}`))
  );
  $("cogen-semaforo").innerHTML = semaforoHtml(r.color, ETIQUETA[r.color]);
  $("cogen-texto").textContent = r.texto;
  $("factores").innerHTML = r.factores
    .map((f) => `<li class="${f.puntos > 0 ? "si" : ""}"><span>${f.puntos > 0 ? "✓" : "–"} ${f.nombre}</span><strong>${f.puntos} / ${f.max}</strong></li>`)
    .join("");

  const texto =
    `Hola, soy ${nombre}${e.empresa ? " de " + e.empresa : ""}. Hice el pre-diagnóstico de Cogeneración.\n` +
    `Folio ${lead.folio} · Puntaje ${r.puntaje}/100 · Recibo ${pesos(e.gastoLuz)} al mes.`;
  const cal = P.config.calendly_url;
  $("cogen-folio").innerHTML =
    `<p>Tu folio: <strong>${lead.folio}</strong>. Un asesor te contactará; si prefieres, escríbenos ahora.</p>` +
    `<div class="acciones" style="margin-top:.5rem">` +
    `<a class="btn btn--pri" href="${urlWhatsApp(texto)}" target="_blank" rel="noopener">Enviar folio por WhatsApp</a>` +
    (cal ? `<a class="btn btn--sec" href="${cal}" target="_blank" rel="noopener">Agendar visita</a>` : "") +
    (r.color === "rojo" ? `<a class="btn btn--sec" href="cotizador.html#solar">Cotizar solar</a>` : "") +
    `</div>`;
  caja.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Bloque de referencia del proveedor (siempre visible)
const R = P.cogeneracion.referencia;
$("refs").innerHTML = [
  ["Equipo llave en mano", pesos(R.precio_sin_iva), `+ IVA (${pesos(R.precio_con_iva)} con IVA)`],
  ["Potencia", `~${R.potencia_kw}–500 kW`, `Transformador de ${R.transformador_kva} kVA`],
  ["Póliza de mantenimiento", `${pesos(R.poliza_anual)}/año`, "A confirmar en tu cotización"],
  ["Consumo de gas", `${R.gas_gj_h} GJ/h`, `${R.gas_m3_h} m³/h`],
  ["Gas del ejemplo", `$${R.precio_gas_gj_ejemplo}/GJ`, "Supuesto; varía con tu contrato"],
  ["Conexión incluida", `${R.metros_conexion_incluidos} m`, "Metros adicionales se cotizan"],
]
  .map((c) => `<div class="ref"><div class="etq">${c[0]}</div><div class="val">${c[1]}</div><div class="det">${c[2]}</div></div>`)
  .join("");
$("plazos").innerHTML =
  `<div class="p1">Entrega<small>${R.entrega}</small></div><div class="p2">Instalación<small>${R.instalacion}</small></div>`;
$("ref-fuente").textContent = `Fuente: ${R.fuente}. Son cifras de un ejemplo, no una cotización para tu planta.`;

// Enlace directo: cogeneracion.html#industrial
if (location.hash === "#industrial") cambiarVista("planta");

montarEsquemasDeclarados();
