"""Asistente de IA (enseña la interfaz y aconseja) con proveedor seleccionable.

- Proveedor "local": LLM local (Llama vía Ollama), privado y gratis.
- Proveedor "openrouter": modelos en la nube (requiere la clave del usuario).
- Proveedor "deepseek": modelos DeepSeek en la nube (requiere clave de DeepSeek).

Si el LLM elegido no está disponible, se responde con una base de conocimiento
integrada, de modo que el asistente SIEMPRE funciona.
"""
import asyncio
import contextvars
import time

import httpx

from . import config, database

# Usuario que originó la llamada a la IA (lo fija el endpoint); se usa para
# atribuir el uso de IA en el panel de admin. None = sistema/anónimo.
current_user: contextvars.ContextVar[int | None] = contextvars.ContextVar("ai_user", default=None)

_pull_task: asyncio.Task | None = None
_pull_state = "unknown"  # unknown | downloading | ready | unavailable
_warmed = False

SYSTEM_PROMPT = (
    "Eres el asistente de 'TradeLab', un SIMULADOR de trading con precios reales y "
    "dinero FICTICIO, pensado para que un principiante aprenda sin riesgo. "
    "Ayudas en español, con tono cercano, claro y breve (frases cortas, usa listas cuando ayude). "
    "Enseñas a usar la interfaz y explicas conceptos de trading de forma sencilla. "
    "Reglas: NUNCA das asesoramiento financiero ni recomiendas invertir dinero real; "
    "recuerdas que la IA predictiva y el asesor son solo SUGERENCIAS orientativas; "
    "el mercado real es impredecible. La app tiene: lista de mercados (cripto, acciones, "
    "índices y materias primas) con buscador y pestañas; gráfico de velas con intervalos "
    "(15m/1h/4h/1d); panel de Comprar/Vender; cesta de órdenes; alertas de precio; cartera "
    "con P&L, gráficas y evaluación de experiencia; perfiles de usuario con ingresos/retiros; "
    "ajustes para elegir la IA (local u OpenRouter); selector de moneda (€/$/£); un panel de "
    "tendencias de mercado; un Agente IA que opera solo para compararse con él; y un panel de "
    "IA con la señal técnica más el sentimiento de mercado (Miedo/Codicia y noticias). "
    "Si en el contexto te doy las POSICIONES y el EFECTIVO del usuario, úsalos para darle ayuda "
    "concreta: por ejemplo, qué posición podría reducir para liberar cierto importe, o cómo va su "
    "cartera. Siempre como práctica educativa, recordando que no es asesoramiento. "
    "Responde SIEMPRE a lo que te preguntan (si preguntan por vender, habla de vender, no de comprar)."
)

