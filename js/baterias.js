import { calcularBaterias } from "./calculos.js";
import {
  cargarParametros, pesos, numero, avisosHtml, conectarAcciones, htmlAcciones, actualizarWhatsApp, bandaHtml,
} from "./comun.js";
import { montarEsquemasDeclarados } from "./esquemas.js";
import { conectarDeslizador } from "./deslizador.js";

const P = await cargarParametros();
const B = P.baterias;
const $ = (id) => document.getElementById(id);
const form = $("form-bat");
let ultimo = null;

// kW de cada perfil, tomados de los parámetros
document.querySelectorAll("[data-kw]").forEach((el) => {
  el.textContent = `${numero(B.perfiles_kw[el.dataset.kw], 1)} kW`;
});

const deslKwh = conectarDeslizador({ rango: $("kwh-mes"), numero: $("kwh-mes-num"), min: 300, max: 100000, paso: 10, alCambiar: () => calcular() });
const deslKw = conectarDeslizador({ rango: $("carga-kw"), numero: $("carga-kw-num"), min: 0.3, max: 60, paso: 0.1, alCambiar: () => calcular() });
deslKwh.fijar(3000, { silencioso: true });
deslKw.fijar(2, { silencioso: true });

form.addEventListener("change", () => {
  $("bloque-negocio").hidden = form.perfil.value !== "negocio";
  $("bloque-manual").hidden = form.perfil.value !== "manual";
  calcular();
});
form.addEventListener("submit", (ev) => ev.preventDefault());

function calcular() {
  const e = {
    perfil: form.perfil.value,
    horasRespaldo: Number(form.horasRespaldo.value),
    yaTieneSolar: form.yaTieneSolar.value,
    kwhMes: deslKwh.valor,
    horasOperacion: Number(form.horasOperacion.value),
    cargaKw: Math.round(deslKw.valor * 10) / 10,
  };
  if (e.perfil === "manual" && !(e.cargaKw > 0)) return;
  const r = calcularBaterias(e, P);
  pintar(e, r);

  const mercado = e.perfil === "negocio" ? "comercial" : "residencial";
  const resumen =
    `Baterías: respaldo de ${numero(r.cargaKw, 1)} kW por ${e.horasRespaldo} h. ` +
    `${r.modulos} módulos (${numero(r.capacidadKwh, 1)} kWh) + inversor ${r.inversor.cantidad > 1 ? r.inversor.cantidad + " × " : ""}${r.inversor.kw} kW. ` +
    `Inversión ${pesos(r.total.bajo)} – ${pesos(r.total.alto)} + IVA.`;
  ultimo = { origen: "baterias", mercado, entrada: e, resultado: r, resumen };
  actualizarWhatsApp($("resultados"), resumen);
}

