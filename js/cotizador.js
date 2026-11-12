// Cotizador integrado: una o varias tecnologías en el mismo sistema.
// Arranca con una propuesta sugerida según el tipo de inmueble y el consumo; cada tecnología se puede
// incluir o quitar, y los totales se recalculan al momento.
import {
  calcularSolar, calcularBaterias, calcularGenerador, calcularCogeneracionModular, puntajeCogeneracion, calcularFinanciamiento,
  ahorroCogeneracion,
} from "./calculos.js";
import {
  cargarParametros, pesos, numero, avisosHtml, conectarAcciones, htmlAcciones, actualizarWhatsApp, bandaHtml,
} from "./comun.js";
import { conectarDeslizador } from "./deslizador.js";
import { montarRed } from "./red.js";
import { leerRecibo } from "./recibo.js";
import { descargarPropuesta, svgConEstilos } from "./propuesta.js";

const P = await cargarParametros();
const $ = (id) => document.getElementById(id);
const form = $("form-cot");
const NOMBRE = { residencial: "una casa", comercial: "un negocio", industrial: "una industria" };
const LIMITES = {
  residencial: { monto: [300, 30000, 2500], m2: [5, 300, 60] },
  comercial: { monto: [1000, 300000, 25000], m2: [10, 3000, 300] },
  industrial: { monto: [20000, 3000000, 300000], m2: [50, 30000, 3000] },
};
const TEC = ["solar", "baterias", "gas"];
const incluir = { solar: true, baterias: false, gas: false };
const manual = { solar: false, baterias: false, gas: false };
let modo = "rapido";
let ultimo = null;
let historialRecibo = []; // kWh de periodos anteriores leídos del recibo

// ---------------------------------------------------------------- Controles

for (const c of P.solar.hsp_ciudades) form.ciudad.add(new Option(c.ciudad, c.hsp));
form.ciudad.add(new Option("Otra ciudad", P.solar.hsp_otra));
form.ciudad.selectedIndex = Math.max(0, P.solar.hsp_ciudades.findIndex((c) => c.ciudad === "Monterrey"));

const deslMonto = conectarDeslizador({ rango: $("monto-mes"), numero: $("monto-mes-num"), min: 300, max: 30000, paso: 50, alCambiar: () => calcular() });
const deslM2 = conectarDeslizador({ rango: $("m2"), numero: $("m2-num"), min: 5, max: 300, paso: 1, alCambiar: () => calcular() });
const red = montarRed($("red-cot"));
$("gas-kw").append(
  new Option("Automático (según tu consumo)", "auto"),
  ...P.generador_gas.tamanos_comerciales_kw.map((k) => new Option(`${k} kW`, k)),
  ...Array.from({ length: P.cogeneracion.referencia.max_modulos }, (_, i) =>
    new Option(`${i + 1} ${i ? "módulos" : "módulo"} de ~0.5 MW (${((i + 1) * P.cogeneracion.referencia.potencia_kw).toLocaleString("es-MX")} kW)`, `m${i + 1}`)
  )
);
$("gas-metros").value = P.generador_gas.metros_gas_incluidos;
$("gas-precio").value = P.cogeneracion.referencia.precio_gas_gj_ejemplo;

function fijarMercado(m, monto) {
  const l = LIMITES[m];
  deslMonto.limites(l.monto[0], l.monto[1]).fijar(monto ?? l.monto[2], { silencioso: true });
  deslM2.limites(l.m2[0], l.m2[1]).fijar(l.m2[2], { silencioso: true });
  $("grupo-operacion").hidden = m === "residencial";
  form.horasOperacion.value = m === "industrial" ? "16" : "12";
  $("bat-perfil").innerHTML =
    m === "residencial"
      ? `<option value="basico">Lo básico (refri, luces, internet)</option><option value="casa" selected>Toda la casa</option><option value="casa_aire">Casa con aire</option>`
      : `<option value="negocio" selected>Toda la operación</option><option value="manual">Solo lo esencial (kW)</option>`;
  $("bat-kw-caja").hidden = true;
}

