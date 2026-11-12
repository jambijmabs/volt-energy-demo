// Preguntas frecuentes con buscador y filtro por tema.
// Los datos numéricos salen de los parámetros para que no se desactualicen.
import { cargarParametros, pesos, numero } from "./comun.js";

const P = await cargarParametros();
const S = P.solar, B = P.baterias, G = P.generador_gas, R = P.cogeneracion.referencia;
const tramos = S.costo_kwp_tramos.map((t) => t.mxn);
const FUENTE = `<span class="fuente-faq">Dato de un proyecto ejemplo; puede cambiar.</span>`;

const PREGUNTAS = [
  // ---- Solar
  ["solar", "¿Qué necesito para cotizar paneles solares?",
    `Tu recibo de CFE más reciente (los kWh del periodo, los días y el total a pagar) y una idea de los metros cuadrados libres en tu techo o terreno. Con eso el <a href="cotizador.html#solar">cotizador solar</a> te da un rango.`],
  ["solar", "¿Cuántos paneles caben en mi techo?",
    `Cada panel de ${S.panel_w} W ocupa cerca de ${S.m2_por_panel} m² contando pasillos. En 40 m² caben unos ${Math.floor(40 / S.m2_por_panel)} paneles. El cotizador lo dibuja con tus medidas.`],
  ["solar", "¿Los paneles dejan mi recibo en ceros?",
    `No. Siempre queda un pago mínimo por cargos fijos de CFE. Por eso dimensionamos para cubrir hasta el ${numero(S.meta_cobertura * 100)} % de tu consumo y mostramos el ahorro como rango, no como promesa.`],
  ["solar", "¿Qué pasa de noche o en días nublados?",
    `Tomas energía de CFE como siempre. Lo que tus paneles entregaron de más durante el día lo cuenta el medidor bidireccional a tu favor, y pagas la diferencia.`],
  ["solar", "¿Qué es el medidor bidireccional y quién lo tramita?",
    `Es el medidor que cuenta la energía en los dos sentidos: la que tomas de CFE y la que entregas. El precio instalado que estimamos incluye estructura, cableado, el trámite con CFE y el medidor.`],
  ["solar", "¿Importa qué tarifa tengo?",
    `Sí. En tarifas subsidiadas (1 a 1F) el ahorro puede ser bajo. En DAC suele ser donde más conviene revisar. En GDMTH los paneles reducen energía, pero no necesariamente la demanda ni los cargos fijos, así que el factor de ahorro es menor.`],
  ["solar", "¿Cuánto cuesta un sistema solar?",
    `Depende del tamaño. Como referencia, el precio instalado va de ${pesos(Math.min(...tramos))} a ${pesos(Math.max(...tramos))} por kWp más IVA: entre más grande el sistema, menor el precio por kWp. El cotizador te da el rango para tu caso.`],
  ["solar", "¿Y si tengo mucha sombra?",
    `Con mucha sombra no podemos estimar la generación en línea. Lo revisamos en una visita técnica para ver qué zona del techo sí sirve.`],

  // ---- Baterías
  ["baterias", "¿Una batería baja mi recibo de luz?",
    `Por sí sola, normalmente no. La batería te respalda cuando se va la luz. Para bajar el recibo, lo primero es evaluar paneles solares.`],
  ["baterias", "¿Cuántas horas de respaldo puedo tener?",
    `Las que necesites. El <a href="cotizador.html#baterias">cotizador de baterías</a> calcula de 2 a 12 horas con módulos de ${B.modulo_kwh} kWh; entre más carga y más horas, más módulos.`],
  ["baterias", "¿Puedo poner baterías sin paneles?",
    `Sí. La batería se carga con la red de CFE y entra cuando hay un apagón. Con paneles, además se carga con el sol.`],
  ["baterias", "¿Dónde se instalan y cuánto espacio ocupan?",
    `En un muro o piso bajo techo. Cada módulo ocupa cerca de ${B.m2_por_modulo} m².`],
  ["baterias", "¿Qué es el tablero de respaldo?",
    `Es un tablero aparte donde se conectan los circuitos que quieres mantener encendidos (refrigerador, luces, internet, cajas). Así la batería no se gasta en lo que no es importante.`],
  ["baterias", "¿Por qué no se usa el 100 % de la batería?",
    `Se deja una reserva para cuidar su vida útil. En el cálculo usamos el ${numero(B.descarga_util * 100)} % de la capacidad y descontamos las pérdidas del inversor.`],

  // ---- Cogeneración
  ["cogeneracion", "¿Qué es la Cogeneración?",
    `Es generar tu electricidad en sitio con un generador a gas natural y, además, aprovechar el calor del motor para agua caliente, vapor o proceso. De ahí el nombre: dos formas de energía con el mismo combustible.`],
  ["cogeneracion", "¿Para qué tipo de operación es?",
    `Para operaciones con consumo alto y constante: un recibo de luz de ${pesos(P.cogeneracion.puntaje.gasto_minimo_mxn)} o más al mes, gas natural disponible y 16 horas o más de operación al día. El <a href="cogeneracion.html#industrial">pre-diagnóstico</a> te dice qué tan buen candidato eres.`],
  ["cogeneracion", "¿Qué tamaños manejan?",
    `Equipos de ${G.tamanos_comerciales_kw[0]} a ${G.tamanos_comerciales_kw.at(-1)} kW con estimado en línea, y proyectos industriales de alrededor de 0.5 MW con pre-diagnóstico y visita. A partir de ${P.general.proyecto_a_la_medida_kw} kW es un proyecto a la medida.`],
  ["cogeneracion", "¿Necesito gas natural de ducto?",
    `Sí. El sistema está pensado para gas natural entubado. Si no tienes ducto, se revisa en la visita qué opciones hay.`],
  ["cogeneracion", "¿Cuánto espacio necesita?",
    `Un equipo chico necesita cerca de ${G.m2_por_kw} m² por kW, con ventilación. Un proyecto de ~0.5 MW requiere un cuarto de unos 40 m² (8 × 5 m). ${FUENTE}`],
  ["cogeneracion", "¿Cuánto tarda la entrega y la instalación?",
    `En el ejemplo de ~0.5 MW, la entrega del equipo es de ${R.entrega} y la instalación de ${R.instalacion}, con el equipo en sitio y la obra civil lista. ${FUENTE}`],
  ["cogeneracion", "¿Qué incluye y qué no incluye el precio del ejemplo?",
    `Incluye el equipo llave en mano y hasta ${R.metros_conexion_incluidos} m de conexión. Se cotizan aparte: metros adicionales de conexión eléctrica o de gas, transformador nuevo, obra civil del cuarto y suministro exterior de gas. ${FUENTE}`],
  ["cogeneracion", "¿Quién le da mantenimiento?",
    `Se cubre con una póliza anual de servicio. En el ejemplo documentado es de ${pesos(R.poliza_anual)} al año, cifra a confirmar en tu cotización. Para equipos de hasta 200 kW el cotizador muestra el mantenimiento anual estimado.`],
  ["cogeneracion", "¿Necesito un permiso?",
    `Como orientación: generación menor a 0.7 MW puede operar como generación distribuida sin permiso; 0.7 MW o más de autoconsumo suele requerir permiso. <span class="badge-verificar">VERIFICAR con abogado antes de publicar</span>`],
  ["cogeneracion", "¿Cuánto voy a ahorrar con Cogeneración?",
    `No publicamos porcentajes de ahorro ni retornos, porque dependen del precio de tu gas, tu perfil de carga y tu tarifa. Eso se calcula con tus datos después de la visita técnica.`],

  // ---- Cotización y visita
  ["cotizacion", "¿El estimado en línea es una cotización?",
    `No. Es un estimado orientativo y no vinculante. La cotización firme se entrega después de una visita técnica.`],
  ["cotizacion", "¿Por qué dan rangos y no un precio exacto?",
    `Porque sin ver tu techo, tu tablero y tu conexión hay cosas que pueden cambiar el precio. El rango va de ${numero(P.general.rango_min * 100)} % a +${numero(P.general.rango_max * 100)} % sobre el valor base.`],
  ["cotizacion", "¿Los precios incluyen IVA?",
    `Los precios se muestran sin IVA y, debajo, el total con IVA.`],
  ["cotizacion", "¿Qué revisan en la visita técnica?",
    `En solar: techo, sombras, orientación y tablero. En baterías: cableado y ubicación. En Cogeneración: acometida de gas, espacio, transformador y perfil de consumo.`],
  ["cotizacion", "¿Tengo que dejar mis datos para ver el resultado?",
    `En solar y baterías no: el resultado es tuyo sin dejar datos, y solo te los pedimos para agendar la visita. En el pre-diagnóstico industrial de Cogeneración sí, porque un asesor le da seguimiento.`],

  // ---- Privacidad
  ["privacidad", "¿Qué hacen con mis datos?",
    `Los usamos solo para contactarte sobre el estimado que pediste. No los vendemos. Puedes leer el <a href="aviso-de-privacidad.html">aviso de privacidad</a>.`],
  ["privacidad", "¿Bolt Energy es parte de CFE?",
    `No. Bolt Energy es una empresa independiente; CFE sigue siendo tu suministrador y quien instala el medidor bidireccional.`],
];

