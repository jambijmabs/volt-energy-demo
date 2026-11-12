import { calcularSolar } from "./calculos.js";
import {
  cargarParametros, pesos, numero, semaforoHtml, avisosHtml, conectarAcciones, htmlAcciones, actualizarWhatsApp, bandaHtml,
} from "./comun.js";
import { montarEsquemasDeclarados } from "./esquemas.js";
import { conectarDeslizador, conectarDeslizadorLineal } from "./deslizador.js";

const P = await cargarParametros();
const $ = (id) => document.getElementById(id);
const form = $("form-solar");
let modo = "rapido";
let ultimo = null;

const LIMITES = {
  residencial: { monto: [300, 30000, 2500], m2: [5, 300, 60] },
  comercial: { monto: [1000, 300000, 15000], m2: [10, 3000, 200] },
  industrial: { monto: [20000, 3000000, 250000], m2: [50, 30000, 3000] },
};

// ---------------------------------------------------------------- Controles

for (const c of P.solar.hsp_ciudades) form.ciudad.add(new Option(c.ciudad, c.hsp));
form.ciudad.add(new Option("Otra ciudad", P.solar.hsp_otra));
form.ciudad.selectedIndex = Math.max(0, P.solar.hsp_ciudades.findIndex((c) => c.ciudad === "Monterrey"));

const deslMonto = conectarDeslizador({ rango: $("monto-mes"), numero: $("monto-mes-num"), min: 300, max: 30000, paso: 50, alCambiar: () => calcular() });
const deslM2 = conectarDeslizador({ rango: $("m2"), numero: $("m2-num"), min: 5, max: 300, paso: 1, alCambiar: () => calcular() });

function fijarMercado(m, monto) {
  const l = LIMITES[m];
  deslMonto.limites(l.monto[0], l.monto[1]).fijar(monto ?? l.monto[2], { silencioso: true });
  deslM2.limites(l.m2[0], l.m2[1]).fijar(l.m2[2], { silencioso: true });
  if (!form.diasPeriodo.value || modo === "rapido") form.diasPeriodo.value = m === "residencial" ? 60 : 30;
}

function cambiarModo(nuevo) {
  modo = nuevo;
  $("modo-rapido").setAttribute("aria-pressed", String(nuevo === "rapido"));
  $("modo-recibo").setAttribute("aria-pressed", String(nuevo === "recibo"));
  $("bloque-rapido").hidden = nuevo !== "rapido";
  $("bloque-recibo").hidden = nuevo !== "recibo";
  calcular();
}
$("modo-rapido").addEventListener("click", () => cambiarModo("rapido"));
$("modo-recibo").addEventListener("click", () => cambiarModo("recibo"));

form.addEventListener("input", (ev) => {
  if (ev.target.type === "range" || ev.target.id?.endsWith("-num")) return; // los deslizadores ya recalculan
  calcular();
});
form.addEventListener("change", (ev) => {
  if (ev.target.name === "mercado") fijarMercado(ev.target.value);
  calcular();
});
form.addEventListener("submit", (ev) => ev.preventDefault());

// ---------------------------------------------------------------- Cálculo

function leerEntrada() {
  const mercado = form.mercado.value;
  const base = {
    mercado,
    hsp: Number(form.ciudad.value),
    ciudad: form.ciudad.selectedOptions[0].text,
    tarifa: form.tarifa.value,
    m2: deslM2.valor,
    techo: "losa",
    sombra: "ninguna",
  };
  if (modo === "rapido") {
    const precio = P.solar.precio_kwh_sin_recibo[base.tarifa === "DAC" ? "dac" : mercado];
    return { ...base, kwhPeriodo: deslMonto.valor / precio, diasPeriodo: 30, montoPeriodo: 0, montoMes: deslMonto.valor };
  }
  return {
    ...base,
    kwhPeriodo: Number(form.kwhPeriodo.value),
    diasPeriodo: Number(form.diasPeriodo.value),
    montoPeriodo: Number(form.montoPeriodo.value) || 0,
  };
}

