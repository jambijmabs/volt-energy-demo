// Páginas por sector: casos tipo calculados con los mismos parámetros del cotizador solar.
import { calcularSolar, estimarCogeneracion } from "./calculos.js";
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
    { nombre: "Planta mediana", monto: 350000 },
    { nombre: "Planta de dos turnos", monto: 700000 },
    { nombre: "Planta grande", monto: 1500000 },
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

// Industria: casos de Cogeneración (16 horas de operación, gas al precio de referencia)
function tarjetaCogeneracion(c) {
  const precio = P.solar.precio_kwh_sin_recibo.industrial;
  const r = estimarCogeneracion({ kwhMes: c.monto / precio, horasOp: 16, precioKwh: precio }, P);
  const ah = r.ahorro.ahorro;
  const rec = r.ahorro.recuperacion;
  const n = r.modular ? r.modular.modulos : 1;
  return `<a class="tarjeta caso" href="cotizador.html#p-${c.monto}-industrial-gdmth">
    <p class="caso__etq">${c.nombre}</p>
    <p class="caso__paga">Paga ${pesos(c.monto)} al mes de luz</p>
    <div class="caso__modulos" aria-hidden="true">${"<i></i>".repeat(n)}</div>
    <p class="caso__sistema">${numero(r.cog.kw)} kW <small>· ${r.modular ? `${n} ${n === 1 ? "módulo" : "módulos"} de ~0.5 MW` : "1 generador"}</small></p>
    <div class="barras">
      <div>
        <div class="barra__etq"><span>Costo de energía hoy</span><strong>${pesos(c.monto)}</strong></div>
        <div class="barra__pista"><div class="barra__relleno barra__relleno--antes" style="width:100%"></div></div>
      </div>
      <div>
        <div class="barra__etq"><span>Con Cogeneración</span><strong>${pesos(Math.max(0, c.monto - ah.alto))} – ${pesos(Math.max(0, c.monto - ah.bajo))}</strong></div>
        <div class="barra__pista"><div class="barra__relleno barra__relleno--despues" style="width:${(Math.max(0, c.monto - ah.base) / c.monto) * 100}%"></div></div>
      </div>
    </div>
    <p class="caso__inv">Inversión: <strong>${pesos(r.cog.total.bajo)} – ${pesos(r.cog.total.alto)}</strong> + IVA</p>
    <p class="nota" style="margin:.4rem 0 0">${rec ? `Recuperación estimada: ${numero(rec.bajo, 1)} a ${numero(rec.alto, 1)} años.` : ""}</p>
    <span class="ir">Ajustar a mi planta →</span>
  </a>`;
}

document.getElementById("casos").innerHTML = CASOS[sector].map(sector === "industrial" ? tarjetaCogeneracion : tarjeta).join("");
document.getElementById("casos-nota").textContent =
  sector === "industrial"
    ? `Suponen 16 horas de operación al día, gas natural a $${numero(P.cogeneracion.referencia.precio_gas_gj_ejemplo)} por GJ y un precio promedio de $${numero(P.solar.precio_kwh_sin_recibo.industrial, 2)} por kWh. El costo con Cogeneración ya incluye gas y mantenimiento. Son estimados no vinculantes y la recuperación es un orden de magnitud.`
    : `Suponen ${CIUDAD.ciudad}, espacio suficiente y un precio promedio por kWh. Son estimados no vinculantes; con tu recibo real el número se afina.`;

montarEsquemasDeclarados();
