// Llamadas al backend por su API HTTP (sin librerías ni paso de compilación).
import { CONVEX_URL } from "./config.js";

// En desarrollo local se puede apuntar a un backend de pruebas sin tocar config.js:
//   localStorage.setItem("volt_backend_url", "http://127.0.0.1:3210")
function urlBase() {
  const local = ["localhost", "127.0.0.1"].includes(location.hostname);
  if (local) {
    try {
      const prueba = localStorage.getItem("volt_backend_url");
      if (prueba) return prueba;
    } catch {
      /* sin almacenamiento */
    }
  }
  return CONVEX_URL;
}

export const BACKEND = urlBase().replace(/\/$/, "");
export const hayBackend = Boolean(BACKEND);

// tipo: "query" | "mutation" | "action". Lanza Error con el mensaje del servidor si falla.
export async function llamar(tipo, ruta, args = {}, { tiempoMs = 10000 } = {}) {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), tiempoMs);
  try {
    const r = await fetch(`${BACKEND}/api/${tipo}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: ruta, args, format: "json" }),
      signal: control.signal,
    });
    const datos = await r.json();
    if (datos.status !== "success") {
      const mensaje = typeof datos.errorData === "string" ? datos.errorData : datos.errorMessage || "No se pudo completar la operación.";
      throw new Error(mensaje);
    }
    return datos.value;
  } finally {
    clearTimeout(reloj);
  }
}
