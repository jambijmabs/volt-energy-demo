import { calcularFinanciamiento } from "./calculos.js";
import { cargarParametros, pesos, numero } from "./comun.js";
import { conectarDeslizador, conectarDeslizadorLineal } from "./deslizador.js";

const P = await cargarParametros();
const F = P.financiamiento;
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- Modelos (esquemas de pagos por año)

const MODELOS = [
  {
    nombre: "De contado",
    texto: "Pagas el proyecto completo al inicio. El equipo es tuyo y todo el ahorro se queda contigo desde el primer mes.",
    pagos: [100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ficha: [["Pago inicial", "100 %"], ["Plazo", "Ninguno"], ["El equipo es", "Tuyo"]],
  },
  {
    nombre: "Crédito",
    texto: "Das un enganche y pagas mensualidades fijas durante el plazo. El equipo es tuyo desde el inicio.",
    pagos: [22, 20, 20, 20, 20, 20, 0, 0, 0, 0, 0],
    ficha: [["Pago inicial", "Enganche"], ["Plazo", "1 a 10 años"], ["El equipo es", "Tuyo"]],
  },
  {
    nombre: "Arrendamiento",
    texto: "Pagas una renta mensual por usar el equipo. Al final del plazo puedes comprarlo con un pago final.",
    pagos: [0, 19, 19, 19, 19, 19, 19, 12, 0, 0, 0],
    final: 7,
    ficha: [["Pago inicial", "Bajo o ninguno"], ["Plazo", "3 a 7 años"], ["El equipo es", "De la arrendadora hasta la compra"]],
  },
  {
    nombre: "Pago por energía (PPA)",
    texto: "Un tercero invierte, instala y opera el equipo en tu sitio. Tú pagas solo la energía que consumes, a un precio pactado.",
    pagos: [0, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11],
    ficha: [["Pago inicial", "Ninguno"], ["Plazo", "10 años o más"], ["El equipo es", "Del inversionista"]],
  },
];

$("modelos").innerHTML = MODELOS.map(
  (m) => `<article class="tarjeta">
    <div class="modelo__flujo" aria-hidden="true">${m.pagos
      .map((h, i) => `<i class="${h === 0 ? "cero" : i === 0 ? "inicial" : i === m.final ? "final" : ""}" style="height:${Math.max(h, 3)}%"></i>`)
      .join("")}</div>
    <div class="modelo__eje" aria-hidden="true"><span>Hoy</span><span>Año 5</span><span>Año 10</span></div>
    <h3>${m.nombre}</h3>
    <p>${m.texto}</p>
    <dl class="ficha">${m.ficha.map(([dt, dd]) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`).join("")}</dl>
  </article>`
).join("");

// ---------------------------------------------------------------- Simulador

const form = $("form-fin");
const pastillas = (nombre, opciones, elegido) =>
  opciones.map(([v, t]) => `<label><input type="radio" name="${nombre}" value="${v}" ${v === elegido ? "checked" : ""}><span>${t}</span></label>`).join("");

$("fin-enganche").innerHTML = pastillas("enganche", [[0, "0 %"], [0.1, "10 %"], [0.2, "20 %"], [0.3, "30 %"], [0.5, "50 %"]], F.enganche);
$("fin-plazo").innerHTML = pastillas(
  "plazo",
  F.plazos_meses.map((m) => [m, m % 12 === 0 ? `${m / 12} ${m === 12 ? "año" : "años"}` : `${m} meses`]),
  F.plazo_meses
);

const deslMonto = conectarDeslizador({ rango: $("fin-monto"), numero: $("fin-monto-num"), min: 20000, max: 20000000, paso: 100, alCambiar: calcular });
$("fin-tasa").min = F.tasa_min * 100;
$("fin-tasa").max = F.tasa_max * 100;
const deslTasa = conectarDeslizadorLineal({ rango: $("fin-tasa"), numero: $("fin-tasa-num"), alCambiar: calcular });
deslTasa.fijar(F.tasa_anual * 100);

form.addEventListener("input", (ev) => { if (ev.target.type !== "range") calcular(); });
form.addEventListener("change", calcular);
form.addEventListener("submit", (ev) => ev.preventDefault());

function calcular() {
  const monto = deslMonto.valor;
  const tasa = Number($("fin-tasa-num").value) / 100;
  const plazoMeses = Number(form.plazo.value);
  if (!(monto > 0) || !(tasa >= 0) || !plazoMeses) return;
  const r = calcularFinanciamiento({ monto, enganchePct: Number(form.enganche.value), plazoMeses, tasaAnual: tasa });

  $("f-mensual").textContent = pesos(r.mensualidad);
  $("f-plazo").textContent = `durante ${plazoMeses} meses`;
  $("f-enganche").textContent = pesos(r.enganche);
  $("f-credito").textContent = `financias ${pesos(r.credito)}`;
  $("f-intereses").textContent = pesos(r.intereses);
  $("f-total").textContent = pesos(r.totalPagado);

  const maximo = Math.max(...r.anual.map((a) => a.capital + a.interes));
  $("f-anios").innerHTML = r.anual
    .map((a) => {
      const total = a.capital + a.interes;
      return `<div class="anio" title="Año ${a.anio}: ${pesos(total)}">
        <div class="anio__barra" style="height:${(total / maximo) * 100}%">
          <div class="anio__interes" style="flex:${a.interes}"></div><div class="anio__capital" style="flex:${a.capital}"></div>
        </div>
        <div class="anio__etq">${a.anio}</div>
      </div>`;
    })
    .join("");

  const ahorro = Number($("fin-ahorro").value);
  $("f-comparativo").hidden = !(ahorro > 0);
  if (ahorro > 0) {
    const tope = Math.max(r.mensualidad, ahorro);
    $("f-b-mensual").textContent = pesos(r.mensualidad);
    $("f-b-ahorro").textContent = pesos(ahorro);
    $("f-b-mensual-barra").style.width = `${(r.mensualidad / tope) * 100}%`;
    $("f-b-ahorro-barra").style.width = `${(ahorro / tope) * 100}%`;
    $("f-cobertura").textContent =
      `Si tu ahorro real fuera el estimado, cubriría cerca del ${numero(Math.min(999, (ahorro / r.mensualidad) * 100))} % de la mensualidad. ` +
      `Al terminar el crédito, el equipo ya está pagado.`;
  }
}

// Desde el cotizador llega #m-<monto> o #m-<monto>-a-<ahorro>
const m = location.hash.match(/^#m-(\d+)(?:-a-(\d+))?$/);
if (m) {
  deslMonto.fijar(Number(m[1]), { silencioso: true });
  if (m[2]) $("fin-ahorro").value = m[2];
  $("fin-origen").textContent = "Usamos el monto de tu estimado. Ajusta enganche, plazo y tasa.";
} else {
  deslMonto.fijar(250000, { silencioso: true });
}
calcular();
