// Ilustración interactiva de la microrred de una planta: generador a gas, paneles, inversor,
// baterías, medidor y red de CFE, con los flujos de energía en cuatro situaciones.

const MODOS = {
  gas: {
    nombre: "Generación base",
    texto: "El generador a gas natural cubre la carga base de la planta y su calor residual se recupera para el proceso. La red de CFE opera en paralelo como complemento.",
  },
  dia: {
    nombre: "Aporte solar",
    texto: "El arreglo fotovoltaico se suma a la generación base, carga el banco de baterías y los excedentes se inyectan a la red.",
  },
  noche: {
    nombre: "Operación nocturna",
    texto: "Sin generación solar, la demanda se cubre con el generador, con la energía almacenada en las baterías y con la red de CFE.",
  },
  apagon: {
    nombre: "Operación en isla",
    texto: "Ante una falla de la red, el sistema se aísla y el generador y las baterías sostienen las cargas de la planta, según el diseño.",
  },
};

const PARTES = [
  ["Generador a gas natural", "Generación base de la planta, con recuperación de calor para proceso."],
  ["Arreglo fotovoltaico", "Generación diurna que reduce el consumo de gas y de red."],
  ["Inversor", "Convierte y sincroniza la energía de paneles y baterías con la red interna."],
  ["Banco de baterías", "Respaldo de cargas críticas y soporte ante picos de demanda."],
  ["Medidor bidireccional", "Punto de interconexión: registra la energía recibida y entregada."],
  ["Red de CFE", "Suministro en paralelo, como complemento o respaldo."],
];

const flujo = (d, tipo, modos, req = "") => `<path class="linea linea--${tipo}" data-modos="${modos}" data-req="${req}" d="${d}"/>`;
const marca = (n, x, y) =>
  `<g class="red__marca"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 5}">${n}</text></g>`;

const paneles = [0, 1, 2, 3, 4, 5]
  .map((i) => {
    const x = 180 + i * 41;
    return `<polygon class="red__panel" points="${x},226 ${x + 34},226 ${x + 44},198 ${x + 10},198"/>
      <path class="red__panel-linea" d="M${x + 5} 212 H${x + 39} M${x + 17} 226 L${x + 27} 198"/>`;
  })
  .join("");

const lamina = Array.from({ length: 12 }, (_, i) => `M${190 + i * 20} 240V354`).join("");
const ventanas = [0, 1, 2, 3].map((i) => `<rect class="red__ventana" x="${186 + i * 34}" y="252" width="26" height="16" rx="2"/>`).join("");

