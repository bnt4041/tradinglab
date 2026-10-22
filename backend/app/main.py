"""API FastAPI del emulador de trading (multi-activo + IA local + asesor)."""
import asyncio
import contextlib
import time

from fastapi import Depends, FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from . import advisor, alerts, assistant, auth, basket, bot, challenges, coach, config, database, external, groups, mailer, market, ml, portfolio, trends, users

app = FastAPI(title="Emulador de Trading", version="3.0.0")

# Mismo origen siempre (nginx hace de proxy delante del backend), así que no
# hace falta "*" — y con cookies de sesión, allow_credentials exige un origen
# explícito en vez de "*" según el propio spec de CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost", "http://localhost:5173",
        config.PUBLIC_ORIGIN,
    ],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

ACTIVE_CRYPTO: list[str] = list(config.CRYPTO_IDS)
YAHOO_IDS: list[str] = list(config.YAHOO_IDS)
_latest_prices: dict[str, float] = {}

SESSION_COOKIE = "sid"


def get_user_id(request: Request) -> int:
    uid = auth.get_user_id_from_token(request.cookies.get(SESSION_COOKIE))
    if uid is None:
        raise HTTPException(status_code=401, detail="No has iniciado sesión")
    return uid


def require_admin(user_id: int = Depends(get_user_id)) -> int:
    if not auth.is_admin(user_id):
        raise HTTPException(status_code=403, detail="Solo el admin puede hacer esto")
    return user_id


class ConnectionManager:
    def __init__(self) -> None:
        self.active: dict[WebSocket, int | None] = {}

    async def connect(self, ws, user_id):
        await ws.accept()
        self.active[ws] = user_id

    def disconnect(self, ws):
        self.active.pop(ws, None)

    async def broadcast(self, message):
        for ws in list(self.active):
            try:
                await ws.send_json(message)
            except Exception:  # noqa: BLE001
                self.disconnect(ws)

    async def send_to_user(self, user_id, message):
        for ws, uid in list(self.active.items()):
            if uid == user_id:
                try:
                    await ws.send_json(message)
                except Exception:  # noqa: BLE001
                    self.disconnect(ws)


manager = ConnectionManager()


def _ticker_payload(t: dict) -> dict:
    return {k: t.get(k) for k in ("symbol", "price", "changePercent", "high", "low", "volume")}


async def _broadcast_and_alert(tickers: list[dict]) -> None:
    for t in tickers:
        _latest_prices[t["symbol"]] = t["price"]
    triggered = alerts.check_alerts(_latest_prices)
    await manager.broadcast({"type": "prices", "data": [_ticker_payload(t) for t in tickers]})
    by_user: dict[int, list[dict]] = {}
    for tr in triggered:
        by_user.setdefault(tr["user_id"], []).append(tr)
    for uid, items in by_user.items():
        await manager.send_to_user(uid, {"type": "notification", "unread": alerts.unread_count(uid), "data": items})


async def crypto_loop() -> None:
    while True:
        try:
            tickers = await market.get_binance_tickers(ACTIVE_CRYPTO)
            await _broadcast_and_alert(tickers)
        except Exception as exc:  # noqa: BLE001
            print(f"[crypto_loop] {exc}")
        await asyncio.sleep(config.POLL_INTERVAL)


async def yahoo_loop() -> None:
    while True:
        try:
            tickers = await market.get_yahoo_tickers(YAHOO_IDS)
            if tickers:
                await _broadcast_and_alert(tickers)
        except Exception as exc:  # noqa: BLE001
            print(f"[yahoo_loop] {exc}")
        await asyncio.sleep(config.YAHOO_POLL_INTERVAL)


async def _prices_for_user(user_id: int) -> dict[str, float]:
    held = [p["symbol"] for p in portfolio.get_positions(user_id)]
    prices = dict(_latest_prices)
    for sym in held:
        if sym not in prices:
            with contextlib.suppress(Exception):
                prices[sym] = (await market.get_ticker(sym))["price"]
    return prices


