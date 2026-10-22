# 📈 TradeLab — Emulador de Trading

Un **simulador de trading de criptomonedas** con precios **reales** (vía la API pública de Binance) y dinero **ficticio**. Pensado para aprender desde cero y ganar madurez sin arriesgar un euro.

> ⚠️ Herramienta **educativa**. No es asesoramiento financiero. La IA incluida es solo una **sugerencia** estadística: nunca ejecuta operaciones por sí sola.

---

## ✨ Qué incluye

- **Multi-mercado con datos reales** (sin API key): **cripto** en tiempo real (Binance) + **acciones, índices y materias primas** (Yahoo Finance, ~15 min de retraso). Watchlist con pestañas por tipo de activo y buscador.
  - Cripto (principales y secundarias), Acciones (Apple, Nvidia, Tesla, AMD, Netflix…), Índices (S&P 500, Nasdaq, Dow, DAX, IBEX 35) y Materias primas (Oro, Plata, Petróleo WTI/Brent, Gas, Cobre).
- **Asistente de IA con proveedor a elegir** (sección **Ajustes**, columna izquierda): **IA local** (Llama vía Ollama, privada y gratis) o **OpenRouter** (modelos en la nube; pones tu clave y eliges entre los **modelos gratuitos** que se listan actualizados en vivo). El chatbot enseña la interfaz y el coach evalúa tu experiencia con el proveedor elegido.
- **Operación conjunta (cesta)**: añade varias compras/ventas con «Añadir a la cesta» y revisa el **consejo combinado del conjunto** (a favor/en contra de la IA por orden y global) antes de ejecutarlas todas a la vez.
- **Asesor con datos externos**: combina la señal técnica del modelo ML con el **índice Miedo/Codicia** y el **sentimiento de titulares de noticias** para un consejo final matizado.
- **Perfiles de usuario**: crea varios perfiles (como en una app de streaming) y cambia entre ellos; cada uno tiene su propia cartera, operaciones, alertas y notificaciones, aisladas.
- **Ajuste de cartera desde el perfil**: simula **ingresar** y **retirar** fondos. El P&L se calcula frente a lo aportado neto (ingresos − retiros), así que mover efectivo no falsea tus resultados.
- **Moneda de visualización (€ / $ / £)**: selector en la cabecera para ver todos los importes y el gráfico en tu divisa, usando el tipo de cambio real de Binance (par EUR/USDT, GBP/USDT). Por defecto en €. Las operaciones se siguen liquidando en USDT.
- **Simulación de cartera**: empiezas con 10.000 USDT virtuales, con comisiones realistas (0,1%), posiciones, P&L e historial.
- **Análisis de la cartera con gráficas** (botón "Análisis"): modal con la evolución del valor en el tiempo, distribución (donut), resultado por posición (barras) y P&L realizado acumulado, más estadísticas (operaciones, aciertos, mejor/peor).
- **IA predictiva** (modelo ML entrenado con el histórico real): te da una señal (COMPRA / VENTA / NEUTRO), la probabilidad, su acierto histórico y **explica en qué indicadores se basa**.
- **Alertas de precio** + **sistema de notificaciones** en vivo (en la app y del navegador).
- **Centro de aprendizaje**: tutoriales, glosario y consejos integrados, más tips contextuales en cada panel y un onboarding guiado.
- **Diseño moderno y elegante** (tema oscuro, responsive).
- **Todo dockerizado**: un solo comando para levantarlo.

---

## 🚀 Puesta en marcha (Docker)

Requisitos: **Docker** y **Docker Compose** (Docker Desktop en Windows).

```bash
docker compose up --build
```

Cuando termine de construir, abre en el navegador:

```
http://localhost:8080
```

Para detenerlo:

```bash
docker compose down
```

Tus datos (saldo, operaciones, alertas) se guardan en un volumen Docker y **persisten** entre reinicios. Para empezar de cero puedes usar el botón **Reiniciar** de la cartera, o borrar el volumen:

```bash
docker compose down -v
```

### Configuración opcional

Copia `.env.example` a `.env` y ajusta lo que quieras:

| Variable          | Por defecto | Descripción                                   |
| ----------------- | ----------- | --------------------------------------------- |
| `APP_PORT`        | `8080`      | Puerto donde se abre la app                    |
| `INITIAL_BALANCE` | `10000`     | Saldo inicial de la cuenta demo (USDT)         |
| `FEE_RATE`        | `0.001`     | Comisión por operación (0,1%)                  |
| `POLL_INTERVAL`   | `3`         | Segundos entre refrescos de precio/alertas     |

---

## 🧭 Cómo usarlo (guía rápida)

1. **Elige una cripto** en la lista de la izquierda.
2. **Mira el gráfico** y cambia el intervalo (15m / 1h / 4h / 1D).
3. Consulta la **sugerencia de la IA** (y, sobre todo, *por qué* la da).
4. **Compra** indicando cuánto invertir en USDT; **vende** cuando quieras.
5. Revisa tu **cartera** y tu **P&L**.
6. Crea **alertas** de precio y deja que el simulador te avise.
7. Pulsa **🎓 Aprender** cuando tengas dudas.

---

## 🏗️ Arquitectura

```
┌──────────────┐     /api  /ws     ┌──────────────────┐     API pública
│  Frontend    │ ───────────────▶  │   Backend        │ ───────────────▶ Binance
│  React + Vite│   (proxy nginx)   │  FastAPI + ML    │
│  nginx :80   │ ◀───────────────  │  SQLite :8000    │
└──────────────┘    WebSocket      └──────────────────┘
      :8080                              volumen: /app/data
```

- **Backend** (`/backend`): FastAPI. Obtiene datos de Binance, simula la cartera (SQLite), entrena el modelo de IA (scikit-learn, RandomForest) y emite precios/notificaciones por WebSocket.
- **Frontend** (`/frontend`): React + Vite + Tailwind, gráficos con `lightweight-charts`. Servido por nginx, que además hace de proxy hacia el backend.

---

## 🧑‍💻 Desarrollo sin Docker (opcional)

**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
El frontend de desarrollo (`http://localhost:5173`) ya está configurado para proxyar al backend en el `:8000`.

---

## ❓ Notas

- **IA local (Llama vía Ollama):** la primera vez, el servicio `ollama` descarga el modelo (`llama3.2`, ~2 GB) automáticamente en segundo plano; mientras tanto el asistente responde con su guía integrada y, al terminar, pasa a usar el LLM. Recomendado disponer de **~4-8 GB de RAM** libres para Docker. Puedes cambiar el modelo con la variable `OLLAMA_MODEL` (p. ej. `llama3.1:8b` si tienes más recursos) y, si tienes GPU NVIDIA, descomentar el bloque `deploy` del servicio `ollama` en `docker-compose.yml` para acelerarlo. En CPU, la **primera** respuesta puede tardar; las siguientes van más rápidas.
- Acciones, índices y materias primas vienen de **Yahoo Finance** (gratis, sin clave) con ~15 min de retraso y solo cotizan en el **horario de cada mercado**; fuera de horario verás el último cierre.
- Si en tu país el dominio `api.binance.com` está bloqueado, el backend intenta automáticamente otros hosts públicos (`data-api.binance.vision`, etc.). Puedes personalizarlos con la variable `BINANCE_HOSTS`.
- El modelo de IA se entrena bajo demanda por símbolo y se cachea 15 minutos.
- El objetivo es **aprender**: equivócate todo lo que quieras, aquí es gratis. 🙂
```
