import { useCallback, useEffect, useRef, useState } from "react";
import { CandlestickChart, GraduationCap, BadgeDollarSign, ShoppingCart, Settings } from "lucide-react";
import { api, connectWS, getUserId, setUserId, setInstrumentMeta, coinName, instrumentMeta } from "./api";
import Watchlist from "./components/Watchlist";
import PriceChart from "./components/PriceChart";
import AIPanel from "./components/AIPanel";
import TradePanel from "./components/TradePanel";
import PortfolioPanel from "./components/PortfolioPanel";
import AlertsPanel from "./components/AlertsPanel";
import NotificationCenter from "./components/NotificationCenter";
import LearnDrawer from "./components/LearnDrawer";
import Onboarding from "./components/Onboarding";
import Toasts from "./components/Toasts";
import UserMenu from "./components/UserMenu";
import ProfileModal from "./components/ProfileModal";
import CurrencySelector from "./components/CurrencySelector";
import ChatAssistant from "./components/ChatAssistant";
import SettingsModal from "./components/SettingsModal";
import BasketModal from "./components/BasketModal";
import MarketTrendsCard from "./components/MarketTrendsCard";

export default function App() {
  const [tickers, setTickers] = useState({});
  const [selected, setSelected] = useState("BTCUSDT");
  const [interval, setIntervalVal] = useState("1h");
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [toasts, setToasts] = useState([]);

  const [usersList, setUsersList] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [advisor, setAdvisor] = useState(null);
  const [basket, setBasket] = useState([]);
  const [basketOpen, setBasketOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Plegado de cards del dashboard (persistido en localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tradelab_dashboard") || "{}");
    } catch (_) {
      return {};
    }
  });
  const toggleCollapsed = useCallback((key) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("tradelab_dashboard", JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  const addToBasket = (item) =>
    setBasket((b) => [...b, { ...item, id: `${Date.now()}-${Math.random()}` }]);
  const removeFromBasket = (id) => setBasket((b) => b.filter((x) => x.id !== id));
  const clearBasket = () => setBasket([]);

  const toastId = useRef(0);
  const addToast = useCallback((message, type = "info") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const refreshPortfolio = useCallback(() => {
    api.portfolio().then(setPortfolio).catch(() => {});
    api.trades().then(setTrades).catch(() => {});
  }, []);
  const refreshAlerts = useCallback(() => {
    api.alerts().then(setAlerts).catch(() => {});
  }, []);
  const refreshNotifications = useCallback(() => {
    api
      .notifications()
      .then((d) => {
        setNotifications(d.items);
        setUnread(d.unread);
      })
      .catch(() => {});
  }, []);

  // --- Bootstrap: usuarios + mercado (una vez) ---
  useEffect(() => {
    if (!localStorage.getItem("tradelab_onboarded")) setShowOnboarding(true);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    api
      .users()
      .then((list) => {
        setUsersList(list);
        let uid = getUserId();
        if (!uid || !list.some((u) => u.id === uid)) {
          uid = list[0]?.id;
        }
        setUserId(uid);
        setCurrentUserId(uid);
      })
      .catch((e) => addToast("No se pudieron cargar los perfiles: " + e.message, "danger"));

    api
      .symbols()
      .then((listSym) => {
        setInstrumentMeta(listSym);
        const map = {};
        listSym.forEach((t) => (map[t.symbol] = t));
        setTickers(map);
      })
      .catch((e) => addToast("No se pudo cargar el mercado: " + e.message, "danger"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Datos por usuario + WebSocket (al cambiar de usuario) ---
  useEffect(() => {
    if (!currentUserId) return;
    refreshPortfolio();
    refreshAlerts();
    refreshNotifications();

    const disconnect = connectWS((msg) => {
      setConnected(true);
      if (msg.type === "prices") {
        setTickers((prev) => {
          const next = { ...prev };
          msg.data.forEach((t) => {
            next[t.symbol] = { ...next[t.symbol], ...t };
          });
          return next;
        });
      } else if (msg.type === "notification") {
        if (typeof msg.unread === "number") setUnread(msg.unread);
        refreshNotifications();
        if (Array.isArray(msg.data)) {
          msg.data.forEach((n) => {
            addToast(n.message, "warning");
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("🔔 Alerta de precio", { body: n.message });
            }
          });
        }
      }
    });

    const pfInterval = setInterval(refreshPortfolio, 8000);
    return () => {
      disconnect();
      clearInterval(pfInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // --- Gestión de perfiles ---
  const switchUser = (id) => {
    if (id === currentUserId) return;
    setUserId(id);
    setConnected(false);
    setPortfolio(null);
    setCurrentUserId(id);
    addToast(`Perfil cambiado a ${usersList.find((u) => u.id === id)?.name || ""}`, "info");
  };

  const createUser = async (name) => {
    try {
      const u = await api.createUser(name);
      const list = await api.users();
      setUsersList(list);
      switchUser(u.id);
      addToast(`Perfil "${u.name}" creado`, "success");
    } catch (e) {
      addToast(e.message, "danger");
    }
  };

  const deleteUser = async (id) => {
    await api.deleteUser(id);
    const list = await api.users();
    setUsersList(list);
    setProfileOpen(false);
    if (id === currentUserId) {
      const next = list[0]?.id;
      setUserId(next);
      setCurrentUserId(next);
    }
    addToast("Perfil eliminado", "info");
  };

  const closeOnboarding = () => {
    localStorage.setItem("tradelab_onboarded", "1");
    setShowOnboarding(false);
  };

  const onTraded = () => {
    refreshPortfolio();
    refreshNotifications();
  };
  const openNotifications = () => {
    api.markRead().then(() => {
      setUnread(0);
      refreshNotifications();
    });
  };
  const clearNotifs = () => {
    api.clearNotifications().then(() => {
      setNotifications([]);
      setUnread(0);
    });
  };

  const ticker = tickers[selected];
  const livePrice = ticker?.price;
  const holding = portfolio?.holdings?.find((h) => h.symbol === selected);
  const currentUser = usersList.find((u) => u.id === currentUserId);

  // Crédito que generan las ventas ya puestas en la cesta (para financiar compras)
  const FEE = 0.001;
  const basketSellCredit = basket.reduce(
    (s, i) => (i.side === "SELL" ? s + (tickers[i.symbol]?.price || 0) * (i.quantity || 0) * (1 - FEE) : s),
    0
  );
  const basketBuyCost = basket.reduce(
    (s, i) => (i.side === "BUY" ? s + (i.quoteAmount || 0) * (1 + FEE) : s),
    0
  );
  const basketAvailable = (portfolio?.balance || 0) + basketSellCredit - basketBuyCost;

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] px-3 py-3 sm:px-5 sm:py-4">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lift">
            <CandlestickChart className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-none text-slate-900">TradeLab</h1>
            <span className="text-[11px] text-slate-400">Simulador de trading · práctica sin riesgo</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium lg:flex ${
              connected ? "border-up/20 bg-up-soft text-up" : "border-slate-200 bg-slate-100 text-slate-400"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse-soft bg-up" : "bg-slate-400"}`} />
            {connected ? "Conectado" : "Conectando…"}
          </span>
          <span className="hidden items-center gap-1.5 rounded-full border border-warn/20 bg-warn-soft px-3 py-1.5 text-[11px] font-semibold text-warn lg:flex">
            <BadgeDollarSign className="h-3.5 w-3.5" /> Dinero ficticio
          </span>
          <CurrencySelector />
          <button onClick={() => setBasketOpen(true)} className="icon-btn relative h-10 w-10" title="Cesta de órdenes">
            <ShoppingCart className="h-[18px] w-[18px]" />
            {basket.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                {basket.length}
              </span>
            )}
          </button>
          <NotificationCenter items={notifications} unread={unread} onOpen={openNotifications} onClear={clearNotifs} />
          <button onClick={() => setLearnOpen(true)} className="btn-primary !px-3 !py-2 text-sm">
            <GraduationCap className="h-4 w-4" /> <span className="hidden sm:inline">Aprender</span>
          </button>
          <UserMenu
            users={usersList}
            currentUser={currentUser}
            onSwitch={switchUser}
            onCreate={createUser}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        </div>
      </header>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-stretch">
        <div className="flex flex-col gap-3 xl:w-[280px] xl:shrink-0">
          <div className={collapsed.watchlist ? "" : "h-[440px] min-h-0 xl:flex-1"}>
            <Watchlist
              tickers={tickers}
              selected={selected}
              onSelect={setSelected}
              collapsed={!!collapsed.watchlist}
              onToggleCollapse={() => toggleCollapsed("watchlist")}
            />
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="card flex items-center gap-2.5 px-4 py-3 text-left transition hover:bg-slate-50"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <Settings className="h-4 w-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-slate-800">Ajustes</div>
              <div className="text-[11px] text-slate-400">Elige la IA: local u OpenRouter</div>
            </div>
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className={collapsed.chart ? "" : "h-[460px]"}>
            <PriceChart
              symbol={selected}
              interval={interval}
              onInterval={setIntervalVal}
              ticker={ticker}
              livePrice={livePrice}
              collapsed={!!collapsed.chart}
              onToggleCollapse={() => toggleCollapsed("chart")}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TradePanel
              symbol={selected}
              price={livePrice}
              balance={portfolio?.balance}
              holdingQty={holding?.quantity}
              advisor={advisor}
              basketSellCredit={basketSellCredit}
              basketAvailable={basketAvailable}
              onTraded={onTraded}
              onToast={addToast}
              onAddToBasket={addToBasket}
              collapsed={!!collapsed.trade}
              onToggleCollapse={() => toggleCollapsed("trade")}
            />
            <AlertsPanel
              symbol={selected}
              price={livePrice}
              alerts={alerts}
              onChanged={refreshAlerts}
              onToast={addToast}
              collapsed={!!collapsed.alerts}
              onToggleCollapse={() => toggleCollapsed("alerts")}
            />
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:w-[340px] xl:shrink-0">
          <MarketTrendsCard
            onSelect={setSelected}
            collapsed={!!collapsed.trends}
            onToggleCollapse={() => toggleCollapsed("trends")}
          />
          <AIPanel
            symbol={selected}
            interval={interval}
            onData={setAdvisor}
            collapsed={!!collapsed.ai}
            onToggleCollapse={() => toggleCollapsed("ai")}
          />
          <div className={collapsed.portfolio ? "" : "min-h-[360px] flex-1"}>
            <PortfolioPanel
              portfolio={portfolio}
              trades={trades}
              onChanged={refreshPortfolio}
              onSelect={setSelected}
              collapsed={!!collapsed.portfolio}
              onToggleCollapse={() => toggleCollapsed("portfolio")}
              onToast={addToast}
            />
          </div>
        </div>
      </div>

      <footer className="mt-6 pb-4 text-center text-[11px] text-slate-400">
        TradeLab · Emulador educativo con datos reales (Binance y Yahoo) y dinero ficticio. No es asesoramiento financiero.
      </footer>

      <LearnDrawer open={learnOpen} onClose={() => setLearnOpen(false)} />
      {profileOpen && currentUser && (
        <ProfileModal
          user={currentUser}
          portfolio={portfolio}
          usersCount={usersList.length}
          onClose={() => setProfileOpen(false)}
          onChanged={refreshPortfolio}
          onDeleteUser={deleteUser}
          onToast={addToast}
        />
      )}
      {basketOpen && (
        <BasketModal
          items={basket}
          balance={portfolio?.balance}
          onRemove={removeFromBasket}
          onClear={clearBasket}
          onExecuted={onTraded}
          onClose={() => setBasketOpen(false)}
          onToast={addToast}
        />
      )}
      {settingsOpen && (
        <SettingsModal onClose={() => setSettingsOpen(false)} onToast={addToast} />
      )}
      {showOnboarding && <Onboarding onClose={closeOnboarding} />}
      <ChatAssistant
        context={{
          symbolName: coinName(selected),
          category: instrumentMeta[selected]?.category,
          price: livePrice,
          equity: portfolio?.equity != null ? Math.round(portfolio.equity) : undefined,
          pnl: portfolio?.totalPnl != null ? Math.round(portfolio.totalPnl) : undefined,
          balance: portfolio?.balance != null ? Math.round(portfolio.balance) : undefined,
          holdings: (portfolio?.holdings || []).map((h) => ({
            name: coinName(h.symbol),
            value: Math.round(h.value),
          })),
        }}
      />
      <Toasts toasts={toasts} />
    </div>
  );
}