function cambiarModo(nuevo) {
  modo = nuevo;
  $("modo-rapido").setAttribute("aria-pressed", String(nuevo === "rapido"));
  $("modo-recibo").setAttribute("aria-pressed", String(nuevo === "recibo"));
  $("bloque-rapido").hidden = nuevo !== "rapido";
  $("bloque-recibo").hidden = nuevo !== "recibo";
}
$("modo-rapido").addEventListener("click", () => { cambiarModo("rapido"); calcular(); });
$("modo-recibo").addEventListener("click", () => { cambiarModo("recibo"); calcular(); });

// Subir recibo: se lee en el navegador y se llenan los campos para confirmar
$("recibo-archivo").addEventListener("change", async (ev) => {
  const archivo = ev.target.files[0];
  if (!archivo) return;
  const msg = $("recibo-msg");
  msg.hidden = false;
  msg.textContent = "Leyendo tu recibo…";
  const { datos, mensaje } = await leerRecibo(archivo);
  if (datos.kwh) form.kwhPeriodo.value = datos.kwh;
  if (datos.dias) form.diasPeriodo.value = datos.dias;
  if (datos.total) form.montoPeriodo.value = datos.total;
  historialRecibo = (datos.historial ?? []).map((x) => x.kwh);
  if (datos.tarifa) {
    const t = /^1[A-F]$/.test(datos.tarifa) ? "1A-1F" : datos.tarifa;
    if ([...form.tarifa.options].some((o) => o.value === t)) form.tarifa.value = t;
  }
  msg.textContent = mensaje;
  cambiarModo("recibo");
  calcular();
});

document.querySelectorAll("#resultados input, #resultados select").forEach((el) => {
  el.addEventListener("change", (ev) => {
    const t = ev.target.dataset.incluir;
    if (t) { incluir[t] = ev.target.checked; manual[t] = true; }
    if (ev.target.id === "bat-perfil") $("bat-kw-caja").hidden = ev.target.value !== "manual";
    calcular();
  });
  if (el.type === "number") el.addEventListener("input", () => calcular());
});
form.addEventListener("input", (ev) => {
  if (ev.target.type === "range" || ev.target.id?.endsWith("-num") || ev.target.type === "file") return;
  if (ev.target.name === "kwhPeriodo") historialRecibo = []; // si corrige el consumo a mano, ya no aplica el historial leído
  calcular();
});
form.addEventListener("change", (ev) => {
  if (ev.target.name === "mercado") fijarMercado(ev.target.value);
  if (ev.target.type !== "file") calcular();
});
form.addEventListener("submit", (ev) => ev.preventDefault());

// ---------------------------------------------------------------- Cálculo

function leerConsumo() {
  const mercado = form.mercado.value;
  const tarifa = form.tarifa.value;
  if (modo === "rapido") {
    const precio = P.solar.precio_kwh_sin_recibo[tarifa === "DAC" ? "dac" : mercado];
    return { kwhPeriodo: deslMonto.valor / precio, diasPeriodo: 30, montoPeriodo: 0, pagoMes: deslMonto.valor };
  }
  const kwh = Number(form.kwhPeriodo.value), dias = Number(form.diasPeriodo.value), monto = Number(form.montoPeriodo.value) || 0;
  const precio = monto > 0 ? monto / kwh : P.solar.precio_kwh_sin_recibo[tarifa === "DAC" ? "dac" : mercado];
  const periodos = [kwh, ...historialRecibo];
  const promedio = periodos.reduce((a, b) => a + b, 0) / periodos.length;
  return { kwhPeriodo: kwh, diasPeriodo: dias, montoPeriodo: monto, historial: historialRecibo, pagoMes: promedio * (30 / dias) * precio };
}