async def _snapshot_user(user_id: int) -> dict:
    prices = await _prices_for_user(user_id)
    s = portfolio.portfolio_summary(user_id, prices)
    portfolio.record_snapshot(user_id, s["equity"], s["balance"], s["positionsValue"])
    return s


async def snapshot_loop() -> None:
    """Guarda periódicamente el valor de la cartera de cada usuario (incl. Agente IA)."""
    while True:
        await asyncio.sleep(60)
        try:
            for u in users.list_all_users():
                await _snapshot_user(u["id"])
        except Exception as exc:  # noqa: BLE001
            print(f"[snapshot_loop] {exc}")


async def bot_loop() -> None:
    """El Agente IA opera una vez al día (y una vez al arrancar si toca)."""
    await asyncio.sleep(25)  # dar tiempo a que haya precios
    while True:
        try:
            if time.time() - bot.last_run() >= 86400:  # 24h
                await bot.run_cycle(dict(_latest_prices))
        except Exception as exc:  # noqa: BLE001
            print(f"[bot_loop] {exc}")
        await asyncio.sleep(3600)  # revisa cada hora


@app.on_event("startup")
async def on_startup() -> None:
    database.init_db()
    global ACTIVE_CRYPTO
    try:
        ACTIVE_CRYPTO = await market.filter_valid_symbols(config.CRYPTO_IDS)
    except Exception:  # noqa: BLE001
        ACTIVE_CRYPTO = list(config.CRYPTO_IDS)
    with contextlib.suppress(Exception):
        await assistant.ensure_model()  # descarga el LLM en segundo plano
    with contextlib.suppress(Exception):
        users.ensure_bot()  # crea el perfil del Agente IA
    app.state.tasks = [
        asyncio.create_task(crypto_loop()),
        asyncio.create_task(yahoo_loop()),
        asyncio.create_task(snapshot_loop()),
        asyncio.create_task(bot_loop()),
    ]


@app.on_event("shutdown")
async def on_shutdown() -> None:
    for task in getattr(app.state, "tasks", []):
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


# ---------------- Modelos ----------------
class TradeRequest(BaseModel):
    symbol: str
    side: str
    quantity: float | None = None
    quoteAmount: float | None = None


class AlertRequest(BaseModel):
    symbol: str
    direction: str
    targetPrice: float
    note: str = ""


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class GroupCreateRequest(BaseModel):
    name: str


class GroupJoinRequest(BaseModel):
    code: str


class ChallengeCreateRequest(BaseModel):
    name: str
    days: int
    maxTrades: int
    includeBot: bool = False
    initialBalance: float = 10000


class ResetRequestRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    newPassword: str


class AdminResetPasswordRequest(BaseModel):
    newPassword: str


class AdminSetAdminRequest(BaseModel):
    isAdmin: bool


class CashRequest(BaseModel):
    amount: float


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]
    context: dict | None = None


class SettingsRequest(BaseModel):
    aiProvider: str | None = None
    openrouterModel: str | None = None
    openrouterKey: str | None = None
    deepseekModel: str | None = None
    deepseekKey: str | None = None


class BasketItem(BaseModel):
    symbol: str
    side: str
    quantity: float | None = None
    quoteAmount: float | None = None


class BasketRequest(BaseModel):
    items: list[BasketItem]


# ---------------- Salud y usuarios ----------------
@app.get("/api/health")
async def health():
    return {"status": "ok", "crypto": len(ACTIVE_CRYPTO), "yahoo": len(YAHOO_IDS)}


def _user_public(user_id: int) -> dict | None:
    u = users.get_user(user_id)
    if not u:
        return None
    return {"id": u["id"], "name": u["name"], "color": u["color"], "isAdmin": bool(u["is_admin"])}


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        SESSION_COOKIE, token, max_age=auth.SESSION_DAYS * 86400,
        httponly=True, samesite="lax", secure=True, path="/",
    )