const TEMAS = { todos: "Todas", solar: "Solar", baterias: "Baterías", cogeneracion: "Cogeneración", cotizacion: "Cotización y visita", privacidad: "Privacidad" };
const $ = (id) => document.getElementById(id);
const sinAcentos = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
let tema = "todos";

$("faq-temas").innerHTML = Object.entries(TEMAS)
  .map(([k, v]) => `<label><input type="radio" name="tema" value="${k}" ${k === "todos" ? "checked" : ""}><span>${v}</span></label>`)
  .join("");

$("faq-lista").innerHTML = PREGUNTAS.map(
  ([t, p, r], i) =>
    `<details class="faq" data-tema="${t}" data-texto="${sinAcentos(p + " " + r.replace(/<[^>]+>/g, " "))}" id="p${i}">
      <summary><span class="faq__tema">${TEMAS[t]}</span>${p}</summary>
      <div class="faq__resp"><p>${r}</p></div>
    </details>`
).join("");

function filtrar() {
  const q = sinAcentos($("faq-buscar").value.trim());
  let visibles = 0;
  document.querySelectorAll(".faq").forEach((d) => {
    const ok = (tema === "todos" || d.dataset.tema === tema) && (!q || q.split(/\s+/).every((w) => d.dataset.texto.includes(w)));
    d.hidden = !ok;
    if (ok) visibles++;
  });
  $("faq-cuenta").textContent = visibles === 1 ? "1 pregunta" : `${visibles} preguntas`;
  $("faq-vacio").hidden = visibles > 0;
}

$("faq-buscar").addEventListener("input", filtrar);
$("faq-temas").addEventListener("change", (ev) => { tema = ev.target.value; filtrar(); });

// Enlace directo por tema: preguntas.html#cogeneracion
const inicial = location.hash.slice(1);
if (TEMAS[inicial]) {
  tema = inicial;
  document.querySelector(`#faq-temas input[value="${inicial}"]`).checked = true;
}
filtrar();
