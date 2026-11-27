// Propuesta preliminar en PDF, generada en el navegador del cliente.
// Usa html2pdf (html2canvas + jsPDF) cargado solo cuando se pide la propuesta.
import { pesos } from "./comun.js";

const LIB = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
let carga;
function cargarLib() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  carga ??= new Promise((ok, falla) => {
    const s = document.createElement("script");
    s.src = LIB;
    s.onload = () => (window.html2pdf ? ok(window.html2pdf) : falla(new Error("Librería de PDF no disponible.")));
    s.onerror = () => falla(new Error("No se pudo cargar el generador de PDF."));
    document.head.appendChild(s);
  });
  return carga;
}

// El generador de PDF dibuja los SVG como imagen y ahí no aplica la hoja de estilos del sitio:
// se copian los estilos calculados de cada elemento dentro del propio SVG.
const PROPS = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity", "display",
  "font-family", "font-size", "font-weight", "text-anchor"];
export function svgConEstilos(svg) {
  const copia = svg.cloneNode(true);
  const originales = [svg, ...svg.querySelectorAll("*")];
  const copias = [copia, ...copia.querySelectorAll("*")];
  originales.forEach((el, i) => {
    const cs = getComputedStyle(el);
    copias[i].setAttribute("style", PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(";"));
    copias[i].removeAttribute("class");
  });
  // Tamaño explícito según el viewBox para que se dibuje completo y proporcionado
  const [, , w, h] = (svg.getAttribute("viewBox") || "0 0 640 430").split(/\s+/).map(Number);
  copia.setAttribute("width", w);
  copia.setAttribute("height", h);
  copia.setAttribute("style", copia.getAttribute("style") + ";width:100%;height:auto;display:block");
  return copia.outerHTML;
}

const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const rango = (r) => `${pesos(r.bajo)} – ${pesos(r.alto)}`;

const C = { noche: "#0e1b2c", verde: "#22c870", verdeOsc: "#0f7f45", crema: "#f7f3ea", gris: "#5b6472", linea: "#e3ddd0" };
const td = "padding:6px 8px;border-bottom:1px solid " + C.linea + ";";

function bloqueTecnologia(t) {
  const datos = t.datos
    .map(([etq, val]) => `<td style="width:33%;padding:8px;vertical-align:top;background:${C.crema};border:3px solid #fff;">
        <div style="font-size:9px;color:${C.gris};text-transform:uppercase;letter-spacing:.05em;font-weight:700">${esc(etq)}</div>
        <div style="font-size:14px;font-weight:800;margin-top:2px">${esc(val)}</div></td>`);
  const filas = [];
  for (let i = 0; i < datos.length; i += 3) filas.push(`<tr>${datos.slice(i, i + 3).join("")}</tr>`);
  return `<div style="break-inside:avoid;margin:0 0 12px;border:1px solid ${C.linea};border-radius:10px;padding:12px 14px;">
    <table style="width:100%;border-collapse:collapse"><tr>
      <td style="font-size:15px;font-weight:800">${esc(t.nombre)}</td>
      <td style="text-align:right;font-size:13px;font-weight:700">${rango(t.inversion)} <span style="color:${C.gris};font-weight:400">+ IVA</span></td>
    </tr></table>
    <table style="width:100%;border-collapse:collapse;margin-top:6px">${filas.join("")}</table>
    ${t.nota ? `<p style="font-size:10px;color:${C.gris};margin:6px 0 0">${esc(t.nota)}</p>` : ""}
  </div>`;
}