function calcular() {
  const mercado = form.mercado.value;
  const c = leerConsumo();
  if (!(c.kwhPeriodo > 0) || !(c.diasPeriodo >= 28 && c.diasPeriodo <= 62) || !(deslM2.valor > 0)) {
    $("avisos").innerHTML = `<p class="aviso">Completa los kWh, los días del periodo (28 a 62) y el espacio libre para ver tu propuesta.</p>`;
    return;
  }
  const horasOp = mercado === "residencial" ? 24 : Number(form.horasOperacion.value);
  const gas = mercado === "residencial" ? "no" : form.gas.value;

  // Solar: se asume instalación con poca o nula sombra
  const eSolar = {
    mercado, hsp: Number(form.ciudad.value), ciudad: form.ciudad.selectedOptions[0].text, tarifa: form.tarifa.value,
    ...c, m2: deslM2.valor, techo: "losa", sombra: "ninguna",
  };
  const solar = calcularSolar(eSolar, P);
  const kwhMes = solar.kwhMes;

  // Baterías
  const perfil = $("bat-perfil").value;
  const eBat = {
    perfil, horasRespaldo: Number(form.horasRespaldo.value), yaTieneSolar: incluir.solar ? "si" : "no",
    kwhMes, horasOperacion: horasOp, cargaKw: Number($("bat-kw").value) || 1,
  };
  const bat = calcularBaterias(eBat, P);

  // Cogeneración: equipo estándar si la carga cabe; si no, proyecto industrial a la medida
  const cargaKw = kwhMes / (30 * horasOp);
  const puntaje = puntajeCogeneracion(
    { gastoLuz: c.pagoMes, horas: horasOp >= 20 ? "20-24" : horasOp >= 16 ? "16" : "8", gas: gas === "si" ? "si_ducto" : gas, calor: "no_se", demandaKw: cargaKw },
    P
  );
  // Cogeneración: equipo estándar (hasta 200 kW) o módulos industriales de ~0.5 MW, según la carga o lo que elija
  const tam = $("gas-kw").value;
  const maxEquipo = P.generador_gas.tamanos_comerciales_kw.at(-1);
  const equipo = (kwElegido) =>
    calcularGenerador({ cargaKw, kwElegido, metrosGas: Number($("gas-metros").value) || 0, gabinete: $("gas-gabinete").checked, gas }, P);
  let gen = null;
  let modular = null;
  if (tam.startsWith("m")) modular = calcularCogeneracionModular({ cargaKw, modulos: Number(tam.slice(1)) }, P);
  else if (tam !== "auto") gen = equipo(Number(tam));
  else {
    gen = equipo();
    if (gen.excede) {
      if (cargaKw <= maxEquipo) gen = equipo(maxEquipo);
      else { gen = null; modular = calcularCogeneracionModular({ cargaKw }, P); }
    }
  }

  // Ahorro y recuperación de la Cogeneración: costo de generar (gas + mantenimiento) contra lo que se deja de pagar a CFE
  const R = P.cogeneracion.referencia;
  const cogBase = modular ?? gen;
  const precioGas = Number($("gas-precio").value) || R.precio_gas_gj_ejemplo;
  const ahorroCog = ahorroCogeneracion(
    {
      kwhMes, cargaKw, horasOp, precioKwh: solar.precioKwh, precioGasGj: precioGas, kwCapacidad: cogBase.kw,
      gjPorKwh: modular ? R.gas_gj_h / (R.potencia_kw * R.carga_recomendada) : P.generador_gas.gas_m3h_por_kw * P.generador_gas.gj_por_m3,
      mantenimientoAnual: modular ? modular.polizaAnual : gen.mantenimientoAnual,
      inversion: cogBase.total,
    },
    P
  );

  // Propuesta sugerida
  const sugerido = {
    solar: !solar.techoInsuficiente,
    baterias: form.apagones.value === "si",
    gas: mercado !== "residencial" && gas === "si" && puntaje.puntaje >= P.cogeneracion.puntaje.umbral_amarillo,
  };
  for (const t of TEC) if (!manual[t]) incluir[t] = sugerido[t];
  if (mercado === "residencial") incluir.gas = false;
  for (const t of TEC) $(`inc-${t}`).checked = incluir[t];

  pintar({ mercado, c, horasOp, gas, eSolar, solar, eBat, bat, cargaKw, puntaje, gen, modular, ahorroCog, precioGas, sugerido });
}

// ---------------------------------------------------------------- Dibujo

function mini(etq, val, det = "") {
  return `<div class="tec__dato"><div class="etq">${etq}</div><div class="val">${val}</div>${det ? `<div class="det">${det}</div>` : ""}</div>`;
}

