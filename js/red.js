// Ilustración interactiva de "tu red de energía": paneles, inversor, batería, medidor,
// red de CFE y generador a gas, con los flujos de energía en cuatro situaciones.

const MODOS = {
  dia: {
    nombre: "Día con sol",
    texto: "Los paneles alimentan el inmueble, cargan la batería y lo que sobra se entrega a la red de CFE.",
  },
  noche: {
    nombre: "Noche",
    texto: "Sin sol, la energía viene de la red de CFE y de lo que guardó la batería durante el día.",
  },
  apagon: {
    nombre: "Apagón",
    texto: "Si se va la luz de CFE, la batería y el inversor mantienen encendido lo importante.",
  },
  gas: {
    nombre: "Con generador a gas",
    texto: "Un generador a gas natural produce electricidad en tu sitio y su calor se aprovecha. CFE queda como complemento.",
  },
};

const PARTES = [
  ["Paneles solares", "Convierten la luz del sol en electricidad."],
  ["Inversor", "Deja la energía lista para tus aparatos y decide de dónde tomarla."],
  ["Batería", "Guarda energía para la noche o para un apagón."],
  ["Medidor bidireccional", "Cuenta lo que tomas de CFE y lo que le entregas."],
  ["Red de CFE", "Tu respaldo de siempre; con paneles le compras menos."],
  ["Generador a gas", "Produce electricidad y calor en sitio para operaciones grandes."],
];

const flujo = (d, tipo, modos, req = "") => `<path class="linea linea--${tipo}" data-modos="${modos}" data-req="${req}" d="${d}"/>`;
const marca = (n, x, y) =>
  `<g class="red__marca"><circle cx="${x}" cy="${y}" r="13"/><text x="${x}" y="${y + 5}">${n}</text></g>`;

const paneles = [0, 1, 2, 3, 4]
  .map((i) => {
    const x = 218 + i * 43;
    return `<polygon class="red__panel" points="${x},224 ${x + 36},224 ${x + 46},196 ${x + 10},196"/>
      <path class="red__panel-linea" d="M${x + 5} 210 H${x + 41} M${x + 18} 224 L${x + 28} 196"/>`;
  })
  .join("");

const SVG = `
<svg viewBox="0 0 640 430" role="img" aria-label="Ilustración de un inmueble con paneles solares, inversor, batería, medidor, red de CFE y generador a gas">
  <rect class="red__cielo" x="0" y="0" width="640" height="430" rx="18"/>
  <g class="red__estrellas"><circle cx="150" cy="60" r="2"/><circle cx="260" cy="40" r="1.6"/><circle cx="380" cy="72" r="2"/><circle cx="470" cy="38" r="1.6"/><circle cx="540" cy="90" r="2"/><circle cx="60" cy="150" r="1.6"/></g>
  <g class="red__sol"><circle cx="86" cy="78" r="30"/><path d="M86 30v-14M86 140v-14M38 78H24M148 78h-14M52 44l-10-10M120 112l10 10M52 112l-10 10M120 44l10-10"/></g>
  <path class="red__luna" d="M104 96A34 34 0 0 1 66 50a34 34 0 1 0 38 46z"/>
  <path class="red__suelo" d="M0 354H640V412a18 18 0 0 1-18 18H18a18 18 0 0 1-18-18Z"/>

  <g class="red__cfe">
    <rect x="596" y="150" width="8" height="206"/><rect x="570" y="162" width="60" height="6"/><rect x="580" y="186" width="40" height="5"/>
    <path class="red__cable" d="M604 165C618 173 630 173 640 168M604 189C618 197 630 197 640 192"/>
  </g>
  <g class="red__corte"><path d="M586 206l28 28M614 206l-28 28"/></g>

  <rect class="red__muro" x="210" y="232" width="230" height="124"/>
  <rect class="red__techo" x="202" y="224" width="246" height="10" rx="2"/>
  ${paneles}
  <rect class="red__ventana" x="230" y="262" width="40" height="34" rx="3"/>
  <rect class="red__ventana" x="288" y="262" width="40" height="34" rx="3"/>
  <rect class="red__ventana" x="346" y="262" width="40" height="34" rx="3"/>
  <rect class="red__puerta" x="398" y="292" width="30" height="64" rx="2"/>

  <rect class="red__inversor" x="180" y="276" width="26" height="38" rx="4"/><circle class="red__led" cx="193" cy="286" r="3"/>
  <g class="red__bateria">
    <rect class="red__caja" x="92" y="286" width="66" height="70" rx="6"/>
    <rect class="red__celda" x="100" y="296" width="50" height="13" rx="2"/><rect class="red__celda" x="100" y="315" width="50" height="13" rx="2"/><rect class="red__celda" x="100" y="334" width="50" height="13" rx="2"/>
  </g>
  <circle class="red__medidor" cx="452" cy="268" r="11"/><path class="red__aguja" d="M452 268l5-6"/>

  <g class="red__generador">
    <rect class="red__escape" x="560" y="278" width="8" height="24"/>
    <rect class="red__caja" x="488" y="300" width="92" height="54" rx="5"/>
    <path class="red__rejilla" d="M498 312h34M498 322h34M498 332h34M498 342h34"/>
    <rect class="red__tablero" x="544" y="312" width="26" height="18" rx="2"/>
    <rect class="red__base" x="482" y="352" width="104" height="6"/>
    <path class="red__tubo" d="M640 374H534V358"/>
  </g>

  ${flujo("M112 96L250 198", "sol", "dia", "paneles")}
  ${flujo("M216 222C196 228 193 250 193 274", "luz", "dia", "paneles")}
  ${flujo("M206 300H238", "luz", "dia", "paneles")}
  ${flujo("M206 300H238", "luz", "noche apagon", "bateria")}
  ${flujo("M180 304L160 314", "luz", "dia", "paneles bateria")}
  ${flujo("M160 314L180 304", "luz", "noche apagon", "bateria")}
  ${flujo("M463 262C520 232 560 192 594 170", "luz", "dia", "paneles")}
  ${flujo("M594 170C560 192 520 232 463 262", "red", "noche gas")}
  ${flujo("M636 374H534V358", "gas", "gas", "generador")}
  ${flujo("M488 326H442", "luz", "gas", "generador")}
  ${flujo("M502 300C492 274 468 274 442 290", "calor", "gas", "generador")}

  ${marca(1, 322, 180)}${marca(2, 193, 258)}${marca(3, 125, 268)}${marca(4, 452, 242)}${marca(5, 600, 132)}${marca(6, 534, 282)}
</svg>`;

export function montarRed(el) {
  el.innerHTML = `
    <div class="red__escena" data-modo="dia">
      <div class="modo modo--red" role="group" aria-label="Situación">
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
  const claves = Object.keys(MODOS);
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
  poner("dia");
  setInterval(() => { if (automatico && el.isConnected) poner(claves[(actual + 1) % claves.length]); }, 5000);

  // Para el cotizador: muestra solo los equipos incluidos en el sistema
  return {
    incluir(equipos) {
      Object.assign(hay, equipos);
      for (const t of Object.keys(hay)) escena.classList.toggle(`sin-${t}`, !hay[t]);
      escena.classList.toggle("con-generador", hay.generador);
      poner(claves[actual]);
    },
    modo: (clave) => { automatico = false; poner(clave); },
  };
}
