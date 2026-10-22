// Contenido educativo en español: tutoriales, tips y glosario para principiantes.

export const TUTORIALS = [
  {
    id: "que-es",
    title: "¿Qué es este simulador?",
    icon: "🎓",
    body: [
      "Esto es un entorno de práctica con dinero FICTICIO pero precios REALES del mercado de criptomonedas (vía Binance).",
      "Empiezas con 10.000 USDT virtuales. Puedes comprar y vender sin ningún riesgo: el objetivo es aprender cómo se mueve el mercado y ganar confianza antes de arriesgar dinero real.",
      "Nada de lo que hagas aquí afecta a tu dinero real ni se conecta a ninguna cuenta real.",
    ],
  },
  {
    id: "primeros-pasos",
    title: "Tus primeros pasos",
    icon: "👣",
    body: [
      "1. Elige una cripto en la lista de la izquierda (por ejemplo Bitcoin).",
      "2. Observa el gráfico: cada vela representa un periodo de tiempo. Verde = subió, roja = bajó.",
      "3. En el panel de compra, escribe cuánto quieres invertir (en USDT) y pulsa COMPRAR.",
      "4. Ve a 'Mi cartera' para ver tu posición y si ganas o pierdes.",
      "5. Cuando quieras, VENDE para cerrar la posición y realizar el resultado.",
    ],
  },
  {
    id: "velas",
    title: "Cómo leer un gráfico de velas",
    icon: "🕯️",
    body: [
      "Cada vela tiene un cuerpo y dos 'mechas' (líneas finas arriba y abajo).",
      "El cuerpo muestra el precio de apertura y cierre. Si es verde, cerró más alto que abrió (subida). Si es roja, cerró más bajo (bajada).",
      "Las mechas muestran el máximo y el mínimo alcanzados en ese periodo.",
      "Muchas velas verdes seguidas indican tendencia alcista; muchas rojas, tendencia bajista.",
    ],
  },
  {
    id: "ia",
    title: "La IA predictiva (solo sugerencia)",
    icon: "🤖",
    body: [
      "El panel de IA entrena un modelo con el histórico real de precios y estima la probabilidad de que la próxima vela suba.",
      "Te da una señal (COMPRA / VENTA / NEUTRO), una confianza y los indicadores en los que se basa.",
      "MUY IMPORTANTE: es una ayuda educativa, NO un oráculo. Los mercados son impredecibles y ninguna IA acierta siempre. Úsala para entender el razonamiento, no para obedecer ciegamente.",
    ],
  },
  {
    id: "riesgo",
    title: "Gestión del riesgo",
    icon: "🛡️",
    body: [
      "Nunca inviertas todo en una sola operación. Diversifica.",
      "Define de antemano cuánto estás dispuesto a perder en cada operación (por ejemplo, un 1-2% de tu cartera).",
      "Usa las alertas de precio para no tener que vigilar la pantalla todo el día.",
      "La emoción es tu peor enemigo: evita operar por miedo (vender en pánico) o por codicia (comprar en euforia).",
    ],
  },
];

export const TIPS = [
  "Compra la duda, vende la euforia: cuando todo el mundo está eufórico suele ser tarde.",
  "La tendencia es tu amiga: operar a favor de la tendencia principal es más seguro que ir en contra.",
  "Cuida las comisiones: cada compra/venta tiene coste. Operar en exceso erosiona tus ganancias.",
  "El RSI por encima de 70 sugiere sobrecompra; por debajo de 30, sobreventa.",
  "Nunca inviertas dinero que no puedas permitirte perder (ni siquiera en real).",
  "Un plan aburrido y consistente suele batir a la genialidad impulsiva.",
  "Define tu objetivo de beneficio y tu límite de pérdida ANTES de entrar.",
  "El volumen confirma el movimiento: subidas con poco volumen son sospechosas.",
  "Guarda parte en liquidez (USDT): tener 'pólvora seca' te deja aprovechar caídas.",
  "Registra tus operaciones y revisa tus errores: el historial es tu mejor profesor.",
];

export const GLOSSARY = [
  ["USDT", "Tether, una 'stablecoin' ligada al dólar. Aquí es tu dinero virtual de referencia."],
  ["Posición", "La cantidad de una cripto que tienes comprada en un momento dado."],
  ["P&L", "Profit & Loss: tus ganancias o pérdidas, en dinero o porcentaje."],
  ["Volumen", "Cuánto se ha negociado de un activo. Más volumen = más interés/liquidez."],
  ["Volatilidad", "Cómo de bruscos son los movimientos de precio. Más volatilidad = más riesgo."],
  ["RSI", "Índice de Fuerza Relativa (0-100). Mide si un activo está sobrecomprado o sobrevendido."],
  ["MACD", "Indicador que compara dos medias móviles para medir la fuerza de la tendencia."],
  ["Media móvil (SMA/EMA)", "El precio medio de los últimos N periodos. Suaviza el ruido y marca tendencia."],
  ["Bandas de Bollinger", "Canal alrededor del precio que mide la volatilidad y los extremos."],
  ["Spread/Comisión", "El coste de operar. Aquí simulamos un 0,1% por operación, como un exchange real."],
  ["Mercado alcista (bull)", "Periodo en el que los precios suben de forma sostenida."],
  ["Mercado bajista (bear)", "Periodo en el que los precios bajan de forma sostenida."],
  ["HODL", "Mantener a largo plazo sin vender pese a las caídas (del inglés 'hold')."],
  ["Stop loss", "Nivel de precio al que decides vender para limitar pérdidas."],
];

// Tips contextuales que aparecen según la sección
export const CONTEXT_TIPS = {
  chart: "💡 Cambia el intervalo (15m, 1h, 1d) para ver el mercado a corto o largo plazo.",
  trade: "💡 Empieza con importes pequeños. Aquí es gratis equivocarse: aprovecha para experimentar.",
  ai: "💡 Fíjate en POR QUÉ la IA sugiere algo (los indicadores), no solo en la señal.",
  portfolio: "💡 Revisa tu P&L total: lo importante no es acertar siempre, sino ganar más de lo que pierdes.",
  alerts: "💡 Crea una alerta en un precio clave y deja que el simulador vigile por ti.",
};