INTERFACE_HELP = [
    (["comprar", "compra", "invertir", "operar", "orden", "compro"],
     "Para COMPRAR: elige un activo en la lista de la izquierda, mira el precio, y en el panel "
     "'Comprar' escribe cuánto quieres invertir (en tu moneda) y pulsa el botón verde. Es dinero "
     "ficticio, así que puedes practicar sin miedo."),
    (["vender", "venta", "cerrar", "vendo"],
     "Para VENDER: en el panel cambia a la pestaña 'Vender', indica la cantidad de la cripto/acción "
     "y confirma. Verás si cierras con ganancia o pérdida en tu cartera."),
    (["cesta", "conjunta", "varias", "lote"],
     "La CESTA te deja preparar varias compras y ventas a la vez y ejecutarlas de golpe. Añade "
     "órdenes con 'Añadir a la cesta' y revisa el consejo combinado antes de ejecutarla."),
    (["alerta", "aviso", "notificar", "notificación"],
     "Las ALERTAS de precio te avisan cuando un activo sube o baja de un precio objetivo. Créalas en "
     "el panel 'Alertas de precio'; el simulador vigila por ti y te manda una notificación."),
    (["cartera", "portfolio", "p&l", "pnl", "ganancia", "pérdida", "beneficio", "evaluación"],
     "En 'Mi cartera' ves tu valor total, efectivo, posiciones y P&L. Con 'Gráficas' ves su evolución "
     "y con 'Evaluación' un coach IA valora tu experiencia y te da consejos."),
    (["perfil", "usuario", "ingresar", "retirar", "fondos", "depositar"],
     "Cada PERFIL tiene su propia cartera. Desde tu perfil puedes INGRESAR o RETIRAR fondos ficticios. "
     "Mover efectivo no falsea tu P&L, que se mide sobre lo aportado neto."),
    (["ajustes", "ia", "openrouter", "local", "modelo", "proveedor"],
     "En AJUSTES (columna izquierda) puedes elegir qué IA usa el asistente: la LOCAL (Llama, privada "
     "y gratis) o OPENROUTER (modelos en la nube; necesitas tu clave y puedes elegir modelos gratuitos)."),
    (["moneda", "euro", "€", "divisa", "dólar"],
     "Con el selector de moneda de arriba puedes ver todos los importes en €, $ o £, con el tipo de "
     "cambio real. Las operaciones se liquidan internamente en dólares (USDT)."),
    (["predicción", "predictiva", "señal", "sugerencia"],
     "El panel de IA estima la probabilidad de que el precio suba y la combina con el sentimiento del "
     "mercado (Miedo/Codicia y noticias). Es SOLO una sugerencia para aprender a razonar, no una orden."),
    (["vela", "velas", "gráfico", "grafico", "chart", "interval"],
     "El GRÁFICO es de velas: cada vela es un periodo (según el intervalo). Verde = subió, roja = bajó. "
     "Las mechas marcan el máximo y mínimo."),
    (["rsi"], "El RSI (0-100) mide si un activo está 'sobrecomprado' (>70) o 'sobrevendido' (<30)."),
    (["miedo", "codicia", "sentimiento", "noticias"],
     "El asesor añade el índice Miedo/Codicia (ánimo del mercado cripto) y titulares con su sentimiento "
     "para matizar la señal técnica."),
]

GREETING = (
    "¡Hola! Soy tu asistente de TradeLab 👋 Puedo explicarte cómo usar la interfaz "
    "(comprar, vender, cesta, alertas, cartera, perfiles, ajustes) o conceptos de trading. ¿Qué te gustaría saber?"
)


def _kb_answer(question: str) -> str:
    q = question.lower()
    if any(g in q for g in ("hola", "buenas", "ayuda", "empezar", "qué puedes", "que puedes")):
        return GREETING
    best, best_score = None, 0
    for keys, text in INTERFACE_HELP:
        score = sum(1 for k in keys if k in q)
        if score > best_score:
            best, best_score = text, score
    if best:
        return best
    return (
        "Puedo ayudarte con la interfaz (comprar, vender, cesta, alertas, cartera, perfiles, ajustes) "
        "o con conceptos (velas, RSI, la IA y el asesor). Prueba a preguntarme algo como '¿cómo compro?' "
        "o '¿qué es el RSI?'."
    )


# ---------------- Proveedor / configuración ----------------
def _provider() -> str:
    return database.get_setting("ai_provider", "local")


def _openrouter_key() -> str:
    return database.get_setting("openrouter_key", "") or config.OPENROUTER_KEY_ENV


def _openrouter_model() -> str:
    return database.get_setting("openrouter_model", "")


def _deepseek_key() -> str:
    return database.get_setting("deepseek_key", "") or config.DEEPSEEK_KEY_ENV


def _deepseek_model() -> str:
    return database.get_setting("deepseek_model", "") or config.DEEPSEEK_MODEL_ENV