function calcular() {
  const e = leerEntrada();
  if (!(e.kwhPeriodo > 0) || !(e.diasPeriodo >= 28 && e.diasPeriodo <= 62) || !(e.m2 > 0)) {
    $("avisos").innerHTML = `<p class="aviso">Completa los kWh, los días del periodo (28 a 62) y la superficie para ver tu estimado.</p>`;
    return;
  }
  const r = calcularSolar(e, P);
  pintar(e, r);
  const resumen =
    `Solar ${e.mercado}, ${e.ciudad}. Sistema ~${numero(r.kwp, 1)} kWp (${r.paneles} paneles). ` +
    `Inversión ${pesos(r.inversion.bajo)} – ${pesos(r.inversion.alto)} + IVA. Ahorro ${pesos(r.ahorro.bajo)} – ${pesos(r.ahorro.alto)} al mes.`;
  ultimo = {
    origen: "solar",
    mercado: e.mercado,
    entrada: e,
    resultado: r,
    extra: { gastoLuz: r.kwhMes * r.precioKwh },
    resumen,
  };
  actualizarWhatsApp($("resultados"), resumen);
}

// ---------------------------------------------------------------- Dibujo

const SEMAFORO = {
  verde: "Buen candidato para solar",
  amarillo: "Viable, con puntos a revisar",
  rojo: "Requiere visita antes de estimar",
};
const LIMITE = {
  consumo: "El tamaño lo marca tu consumo: cabe de sobra.",
  techo: "El tamaño lo marca el espacio: tu consumo pediría más paneles.",
  tope: "Llegamos al tope de este estimado: tu caso es un proyecto a la medida.",
};

function pintar(e, r) {
  $("semaforo").innerHTML = semaforoHtml(r.semaforo, SEMAFORO[r.semaforo]);
  $("avisos").innerHTML = avisosHtml(r.avisos);

  $("k-kwp").innerHTML = `${numero(r.kwp, 1)} <small>kWp</small>`;
  $("k-paneles").textContent = `${r.paneles} paneles de ${P.solar.panel_w} W`;
  $("k-gen").innerHTML = `${numero(r.generacionMes)} <small>kWh</small>`;
  $("k-consumo").textContent = `consumes ${numero(r.kwhMes)} kWh`;
  $("k-ahorro").textContent = pesos(r.ahorro.base);
  $("k-inv").textContent = pesos(r.inversion.base);

  pintarTecho(e, r);

  // Dona de cobertura
  const cobertura = Math.min(r.generacionMes, r.kwhMes) / r.kwhMes;
  const circ = 2 * Math.PI * 52;
  $("dona").setAttribute("stroke-dasharray", `${cobertura * circ} ${circ}`);
  $("dona-txt").textContent = `${Math.round(cobertura * 100)} %`;
  $("dona-svg").setAttribute("aria-label", `Los paneles cubren ${Math.round(cobertura * 100)} % de tu consumo`);
  $("cob-gen").textContent = `${numero(r.generacionMes)} kWh`;
  $("cob-con").textContent = `${numero(r.kwhMes)} kWh`;
  $("cob-meta").textContent = `${Math.round(P.solar.meta_cobertura * 100)} %`;

  // Recibo antes / después
  const antes = r.kwhMes * r.precioKwh;
  const despues = Math.max(0, antes - r.ahorro.base);
  const despuesMin = Math.max(0, antes - r.ahorro.alto);
  const despuesMax = Math.max(0, antes - r.ahorro.bajo);
  $("b-antes").textContent = pesos(antes);
  $("b-despues").textContent = `${pesos(despuesMin)} – ${pesos(despuesMax)}`;
  $("b-antes-barra").style.width = "100%";
  $("b-despues-barra").style.width = `${(despues / antes) * 100}%`;
  $("b-rango").style.left = `${(despuesMin / antes) * 100}%`;
  $("b-rango").style.width = `${((despuesMax - despuesMin) / antes) * 100}%`;

  pintarBanda($("banda-ahorro"), r.ahorro);
  pintarBanda($("banda-inv"), r.inversion);
  $("inv-iva").textContent = `Con IVA: ${pesos(r.inversionConIva.bajo)} – ${pesos(r.inversionConIva.alto)}. Incluye estructura, cableado, trámite CFE y medidor.`;

  const acciones = $("acciones");
  if (!acciones.dataset.listo) {
    acciones.innerHTML = htmlAcciones();
    acciones.dataset.listo = "1";
  }
  pintarComo(e, r);
}

