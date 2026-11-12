// Deslizador con escala logarítmica + campo numérico sincronizado.
// Útil para montos que van de cientos a millones de pesos.

export function conectarDeslizador({ rango, numero, min, max, paso = 1, alCambiar }) {
  let lmin = Math.log(min);
  let lmax = Math.log(max);
  rango.min = 0;
  rango.max = 1000;
  rango.step = 1;

  const aValor = (pos) => {
    const v = Math.exp(lmin + (pos / 1000) * (lmax - lmin));
    const p = v > 10000 ? paso * 100 : v > 1000 ? paso * 10 : paso;
    return Math.round(v / p) * p;
  };
  const aPos = (v) => ((Math.log(Math.min(Math.max(v, min), max)) - lmin) / (lmax - lmin)) * 1000;
  const pintarPista = () => rango.style.setProperty("--pct", `${rango.value / 10}%`);

  rango.addEventListener("input", () => {
    numero.value = aValor(Number(rango.value));
    pintarPista();
    alCambiar?.(Number(numero.value));
  });
  numero.addEventListener("input", () => {
    const v = Number(numero.value);
    if (v > 0) {
      rango.value = aPos(v);
      pintarPista();
      alCambiar?.(v);
    }
  });

  return {
    fijar(v, { silencioso = false } = {}) {
      numero.value = v;
      rango.value = aPos(v);
      pintarPista();
      if (!silencioso) alCambiar?.(v);
    },
    limites(nmin, nmax) {
      min = nmin; max = nmax;
      lmin = Math.log(min); lmax = Math.log(max);
      return this;
    },
    get valor() { return Number(numero.value); },
  };
}

// Variante lineal (m², horas, etc.)
export function conectarDeslizadorLineal({ rango, numero, alCambiar }) {
  const pintar = () => {
    const pct = ((rango.value - rango.min) / (rango.max - rango.min)) * 100;
    rango.style.setProperty("--pct", `${pct}%`);
  };
  rango.addEventListener("input", () => { numero.value = rango.value; pintar(); alCambiar?.(Number(rango.value)); });
  numero.addEventListener("input", () => {
    if (Number(numero.value) > 0) { rango.value = numero.value; pintar(); alCambiar?.(Number(numero.value)); }
  });
  pintar();
  return {
    fijar(v) { numero.value = v; rango.value = v; pintar(); },
  };
}