# ---------------- Ollama (local) ----------------
async def _ollama_get(path: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            r = await client.get(f"{config.OLLAMA_URL}{path}")
            r.raise_for_status()
            return r.json()
    except Exception:  # noqa: BLE001
        return None


async def _model_present() -> bool:
    tags = await _ollama_get("/api/tags")
    if not tags:
        return False
    names = [m.get("name", "") for m in tags.get("models", [])]
    want = config.OLLAMA_MODEL
    return any(n == want or n.split(":")[0] == want.split(":")[0] for n in names)


async def _warmup() -> None:
    global _warmed
    if _warmed:
        return
    try:
        async with httpx.AsyncClient(timeout=300.0) as client:
            await client.post(
                f"{config.OLLAMA_URL}/api/chat",
                json={"model": config.OLLAMA_MODEL,
                      "messages": [{"role": "user", "content": "Hola"}],
                      "stream": False, "keep_alive": "30m", "options": {"num_predict": 8}},
            )
        _warmed = True
    except Exception:  # noqa: BLE001
        pass


async def _pull_model() -> None:
    global _pull_state
    _pull_state = "downloading"
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            r = await client.post(
                f"{config.OLLAMA_URL}/api/pull",
                json={"name": config.OLLAMA_MODEL, "stream": False},
                timeout=httpx.Timeout(1800.0),
            )
            r.raise_for_status()
        _pull_state = "ready"
        await _warmup()
    except Exception:  # noqa: BLE001
        _pull_state = "unavailable"


async def ensure_model() -> None:
    global _pull_task, _pull_state
    if await _ollama_get("/api/tags") is None:
        _pull_state = "unavailable"
        return
    if await _model_present():
        _pull_state = "ready"
        if not _warmed:
            asyncio.create_task(_warmup())
        return
    if _pull_task is None or _pull_task.done():
        _pull_task = asyncio.create_task(_pull_model())


async def _ollama_chat(messages: list[dict], num_predict: int, temperature: float) -> str | None:
    if not await _model_present():
        await ensure_model()
        raise RuntimeError("El modelo local aún no está listo (descargándose o Ollama no disponible)")
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(
            f"{config.OLLAMA_URL}/api/chat",
            json={"model": config.OLLAMA_MODEL, "messages": messages, "stream": False,
                  "keep_alive": "30m",
                  "options": {"temperature": temperature, "num_ctx": 4096, "num_predict": num_predict}},
        )
        r.raise_for_status()
        data = r.json()
    return (data.get("message") or {}).get("content", "").strip() or None


# ---------------- OpenRouter (nube) ----------------
async def _openrouter_chat(messages: list[dict], num_predict: int, temperature: float) -> str | None:
    key = _openrouter_key()
    model = _openrouter_model()
    if not key:
        raise RuntimeError("Falta tu clave de OpenRouter (Ajustes)")
    if not model:
        raise RuntimeError("Elige un modelo de OpenRouter (Ajustes)")
    headers = {
        "Authorization": f"Bearer {key}",
        "HTTP-Referer": "http://localhost",
        "X-Title": "TradeLab",
        "Content-Type": "application/json",
    }
    body = {"model": model, "messages": messages, "max_tokens": num_predict, "temperature": temperature}
    async with httpx.AsyncClient(timeout=120.0) as client:
        data = None
        for attempt in range(2):
            r = await client.post(f"{config.OPENROUTER_URL}/chat/completions", headers=headers, json=body)
            if r.status_code == 429 and attempt == 0:
                await asyncio.sleep(2.0)  # rate-limit temporal: reintenta una vez
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"OpenRouter {r.status_code}: {r.text[:200]}")
            data = r.json()
            break
    if not data:
        raise RuntimeError("OpenRouter: sin respuesta tras reintento (rate-limited)")
    if data.get("error"):
        raise RuntimeError(f"OpenRouter: {data['error'].get('message', data['error'])}")

    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    content = msg.get("content")
    if isinstance(content, list):  # formato multimodal (lista de partes)
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    text = (content or "").strip()
    if not text:  # algunos modelos devuelven el texto en 'reasoning' o 'text'
        text = (msg.get("reasoning") or choice.get("text") or "").strip()
    if not text:
        raise RuntimeError("El modelo devolvió una respuesta vacía (prueba con otro modelo gratuito)")
    return text