function pintar(d) {
  const { mercado, c, solar, bat, gen, modular, ahorroCog, puntaje, sugerido } = d;
  const R = P.cogeneracion.referencia;
  $("avisos").innerHTML = avisosHtml(incluir.solar ? solar.avisos.filter((a) => !a.startsWith("No capturaste")) : []);

  // Propuesta en palabras
  const razones = [
    sugerido.solar
      ? `<li class="si"><strong>Paneles solares.</strong> Cubren cerca del ${numero((Math.min(solar.generacionMes, solar.kwhMes) / solar.kwhMes) * 100)} % de tu consumo.</li>`
      : `<li><strong>Paneles solares.</strong> El espacio que indicaste no alcanza; revisemos otra superficie.</li>`,
    sugerido.baterias
      ? `<li class="si"><strong>Baterías.</strong> Pediste respaldo para cuando se va la luz.</li>`
      : `<li><strong>Baterías.</strong> Opcionales: agrégalas si no puedes quedarte sin luz.</li>`,
    mercado === "residencial"
      ? ""
      : sugerido.gas
        ? `<li class="si"><strong>Cogeneración.</strong> Tienes gas natural y tu operación la justifica (${puntaje.puntaje} de 100).</li>`
        : d.gas !== "si"
          ? `<li><strong>Cogeneración.</strong> Requiere gas natural de ducto en tu sitio.</li>`
          : `<li><strong>Cogeneración.</strong> Con tu consumo y horario aún no es el caso típico (${puntaje.puntaje} de 100).</li>`,
  ];
  $("propuesta-titulo").textContent = `Para ${NOMBRE[mercado]} que paga ${pesos(c.pagoMes)} al mes`;
  $("propuesta-razones").innerHTML = razones.join("");

  // Tarjetas
  $("tec-gas").hidden = mercado === "residencial";
  for (const t of TEC) $(`tec-${t}`).classList.toggle("tec--fuera", !incluir[t]);

  const escalar = (r, f) => ({ bajo: r.bajo * f, base: r.base * f, alto: r.alto * f });
  let ahorroSolar = incluir.solar && !solar.techoInsuficiente ? solar.ahorro : null;
  if (ahorroSolar && incluir.gas) {
    // Si la Cogeneración ya cubre parte del consumo, los paneles solo ahorran sobre lo que queda
    const usable = Math.max(0, solar.kwhMes - ahorroCog.kwhGen);
    const original = Math.min(solar.generacionMes, solar.kwhMes);
    ahorroSolar = escalar(ahorroSolar, original > 0 ? Math.min(1, usable / original) : 0);
  }
  const ahorroGas = incluir.gas && ahorroCog.ahorro.base > 0 ? ahorroCog.ahorro : null;
  const fuentes = [ahorroSolar && ahorroSolar.base > 0 && "paneles", ahorroGas && "Cogeneración"].filter(Boolean);
  const ahorro = fuentes.length
    ? [ahorroSolar, ahorroGas].filter((r) => r && r.base > 0).reduce((a, r) => ({ bajo: a.bajo + r.bajo, base: a.base + r.base, alto: a.alto + r.alto }), { bajo: 0, base: 0, alto: 0 })
    : null;

  $("pre-solar").textContent = `${pesos(solar.inversion.bajo)} – ${pesos(solar.inversion.alto)}`;
  $("cuerpo-solar").innerHTML = solar.techoInsuficiente
    ? `<p class="nota">Con ${numero(d.eSolar.m2)} m² no caben ni 2 paneles.</p>`
    : mini("Sistema", `${numero(solar.kwp, 1)} kWp`, `${solar.paneles} paneles · ${numero(solar.m2Usados)} m²`) +
      mini("Genera al mes", `${numero(solar.generacionMes)} kWh`, `consumes ${numero(solar.kwhMes)} kWh`) +
      mini(
        "Ahorro al mes",
        ahorroSolar && ahorroSolar.base > 0 ? `${pesos(ahorroSolar.bajo)} – ${pesos(ahorroSolar.alto)}` : "—",
        incluir.gas && incluir.solar
          ? ahorroSolar && ahorroSolar.base > 0 ? "sobre lo que no cubre la Cogeneración" : "la Cogeneración ya cubre tu consumo"
          : solar.limitadoPor === "techo" ? "limitado por el espacio" : ""
      );

  $("pre-baterias").textContent = `${pesos(bat.total.bajo)} – ${pesos(bat.total.alto)}`;
  $("cuerpo-baterias").innerHTML =
    mini("Batería", `${numero(bat.capacidadKwh, 1)} kWh`, `${bat.modulos} ${bat.modulos === 1 ? "módulo" : "módulos"}`) +
    mini("Respalda", `${numero(bat.cargaKw, 1)} kW`, `durante ${numero(bat.autonomiaHoras, 1)} h`) +
    mini("Inversor", `${bat.inversor.cantidad > 1 ? bat.inversor.cantidad + " × " : ""}${bat.inversor.kw} kW`);

  const cog = modular ?? gen; // lo que entra al presupuesto
  $("gas-extras").hidden = Boolean(modular);
  $("pre-gas").textContent = `${pesos(cog.total.bajo)} – ${pesos(cog.total.alto)}`;
  const rec = ahorroCog.recuperacion;
  const ahorraGas = ahorroCog.ahorro.base > 0;
  const datosAhorroGas =
    mini("Genera al mes", `${numero(ahorroCog.kwhGen)} kWh`, `${numero(ahorroCog.cobertura * 100)} % de tu consumo`) +
    mini("Ahorro al mes", ahorraGas ? `${pesos(ahorroCog.ahorro.bajo)} – ${pesos(ahorroCog.ahorro.alto)}` : "Sin ahorro", ahorraGas ? "gas y mantenimiento ya descontados" : "con estos precios de gas y luz") +
    mini("Recuperación", rec ? `${numero(rec.bajo, 1)} a ${numero(rec.alto, 1)} años` : "—", "orden de magnitud, no garantizado");
  const lineaCosto = `<p class="nota" style="grid-column:1/-1;margin:0">Generar te cuesta cerca de $${numero(ahorroCog.costoKwh, 2)} por kWh (gas a $${numero(d.precioGas)} por GJ más mantenimiento), contra $${numero(ahorroCog.precioEvitado, 2)} por kWh que dejas de pagar a CFE. No incluye el valor del calor aprovechado.</p>`;
  $("cuerpo-gas").innerHTML = modular
    ? mini("Proyecto", `${numero(modular.kw)} kW`, `${modular.modulos} ${modular.modulos === 1 ? "módulo" : "módulos"} de ~0.5 MW`) +
      mini("Cubre", `${numero(modular.cobertura * 100)} %`, `de tu carga promedio de ${numero(d.cargaKw)} kW`) +
      mini("Gas a plena carga", `${numero(modular.gasGjH, 1)} GJ/h`) +
      mini("Póliza de mantenimiento", pesos(modular.polizaAnual), "al año, aparte") +
      mini("Transformador", `${numero(modular.transformadorKva)} kVA`) +
      mini("Espacio", `${numero(modular.espacioM2)} m²`, "cuarto ventilado") +
      datosAhorroGas + lineaCosto +
      `<p class="nota" style="grid-column:1/-1;margin:0">Presupuesto con el precio llave en mano de un módulo de ~${R.potencia_kw} kW de un proyecto ejemplo. Entrega ${R.entrega}; instalación ${R.instalacion}. Tubería adicional, transformador y obra civil se definen en la visita. ${modular.avisos.join(" ")} Candidato: ${puntaje.puntaje} de 100.</p>`
    : mini("Equipo", `${gen.kw} kW`, gen.kw >= gen.necesarioKw ? "cubre tu carga con margen" : gen.kw >= d.cargaKw ? "cubre tu carga, con poco margen" : `cubre cerca del ${numero((gen.kw / d.cargaKw) * 100)} % de tu carga`) +
      mini("Tu carga promedio", `${numero(d.cargaKw, 1)} kW`, `${d.horasOp} h al día`) +
      mini("Gas a plena carga", `${numero(gen.gasM3h, 1)} m³/h`) +
      mini("Mantenimiento", `${pesos(gen.mantenimientoAnual)}`, "al año, aparte") +
      datosAhorroGas + lineaCosto +
      `<p class="nota" style="grid-column:1/-1;margin:0">Los precios y el mantenimiento de equipos de 10 a 200 kW son de referencia para uso de respaldo; para operar todos los días el costo de mantenimiento sube y se confirma con el proveedor.</p>`;

  // Totales
  const partes = [];
  if (incluir.solar && !solar.techoInsuficiente) partes.push(["Paneles solares", solar.inversion]);
  if (incluir.baterias) partes.push(["Baterías", bat.total]);
  if (incluir.gas) partes.push(["Cogeneración", cog.total]);
  const total = partes.reduce((a, [, r]) => ({ bajo: a.bajo + r.bajo, base: a.base + r.base, alto: a.alto + r.alto }), { bajo: 0, base: 0, alto: 0 });
  const iva = 1 + P.general.iva;

  const F = P.financiamiento;

  $("sin-nada").hidden = partes.length > 0;
  $("totales").hidden = partes.length === 0;
  if (partes.length) {
    const fin = calcularFinanciamiento({ monto: total.base * iva, enganchePct: F.enganche, plazoMeses: F.plazo_meses, tasaAnual: F.tasa_anual });
    $("t-inv").textContent = pesos(total.base);
    $("t-inv-det").textContent = `${partes.map(([n]) => n).join(" + ")} · más IVA`;
    $("t-ahorro").textContent = ahorro ? pesos(ahorro.base) : "—";
    $("t-ahorro-det").textContent = ahorro ? `estimado, por ${fuentes.join(" y ")}` : "las baterías solas no bajan el recibo";
    $("t-mensual").textContent = pesos(fin.mensualidad);
    $("t-mensual-det").textContent = `${F.plazo_meses} meses, ${numero(F.enganche * 100)} % de enganche, tasa ${numero(F.tasa_anual * 100)} %`;
    $("t-banda").innerHTML = bandaHtml(total);
    $("t-iva").textContent = `Con IVA: ${pesos(total.bajo * iva)} – ${pesos(total.alto * iva)}.`;
    $("t-desglose").innerHTML = partes.map(([n, r]) => `<tr><td>${n}</td><td>${pesos(r.base)}</td></tr>`).join("") + `<tr class="total"><td>Total base</td><td>${pesos(total.base)}</td></tr>`;
    $("ir-fin").href = `financiamiento.html#m-${Math.round(total.base * iva)}${ahorro ? "-a-" + Math.round(ahorro.base) : ""}`;
  }

  // Ilustración del sistema
  red.incluir({ paneles: incluir.solar && !solar.techoInsuficiente, bateria: incluir.baterias, generador: incluir.gas });

  const acciones = $("acciones");
  if (!acciones.dataset.listo) { acciones.innerHTML = htmlAcciones({ propuesta: true }); acciones.dataset.listo = "1"; }

  const nombres = [incluir.solar && `paneles ${numero(solar.kwp, 1)} kWp`, incluir.baterias && `baterías ${numero(bat.capacidadKwh, 1)} kWh`, incluir.gas && `Cogeneración ${numero(cog.kw)} kW`].filter(Boolean);
  const resumen =
    `Sistema para ${NOMBRE[mercado]} (${pesos(c.pagoMes)} al mes de luz): ${nombres.join(" + ") || "sin equipos"}.` +
    (partes.length ? ` Inversión ${pesos(total.bajo)} – ${pesos(total.alto)} + IVA.` : "") +
    (ahorro ? ` Ahorro ${pesos(ahorro.bajo)} – ${pesos(ahorro.alto)} al mes.` : "");
  const F2 = P.financiamiento;
  const finPdf = partes.length
    ? calcularFinanciamiento({ monto: total.base * iva, enganchePct: F2.enganche, plazoMeses: F2.plazo_meses, tasaAnual: F2.tasa_anual })
    : null;
  const tecnologias = [];
  if (incluir.solar && !solar.techoInsuficiente)
    tecnologias.push({
      nombre: "Paneles solares",
      inversion: solar.inversion,
      datos: [
        ["Sistema", `${numero(solar.kwp, 1)} kWp`], ["Paneles", `${solar.paneles} de ${P.solar.panel_w} W`], ["Espacio", `${numero(solar.m2Usados)} m²`],
        ["Genera al mes", `${numero(solar.generacionMes)} kWh`], ["Tu consumo", `${numero(solar.kwhMes)} kWh al mes`],
        ["Ahorro al mes", ahorroSolar && ahorroSolar.base > 0 ? `${pesos(ahorroSolar.bajo)} – ${pesos(ahorroSolar.alto)}` : "—"],
      ],
      nota: "Incluye estructura, cableado, trámite ante CFE y medidor. Supone poca o nula sombra sobre los paneles.",
    });
  if (incluir.baterias)
    tecnologias.push({
      nombre: "Baterías de respaldo",
      inversion: bat.total,
      datos: [
        ["Capacidad", `${numero(bat.capacidadKwh, 1)} kWh`], ["Módulos", `${bat.modulos} de ${P.baterias.modulo_kwh} kWh`],
        ["Inversor", `${bat.inversor.cantidad > 1 ? bat.inversor.cantidad + " × " : ""}${bat.inversor.kw} kW`],
        ["Respalda", `${numero(bat.cargaKw, 1)} kW`], ["Duración", `${numero(bat.autonomiaHoras, 1)} h`], ["Espacio", `${numero(bat.espacioM2, 1)} m²`],
      ],
      nota: "La batería respalda cuando se va la luz; por sí sola no baja el recibo.",
    });
  if (incluir.gas) {
    const g = [
      ["Potencia", `${numero(cog.kw)} kW`],
      modular ? ["Módulos", `${modular.modulos} de ~0.5 MW`] : ["Tu carga promedio", `${numero(d.cargaKw, 1)} kW`],
      ["Genera al mes", `${numero(ahorroCog.kwhGen)} kWh`],
      ["Ahorro al mes", ahorroGas ? `${pesos(ahorroGas.bajo)} – ${pesos(ahorroGas.alto)}` : "Sin ahorro con estos precios"],
      ["Recuperación", rec ? `${numero(rec.bajo, 1)} a ${numero(rec.alto, 1)} años` : "—"],
      modular ? ["Póliza anual", pesos(modular.polizaAnual)] : ["Mantenimiento anual", pesos(gen.mantenimientoAnual)],
    ];
    if (modular) g.push(["Gas a plena carga", `${numero(modular.gasGjH, 1)} GJ/h`], ["Transformador", `${numero(modular.transformadorKva)} kVA`], ["Espacio", `${numero(modular.espacioM2)} m²`]);
    tecnologias.push({
      nombre: "Cogeneración a gas natural",
      inversion: cog.total,
      datos: g,
      nota: `Costo de generar ~$${numero(ahorroCog.costoKwh, 2)} por kWh (gas a $${numero(d.precioGas)} por GJ y mantenimiento) contra $${numero(ahorroCog.precioEvitado, 2)} por kWh que se deja de pagar a CFE. No incluye el valor del calor aprovechado.${modular ? " Tubería adicional, transformador y obra civil se definen en la visita." : ""}`,
    });
  }
  const escena = document.querySelector("#red-cot .red__escena");
  const propuesta = {
    titulo: `Sistema de energía para ${NOMBRE[mercado]}`,
    resumen: [
      ["Pago de luz", `${pesos(c.pagoMes)} al mes`], ["Consumo", `${numero(solar.kwhMes)} kWh al mes`],
      ["Ciudad", d.eSolar.ciudad], ["Tarifa", d.eSolar.tarifa === "no_se" ? "Sin especificar" : d.eSolar.tarifa],
    ],
    ilustracion: escena ? svgConEstilos(escena.querySelector("svg")) : "",
    tecnologias,
    total,
    iva: P.general.iva,
    indicadores: [
      ["Inversión con IVA", pesos(total.base * iva), "valor base"],
      ["Ahorro al mes", ahorro ? `${pesos(ahorro.bajo)} – ${pesos(ahorro.alto)}` : "—", ahorro ? `por ${fuentes.join(" y ")}` : "sin ahorro estimado"],
      ["O en mensualidades de", finPdf ? pesos(finPdf.mensualidad) : "—", `${F2.plazo_meses} meses, ${numero(F2.enganche * 100)} % de enganche`],
    ],
    supuestos: [
      `Consumo de ${numero(solar.kwhMes)} kWh al mes y precio de $${numero(solar.precioKwh, 2)} por kWh${solar.precioEstimado ? " (promedio, sin recibo)" : " (del recibo, con IVA)"}.`,
      ...(incluir.solar ? [`Paneles: ${numero(d.eSolar.hsp, 1)} horas de sol pico en ${d.eSolar.ciudad}, rendimiento del ${numero(P.solar.pr_sistema * 100)} % y cobertura de hasta el ${numero(P.solar.meta_cobertura * 100)} % del consumo, con poca o nula sombra.`] : []),
      ...(incluir.gas ? [`Cogeneración: ${d.horasOp} horas de operación al día, gas a $${numero(d.precioGas)} por GJ y ${numero(P.cogeneracion.factor_ahorro * 100)} % del precio por kWh como ahorro (descuenta cargos fijos).`] : []),
      `Precios sin IVA; rango de ${numero(P.general.rango_min * 100)} % a +${numero(P.general.rango_max * 100)} % sobre el valor base.`,
      `Mensualidad simulada con tasa anual de ${numero(F2.tasa_anual * 100)} %; no es una oferta de crédito.`,
    ],
    whatsapp: P.config.whatsapp_numero || "",
  };
  ultimo = {
    origen: "sistema", mercado, resumen, propuesta,
    entrada: { ...d.eSolar, incluir: { ...incluir }, bateria: d.eBat, horasOperacion: d.horasOp, gas: d.gas },
    resultado: { solar: incluir.solar ? solar : null, baterias: incluir.baterias ? bat : null, cogeneracion: incluir.gas ? { ...cog, puntaje: puntaje.puntaje } : null, total },
    extra: { gastoLuz: c.pagoMes, puntaje: incluir.gas ? puntaje.puntaje : undefined, gas: d.gas === "si" ? "si_ducto" : d.gas },
  };
  actualizarWhatsApp($("resultados"), resumen);
}

