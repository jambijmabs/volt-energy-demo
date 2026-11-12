// Fórmulas de los cotizadores Bolt Energy. Funciones puras: reciben la entrada del
// formulario y los parámetros de data/parametros.json, y regresan el resultado.
// Fuente de fórmulas: HERCULES_PROMPTS_v2 (consenso 24-sep-2026), ajustadas a los
// datos del Excel Volt_Energy_Datos_Cotizador.xlsx (30-sep-2026).

const redondear1 = (n) => Math.round(n * 10) / 10;

function rangoPrecio(base, general) {
  return { bajo: base * (1 + general.rango_min), base, alto: base * (1 + general.rango_max) };
}

function porTramo(tramos, valor, campo) {
  return tramos.find((t) => t[campo] === null || valor <= t[campo]) ?? tramos[tramos.length - 1];
}

// ---------------------------------------------------------------- Solar

export function calcularSolar(e, P) {
  const s = P.solar;
  const avisos = [];

  const periodos = [e.kwhPeriodo, ...(e.historial || []).filter((x) => x > 0)];
  const promedioPeriodo = periodos.reduce((a, b) => a + b, 0) / periodos.length;
  const kwhMes = promedioPeriodo * (30 / e.diasPeriodo);

  let precioKwh;
  let precioEstimado = false;
  if (e.montoPeriodo > 0) {
    // Total del recibo ÷ kWh: lo que paga el cliente, con IVA. No se quita IVA.
    precioKwh = e.montoPeriodo / Math.max(e.kwhPeriodo, 1);
  } else {
    precioEstimado = true;
    const clave = e.tarifa === "DAC" ? "dac" : e.mercado;
    precioKwh = s.precio_kwh_sin_recibo[clave];
  }
  const precioRaro = precioKwh < s.precio_kwh_alerta[0] || precioKwh > s.precio_kwh_alerta[1];

  const kwPanel = s.panel_w / 1000;
  const espacios = Math.floor(e.m2 / s.m2_por_panel + 1e-9);
  const kwpPorConsumo = (kwhMes * s.meta_cobertura) / (e.hsp * 30 * s.pr_sistema);
  const kwpPorTecho = espacios * kwPanel;
  const kwpMax = s.kwp_max[e.mercado];

  let limitadoPor = kwpPorConsumo <= kwpPorTecho ? "consumo" : "techo";
  let kwp = redondear1(Math.min(kwpPorConsumo, kwpPorTecho));
  if (kwp > kwpMax) {
    kwp = kwpMax;
    limitadoPor = "tope";
  }
  const techoInsuficiente = kwpPorTecho < s.kwp_min;
  kwp = Math.max(s.kwp_min, kwp);

  // Paneles completos que cubren el kWp, sin pasar de los que caben
  const paneles = techoInsuficiente
    ? Math.ceil(s.kwp_min / kwPanel - 1e-9)
    : Math.min(Math.ceil(kwp / kwPanel - 1e-9), espacios);
  const generacionMes = kwp * e.hsp * 30 * s.pr_sistema;

  const factorAhorro = e.tarifa === "GDMTH" ? s.factor_ahorro.gdmth : s.factor_ahorro[e.mercado];
  const ahorroBase = Math.min(generacionMes, kwhMes) * precioKwh * factorAhorro;
  const ahorro = { bajo: ahorroBase * s.ahorro_rango[0], base: ahorroBase, alto: ahorroBase * s.ahorro_rango[1] };

  const costoKwp = porTramo(s.costo_kwp_tramos, kwp, "hasta_kwp").mxn;
  const extraKwp =
    e.techo === "terreno" ? s.extra_estructura_elevada_kwp : e.techo === "lamina" ? s.extra_techo_lamina_kwp : 0;
  const inversionSinIva = kwp * (costoKwp + extraKwp);
  const inversion = rangoPrecio(inversionSinIva, P.general);
  const inversionConIva = rangoPrecio(inversionSinIva * (1 + P.general.iva), P.general);

  // Avisos de tarifa
  if (e.tarifa === "1" || e.tarifa === "1A-1F")
    avisos.push("Tarifa subsidiada: el ahorro puede ser bajo; dimensiona con cuidado para no pasar a DAC sin querer.");
  if (e.tarifa === "DAC") avisos.push("DAC: suele ser el caso donde el solar más conviene revisar.");
  if (e.tarifa === "GDMTH")
    avisos.push(
      "En GDMTH el solar suele reducir energía, no necesariamente demanda ni cargos fijos; por eso el factor de ahorro es menor."
    );
  if (precioRaro) avisos.push("Revisa los datos del recibo: el precio por kWh resultante se ve fuera de lo normal.");
  if (precioEstimado)
    avisos.push(
      `No capturaste el monto del recibo: usamos un precio promedio de $${precioKwh.toFixed(2)}/kWh. Con tu recibo real el ahorro puede cambiar.`
    );
  if (e.sombra === "mucha") avisos.push("Requiere visita (sombra): con mucha sombra no podemos estimar la generación.");
  if (limitadoPor === "tope" || kwpPorConsumo >= P.general.proyecto_a_la_medida_kw)
    avisos.push("Tu consumo pide un sistema más grande que el tope de este estimado: es un proyecto a la medida.");

  // Semáforo
  const recorteTecho = limitadoPor === "techo" && kwp < kwpPorConsumo * (1 - s.recorte_techo_alerta);
  let semaforo;
  if (techoInsuficiente || e.sombra === "mucha") semaforo = "rojo";
  else if (recorteTecho || e.sombra === "parcial" || precioRaro || precioEstimado || kwp < 2) semaforo = "amarillo";
  else semaforo = "verde";

  return {
    kwhMes,
    precioKwh,
    precioEstimado,
    kwpPorConsumo,
    kwpPorTecho,
    kwp,
    paneles,
    espacios,
    m2Usados: paneles * s.m2_por_panel,
    limitadoPor,
    generacionMes,
    generacion: { bajo: generacionMes * 0.85, base: generacionMes, alto: generacionMes * 1.15 },
    factorAhorro,
    ahorro,
    costoKwp: costoKwp + extraKwp,
    inversion,
    inversionConIva,
    semaforo,
    techoInsuficiente,
    avisos,
  };
}

