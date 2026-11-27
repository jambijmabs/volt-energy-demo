import { estimarCogeneracion } from "./calculos.js";
import { cargarParametros, pesos, numero } from "./comun.js";
import { conectarDeslizador } from "./deslizador.js";
import { montarEsquema } from "./esquemas.js";
import { montarRed } from "./red.js";

const P = await cargarParametros();
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- Portada: red y equipos

montarRed($("red-inicio"));
$("sp-panel").textContent = `${P.solar.panel_w} W por panel`;
$("sp-panel-m2").textContent = `${P.solar.m2_por_panel} m² por panel`;
$("sp-bat").textContent = `${P.baterias.modulo_kwh} kWh por módulo`;
$("sp-bat-m2").textContent = `${P.baterias.m2_por_modulo} m² por módulo`;
$("sp-gen").textContent = `De ${P.generador_gas.tamanos_comerciales_kw[0]} a ${P.generador_gas.tamanos_comerciales_kw.at(-1)} kW`;

// ---------------------------------------------------------------- Mini-cotizador de Cogeneración

const LIMITES = {
  industrial: { min: 50000, max: 5000000, inicial: 400000, horas: 16 },
  comercial: { min: 10000, max: 300000, inicial: 80000, horas: 12 },
};
let mercado = "industrial";

const desl = conectarDeslizador({
  rango: $("mini-monto"),
  numero: $("mini-monto-num"),
  min: LIMITES.industrial.min,
  max: LIMITES.industrial.max,
  paso: 1000,
  alCambiar: calcular,
});

function calcular(monto) {
  if (!(monto > 0)) return;
  const precio = P.solar.precio_kwh_sin_recibo[mercado];
  const horas = LIMITES[mercado].horas;
  const gasGj = P.cogeneracion.referencia.precio_gas_gj_ejemplo;
  // Solo sabemos cuánto paga: estimamos el consumo con un precio promedio por kWh
  const r = estimarCogeneracion({ kwhMes: monto / precio, horasOp: horas, precioKwh: precio, precioGasGj: gasGj }, P);
  const rec = r.ahorro.recuperacion;
  $("mini-pot").innerHTML = `${numero(r.cog.kw)} <small>kW</small>`;
  $("mini-mod").innerHTML = r.modular
    ? `${r.modular.modulos} <small>${r.modular.modulos === 1 ? "módulo" : "módulos"} de ~0.5 MW</small>`
    : `1 <small>generador</small>`;
  $("mini-ahorro").innerHTML = r.ahorro.ahorro.base > 0 ? `${pesos(r.ahorro.ahorro.bajo)} – ${pesos(r.ahorro.ahorro.alto)}` : "Sin ahorro";
  $("mini-rec").innerHTML = rec ? `${numero(rec.bajo, 1)} a ${numero(rec.alto, 1)} <small>años</small>` : "—";
  $("mini-inv").innerHTML = `${pesos(r.cog.total.bajo)} – ${pesos(r.cog.total.alto)} <small>+ IVA</small>`;
  $("mini-nota").textContent =
    `Supone ${horas} horas de operación al día, gas natural a $${numero(gasGj)} por GJ y un precio promedio de $${numero(precio, 2)} por kWh. ` +
    "Estimado no vinculante; la recuperación es un orden de magnitud, no una garantía.";
  $("mini-ir").href = `cotizador.html#p-${Math.round(monto)}-${mercado}${mercado === "industrial" ? "-gdmth" : ""}`;
}

function cambiarMercado(m) {
  mercado = m;
  const l = LIMITES[m];
  desl.limites(l.min, l.max);
  $("mini-min").textContent = pesos(l.min);
  $("mini-max").textContent = pesos(l.max);
  desl.fijar(l.inicial);
}

document.querySelectorAll('input[name="mini-mercado"]').forEach((r) =>
  r.addEventListener("change", () => cambiarMercado(r.value))
);
cambiarMercado("industrial");

// ---------------------------------------------------------------- Esquemas "Cómo funciona"

const cajaEsquema = $("esquema-inicio");
const tabs = [...document.querySelectorAll("#tabs-esquema button")];
let esquemaActual = null;