export function htmlPropuesta(d) {
  const fecha = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const tabla = d.tecnologias
    .map((t) => `<tr><td style="${td}">${esc(t.nombre)}</td><td style="${td}text-align:right">${pesos(t.inversion.base)}</td></tr>`)
    .join("");
  return `
<div style="font-family:Inter,Arial,sans-serif;color:${C.noche};font-size:12px;line-height:1.45;width:100%;box-sizing:border-box;background:#fff">
  <table style="width:100%;border-collapse:collapse;background:${C.noche};color:#fff;border-radius:10px">
    <tr>
      <td style="padding:16px 18px;font-size:22px;font-weight:800">⚡ Bolt <span style="color:${C.verde}">Energy</span></td>
      <td style="padding:16px 18px;text-align:right;font-size:11px;color:#c3cddb">Propuesta preliminar<br><strong style="color:#fff;font-size:13px">Folio ${esc(d.folio)}</strong><br>${esc(fecha)}</td>
    </tr>
  </table>

  <h1 style="font-size:20px;margin:18px 0 4px">${esc(d.titulo)}</h1>
  <p style="margin:0;color:${C.gris}">Preparada para <strong style="color:${C.noche}">${esc(d.cliente)}</strong>. Estimado orientativo, no vinculante; el precio firme se entrega después de una visita técnica.</p>

  <table style="width:100%;border-collapse:collapse;margin:14px 0 16px">
    <tr>
      ${d.resumen.map(([e, v]) => `<td style="padding:8px 10px;background:${C.crema};border:3px solid #fff;vertical-align:top">
        <div style="font-size:9px;color:${C.gris};text-transform:uppercase;letter-spacing:.05em;font-weight:700">${esc(e)}</div>
        <div style="font-size:13px;font-weight:700;margin-top:2px">${esc(v)}</div></td>`).join("")}
    </tr>
  </table>

  ${d.ilustracion ? `<div style="break-inside:avoid;margin:0 auto 14px;width:72%;border-radius:12px;overflow:hidden">${d.ilustracion}</div>` : ""}

  <h2 style="font-size:15px;margin:0 0 8px">Sistema propuesto</h2>
  ${d.tecnologias.map(bloqueTecnologia).join("")}

  <div style="break-inside:avoid">
    <h2 style="font-size:15px;margin:14px 0 8px">Inversión</h2>
    <table style="width:100%;border-collapse:collapse">
      ${tabla}
      <tr><td style="${td}font-weight:800">Total base, sin IVA</td><td style="${td}text-align:right;font-weight:800">${pesos(d.total.base)}</td></tr>
      <tr><td style="${td}">IVA (${Math.round(d.iva * 100)} %)</td><td style="${td}text-align:right">${pesos(d.total.base * d.iva)}</td></tr>
      <tr><td style="${td}font-weight:800;border-bottom:0">Total con IVA</td><td style="${td}text-align:right;font-weight:800;border-bottom:0;color:${C.verdeOsc};font-size:14px">${pesos(d.total.base * (1 + d.iva))}</td></tr>
    </table>
    <p style="font-size:10px;color:${C.gris};margin:4px 0 0">Rango posible: ${rango(d.total)} sin IVA.</p>
  </div>

  <table style="width:100%;border-collapse:collapse;margin:14px 0;break-inside:avoid">
    <tr>
      ${d.indicadores.map(([e, v, det]) => `<td style="padding:10px 12px;background:${C.noche};color:#fff;border:3px solid #fff;vertical-align:top;width:${100 / d.indicadores.length}%">
        <div style="font-size:9px;color:#aebbcc;text-transform:uppercase;letter-spacing:.05em;font-weight:700">${esc(e)}</div>
        <div style="font-size:17px;font-weight:800;margin-top:2px">${esc(v)}</div>
        <div style="font-size:10px;color:#aebbcc">${esc(det)}</div></td>`).join("")}
    </tr>
  </table>

  <div style="break-inside:avoid">
    <h2 style="font-size:15px;margin:14px 0 6px">Supuestos del cálculo</h2>
    <ul style="margin:0;padding-left:16px;color:${C.gris};font-size:10.5px">${d.supuestos.map((s) => `<li style="margin:2px 0">${esc(s)}</li>`).join("")}</ul>
  </div>

  <div style="break-inside:avoid;margin-top:14px;padding:12px 14px;border-radius:10px;background:#d9f6e6">
    <strong>Siguiente paso: visita técnica.</strong> Revisamos tu sitio, tu recibo y tu conexión para entregarte una propuesta firme con equipo, precio, plazos y garantías.
    ${d.whatsapp ? `Escríbenos al WhatsApp ${esc(d.whatsapp)} y menciona el folio ${esc(d.folio)}.` : `Menciona el folio ${esc(d.folio)} al contactarnos.`}
  </div>

  <p style="font-size:9px;color:${C.gris};margin:12px 0 0">Estimado educativo no vinculante. No constituye cotización, oferta ni asesoría. Los ahorros son rangos calculados con los datos capturados y parámetros que pueden cambiar; el resultado real depende de tu tarifa, consumo, clima, precio del gas y condiciones del sitio. Bolt Energy no es CFE.</p>
</div>`;
}

export async function descargarPropuesta(datos) {
  const html2pdf = await cargarLib();
  await html2pdf()
    .set({
      margin: [0.5, 0.5, 0.5, 0.5],
      filename: `Propuesta-Bolt-Energy-${datos.folio}.pdf`,
      image: { type: "jpeg", quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: "#ffffff", useCORS: true, scrollX: 0, scrollY: 0 },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    })
    .from(htmlPropuesta(datos), "string")
    .save();
}