// ---------------------------------------------------------------- Baterías

export function calcularBaterias(e, P) {
  const b = P.baterias;
  const avisos = [];

  let cargaKw;
  if (e.perfil === "negocio") cargaKw = e.kwhMes / (30 * e.horasOperacion);
  else if (e.perfil === "manual") cargaKw = e.cargaKw;
  else cargaKw = b.perfiles_kw[e.perfil];

  const energiaNecesaria = cargaKw * e.horasRespaldo;
  const kwhUtilPorModulo = b.modulo_kwh * b.descarga_util * b.eficiencia;
  const modulos = Math.max(1, Math.ceil(energiaNecesaria / kwhUtilPorModulo - 1e-9));

  const inversorNecesario = cargaKw * b.factor_inversor;
  const mayor = b.inversores[b.inversores.length - 1];
  const modelo = b.inversores.find((i) => i.kw >= inversorNecesario) ?? mayor;
  const nInversores = Math.max(
    Math.ceil(inversorNecesario / modelo.kw - 1e-9),
    Math.ceil(modulos / b.max_modulos_por_inversor - 1e-9)
  );

  const precioModulo = modulos <= b.modulos_sistema_chico_max ? b.modulo_mxn_sistema_chico : b.modulo_mxn;
  const costoModulos = modulos * precioModulo;
  const costoInversores = nInversores * modelo.mxn;
  const totalSinIva = costoModulos + costoInversores + b.tablero_respaldo_mxn;

  const capacidadKwh = modulos * b.modulo_kwh;
  const autonomiaHoras = (modulos * kwhUtilPorModulo) / cargaKw;

  if (e.yaTieneSolar === "no")
    avisos.push("Evalúa solar primero: la batería sola normalmente no baja el recibo; solo te respalda cuando se va la luz.");
  if (nInversores > 1 || modelo.trifasico)
    avisos.push("Por el tamaño de la carga se requiere instalación trifásica o varios inversores: confirmar en visita técnica.");

  return {
    cargaKw,
    energiaNecesaria,
    modulos,
    capacidadKwh,
    autonomiaHoras,
    inversor: { kw: modelo.kw, cantidad: nInversores, necesarioKw: inversorNecesario },
    desglose: { modulos: costoModulos, precioModulo, inversores: costoInversores, tablero: b.tablero_respaldo_mxn },
    total: rangoPrecio(totalSinIva, P.general),
    totalConIva: rangoPrecio(totalSinIva * (1 + P.general.iva), P.general),
    espacioM2: modulos * b.m2_por_modulo,
    avisos,
  };
}

// ---------------------------------------------------------------- Generador a gas (hasta 200 kW)

export function precioEquipoGas(kw, equipos) {
  if (kw <= equipos[0].kw) return equipos[0].mxn;
  for (let i = 1; i < equipos.length; i++) {
    const a = equipos[i - 1];
    const b = equipos[i];
    if (kw <= b.kw) return a.mxn + ((kw - a.kw) / (b.kw - a.kw)) * (b.mxn - a.mxn);
  }
  return equipos[equipos.length - 1].mxn;
}