function pintar(e, r) {
  const avisos = r.avisos.filter((a) => !a.startsWith("Evalúa solar"));
  $("avisos").innerHTML =
    (e.yaTieneSolar === "no"
      ? `<p class="aviso"><strong>Evalúa solar primero.</strong> La batería sola normalmente no baja el recibo; te respalda cuando se va la luz. <a href="cotizador.html#solar">Cotizar paneles →</a></p>`
      : "") + avisosHtml(avisos);

  $("k-kwh").innerHTML = `${numero(r.capacidadKwh, 1)} <small>kWh</small>`;
  $("k-modulos").textContent = `${r.modulos} ${r.modulos === 1 ? "módulo" : "módulos"} de ${B.modulo_kwh} kWh`;
  $("k-carga").innerHTML = `${numero(r.cargaKw, 1)} <small>kW</small>`;
  $("k-horas").innerHTML = `${numero(r.autonomiaHoras, 1)} <small>h</small>`;
  $("k-pediste").textContent = `pediste ${e.horasRespaldo} h`;
  $("k-inv").innerHTML = `${r.inversor.cantidad > 1 ? r.inversor.cantidad + " × " : ""}${r.inversor.kw} <small>kW</small>`;
  $("k-inv-det").textContent = `necesitas ${numero(r.inversor.necesarioKw, 1)} kW`;

  // Banco de módulos
  const escala = Math.max(1, Math.ceil(r.modulos / 40));
  const celdas = Math.ceil(r.modulos / escala);
  const caja = $("modulos");
  if (caja.children.length !== celdas) caja.innerHTML = "<i></i>".repeat(celdas);
  $("mod-escala").textContent = escala > 1 ? `cada figura = ${escala} módulos` : "";
  $("mod-nota").textContent = `Ocupa cerca de ${numero(r.espacioM2, 1)} m² de piso o pared, bajo techo.`;

  $("descarga").innerHTML = curvaDescarga(e.horasRespaldo, r.autonomiaHoras);

  // Inversión
  const d = r.desglose;
  const partes = [
    [`${r.modulos} ${r.modulos === 1 ? "módulo" : "módulos"} × ${pesos(d.precioModulo)}`, d.modulos, "var(--noche)", "seg--1"],
    [`Inversor${r.inversor.cantidad > 1 ? "es" : ""} (${r.inversor.cantidad} × ${r.inversor.kw} kW)`, d.inversores, "var(--verde)", "seg--2"],
    ["Tablero de respaldo", d.tablero, "var(--sol)", "seg--3"],
  ];
  const total = r.total.base;
  $("apilada").innerHTML = partes.map((p) => `<div class="${p[3]}" style="width:${(p[1] / total) * 100}%"></div>`).join("");
  $("desglose").innerHTML =
    partes.map((p) => `<tr><td style="--c:${p[2]}">${p[0]}</td><td>${pesos(p[1])}</td></tr>`).join("") +
    `<tr class="total"><td>Total base, instalado</td><td>${pesos(total)}</td></tr>`;
  $("banda").innerHTML = bandaHtml(r.total);
  $("con-iva").textContent = `Con IVA: ${pesos(r.totalConIva.bajo)} – ${pesos(r.totalConIva.alto)}.`;

  const acciones = $("acciones");
  if (!acciones.dataset.listo) {
    acciones.innerHTML = htmlAcciones();
    acciones.dataset.listo = "1";
  }

  const filas = [
    ["Energía necesaria", `${numero(r.energiaNecesaria, 1)} kWh`, `${numero(r.cargaKw, 1)} kW × ${e.horasRespaldo} h`],
    ["Módulo", `${B.modulo_kwh} kWh`, "Capacidad nominal por módulo"],
    ["Descarga útil", `${numero(B.descarga_util * 100)} %`, "Se deja una reserva para cuidar la batería"],
    ["Eficiencia", `${numero(B.eficiencia * 100)} %`, "Pérdidas del inversor"],
    ["Inversor", `× ${B.factor_inversor}`, "Margen sobre la carga para arranques"],
    ["Rango", "−10 % / +15 %", "Sobre el total instalado, sin IVA"],
  ];
  $("como").innerHTML = filas.map((f) => `<tr><td>${f[0]}</td><td>${f[1]}</td><td>${f[2]}</td></tr>`).join("");
}

// Curva de carga de la batería contra el tiempo
function curvaDescarga(pedidas, autonomia) {
  const W = 320, H = 170, izq = 46, der = 14, arr = 16, aba = 30;
  const maxH = Math.max(autonomia, pedidas) * 1.15;
  const reserva = 1 - B.descarga_util;
  const x = (h) => izq + (h / maxH) * (W - izq - der);
  const y = (pct) => arr + (1 - pct) * (H - arr - aba);
  const base = y(0);
  const fin = x(autonomia);
  const etiquetaDerecha = x(pedidas) > W - 90;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="La batería baja de 100 % a su reserva en ${numero(autonomia, 1)} horas">
    <path class="area" d="M${x(0)} ${y(1)} L${fin} ${y(reserva)} L${x(maxH)} ${y(reserva)} L${x(maxH)} ${base} L${x(0)} ${base} Z"/>
    <path class="eje" d="M${izq} ${arr} V${base} H${W - der}"/>
    <path class="reserva" d="M${izq} ${y(reserva)} H${W - der}"/>
    <path class="curva" d="M${x(0)} ${y(1)} L${fin} ${y(reserva)} L${x(maxH)} ${y(reserva)}"/>
    <path class="pedido" d="M${x(pedidas)} ${arr} V${base}"/>
    <text x="${izq - 6}" y="${y(1) + 4}" text-anchor="end">100 %</text>
    <text x="${izq - 6}" y="${y(reserva) + 4}" text-anchor="end">${Math.round(reserva * 100)} %</text>
    <text x="${izq}" y="${H - 10}">0 h</text>
    <text class="fuerte" x="${x(pedidas) + (etiquetaDerecha ? -5 : 5)}" y="${arr + 10}" text-anchor="${etiquetaDerecha ? "end" : "start"}">Pediste ${pedidas} h</text>
    <text class="fuerte" x="${Math.min(fin, W - der)}" y="${H - 10}" text-anchor="middle">${numero(autonomia, 1)} h</text>
  </svg>`;
}

conectarAcciones($("resultados"), () => ultimo);
calcular();

montarEsquemasDeclarados();