# ---------------- Autenticación ----------------
@app.post("/api/auth/register")
async def register(req: RegisterRequest, response: Response):
    try:
        user = auth.register(req.name, req.email, req.password)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    token = auth.create_session(user["id"])
    _set_session_cookie(response, token)
    return {"user": _user_public(user["id"])}


@app.post("/api/auth/login")
async def login(req: LoginRequest, response: Response):
    try:
        user = auth.login(req.email, req.password)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    token = auth.create_session(user["id"])
    _set_session_cookie(response, token)
    return {"user": _user_public(user["id"])}


@app.post("/api/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        auth.delete_session(token)
    response.delete_cookie(SESSION_COOKIE, path="/")
    return {"ok": True}


@app.get("/api/auth/me")
async def auth_me(user_id: int = Depends(get_user_id)):
    return {"user": _user_public(user_id)}


@app.post("/api/auth/request-reset")
async def request_password_reset(req: ResetRequestRequest):
    token = auth.request_password_reset(req.email)
    if token:
        user = users.get_user_by_email(req.email)
        name = (user or {}).get("name", "")
        reset_url = f"{config.PUBLIC_ORIGIN}/?resetToken={token}"
        with contextlib.suppress(mailer.MailerError):
            await mailer.send_email(
                to=req.email.strip().lower(),
                subject="TradeLab · Restablecer tu contraseña",
                html_body=mailer.reset_email_html(name or "", reset_url),
            )
    # Siempre "ok", exista o no esa cuenta: no revelamos qué emails están registrados.
    return {"ok": True}


@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    try:
        auth.reset_password_with_token(req.token, req.newPassword)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


# ---------------- Administración ----------------
@app.get("/api/admin/users")
async def admin_list_users(admin_id: int = Depends(require_admin)):
    return auth.list_accounts()


@app.post("/api/admin/users/{target_id}/reset-password")
async def admin_reset_password(target_id: int, req: AdminResetPasswordRequest, admin_id: int = Depends(require_admin)):
    try:
        auth.admin_reset_password(target_id, req.newPassword)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


@app.post("/api/admin/users/{target_id}/admin")
async def admin_set_admin(target_id: int, req: AdminSetAdminRequest, admin_id: int = Depends(require_admin)):
    try:
        auth.set_admin(target_id, req.isAdmin)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"ok": True}


@app.post("/api/admin/test-email")
async def admin_test_email(admin_id: int = Depends(require_admin)):
    admin_user = users.get_user(admin_id)
    if not admin_user or not admin_user.get("email"):
        raise HTTPException(status_code=400, detail="Tu cuenta no tiene email")
    try:
        await mailer.send_email(
            to=admin_user["email"],
            subject="TradeLab · Correo de prueba",
            html_body="<p>Si lees esto, el SMTP de TradeLab está bien configurado.</p>",
        )
    except mailer.MailerError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    return {"ok": True}


# ---------------- Grupos y retos ----------------
@app.get("/api/groups")
async def my_groups(user_id: int = Depends(get_user_id)):
    return groups.list_my_groups(user_id)