export function calcularGenerador(e, P) {
  const g = P.generador_gas;
  const avisos = [];
  const necesarioKw = e.cargaKw * g.factor_margen;
  const maximo = g.tamanos_comerciales_kw[g.tamanos_comerciales_kw.length - 1];

  // Sin tamaño elegido, se toma el primer equipo que cubre la carga con margen
  if (!e.kwElegido && necesarioKw > maximo) {
    return { excede: true, necesarioKw, maximo, avisos };
  }

  const kw = e.kwElegido ?? g.tamanos_comerciales_kw.find((t) => t >= necesarioKw);
  const equipo = Math.round(precioEquipoGas(kw, g.equipos));
  const instalacion = equipo * g.instalacion_pct;
  const transferencia = porTramo(g.transferencias, kw, "hasta_kw").mxn;
  const metrosExtra = Math.max(0, (e.metrosGas || 0) - g.metros_gas_incluidos);
  const conexionGas = metrosExtra * g.conexion_gas_mxn_m;
  const gabinete = e.gabinete ? equipo * g.gabinete_ruido_pct : 0;
  const totalSinIva = equipo + instalacion + transferencia + conexionGas + gabinete;
  const mantenimiento = porTramo(g.mantenimiento_anual, kw, "hasta_kw").mxn;

  if (e.gas === "no") avisos.push("Sin gas natural en el sitio el proyecto requiere acometida nueva o gas LP: se revisa en visita.");
  if (e.gas === "no_se") avisos.push("Confirma si tienes gas natural de ducto: cambia el costo de la conexión.");

  return {
    excede: false,
    necesarioKw,
    kw,
    desglose: { equipo, instalacion, transferencia, conexionGas, metrosExtra, gabinete },
    total: rangoPrecio(totalSinIva, P.general),
    totalConIva: rangoPrecio(totalSinIva * (1 + P.general.iva), P.general),
    mantenimientoAnual: mantenimiento,
    gasM3h: kw * g.gas_m3h_por_kw,
    espacioM2: kw * g.m2_por_kw,
    avisos,
  };
}

// ---------------------------------------------------------------- Cogeneración industrial por módulos de ~0.5 MW

// Dimensiona con la carga promedio: cada módulo trabaja hasta al 90 % de su potencia.
// e.modulos permite fijar la cantidad; sin él se toma la que cubre la carga.
export function calcularCogeneracionModular(e, P) {
  const R = P.cogeneracion.referencia;
  const util = R.potencia_kw * R.carga_recomendada;
  const sugeridos = Math.max(1, Math.ceil(e.cargaKw / util - 1e-9));
  const modulos = Math.min(R.max_modulos, e.modulos ?? sugeridos);
  const kw = modulos * R.potencia_kw;
  const sinIva = modulos * R.precio_sin_iva;
  const avisos = [];
  if (kw >= P.general.proyecto_a_la_medida_kw)
    avisos.push(`Con ${kw.toLocaleString("es-MX")} kW el proyecto es a la medida y suele requerir permiso de generación.`);
  if (!e.modulos && sugeridos > R.max_modulos) avisos.push("Tu carga pide más módulos de los que estimamos en línea; se revisa caso por caso.");
  return {
    modular: true,
    modulos,
    sugeridos,
    kw,
    cobertura: Math.min(1, (modulos * util) / e.cargaKw),
    total: rangoPrecio(sinIva, P.general),
    totalConIva: rangoPrecio(sinIva * (1 + P.general.iva), P.general),
    polizaAnual: modulos * R.poliza_anual,
    gasGjH: modulos * R.gas_gj_h,
    transformadorKva: modulos * R.transformador_kva,
    espacioM2: modulos * R.espacio_m2,
    avisos,
  };
}

// ---------------------------------------------------------------- Ahorro y recuperación de la Cogeneración

// Energía que genera el equipo, lo que cuesta generarla (gas + mantenimiento) contra lo que se deja
// de pagar a CFE, y en cuántos años se recupera la inversión.
// e: { kwhMes, cargaKw, horasOp, precioKwh, precioGasGj, kwCapacidad, gjPorKwh, mantenimientoAnual, inversion }
export function ahorroCogeneracion(e, P) {
  const factor = P.cogeneracion.factor_ahorro;
  const carga = P.generador_gas.carga_operacion;
  const kwhGen = Math.min(e.kwhMes, Math.min(e.cargaKw, e.kwCapacidad * carga) * e.horasOp * 30);
  const costoGasKwh = e.gjPorKwh * e.precioGasGj;
  const costoMttoKwh = kwhGen > 0 ? e.mantenimientoAnual / 12 / kwhGen : 0;
  const precioEvitado = e.precioKwh * factor;
  const base = kwhGen * (precioEvitado - costoGasKwh) - e.mantenimientoAnual / 12;
  const [rb, ra] = P.solar.ahorro_rango;
  const ahorro = { bajo: base * rb, base, alto: base * ra };
  const anios = (inv, ah) => (ah > 0 ? inv / (ah * 12) : null);
  const recuperacion =
    base > 0
      ? { bajo: anios(e.inversion.bajo, ahorro.alto), base: anios(e.inversion.base, base), alto: anios(e.inversion.alto, ahorro.bajo) }
      : null;
  return {
    kwhGen,
    cobertura: e.kwhMes > 0 ? kwhGen / e.kwhMes : 0,
    costoKwh: costoGasKwh + costoMttoKwh,
    costoGasKwh,
    precioEvitado,
    ahorro,
    recuperacion,
  };
}