# ---------------- DeepSeek (nube) ----------------
async def _deepseek_chat(messages: list[dict], num_predict: int, temperature: float) -> str | None:
    key = _deepseek_key()
    model = _deepseek_model()
    if not key:
        raise RuntimeError("Falta tu clave de DeepSeek (Ajustes)")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    body = {"model": model, "messages": messages, "max_tokens": num_predict, "temperature": temperature}
    async with httpx.AsyncClient(timeout=120.0) as client:
        data = None
        for attempt in range(2):
            r = await client.post(f"{config.DEEPSEEK_URL}/chat/completions", headers=headers, json=body)
            if r.status_code == 429 and attempt == 0:
                await asyncio.sleep(2.0)  # rate-limit temporal: reintenta una vez
                continue
            if r.status_code >= 400:
                raise RuntimeError(f"DeepSeek {r.status_code}: {r.text[:200]}")
            data = r.json()
            break
    if not data:
        raise RuntimeError("DeepSeek: sin respuesta tras reintento (rate-limited)")
    if data.get("error"):
        raise RuntimeError(f"DeepSeek: {data['error'].get('message', data['error'])}")

    choice = (data.get("choices") or [{}])[0]
    msg = choice.get("message") or {}
    text = (msg.get("content") or "").strip()
    if not text:
        raise RuntimeError("DeepSeek devolvió una respuesta vacía")
    return text


async def list_openrouter_models(only_free: bool = True) -> list[dict]:
    """Lista modelos de OpenRouter (endpoint público). Filtra los gratuitos."""
    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            r = await client.get(f"{config.OPENROUTER_URL}/models")
            r.raise_for_status()
            models = r.json().get("data", [])
    except Exception:  # noqa: BLE001
        return []
    out = []
    for m in models:
        pricing = m.get("pricing", {}) or {}
        is_free = (str(pricing.get("prompt", "0")) in ("0", "0.0")
                   and str(pricing.get("completion", "0")) in ("0", "0.0"))
        if only_free and not is_free:
            continue
        out.append({
            "id": m.get("id"),
            "name": m.get("name", m.get("id")),
            "context": m.get("context_length"),
        })
    out.sort(key=lambda x: x["name"] or "")
    return out


# ---------------- Enrutado ----------------
async def _run(messages: list[dict], num_predict: int, temperature: float, kind: str) -> dict:
    """Ejecuta el LLM del proveedor activo, registra el uso y devuelve detalle."""
    provider = _provider()
    if provider == "openrouter":
        model = _openrouter_model()
    elif provider == "deepseek":
        model = _deepseek_model()
    else:
        model = config.OLLAMA_MODEL
    t0 = time.time()
    text, ok, err = None, False, None
    try:
        if provider == "openrouter":
            text = await _openrouter_chat(messages, num_predict, temperature)
        elif provider == "deepseek":
            text = await _deepseek_chat(messages, num_predict, temperature)
        else:
            text = await _ollama_chat(messages, num_predict, temperature)
        ok = text is not None
        if not ok:
            err = "El modelo no devolvió texto"
    except Exception as exc:  # noqa: BLE001
        err = str(exc)
    latency = int((time.time() - t0) * 1000)
    try:
        database.log_ai(provider, model, kind, ok, latency, err, user_id=current_user.get())
    except Exception:  # noqa: BLE001
        pass
    return {"text": text, "ok": ok, "latencyMs": latency, "error": err, "provider": provider, "model": model}


async def _run_with_fallback(messages: list[dict], num_predict: int, temperature: float, kind: str) -> str | None:
    """Ejecuta el proveedor configurado y, si falla OpenRouter, prueba la IA local."""
    res = await _run(messages, num_predict, temperature, kind)
    if res["text"]:
        return res["text"]
    if _provider() in ("openrouter", "deepseek"):  # respaldo a la IA local
        t0 = time.time()
        text, ok, err = None, False, None
        try:
            text = await _ollama_chat(messages, num_predict, temperature)
            ok = text is not None
            if not ok:
                err = "sin texto (local)"
        except Exception as exc:  # noqa: BLE001
            err = str(exc)
        try:
            database.log_ai("local", config.OLLAMA_MODEL, kind + "-fallback", ok, int((time.time() - t0) * 1000), err, user_id=current_user.get())
        except Exception:  # noqa: BLE001
            pass
        return text
    return None


async def _run_chat(messages: list[dict], num_predict: int = 400, temperature: float = 0.5, kind: str = "chat") -> str | None:
    return await _run_with_fallback(messages, num_predict, temperature, kind)


async def test() -> dict:
    """Llamada de prueba al proveedor configurado para comprobar que responde."""
    res = await _run(
        [{"role": "user", "content": "Responde únicamente con: OK"}],
        num_predict=16, temperature=0, kind="test",
    )
    return {
        "ok": res["ok"],
        "provider": res["provider"],
        "model": res["model"],
        "latencyMs": res["latencyMs"],
        "reply": (res["text"] or "")[:120],
        "error": res["error"],
    }