function mostrarEsquema(clave, { auto = true } = {}) {
  esquemaActual?.detener();
  esquemaActual = montarEsquema(cajaEsquema, clave, { auto });
  tabs.forEach((t) => t.setAttribute("aria-pressed", String(t.dataset.clave === clave)));
}
tabs.forEach((t) => t.addEventListener("click", () => mostrarEsquema(t.dataset.clave)));
mostrarEsquema("cogeneracion");

// ---------------------------------------------------------------- Un día con paneles

const campana = (h, centro, ancho) => Math.exp(-((h - centro) ** 2) / (2 * ancho ** 2));
// Planta de dos turnos: consumo alto y parejo de 6 am a 10 pm
const consumo = (h) => 0.3 + 0.6 / ((1 + Math.exp(-(h - 6) * 1.6)) * (1 + Math.exp((h - 22) * 1.6)));
const solar = (h) => (h > 6.5 && h < 19.5 ? 0.62 * Math.sin((Math.PI * (h - 6.5)) / 13) ** 1.6 : 0);

const DIA = { W: 700, H: 250, izq: 8, der: 8, arr: 12, aba: 8, max: 1.08 };
const dx = (h) => DIA.izq + (h / 24) * (DIA.W - DIA.izq - DIA.der);
const dy = (v) => DIA.arr + (1 - v / DIA.max) * (DIA.H - DIA.arr - DIA.aba);

function dibujarDia() {
  const horas = Array.from({ length: 97 }, (_, i) => i / 4);
  const linea = (f) => horas.map((h, i) => `${i ? "L" : "M"}${dx(h).toFixed(1)} ${dy(f(h)).toFixed(1)}`).join(" ");
  const area = (arriba, abajo) =>
    linea(arriba) + " " + [...horas].reverse().map((h) => `L${dx(h).toFixed(1)} ${dy(abajo(h)).toFixed(1)}`).join(" ") + " Z";
  const cero = () => 0;
  $("dia-grafica").innerHTML = `
    <svg viewBox="0 0 ${DIA.W} ${DIA.H}" role="img" aria-label="Consumo de una casa y generación solar a lo largo de un día">
      <path class="a-red" d="${area(consumo, cero)}"/>
      <path class="a-sobra" d="${area((h) => Math.max(consumo(h), solar(h)), consumo)}"/>
      <path class="a-solar" d="${area((h) => Math.min(consumo(h), solar(h)), cero)}"/>
      <path class="l-solar" d="${linea(solar)}"/>
      <path class="l-consumo" d="${linea(consumo)}"/>
      <path class="eje" d="M${DIA.izq} ${dy(0)} H${DIA.W - DIA.der}"/>
      <line class="marca" id="dia-marca" y1="${DIA.arr}" y2="${dy(0)}"/>
      <circle class="punto" id="dia-p-solar" r="7" fill="#f5b82e"/>
      <circle class="punto" id="dia-p-consumo" r="7" fill="#0e1b2c"/>
    </svg>`;
}

function horaTexto(h) {
  const hh = Math.floor(h);
  const mm = h % 1 ? "30" : "00";
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${hh < 12 ? "am" : "pm"}`;
}

function moverHora(h) {
  const c = consumo(h);
  const s = solar(h);
  $("dia-marca").setAttribute("x1", dx(h));
  $("dia-marca").setAttribute("x2", dx(h));
  $("dia-p-solar").setAttribute("cx", dx(h));
  $("dia-p-solar").setAttribute("cy", dy(s));
  $("dia-p-consumo").setAttribute("cx", dx(h));
  $("dia-p-consumo").setAttribute("cy", dy(c));
  let texto;
  if (s < 0.02) texto = "Sin generación fotovoltaica. La carga se cubre con el generador a gas, el banco de baterías o la red de CFE.";
  else if (s >= c) texto = "La generación fotovoltaica supera la carga. El excedente se inyecta a la red y lo registra el medidor bidireccional.";
  else texto = `El campo fotovoltaico cubre cerca del ${Math.round((s / c) * 100)} % de la carga en ese momento; el resto lo aportan el generador o CFE.`;
  $("dia-texto").innerHTML = `<strong>${horaTexto(h)}</strong><br>${texto}`;
  const rango = $("dia-hora");
  rango.style.setProperty("--pct", `${(h / 23.5) * 100}%`);
}

dibujarDia();
$("dia-hora").addEventListener("input", (ev) => moverHora(Number(ev.target.value)));
moverHora(13);