// ---------------------------------------------------------------- Cogeneración (pre-diagnóstico ~0.5 MW)

export function puntajeCogeneracion(e, P) {
  const p = P.cogeneracion.puntaje;
  const demandaIdeal = e.demandaKw != null && e.demandaKw >= p.demanda_ideal[0] && e.demandaKw <= p.demanda_ideal[1];
  const demandaOtra = e.demandaKw != null && !demandaIdeal && e.demandaKw >= p.demanda_minima;
  const factores = [
    { nombre: `Recibo de luz de ${p.gasto_minimo_mxn.toLocaleString("es-MX")} pesos o más al mes`, max: p.pts_gasto, puntos: e.gastoLuz >= p.gasto_minimo_mxn ? p.pts_gasto : 0 },
    { nombre: "Operación de 16 horas o más al día", max: p.pts_horas, puntos: e.horas === "16" || e.horas === "20-24" ? p.pts_horas : 0 },
    { nombre: "Gas natural disponible", max: p.pts_gas_ducto, puntos: e.gas === "si_ducto" ? p.pts_gas_ducto : e.gas === "red_cerca" ? p.pts_gas_cerca : 0 },
    { nombre: "Uso para el calor (proceso, vapor, agua caliente)", max: p.pts_calor, puntos: e.calor && e.calor !== "ninguno" && e.calor !== "no_se" ? p.pts_calor : 0 },
    { nombre: `Demanda entre ${p.demanda_ideal[0]} y ${p.demanda_ideal[1]} kW`, max: p.pts_demanda_ideal, puntos: demandaIdeal ? p.pts_demanda_ideal : demandaOtra ? p.pts_demanda_otra : 0 },
  ];
  const pts = Math.min(100, factores.reduce((a, f) => a + f.puntos, 0));

  let color, texto;
  if (pts >= p.umbral_verde) {
    color = "verde";
    texto = "Candidato a estudio de Cogeneración ~0.5 MW. Siguiente paso: visita técnica.";
  } else if (pts >= p.umbral_amarillo) {
    color = "amarillo";
    texto = "Posible; necesitamos visita / más datos de gas, demanda y perfil.";
  } else {
    color = "rojo";
    texto = "Hoy no parece fit típico de Cogeneración; te sugerimos revisar solar o baterías.";
  }
  return { puntaje: pts, color, texto, factores };
}

// ---------------------------------------------------------------- Financiamiento

// Crédito con mensualidades fijas (sistema francés). tasaAnual y enganchePct en fracción (0.18 = 18 %).
export function calcularFinanciamiento({ monto, enganchePct, plazoMeses, tasaAnual }) {
  const enganche = monto * enganchePct;
  const credito = monto - enganche;
  const i = tasaAnual / 12;
  const mensualidad = i === 0 ? credito / plazoMeses : (credito * i) / (1 - (1 + i) ** -plazoMeses);
  const anual = [];
  let saldo = credito;
  for (let mes = 1; mes <= plazoMeses; mes++) {
    const interes = saldo * i;
    const capital = mensualidad - interes;
    saldo = Math.max(0, saldo - capital);
    const k = Math.ceil(mes / 12) - 1;
    anual[k] ??= { anio: k + 1, capital: 0, interes: 0, saldo: 0 };
    anual[k].capital += capital;
    anual[k].interes += interes;
    anual[k].saldo = saldo;
  }
  const intereses = mensualidad * plazoMeses - credito;
  return { enganche, credito, mensualidad, intereses, totalPagado: monto + intereses, anual };
}

// ---------------------------------------------------------------- Leads

export function prioridadLead({ origen, mercado, gastoLuz, puntaje, gas }) {
  if ((puntaje ?? 0) >= 70 || (gastoLuz ?? 0) >= 200000 || (mercado === "industrial" && gas === "si_ducto")) return "A";
  if (mercado === "comercial" || mercado === "industrial" || origen === "cogeneracion") return "B";
  return "C";
}
