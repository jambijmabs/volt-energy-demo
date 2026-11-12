import { calcularSolar } from "./calculos.js";
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

// ---------------------------------------------------------------- Mini-cotizador

const LIMITES = {
  residencial: { min: 300, max: 30000, inicial: 2500 },
  comercial: { min: 1000, max: 300000, inicial: 15000 },
  industrial: { min: 20000, max: 3000000, inicial: 250000 },
};
const CIUDAD = P.solar.hsp_ciudades.find((c) => c.ciudad === "Monterrey") ?? { ciudad: "Monterrey", hsp: P.solar.hsp_otra };
let mercado = "residencial";

const desl = conectarDeslizador({
  rango: $("mini-monto"),
  numero: $("mini-monto-num"),
  min: LIMITES.residencial.min,
  max: LIMITES.residencial.max,
  paso: 50,
  alCambiar: calcular,
});

function calcular(monto) {
  if (!(monto > 0)) return;
  const precio = P.solar.precio_kwh_sin_recibo[mercado];
  // Modo rápido: solo sabemos cuánto paga; estimamos kWh con un precio promedio y suponemos espacio suficiente.
  const r = calcularSolar(
    { mercado, hsp: CIUDAD.hsp, tarifa: "no_se", kwhPeriodo: monto / precio, diasPeriodo: 30, montoPeriodo: 0, m2: 1e6, techo: "losa", sombra: "ninguna" },
    P
  );
  $("mini-kwp").innerHTML = `${numero(r.kwp, 1)} <small>kWp</small>`;
  $("mini-paneles").textContent = numero(r.paneles);
  $("mini-ahorro").innerHTML = `${pesos(r.ahorro.bajo)} – ${pesos(r.ahorro.alto)}`;
  $("mini-inv").innerHTML = `${pesos(r.inversion.bajo)} – ${pesos(r.inversion.alto)} <small>+ IVA</small>`;
  $("mini-nota").textContent =
    `Supone ${CIUDAD.ciudad}, espacio suficiente y un precio promedio de $${numero(precio, 2)}/kWh. ` +
    (r.limitadoPor === "tope" ? "Tu consumo pide un proyecto a la medida. " : "") +
    "Con tu recibo real el número se afina.";
  $("mini-ir").href = `cotizador.html#p-${Math.round(monto)}-${mercado}`;
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
cambiarMercado("residencial");

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
mostrarEsquema("solar");

// ---------------------------------------------------------------- Un día con paneles

const campana = (h, centro, ancho) => Math.exp(-((h - centro) ** 2) / (2 * ancho ** 2));
const consumo = (h) => 0.3 + 0.18 * campana(h, 7.5, 1.2) + 0.12 * campana(h, 14, 3) + 0.5 * campana(h, 20.5, 1.8);
const solar = (h) => (h > 6.5 && h < 19.5 ? Math.sin((Math.PI * (h - 6.5)) / 13) ** 1.6 : 0);

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
  if (s < 0.02) texto = "No hay sol. Toda tu energía viene de CFE; es cuando una batería puede entrar al relevo.";
  else if (s >= c) texto = "Tus paneles producen más de lo que usas. El sobrante se va a la red y el medidor lo cuenta a tu favor.";
  else texto = `Los paneles cubren cerca del ${Math.round((s / c) * 100)} % de lo que usas en este momento; el resto viene de CFE.`;
  $("dia-texto").innerHTML = `<strong>${horaTexto(h)}</strong><br>${texto}`;
  const rango = $("dia-hora");
  rango.style.setProperty("--pct", `${(h / 23.5) * 100}%`);
}

dibujarDia();
$("dia-hora").addEventListener("input", (ev) => moverHora(Number(ev.target.value)));
moverHora(13);