conectarAcciones($("resultados"), () => ultimo, {
  pdf: (lead, contacto, datos) => descargarPropuesta({ ...datos.propuesta, folio: lead.folio, cliente: contacto.nombre }),
});

// ---------------------------------------------------------------- Arranque

// #solar, #baterias o #cogeneracion: llega con esa tecnología incluida.
// #p-<monto>-<mercado>[-dac|-gdmth]: llega con ese pago mensual.
const h = location.hash.slice(1);
const p = h.match(/^p-(\d+)-(residencial|comercial|industrial)(?:-(dac|gdmth))?$/);
if (p) {
  form.querySelector(`input[name="mercado"][value="${p[2]}"]`).checked = true;
  fijarMercado(p[2], Number(p[1]));
  if (p[3]) form.tarifa.value = p[3].toUpperCase();
  const previo = calcularSolar({ mercado: p[2], hsp: Number(form.ciudad.value), tarifa: form.tarifa.value, ...leerConsumo(), m2: 1e7, techo: "losa", sombra: "ninguna" }, P);
  const lim = LIMITES[p[2]].m2;
  deslM2.fijar(Math.min(lim[1], Math.max(lim[2], Math.ceil((previo.paneles * P.solar.m2_por_panel * 1.15) / 5) * 5)), { silencioso: true });
  $("es-ejemplo").textContent = "Partimos del pago que elegiste. Ajusta lo demás a tu caso.";
} else {
  const inicial = h === "cogeneracion" ? "comercial" : "residencial";
  form.querySelector(`input[name="mercado"][value="${inicial}"]`).checked = true;
  fijarMercado(inicial, h === "cogeneracion" ? 250000 : undefined);
  if (h === "baterias") { form.apagones.value = "si"; }
  if (h === "cogeneracion") { form.gas.value = "si"; form.horasOperacion.value = "16"; }
  if (h === "cogeneracion") { incluir.gas = true; manual.gas = true; }
  if (h === "baterias") { incluir.baterias = true; manual.baterias = true; }
}
form.kwhPeriodo.value = 900;
form.diasPeriodo.value = 60;
form.montoPeriodo.value = 4500;
calcular();