const SVG = `
<svg viewBox="0 0 640 430" role="img" aria-label="Ilustración de una planta industrial con generador a gas, paneles solares, inversor, baterías, medidor y red de CFE">
  <rect class="red__cielo" x="0" y="0" width="640" height="430" rx="18"/>
  <g class="red__estrellas"><circle cx="150" cy="60" r="2"/><circle cx="260" cy="40" r="1.6"/><circle cx="380" cy="72" r="2"/><circle cx="470" cy="38" r="1.6"/><circle cx="540" cy="90" r="2"/><circle cx="60" cy="150" r="1.6"/></g>
  <g class="red__sol"><circle cx="86" cy="78" r="30"/><path d="M86 30v-14M86 140v-14M38 78H24M148 78h-14M52 44l-10-10M120 112l10 10M52 112l-10 10M120 44l10-10"/></g>
  <path class="red__luna" d="M104 96A34 34 0 0 1 66 50a34 34 0 1 0 38 46z"/>
  <path class="red__suelo" d="M0 354H640V412a18 18 0 0 1-18 18H18a18 18 0 0 1-18-18Z"/>

  <g class="red__cfe">
    <rect x="608" y="140" width="8" height="216"/><rect x="584" y="152" width="56" height="6"/><rect x="592" y="176" width="40" height="5"/>
  </g>
  <g class="red__corte"><path d="M598 198l28 28M626 198l-28 28"/></g>

  <rect class="red__muro" x="170" y="236" width="262" height="120"/>
  <path class="red__lamina" d="${lamina}"/>
  <rect class="red__techo" x="162" y="226" width="278" height="12" rx="2"/>
  ${paneles}
  ${ventanas}
  <rect class="red__porton" x="336" y="286" width="72" height="70" rx="2"/>
  <path class="red__porton-linea" d="M336 300h72M336 314h72M336 328h72M336 342h72"/>

  <rect class="red__inversor" x="142" y="278" width="24" height="38" rx="4"/><circle class="red__led" cx="154" cy="288" r="3"/>
  <g class="red__bateria">
    <rect class="red__caja" x="40" y="292" width="84" height="64" rx="6"/>
    <rect class="red__celda" x="50" y="302" width="64" height="12" rx="2"/><rect class="red__celda" x="50" y="319" width="64" height="12" rx="2"/><rect class="red__celda" x="50" y="336" width="64" height="12" rx="2"/>
  </g>
  <circle class="red__medidor" cx="444" cy="270" r="11"/><path class="red__aguja" d="M444 270l5-6"/>

  <g class="red__generador">
    <rect class="red__escape" x="562" y="258" width="10" height="34"/>
    <path class="red__vapor" d="M567 252c-4-6 4-8 0-14M575 248c-3-5 3-7 0-12"/>
    <rect class="red__caja" x="468" y="290" width="124" height="64" rx="6"/>
    <path class="red__rejilla" d="M480 304h48M480 315h48M480 326h48M480 337h48"/>
    <rect class="red__tablero" x="542" y="304" width="38" height="24" rx="2"/><circle class="red__led" cx="552" cy="316" r="4"/>
    <rect class="red__base" x="460" y="352" width="140" height="7"/>
    <path class="red__tubo" d="M640 380H530V359"/>
  </g>

  ${flujo("M636 380H530V359", "gas", "gas dia noche apagon", "generador")}
  ${flujo("M468 328H434", "luz", "gas dia noche apagon", "generador")}
  ${flujo("M486 290C474 268 458 272 434 292", "calor", "gas dia noche apagon", "generador")}
  ${flujo("M112 96L240 200", "sol", "dia", "paneles")}
  ${flujo("M178 224C158 230 154 252 154 276", "luz", "dia", "paneles")}
  ${flujo("M166 300H198", "luz", "dia", "paneles")}
  ${flujo("M166 300H198", "luz", "noche apagon", "bateria")}
  ${flujo("M142 304L126 314", "luz", "dia", "paneles bateria")}
  ${flujo("M126 314L142 304", "luz", "noche apagon", "bateria")}
  ${flujo("M455 264C510 236 566 196 606 166", "luz", "dia", "paneles")}
  ${flujo("M606 166C566 196 510 236 455 264", "red", "gas noche")}

  ${marca(1, 506, 270)}${marca(2, 300, 182)}${marca(3, 154, 260)}${marca(4, 82, 274)}${marca(5, 444, 244)}${marca(6, 612, 122)}
</svg>`;

export function montarRed(el) {
  const claves = Object.keys(MODOS);
  el.innerHTML = `
    <div class="red__escena" data-modo="${claves[0]}">
      <div class="modo modo--red" role="group" aria-label="Modo de operación">
        ${Object.entries(MODOS).map(([k, m]) => `<button type="button" data-modo="${k}">${m.nombre}</button>`).join("")}
      </div>
      ${SVG}
      <p class="red__texto" aria-live="polite"></p>
    </div>
    <ol class="red__partes">${PARTES.map(([t, d]) => `<li><strong>${t}</strong>${d}</li>`).join("")}</ol>`;

  const escena = el.querySelector(".red__escena");
  const texto = el.querySelector(".red__texto");
  const botones = [...el.querySelectorAll("[data-modo]")].filter((b) => b.tagName === "BUTTON");
  const lineas = [...el.querySelectorAll(".linea")];
  let actual = 0;
  let automatico = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hay = { paneles: true, bateria: true, generador: true };

  function poner(clave) {
    actual = claves.indexOf(clave);
    escena.dataset.modo = clave;
    texto.textContent = MODOS[clave].texto;
    botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === clave)));
    lineas.forEach((l) => {
      const enModo = l.dataset.modos.split(" ").includes(clave);
      const disponible = l.dataset.req.split(" ").filter(Boolean).every((t) => hay[t]);
      l.classList.toggle("off", !(enModo && disponible));
    });
  }
  botones.forEach((b) => b.addEventListener("click", () => { automatico = false; poner(b.dataset.modo); }));
  poner(claves[0]);
  setInterval(() => { if (automatico && el.isConnected) poner(claves[(actual + 1) % claves.length]); }, 5000);

  // Para el cotizador: muestra solo los equipos incluidos en el sistema
  return {
    incluir(equipos) {
      Object.assign(hay, equipos);
      for (const t of Object.keys(hay)) escena.classList.toggle(`sin-${t}`, !hay[t]);
      poner(claves[actual]);
    },
    modo: (clave) => { automatico = false; poner(clave); },
  };
}
