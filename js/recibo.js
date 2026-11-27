// Lectura automática del recibo de CFE.
// Por ahora lee recibos en PDF (los que se descargan de CFE), extrayendo su texto en el
// navegador: el archivo no se sube a ningún servidor. Los datos siempre se muestran para confirmar.

const MESES = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };
const num = (t) => Number(String(t).replace(/[,\s$]/g, ""));

function fecha(dia, mes, anio) {
  const m = MESES[mes.slice(0, 3).toUpperCase()];
  if (m === undefined) return null;
  let a = Number(anio);
  if (a < 100) a += 2000;
  return new Date(a, m, Number(dia));
}

// Interpreta el texto de un recibo. Regresa solo lo que encontró: { kwh, dias, total, tarifa }.
export function interpretarRecibo(texto) {
  const t = texto.replace(/\s+/g, " ");
  const r = {};

  const total = t.match(/TOTAL\s+A\s+PAGAR:?\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (total) r.total = Math.round(num(total[1]));

  const periodo = t.match(
    /PERIODO\s+FACTURADO:?\s*(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{2,4})\s*(?:-|–|al?)\s*(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{2,4})/i
  );
  if (periodo) {
    const ini = fecha(periodo[1], periodo[2], periodo[3]);
    const fin = fecha(periodo[4], periodo[5], periodo[6]);
    if (ini && fin) {
      const dias = Math.round((fin - ini) / 86400000);
      if (dias >= 20 && dias <= 70) r.dias = dias;
    }
  }

  const tarifa = t.match(/TARIFA:?\s*(DAC|PDBT|GDBT|GDMTO|GDMTH|RABT|1[A-F]?)\b/i);
  if (tarifa) r.tarifa = tarifa[1].toUpperCase();

  // Consumo del periodo. En el recibo real los números vienen así:
  //   "<lectura actual> <lectura anterior> <total> Basico 150 ... Intermedio 200 ... Excedente 312 ..."
  // 1) Tres enteros seguidos donde actual − anterior = total (lecturas del medidor).
  for (const m of t.matchAll(/(\d[\d,]*)\s+(\d[\d,]*)\s+(\d[\d,]*)(?![\d.,])/g)) {
    const [a, b, c] = [num(m[1]), num(m[2]), num(m[3])];
    if (c > 0 && a > b && a - b === c) { r.kwh = c; break; }
  }
  // 2) Suma de los escalones de la tarifa (básico, intermedio, excedente).
  if (!r.kwh) {
    let suma = 0;
    for (const m of t.matchAll(/(?:B[áa]sico|Intermedio(?:\s+(?:bajo|alto))?|Excedente)\s+([\d,]+)\s+\d+\.\d+\s+[\d,]+\.\d{2}/gi)) suma += num(m[1]);
    if (suma > 0) r.kwh = suma;
  }
  // 3) Otras formas comunes.
  if (!r.kwh) {
    const formas = [
      /Energ[ií]a\s*\(kWh\)\s*[\d,]+\s+[\d,]+\s+([\d,]+)/i,
      /Total\s+(?:del\s+)?periodo:?\s*([\d,]+)\s*kWh/i,
      /Consumo\s+(?:total\s+)?(?:del\s+periodo\s+)?(?:en\s+)?kWh:?\s*([\d,]+)/i,
      /kWh\s+(?:totales|consumidos|base):?\s*([\d,]+)/i,
    ];
    for (const re of formas) {
      const m = t.match(re);
      if (m && num(m[1]) > 0) { r.kwh = num(m[1]); break; }
    }
  }
  if (!(r.kwh > 0 && r.kwh < 5e7)) delete r.kwh;

  // Consumo histórico: "del 08 DIC 25 al 05 FEB 26 789 $2,515.00"
  const historial = [];
  for (const m of t.matchAll(/del\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})\s+al\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{2,4})\s+([\d,]+)\s+\$\s*([\d,]+(?:\.\d+)?)/gi)) {
    const ini = fecha(m[1], m[2], m[3]);
    const fin = fecha(m[4], m[5], m[6]);
    const kwh = num(m[7]);
    if (ini && fin && kwh > 0) historial.push({ kwh, dias: Math.round((fin - ini) / 86400000), total: Math.round(num(m[8])) });
  }
  if (historial.length) r.historial = historial.slice(0, 12);
  return r;
}

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let cargaPdfjs;
function cargarPdfjs() {
  cargaPdfjs ??= new Promise((ok, falla) => {
    const s = document.createElement("script");
    s.src = PDFJS + "pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";
      ok(window.pdfjsLib);
    };
    s.onerror = () => falla(new Error("No se pudo cargar el lector de PDF."));
    document.head.appendChild(s);
  });
  return cargaPdfjs;
}

async function textoDePdf(archivo) {
  const pdfjs = await cargarPdfjs();
  const pdf = await pdfjs.getDocument({ data: await archivo.arrayBuffer() }).promise;
  let texto = "";
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const pagina = await pdf.getPage(i);
    const contenido = await pagina.getTextContent();
    texto += contenido.items.map((it) => it.str).join(" ") + "\n";
  }
  return texto;
}

// Lee un archivo de recibo. Regresa { datos, mensaje }.
export async function leerRecibo(archivo) {
  const esPdf = archivo.type === "application/pdf" || /\.pdf$/i.test(archivo.name);
  if (!esPdf) {
    return { datos: {}, mensaje: "Por ahora leemos recibos en PDF (el que descargas de CFE). Con una foto, captura los tres datos a mano." };
  }
  let texto;
  try {
    texto = await textoDePdf(archivo);
  } catch {
    return { datos: {}, mensaje: "No pudimos abrir ese PDF. Captura los datos a mano." };
  }
  if (texto.replace(/\s/g, "").length < 40) {
    return { datos: {}, mensaje: "Ese PDF es una imagen escaneada y no trae texto. Captura los datos a mano." };
  }
  const datos = interpretarRecibo(texto);
  const leidos = Object.keys(datos).length;
  const faltan = ["kwh", "dias", "total"].filter((k) => datos[k] === undefined);
  const nombres = { kwh: "los kWh", dias: "los días del periodo", total: "el total a pagar" };
  const n = datos.historial?.length ?? 0;
  const mensaje =
    leidos === 0
      ? "No reconocimos los datos en ese PDF. Captúralos a mano."
      : faltan.length
        ? `Leímos parte del recibo. Falta capturar ${faltan.map((k) => nombres[k]).join(" y ")}.`
        : n
          ? `Leímos tu recibo y ${n} ${n === 1 ? "periodo anterior" : "periodos anteriores"}: usamos el promedio para no dimensionar con un solo periodo. Revisa que los datos coincidan.`
          : "Leímos tu recibo. Revisa que los datos coincidan.";
  return { datos, mensaje };
}
