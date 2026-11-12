import { cargarParametros, crearLead, urlWhatsApp } from "./comun.js";

await cargarParametros();
const form = document.getElementById("form-contacto");
const error = document.getElementById("c-error");
const folio = document.getElementById("c-folio");

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const nombre = form.nombre.value.trim();
  const whatsapp = form.whatsapp.value.replace(/\D/g, "");
  let msg = "";
  if (!nombre) msg = "Escribe tu nombre.";
  else if (whatsapp.length !== 10) msg = "El WhatsApp debe tener 10 dígitos.";
  else if (!form.consentimiento.checked) msg = "Necesitamos tu consentimiento para continuar.";
  error.textContent = msg;
  error.hidden = !msg;
  if (msg) return;

  const entrada = { interes: form.interes.value, mensaje: form.mensaje.value.trim() };
  const boton = form.querySelector('button[type="submit"]');
  boton.disabled = true;
  const lead = await crearLead({ origen: "contacto", mercado: form.mercado.value, contacto: { nombre, whatsapp }, entrada, resultado: null, resumen: `Contacto. Interés: ${entrada.interes}.${entrada.mensaje ? " " + entrada.mensaje : ""}` });
  const texto =
    `Hola, soy ${nombre}. Me interesa: ${entrada.interes}.\nFolio ${lead.folio}` + (entrada.mensaje ? `\n${entrada.mensaje}` : "");
  boton.disabled = false;
  folio.hidden = false;
  folio.innerHTML =
    `<p>Listo. Tu folio es <strong>${lead.folio}</strong>. Envíanoslo por WhatsApp para que te respondamos.</p>` +
    `<div class="acciones" style="margin-top:.5rem"><a class="btn btn--pri" href="${urlWhatsApp(texto)}" target="_blank" rel="noopener">Enviar por WhatsApp</a></div>`;
  folio.scrollIntoView({ behavior: "smooth", block: "center" });
});