@app.post("/api/groups")
async def create_group(req: GroupCreateRequest, user_id: int = Depends(get_user_id)):
    try:
        return groups.create_group(user_id, req.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/groups/join")
async def join_group(req: GroupJoinRequest, user_id: int = Depends(get_user_id)):
    try:
        return groups.join_group(user_id, req.code)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/groups/{group_id}")
async def group_detail(group_id: int, user_id: int = Depends(get_user_id)):
    group = groups.get_group(group_id)
    if not group or not groups.is_member(group_id, user_id):
        raise HTTPException(status_code=404, detail="Grupo no encontrado")
    return {
        "group": group,
        "members": groups.list_members(group_id),
        "challenges": challenges.list_group_challenges(group_id),
    }


async def _equity_now(uid: int) -> float:
    prices = await _prices_for_user(uid)
    return portfolio.portfolio_summary(uid, prices)["equity"]


@app.post("/api/groups/{group_id}/challenges")
async def create_challenge(group_id: int, req: ChallengeCreateRequest, user_id: int = Depends(get_user_id)):
    try:
        return challenges.create_challenge(
            group_id, user_id, req.name, req.days, req.maxTrades, req.includeBot, req.initialBalance,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.post("/api/challenges/{challenge_id}/join")
async def join_challenge(challenge_id: int, user_id: int = Depends(get_user_id)):
    try:
        return challenges.join_challenge(challenge_id, user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.get("/api/challenges/{challenge_id}")
async def challenge_detail(challenge_id: int, user_id: int = Depends(get_user_id)):
    challenge = challenges.get_challenge(challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Reto no encontrado")
    if not groups.is_member(challenge["group_id"], user_id):
        raise HTTPException(status_code=404, detail="Reto no encontrado")

    rows = challenges.participants(challenge_id)
    for r in rows:
        equity = await _equity_now(r["userId"])
        start = r["startEquity"] or equity or 1
        r["equity"] = equity
        r["returnPct"] = round(((equity - start) / start) * 100, 2) if start else 0.0
    rows.sort(key=lambda r: r["returnPct"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    now = time.time()
    return {
        "challenge": challenge,
        "ranking": rows,
        "daysLeft": max(0, round((challenge["end_at"] - now) / 86400, 1)),
        "finished": challenge["end_at"] <= now,
        "myTradesUsed": challenges.trades_used(challenge_id, user_id),
    }


# ---------------- Mercado ----------------
def _decorate(t: dict) -> dict:
    inst = config.instrument(t["symbol"]) or {}
    t["name"] = inst.get("name", t["symbol"])
    t["category"] = inst.get("category", "cripto")
    t["tier"] = inst.get("tier", "secundario")
    t["source"] = inst.get("source", "binance")
    return t


@app.get("/api/symbols")
async def symbols():
    results: list[dict] = []
    with contextlib.suppress(Exception):
        results += await market.get_binance_tickers(ACTIVE_CRYPTO)
    with contextlib.suppress(Exception):
        results += await market.get_yahoo_tickers(YAHOO_IDS)
    if not results:
        raise HTTPException(status_code=502, detail="No se pudieron cargar los mercados")
    return [_decorate(t) for t in results]


@app.get("/api/categories")
async def categories():
    return {"order": config.CATEGORIES, "labels": config.CATEGORY_LABELS}


@app.get("/api/ticker/{symbol}")
async def ticker(symbol: str):
    try:
        return await market.get_ticker(symbol)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/klines/{symbol}")
async def klines(symbol: str, interval: str = "1h", limit: int = 300):
    try:
        return await market.get_klines(symbol, interval=interval, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/predict/{symbol}")
async def predict(symbol: str, interval: str = "1h"):
    try:
        return await ml.predict(symbol, interval=interval)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/advisor/{symbol}")
async def get_advisor(symbol: str, interval: str = "1h"):
    try:
        return await advisor.advise(symbol, interval=interval)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/news/{symbol}")
async def get_news(symbol: str):
    return await external.get_news(symbol)


@app.get("/api/fear-greed")
async def fear_greed():
    return await external.get_fear_greed()


@app.get("/api/market/trends")
async def market_trends():
    try:
        return await trends.market_trends()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=str(exc))


@app.get("/api/rates")
async def rates():
    return await market.get_fx_rates()


# ---------------- Cartera ----------------
@app.get("/api/portfolio")
async def get_portfolio(user_id: int = Depends(get_user_id)):
    held = [p["symbol"] for p in portfolio.get_positions(user_id)]
    prices = dict(_latest_prices)
    for sym in held:
        if sym not in prices:
            with contextlib.suppress(Exception):
                prices[sym] = (await market.get_ticker(sym))["price"]
    return portfolio.portfolio_summary(user_id, prices)


@app.get("/api/trades")
async def get_trades(user_id: int = Depends(get_user_id)):
    return portfolio.get_trades(user_id)


@app.get("/api/portfolio/history")
async def portfolio_history(user_id: int = Depends(get_user_id)):
    await _snapshot_user(user_id)  # registra el punto actual al abrir
    snaps = portfolio.get_history(user_id)
    points = [{"t": s["ts"], "equity": s["equity"]} for s in snaps]
    acc = portfolio.get_account(user_id)
    created = acc.get("created_at", 0)
    net = acc.get("net_contributions", 0)
    # Punto de partida (capital aportado) para que la curva tenga inicio
    if not points or points[0]["t"] > created + 1:
        points.insert(0, {"t": created, "equity": net})
    return {"points": points, "net": net}


@app.get("/api/portfolio/stats")
async def portfolio_stats(user_id: int = Depends(get_user_id)):
    return portfolio.stats(user_id)


def _equity_history(uid: int) -> list[dict]:
    snaps = portfolio.get_history(uid)
    pts = [{"t": s["ts"], "equity": s["equity"]} for s in snaps]
    acc = portfolio.get_account(uid)
    created = acc.get("created_at", 0)
    if not pts or pts[0]["t"] > created + 1:
        pts.insert(0, {"t": created, "equity": acc.get("net_contributions", 0)})
    return pts


@app.get("/api/bot/compare")
async def bot_compare(user_id: int = Depends(get_user_id)):
    botu = users.ensure_bot()
    bot_id = botu["id"]
    with contextlib.suppress(Exception):
        await _snapshot_user(user_id)
    with contextlib.suppress(Exception):
        await _snapshot_user(bot_id)

    prices = dict(_latest_prices)
    for uid in (user_id, bot_id):
        for p in portfolio.get_positions(uid):
            if p["symbol"] not in prices:
                with contextlib.suppress(Exception):
                    prices[p["symbol"]] = (await market.get_ticker(p["symbol"]))["price"]

    us = portfolio.portfolio_summary(user_id, prices)
    bs = portfolio.portfolio_summary(bot_id, prices)
    diff = round(us["totalPnlPercent"] - bs["totalPnlPercent"], 2)
    leader = "user" if diff > 0.05 else "bot" if diff < -0.05 else "tie"

    return {
        "user": {
            "name": (users.get_user(user_id) or {}).get("name", "Tú"),
            "equity": us["equity"], "pnlPct": round(us["totalPnlPercent"], 2),
            "history": _equity_history(user_id),
        },
        "bot": {
            "name": botu["name"], "color": botu["color"],
            "equity": bs["equity"], "pnlPct": round(bs["totalPnlPercent"], 2),
            "history": _equity_history(bot_id),
            "holdings": bs["holdings"],
            "trades": portfolio.get_trades(bot_id, 12),
            "lastRun": bot.last_run(),
            "log": [n for n in alerts.list_notifications(bot_id, 40) if n["type"] == "signal"][:15],
        },
        "leader": leader, "diffPct": diff,
    }


@app.post("/api/bot/run")
async def bot_run():
    return await bot.run_cycle(dict(_latest_prices))


@app.get("/api/portfolio/evaluation")
async def portfolio_evaluation(user_id: int = Depends(get_user_id)):
    prices = await _prices_for_user(user_id)
    s = portfolio.portfolio_summary(user_id, prices)
    return await coach.evaluate(user_id, s["equity"], s["netContributions"])


@app.get("/api/account/movements")
async def get_movements(user_id: int = Depends(get_user_id)):
    return portfolio.get_cash_movements(user_id)


@app.post("/api/trade")
async def trade(req: TradeRequest, user_id: int = Depends(get_user_id)):
    symbol = req.symbol
    try:
        price = _latest_prices.get(symbol) or (await market.get_ticker(symbol))["price"]
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"No se pudo obtener el precio: {exc}")

    quantity = req.quantity
    if quantity is None and req.quoteAmount is not None:
        quantity = req.quoteAmount / price
    if quantity is None or quantity <= 0:
        raise HTTPException(status_code=400, detail="Indica una cantidad válida")

    # Señal de la IA en este momento (solo si ya está cacheada, sin bloquear)
    peek = ml.peek_signal(symbol, "1h")
    ai_signal = peek["signal"] if peek else None
    ai_prob = peek["prob"] if peek else None

    try:
        challenges.check_trade_allowed(user_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    try:
        if req.side.upper() == "BUY":
            result = portfolio.buy(user_id, symbol, quantity, price, ai_signal, ai_prob)
        elif req.side.upper() == "SELL":
            result = portfolio.sell(user_id, symbol, quantity, price, ai_signal, ai_prob)
        else:
            raise ValueError("side debe ser BUY o SELL")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    await manager.send_to_user(user_id, {"type": "notification", "unread": alerts.unread_count(user_id), "data": []})
    with contextlib.suppress(Exception):
        await _snapshot_user(user_id)
    return result


@app.post("/api/account/deposit")
async def deposit(req: CashRequest, user_id: int = Depends(get_user_id)):
    try:
        res = portfolio.deposit(user_id, req.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    with contextlib.suppress(Exception):
        await _snapshot_user(user_id)
    return res


@app.post("/api/account/withdraw")
async def withdraw(req: CashRequest, user_id: int = Depends(get_user_id)):
    try:
        res = portfolio.withdraw(user_id, req.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    with contextlib.suppress(Exception):
        await _snapshot_user(user_id)
    return res


@app.post("/api/account/reset")
async def reset_account(user_id: int = Depends(get_user_id)):
    database.reset_account(user_id)
    await manager.send_to_user(user_id, {"type": "notification", "unread": alerts.unread_count(user_id), "data": []})
    with contextlib.suppress(Exception):
        await _snapshot_user(user_id)
    return {"ok": True}


# ---------------- Alertas ----------------
@app.get("/api/alerts")
async def get_alerts(user_id: int = Depends(get_user_id)):
    return alerts.list_alerts(user_id)


@app.post("/api/alerts")
async def post_alert(req: AlertRequest, user_id: int = Depends(get_user_id)):
    try:
        return alerts.create_alert(user_id, req.symbol, req.direction, req.targetPrice, req.note)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.delete("/api/alerts/{alert_id}")
async def remove_alert(alert_id: int, user_id: int = Depends(get_user_id)):
    alerts.delete_alert(user_id, alert_id)
    return {"ok": True}


# ---------------- Notificaciones ----------------
@app.get("/api/notifications")
async def get_notifications(user_id: int = Depends(get_user_id)):
    return {"items": alerts.list_notifications(user_id), "unread": alerts.unread_count(user_id)}


@app.post("/api/notifications/read")
async def read_notifications(user_id: int = Depends(get_user_id)):
    alerts.mark_all_read(user_id)
    return {"ok": True}


@app.delete("/api/notifications")
async def clear_notifications(user_id: int = Depends(get_user_id)):
    alerts.clear_notifications(user_id)
    return {"ok": True}


# ---------------- Asistente IA ----------------
@app.get("/api/assistant/status")
async def assistant_status():
    return await assistant.status()


@app.post("/api/assistant/chat")
async def assistant_chat(req: ChatRequest):
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    return await assistant.chat(msgs, req.context)


# ---------------- Ajustes de IA ----------------
def _settings_payload() -> dict:
    return {
        "aiProvider": database.get_setting("ai_provider", "local"),
        "openrouterModel": database.get_setting("openrouter_model", ""),
        "hasOpenrouterKey": bool(database.get_setting("openrouter_key", "") or config.OPENROUTER_KEY_ENV),
        "deepseekModel": database.get_setting("deepseek_model", "") or config.DEEPSEEK_MODEL_ENV,
        "hasDeepseekKey": bool(database.get_setting("deepseek_key", "") or config.DEEPSEEK_KEY_ENV),
        "ollamaModel": config.OLLAMA_MODEL,
    }


@app.get("/api/settings")
async def get_settings(user_id: int = Depends(get_user_id)):
    return _settings_payload()


@app.post("/api/settings")
async def update_settings(req: SettingsRequest, admin_id: int = Depends(require_admin)):
    if req.aiProvider in ("local", "openrouter", "deepseek"):
        database.set_setting("ai_provider", req.aiProvider)
    if req.openrouterModel is not None:
        database.set_setting("openrouter_model", req.openrouterModel)
    if req.openrouterKey is not None and req.openrouterKey.strip():
        database.set_setting("openrouter_key", req.openrouterKey.strip())
    if req.deepseekModel is not None and req.deepseekModel.strip():
        database.set_setting("deepseek_model", req.deepseekModel.strip())
    if req.deepseekKey is not None and req.deepseekKey.strip():
        database.set_setting("deepseek_key", req.deepseekKey.strip())
    return _settings_payload()


@app.get("/api/openrouter/models")
async def openrouter_models():
    return await assistant.list_openrouter_models(only_free=True)


@app.post("/api/ai/test")
async def ai_test(admin_id: int = Depends(require_admin)):
    return await assistant.test()


@app.get("/api/ai/log")
async def ai_log(admin_id: int = Depends(require_admin)):
    return assistant.get_log(50)


# ---------------- Cesta (operación conjunta) ----------------
async def _notional(symbol: str, side: str, quantity: float | None, quote: float | None, price: float) -> float:
    if quote is not None:
        return quote
    if quantity is not None:
        return quantity * price
    return 0.0


@app.post("/api/basket/advice")
async def basket_advice(req: BasketRequest):
    items = []
    for it in req.items:
        sym = it.symbol
        try:
            price = _latest_prices.get(sym) or (await market.get_ticker(sym))["price"]
        except Exception:  # noqa: BLE001
            price = 0
        items.append({
            "symbol": sym, "side": it.side,
            "notional": await _notional(sym, it.side, it.quantity, it.quoteAmount, price),
        })
    if not items:
        raise HTTPException(status_code=400, detail="La cesta está vacía")
    return await basket.advise(items)


@app.post("/api/basket/execute")
async def basket_execute(req: BasketRequest, user_id: int = Depends(get_user_id)):
    results = []
    # Ejecutamos primero las VENTAS: su efectivo financia las compras de la cesta
    ordered = sorted(req.items, key=lambda it: 0 if it.side.upper() == "SELL" else 1)
    for it in ordered:
        sym = it.symbol
        try:
            challenges.check_trade_allowed(user_id)
            price = _latest_prices.get(sym) or (await market.get_ticker(sym))["price"]
            quantity = it.quantity
            if quantity is None and it.quoteAmount is not None:
                quantity = it.quoteAmount / price
            if not quantity or quantity <= 0:
                raise ValueError("Cantidad inválida")
            peek = ml.peek_signal(sym, "1h")
            ai_s = peek["signal"] if peek else None
            ai_p = peek["prob"] if peek else None
            if it.side.upper() == "BUY":
                portfolio.buy(user_id, sym, quantity, price, ai_s, ai_p)
            else:
                portfolio.sell(user_id, sym, quantity, price, ai_s, ai_p)
            results.append({"symbol": sym, "side": it.side.upper(), "ok": True})
        except ValueError as exc:
            results.append({"symbol": sym, "side": it.side.upper(), "ok": False, "error": str(exc)})
        except Exception as exc:  # noqa: BLE001
            results.append({"symbol": sym, "side": it.side.upper(), "ok": False, "error": str(exc)})

    await manager.send_to_user(user_id, {"type": "notification", "unread": alerts.unread_count(user_id), "data": []})
    with contextlib.suppress(Exception):
        await _snapshot_user(user_id)
    ok = sum(1 for r in results if r["ok"])
    return {"results": results, "executed": ok, "total": len(results)}


# ---------------- WebSocket ----------------
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    user_id = auth.get_user_id_from_token(ws.cookies.get(SESSION_COOKIE))
    await manager.connect(ws, user_id)
    try:
        if _latest_prices:
            await ws.send_json({
                "type": "prices",
                "data": [{"symbol": s, "price": p} for s, p in _latest_prices.items()],
            })
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:  # noqa: BLE001
        manager.disconnect(ws)