def get_log(limit: int = 50) -> list[dict]:
    return database.get_ai_log(limit)


async def status() -> dict:
    provider = _provider()
    if provider == "openrouter":
        model = _openrouter_model()
        has_key = bool(_openrouter_key())
        if has_key and model:
            state, msg = "ready", f"OpenRouter · {model.split('/')[-1]}"
        elif not has_key:
            state, msg = "unavailable", "Falta tu clave de OpenRouter (Ajustes)"
        else:
            state, msg = "unavailable", "Elige un modelo de OpenRouter (Ajustes)"
        return {"provider": "openrouter", "state": state, "model": model, "llm": state == "ready", "message": msg}

    if provider == "deepseek":
        model = _deepseek_model()
        has_key = bool(_deepseek_key())
        if has_key and model:
            state, msg = "ready", f"DeepSeek · {model}"
        else:
            state, msg = "unavailable", "Falta tu clave de DeepSeek (Ajustes)"
        return {"provider": "deepseek", "state": state, "model": model, "llm": state == "ready", "message": msg}

    # local
    await ensure_model()
    present = await _model_present()
    if present:
        state = "ready"
    elif _pull_state == "downloading":
        state = "downloading"
    elif await _ollama_get("/api/tags") is None:
        state = "unavailable"
    else:
        state = _pull_state if _pull_state in ("downloading", "unavailable") else "preparing"
    return {
        "provider": "local",
        "state": state,
        "model": config.OLLAMA_MODEL,
        "llm": state == "ready",
        "message": {
            "ready": "Llama local listo",
            "downloading": "Descargando el modelo local…",
            "preparing": "Preparando el modelo…",
            "unavailable": "LLM local no disponible; uso la guía integrada",
        }.get(state, ""),
    }


# ---------------- API pública ----------------
async def complete(system_prompt: str, user_prompt: str, num_predict: int = 500, kind: str = "coach") -> str | None:
    return await _run_chat(
        [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
        num_predict=num_predict, temperature=0.5, kind=kind,
    )


def _context_block(ctx: dict | None) -> str:
    if not ctx:
        return ""
    parts = []
    if ctx.get("symbolName"):
        parts.append(f"Activo mostrado: {ctx['symbolName']} ({ctx.get('category','')}).")
    if ctx.get("price") is not None:
        parts.append(f"Precio actual: {ctx['price']} USD.")
    if ctx.get("signal"):
        parts.append(f"Señal técnica de la IA: {ctx['signal']} (prob. subida {ctx.get('probabilityUp','?')}%).")
    if ctx.get("verdict"):
        parts.append(f"Asesor combinado: {ctx['verdict']} — {ctx.get('explanation','')}")
    if ctx.get("equity") is not None:
        parts.append(f"Cartera del usuario: valor {ctx['equity']} USD, P&L {ctx.get('pnl','?')} USD.")
    if ctx.get("balance") is not None:
        parts.append(f"Efectivo disponible: {ctx['balance']} USD.")
    if ctx.get("holdings"):
        hs = ", ".join(f"{h.get('name')} (~{h.get('value')} USD)" for h in ctx["holdings"][:10])
        parts.append(f"Posiciones actuales del usuario: {hs if hs else 'ninguna'}.")
    elif ctx.get("equity") is not None:
        parts.append("El usuario no tiene posiciones abiertas ahora mismo (todo en efectivo).")
    return ("Contexto actual de la app (úsalo si es relevante para responder):\n" + "\n".join(parts)) if parts else ""


async def chat(messages: list[dict], ctx: dict | None = None) -> dict:
    last_user = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")

    chat_messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    ctx_block = _context_block(ctx)
    if ctx_block:
        chat_messages.append({"role": "system", "content": ctx_block})
    chat_messages += [
        {"role": m["role"], "content": m["content"]}
        for m in messages[-8:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    reply = await _run_chat(chat_messages, num_predict=320, temperature=0.4, kind="chat")
    if reply:
        return {"reply": reply, "source": _provider()}
    return {"reply": _kb_answer(last_user), "source": "kb"}
