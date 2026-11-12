// Esquemas animados de cómo funciona cada solución.
// Cada esquema: nodos (cajas con icono), flujos (líneas animadas) y pasos que resaltan partes.
// Un paso puede cambiar el "estado" (por ejemplo día/noche o con luz/apagón) y con él los flujos visibles.

const W_NODO = 170;
const H_NODO = 58;

const ICONOS = {
  sol: `<circle cx="12" cy="12" r="5" fill="#f5b82e"/><g stroke="#f5b82e" stroke-width="2" stroke-linecap="round"><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g>`,
  luna: `<path d="M19 14.5A8 8 0 0 1 9.5 5a8 8 0 1 0 9.5 9.5z" fill="#c3cddb"/>`,
  panel: `<rect x="2" y="5" width="20" height="14" rx="2" fill="#2a4060" stroke="#8fa3bf" stroke-width="1.5"/><path d="M8.7 5v14M15.3 5v14M2 12h20" stroke="#8fa3bf" stroke-width="1.2"/>`,
  inversor: `<rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#f7f3ea" stroke-width="1.8"/><path d="M6 12c1.5-4 3-4 4.5 0s3 4 4.5 0 1.5-2 3-2" fill="none" stroke="#22c870" stroke-width="1.8" stroke-linecap="round"/>`,
  casa: `<path d="M3 11.5 12 4l9 7.5" fill="none" stroke="#f7f3ea" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5V20h13v-9.5" fill="none" stroke="#f7f3ea" stroke-width="1.8" stroke-linejoin="round"/><rect x="10" y="14" width="4" height="6" fill="#22c870"/>`,
  bateria: `<rect x="5" y="5" width="14" height="17" rx="2.5" fill="none" stroke="#f7f3ea" stroke-width="1.8"/><rect x="9" y="2" width="6" height="3" rx="1" fill="#f7f3ea"/><rect x="7.5" y="12" width="9" height="7.5" rx="1" fill="#22c870"/>`,
  medidor: `<circle cx="12" cy="12" r="9" fill="none" stroke="#f7f3ea" stroke-width="1.8"/><path d="M12 12l4-4" stroke="#22c870" stroke-width="2" stroke-linecap="round"/><path d="M6.5 15.5h11" stroke="#8fa3bf" stroke-width="1.5" stroke-linecap="round"/>`,
  torre: `<path d="M12 2 7 22M12 2l5 20M8.5 8h7M7.2 14h9.6M4 8h16M9.2 8l6.6 6M14.8 8l-6.6 6" fill="none" stroke="#8fa3bf" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  gas: `<path d="M12 2c2.5 4 6.5 6.5 6.5 11.5a6.5 6.5 0 0 1-13 0c0-3.2 1.6-5 3.2-6.5 0 2.4.8 4 2.4 4C11.1 8 10.4 5.300 12 2z" fill="#f08a4b"/>`,
  motor: `<rect x="2" y="8" width="15" height="10" rx="2" fill="none" stroke="#f7f3ea" stroke-width="1.8"/><path d="M17 11h3v4h-3M6 8V5h7v3M5 18v2M14 18v2" fill="none" stroke="#f7f3ea" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="9.5" cy="13" r="2.4" fill="#22c870"/>`,
  calor: `<g fill="none" stroke="#e8705d" stroke-width="2" stroke-linecap="round"><path d="M6 20c-2-3 2-5 0-8s2-5 0-8"/><path d="M12 20c-2-3 2-5 0-8s2-5 0-8"/><path d="M18 20c-2-3 2-5 0-8s2-5 0-8"/></g>`,
  tablero: `<rect x="4" y="2" width="16" height="20" rx="2" fill="none" stroke="#f7f3ea" stroke-width="1.8"/><path d="M8 7v5M12 7v5M16 7v5" stroke="#22c870" stroke-width="2.2" stroke-linecap="round"/><path d="M8 17h8" stroke="#8fa3bf" stroke-width="1.6" stroke-linecap="round"/>`,
  foco: `<path d="M12 2a7 7 0 0 0-4 12.700V17h8v-2.300A7 7 0 0 0 12 2z" fill="#f5b82e"/><path d="M9 20h6M10 22.500h4" stroke="#f7f3ea" stroke-width="1.8" stroke-linecap="round"/>`,
  fabrica: `<path d="M2 21V10l6 4v-4l6 4V5h6v16z" fill="none" stroke="#f7f3ea" stroke-width="1.8" stroke-linejoin="round"/><rect x="6" y="16" width="3" height="3" fill="#22c870"/><rect x="12" y="16" width="3" height="3" fill="#22c870"/>`,
};

export const ESQUEMAS = {
  solar: {
    titulo: "Paneles solares",
    alto: 348,
    nodos: [
      { id: "sol", x: 20, y: 20, icono: "sol", texto: "Sol", en: ["dia"] },
      { id: "paneles", x: 215, y: 20, icono: "panel", texto: "Paneles", sub: "550 W cada uno" },
      { id: "inversor", x: 410, y: 20, icono: "inversor", texto: "Inversor", sub: "convierte la energía" },
      { id: "casa", x: 410, y: 145, icono: "casa", texto: "Tu casa", sub: "o negocio" },
      { id: "medidor", x: 410, y: 270, icono: "medidor", texto: "Medidor", sub: "bidireccional" },
      { id: "cfe", x: 610, y: 270, w: 130, icono: "torre", texto: "Red CFE" },
    ],
    flujos: [
      { de: "sol", a: "paneles", tipo: "sol", en: ["dia"] },
      { de: "paneles", a: "inversor", tipo: "luz", en: ["dia"] },
      { de: "inversor", a: "casa", tipo: "luz", en: ["dia"] },
      { de: "casa", a: "medidor", tipo: "luz", en: ["dia"] },
      { de: "medidor", a: "cfe", tipo: "luz", en: ["dia"] },
      { de: "cfe", a: "medidor", tipo: "red", en: ["noche"] },
      { de: "medidor", a: "casa", tipo: "red", en: ["noche"] },
    ],
    pasos: [
      { titulo: "Los paneles captan el sol", texto: "Cada panel produce energía mientras hay luz.", nodos: ["sol", "paneles"], estado: "dia" },
      { titulo: "El inversor la convierte", texto: "La deja lista para tus aparatos.", nodos: ["inversor"], estado: "dia" },
      { titulo: "Tú la usas primero", texto: "Consumes lo que generas antes de tomar de CFE.", nodos: ["casa"], estado: "dia" },
      { titulo: "Lo que sobra va a la red", texto: "El medidor bidireccional cuenta lo que entregas.", nodos: ["medidor", "cfe"], estado: "dia" },
      { titulo: "De noche tomas de CFE", texto: "Pagas solo la diferencia entre lo que tomaste y lo que entregaste.", nodos: ["cfe", "medidor", "casa"], estado: "noche" },
    ],
  },

  baterias: {
    titulo: "Baterías de respaldo",
    alto: 318,
    nodos: [
      { id: "cfe", x: 20, y: 30, icono: "torre", texto: "Red CFE", en: ["normal"] },
      { id: "paneles", x: 20, y: 200, icono: "panel", texto: "Paneles", sub: "opcional" },
      { id: "inversor", x: 280, y: 30, icono: "inversor", texto: "Inversor híbrido" },
      { id: "bateria", x: 280, y: 200, icono: "bateria", texto: "Batería", sub: "módulos de 4.8 kWh" },
      { id: "tablero", x: 540, y: 30, icono: "tablero", texto: "Tablero", sub: "de respaldo" },
      { id: "cargas", x: 540, y: 200, icono: "foco", texto: "Lo importante", sub: "refri, luces, wifi" },
    ],
    flujos: [
      { de: "cfe", a: "inversor", tipo: "red", en: ["normal"] },
      { de: "paneles", a: "inversor", tipo: "sol", en: ["normal", "apagon"] },
      { de: "inversor", a: "bateria", tipo: "luz", en: ["normal"] },
      { de: "bateria", a: "inversor", tipo: "luz", en: ["apagon"] },
      { de: "inversor", a: "tablero", tipo: "luz", en: ["normal", "apagon"] },
      { de: "tablero", a: "cargas", tipo: "luz", en: ["normal", "apagon"] },
    ],
    pasos: [
      { titulo: "Con luz, la batería se carga", texto: "Con la red de CFE o con tus paneles.", nodos: ["cfe", "paneles", "inversor", "bateria"], estado: "normal" },
      { titulo: "Se va la luz", texto: "El inversor lo detecta y cambia solo a la batería.", nodos: ["inversor", "bateria"], estado: "apagon" },
      { titulo: "Lo importante sigue encendido", texto: "La batería alimenta el tablero de respaldo.", nodos: ["bateria", "tablero", "cargas"], estado: "apagon" },
      { titulo: "Vuelve la luz", texto: "El sistema regresa a la red y la batería se recarga.", nodos: ["cfe", "inversor", "bateria"], estado: "normal" },
    ],
    estados: { normal: "Con luz", apagon: "Apagón" },
  },

  cogeneracion: {
    titulo: "Cogeneración",
    alto: 330,
    nodos: [
      { id: "gas", x: 20, y: 130, icono: "gas", texto: "Gas natural", sub: "por ducto" },
      { id: "motor", x: 280, y: 130, icono: "motor", texto: "Generador a gas", sub: "en tu sitio" },
      { id: "cfe", x: 550, y: 10, icono: "torre", texto: "Red CFE", sub: "complemento" },
      { id: "planta", x: 550, y: 130, icono: "fabrica", texto: "Tu operación", sub: "electricidad" },
      { id: "calor", x: 550, y: 255, icono: "calor", texto: "Calor útil", sub: "agua caliente, vapor" },
    ],
    flujos: [
      { de: "gas", a: "motor", tipo: "gas" },
      { de: "motor", a: "planta", tipo: "luz" },
      { de: "motor", a: "calor", tipo: "calor" },
      { de: "cfe", a: "planta", tipo: "red" },
    ],
    pasos: [
      { titulo: "El gas llega por ducto", texto: "Es el combustible del sistema.", nodos: ["gas"] },
      { titulo: "Generas electricidad en tu sitio", texto: "Un motor a gas mueve el generador que alimenta tu operación.", nodos: ["motor", "planta"] },
      { titulo: "El calor también se aprovecha", texto: "El calor del motor puede servir para agua caliente, vapor o proceso. Por eso se llama Cogeneración.", nodos: ["motor", "calor"] },
      { titulo: "CFE sigue conectada", texto: "Tu conexión a la red puede quedar como complemento o respaldo, según el diseño.", nodos: ["cfe", "planta"] },
    ],
  },
};

function trazo(a, b) {
  const wa = a.w ?? W_NODO, wb = b.w ?? W_NODO;
  const ca = { x: a.x + wa / 2, y: a.y + H_NODO / 2 };
  const cb = { x: b.x + wb / 2, y: b.y + H_NODO / 2 };
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  if (Math.abs(dx) >= Math.abs(dy) || Math.abs(dy) < H_NODO) {
    const x1 = dx > 0 ? a.x + wa : a.x, x2 = dx > 0 ? b.x : b.x + wb;
    const m = (x1 + x2) / 2;
    return `M${x1} ${ca.y} C${m} ${ca.y}, ${m} ${cb.y}, ${x2} ${cb.y}`;
  }
  const y1 = dy > 0 ? a.y + H_NODO : a.y, y2 = dy > 0 ? b.y : b.y + H_NODO;
  const m = (y1 + y2) / 2;
  return `M${ca.x} ${y1} C${ca.x} ${m}, ${cb.x} ${m}, ${cb.x} ${y2}`;
}

function svgEsquema(q) {
  const porId = Object.fromEntries(q.nodos.map((n) => [n.id, n]));
  const flujos = q.flujos
    .map((f, i) => `<path class="linea linea--${f.tipo}" data-flujo="${i}" d="${trazo(porId[f.de], porId[f.a])}"/>`)
    .join("");
  const nodos = q.nodos
    .map((n) => {
      const w = n.w ?? W_NODO;
      return `<g class="nodo" data-nodo="${n.id}">
        <rect class="caja" x="${n.x}" y="${n.y}" width="${w}" height="${H_NODO}" rx="12"/>
        <g transform="translate(${n.x + 12} ${n.y + 17})">${ICONOS[n.icono]}</g>
        <text x="${n.x + 46}" y="${n.y + (n.sub ? 26 : 35)}">${n.texto}</text>
        ${n.sub ? `<text class="sub-nodo" x="${n.x + 46}" y="${n.y + 43}">${n.sub}</text>` : ""}
      </g>`;
    })
    .join("");
  return `<svg viewBox="0 0 760 ${q.alto}" role="img" aria-label="Esquema de ${q.titulo}">${flujos}${nodos}</svg>`;
}

// Monta un esquema interactivo dentro de `el`. Regresa { detener }.
export function montarEsquema(el, clave, { auto = true } = {}) {
  const q = ESQUEMAS[clave];
  const estados = q.estados;
  el.innerHTML = `
    <div class="esquema__dibujo">
      ${estados ? `<div class="modo modo--esquema" role="group" aria-label="Estado">${Object.entries(estados).map(([k, v]) => `<button type="button" data-estado="${k}">${v}</button>`).join("")}</div>` : ""}
      ${svgEsquema(q)}
    </div>
    <ol class="pasos-flujo">${q.pasos.map((p) => `<li tabindex="0"><strong>${p.titulo}</strong>${p.texto}</li>`).join("")}</ol>`;

  const pasos = [...el.querySelectorAll(".pasos-flujo li")];
  const nodos = [...el.querySelectorAll(".nodo")];
  const lineas = [...el.querySelectorAll(".linea")];
  const botones = [...el.querySelectorAll("[data-estado]")];
  const dibujo = el.querySelector(".esquema__dibujo");
  let actual = 0;
  let automatico = auto && !matchMedia("(prefers-reduced-motion: reduce)").matches;

  function activar(i) {
    actual = i;
    const paso = q.pasos[i];
    const estado = paso.estado;
    pasos.forEach((p, j) => p.classList.toggle("activo", j === i));
    nodos.forEach((n) => {
      const def = q.nodos.find((d) => d.id === n.dataset.nodo);
      n.classList.toggle("activo", paso.nodos.includes(def.id));
      n.classList.toggle("apagado", Boolean(estado && def.en && !def.en.includes(estado)));
    });
    lineas.forEach((l) => {
      const f = q.flujos[Number(l.dataset.flujo)];
      l.classList.toggle("off", Boolean(estado && f.en && !f.en.includes(estado)));
    });
    botones.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.estado === estado)));

    // En pantallas angostas el dibujo se desplaza: centra el primer nodo del paso
    if (dibujo.scrollWidth > dibujo.clientWidth + 4) {
      const def = q.nodos.find((d) => d.id === paso.nodos[0]);
      const centro = ((def.x + (def.w ?? W_NODO) / 2) / 760) * dibujo.scrollWidth;
      dibujo.scrollTo({ left: Math.max(0, centro - dibujo.clientWidth / 2), behavior: "smooth" });
    }
  }

  pasos.forEach((p, i) => {
    const elegir = () => { automatico = false; activar(i); };
    p.addEventListener("click", elegir);
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); elegir(); } });
  });
  nodos.forEach((n) =>
    n.addEventListener("click", () => {
      const i = q.pasos.findIndex((p) => p.nodos.includes(n.dataset.nodo));
      if (i >= 0) { automatico = false; activar(i); }
    })
  );
  botones.forEach((b) =>
    b.addEventListener("click", () => {
      const i = q.pasos.findIndex((p) => p.estado === b.dataset.estado);
      if (i >= 0) { automatico = false; activar(i); }
    })
  );

  activar(0);
  const reloj = setInterval(() => { if (automatico && el.isConnected) activar((actual + 1) % q.pasos.length); }, 3500);
  return { detener: () => clearInterval(reloj) };
}

// Monta automáticamente los esquemas declarados como <div data-esquema="solar">
export function montarEsquemasDeclarados() {
  document.querySelectorAll("[data-esquema]").forEach((el) => montarEsquema(el, el.dataset.esquema));
}