function pintarTecho(e, r) {
  const s = P.solar;
  const espacios = r.espacios;
  const maxCeldas = 96;
  const escala = Math.max(1, Math.ceil(espacios / maxCeldas));
  const celdas = Math.max(1, Math.ceil(espacios / escala));
  const llenas = Math.min(celdas, Math.ceil(r.paneles / escala));
  const techo = $("techo");
  const columnas = Math.min(12, Math.max(4, Math.ceil(Math.sqrt(celdas * 1.6))));
  techo.style.gridTemplateColumns = `repeat(${columnas}, 1fr)`;
  if (techo.children.length !== celdas) techo.innerHTML = "<i></i>".repeat(celdas);
  [...techo.children].forEach((c, i) => c.classList.toggle("on", i < llenas));
  $("techo-escala").textContent = escala > 1 ? `cada cuadro = ${escala} paneles` : "";
  $("ley-paneles").textContent = `${r.paneles} paneles`;
  $("ley-libre").textContent = `espacio para ${espacios}`;
  $("limite").textContent = r.techoInsuficiente
    ? `Con ${numero(e.m2)} m² no caben ni 2 paneles; revisemos otra superficie en la visita.`
    : LIMITE[r.limitadoPor];
}

function pintarBanda(el, rango) {
  el.innerHTML = bandaHtml(rango);
}

function pintarComo(e, r) {
  const s = P.solar;
  const filas = [
    ["Consumo mensual", `${numero(r.kwhMes)} kWh`, modo === "rapido" ? "Tu pago ÷ precio promedio por kWh" : "kWh del recibo × 30 ÷ días del periodo"],
    ["Precio por kWh", `$${numero(r.precioKwh, 2)}`, r.precioEstimado ? "Promedio de mercado (sin recibo)" : "Total del recibo ÷ kWh (incluye IVA)"],
    ["Horas de sol pico", `${numero(e.hsp, 1)} h`, e.ciudad],
    ["Rendimiento del sistema", `${numero(s.pr_sistema * 100)} %`, "Pérdidas por calor, cableado e inversor"],
    ["Meta de cobertura", `${numero(s.meta_cobertura * 100)} %`, "Para no producir de más"],
    ["Panel", `${s.panel_w} W · ${s.m2_por_panel} m²`, "Espacio por panel con pasillos"],
    ["Precio instalado", `${pesos(r.costoKwp)}/kWp`, "Según tamaño del sistema y tipo de techo, sin IVA"],
    ["Factor de ahorro", `${numero(r.factorAhorro * 100)} %`, "Descuenta cargos fijos y de demanda"],
    ["Rango", "−10 % / +15 %", "Inversión; ahorro ±15 %"],
  ];
  $("como").innerHTML = filas.map((f) => `<tr><td>${f[0]}</td><td>${f[1]}</td><td>${f[2]}</td></tr>`).join("");
}

conectarAcciones($("resultados"), () => ultimo);

// ---------------------------------------------------------------- Arranque

// Desde la portada llega #p-<monto>-<mercado>
const m = location.hash.match(/^#p-(\d+)-(residencial|comercial|industrial)(?:-(dac|gdmth))?$/);
if (m) {
  form.querySelector(`input[name="mercado"][value="${m[2]}"]`).checked = true;
  fijarMercado(m[2], Number(m[1]));
  if (m[3]) form.tarifa.value = m[3].toUpperCase();
  // Arranca con espacio suficiente para el sistema que pide ese consumo
  const previo = calcularSolar({ ...leerEntrada(), m2: 1e7 }, P);
  const lim = LIMITES[m[2]].m2;
  deslM2.fijar(Math.min(lim[1], Math.max(lim[2], Math.ceil((previo.paneles * P.solar.m2_por_panel * 1.15) / 5) * 5)), { silencioso: true });
  $("es-ejemplo").textContent = "Partimos del pago que elegiste. Agrega tu techo y tu recibo para afinar.";
} else {
  fijarMercado("residencial");
}
form.kwhPeriodo.value = 900;
form.diasPeriodo.value = 60;
form.montoPeriodo.value = 4500;
calcular();

montarEsquemasDeclarados();
