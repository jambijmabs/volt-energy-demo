// Páginas por sector: casos tipo calculados con los mismos parámetros del cotizador solar.
import { calcularSolar } from "./calculos.js";
import { cargarParametros, pesos, numero } from "./comun.js";
import { montarEsquemasDeclarados } from "./esquemas.js";

const P = await cargarParametros();
const sector = document.body.dataset.sector;
const CIUDAD = P.solar.hsp_ciudades.find((c) => c.ciudad === "Monterrey") ?? { ciudad: "Monterrey", hsp: P.solar.hsp_otra };

const CASOS = {
  residencial: [
    { nombre: "Depa o casa chica", monto: 1500 },
    { nombre: "Casa familiar", monto: 2500 },
    { nombre: "Casa grande con aire", monto: 8000, tarifa: "DAC" },
  ],
  comercial: [
    { nombre: "Local o consultorio", monto: 8000 },
    { nombre: "Restaurante u oficina", monto: 25000 },
    { nombre: "Súper o nave chica", monto: 80000 },
  ],
  industrial: [
    { nombre: "Taller o bodega", monto: 60000, tarifa: "GDMTH" },
    { nombre: "Nave mediana", monto: 150000, tarifa: "GDMTH" },
    { nombre: "Planta grande", monto: 400000, tarifa: "GDMTH" },
  ],
};

function tarjeta(c) {
  const precio = P.solar.precio_kwh_sin_recibo[c.tarifa === "DAC" ? "dac" : sector];
  const r = calcularSolar(
    { mercado: sector, hsp: CIUDAD.hsp, tarifa: c.tarifa ?? "no_se", kwhPeriodo: c.monto / precio, diasPeriodo: 30, montoPeriodo: 0, m2: 1e7, techo: "losa", sombra: "ninguna" },
    P
  );
  const despuesMin = Math.max(0, c.monto - r.ahorro.alto);
  const despuesMax = Math.max(0, c.monto - r.ahorro.bajo);
  const despues = Math.max(0, c.monto - r.ahorro.base);
  const escala = Math.max(1, Math.ceil(r.paneles / 32));
  const celdas = Math.ceil(r.paneles / escala);
  const aLaMedida = r.limitadoPor === "tope";
  return `<a class="tarjeta caso" href="cotizador.html#p-${c.monto}-${sector}${c.tarifa ? "-" + c.tarifa.toLowerCase() : ""}">
    <p class="caso__etq">${c.nombre}</p>
    <p class="caso__paga">Paga ${pesos(c.monto)} al mes${c.tarifa ? ", en tarifa " + c.tarifa : ""}</p>
    <div class="caso__techo" aria-hidden="true">${"<i></i>".repeat(celdas)}</div>
    <p class="caso__sistema">${numero(r.kwp, 1)} kWp <small>· ${numero(r.paneles)} paneles${escala > 1 ? ` (cada cuadro = ${escala})` : ""}</small></p>
    <div class="barras">
      <div>
        <div class="barra__etq"><span>Hoy</span><strong>${pesos(c.monto)}</strong></div>
        <div class="barra__pista"><div class="barra__relleno barra__relleno--antes" style="width:100%"></div></div>
      </div>
      <div>
        <div class="barra__etq"><span>Con paneles</span><strong>${pesos(despuesMin)} – ${pesos(despuesMax)}</strong></div>
        <div class="barra__pista"><div class="barra__relleno barra__relleno--despues" style="width:${(despues / c.monto) * 100}%"></div></div>
      </div>
    </div>
    <p class="caso__inv">Inversión: <strong>${pesos(r.inversion.bajo)} – ${pesos(r.inversion.alto)}</strong> + IVA</p>
    <p class="nota" style="margin:.4rem 0 0">${aLaMedida ? "Su consumo pide más que el tope del estimado: el resto es proyecto a la medida." : ""}</p>
    <span class="ir">Ajustar a mi caso →</span>
  </a>`;
}

document.getElementById("casos").innerHTML = CASOS[sector].map(tarjeta).join("");
document.getElementById("casos-nota").textContent =
  `Suponen ${CIUDAD.ciudad}, espacio suficiente y un precio promedio por kWh. Son estimados no vinculantes; con tu recibo real el número se afina.`;

montarEsquemasDeclarados();
