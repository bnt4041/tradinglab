import { useEffect, useState } from "react";
import {
  X, Trophy, Users, Plus, Copy, ArrowLeft, Bot, Calendar, Repeat, Crown, Check,
  Globe, Coins, Gift, UserPlus,
} from "lucide-react";
import { api, fmt } from "../api";

const MARKETS = [
  { id: "cripto", label: "Cripto" },
  { id: "acciones", label: "Acciones" },
  { id: "indices", label: "Índices" },
  { id: "materias", label: "Materias" },
];
const marketLabels = (list) =>
  !list || list.length === 0 || list.length === MARKETS.length
    ? "Todos los mercados"
    : MARKETS.filter((m) => list.includes(m.id)).map((m) => m.label).join(", ");

export default function GroupsModal({ currentUserId, onClose, onToast, onEnterChallenge }) {
  const [view, setView] = useState("list"); // list | group | challenge | open
  const [myGroups, setMyGroups] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [challengeDetail, setChallengeDetail] = useState(null);
  const [openList, setOpenList] = useState(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const loadGroups = () => api.groups().then(setMyGroups).catch((e) => onToast?.(e.message, "danger"));
  const loadOpen = () => api.openChallenges().then(setOpenList).catch((e) => onToast?.(e.message, "danger"));
  useEffect(() => { loadGroups(); /* eslint-disable-next-line */ }, []);

  const openGroup = (id) => {
    api.groupDetail(id).then((d) => { setGroupDetail(d); setView("group"); }).catch((e) => onToast?.(e.message, "danger"));
  };
  const openChallenge = (id) => {
    api.challengeDetail(id).then((d) => { setChallengeDetail(d); setView("challenge"); }).catch((e) => onToast?.(e.message, "danger"));
  };
  const openBrowse = () => { setView("open"); loadOpen(); };
  const back = () => {
    if (view === "challenge") return groupDetail ? openGroup(groupDetail.group.id) : openBrowse();
    setView("list"); loadGroups();
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) return;
    setBusy(true);
    try {
      const g = await api.createGroup(newGroupName.trim());
      setNewGroupName("");
      onToast?.(`Grupo "${g.name}" creado`, "success");
      openGroup(g.id);
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  const joinGroup = async () => {
    if (!joinCode.trim()) return;
    setBusy(true);
    try {
      const g = await api.joinGroup(joinCode.trim());
      setJoinCode("");
      onToast?.(`Te has unido a "${g.name}"`, "success");
      openGroup(g.id);
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).then(() => onToast?.("Código copiado", "info"));
  };

  // Crea un reto (de grupo o abierto) y salta a su cartera.
  const submitChallenge = async (payload, { open }) => {
    setBusy(true);
    try {
      const ch = open
        ? await api.createOpenChallenge(payload)
        : await api.createChallenge(groupDetail.group.id, payload);
      onToast?.(`Reto "${ch.name}" creado`, "success");
      onEnterChallenge?.(ch.id);
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  const joinChallenge = async (id) => {
    setBusy(true);
    try {
      await api.joinChallenge(id);
      onToast?.("Te has unido al reto", "success");
      onEnterChallenge?.(id);
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  const title = {
    list: "Grupos y retos",
    group: groupDetail?.group.name,
    challenge: challengeDetail?.challenge.name,
    open: "Retos abiertos",
  }[view];

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <button onClick={back} className="icon-btn h-8 w-8"><ArrowLeft className="h-4 w-4" /></button>
            )}
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Trophy className="h-5 w-5 text-brand-600" /> {title}
            </h2>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-5">
          {view === "list" && (
            <ListView
              groups={myGroups} onOpen={openGroup} onBrowseOpen={openBrowse}
              newGroupName={newGroupName} setNewGroupName={setNewGroupName} onCreate={createGroup}
              joinCode={joinCode} setJoinCode={setJoinCode} onJoin={joinGroup} busy={busy}
            />
          )}
          {view === "group" && groupDetail && (
            <GroupView detail={groupDetail} currentUserId={currentUserId}
              onOpenChallenge={openChallenge} onCopyCode={copyCode}
              onSubmitChallenge={submitChallenge} busy={busy} />
          )}
          {view === "open" && (
            <OpenView list={openList} onOpenChallenge={openChallenge}
              onSubmitChallenge={submitChallenge} busy={busy} />
          )}
          {view === "challenge" && challengeDetail && (
            <ChallengeView detail={challengeDetail} currentUserId={currentUserId}
              onJoin={() => joinChallenge(challengeDetail.challenge.id)}
              onEnter={() => onEnterChallenge?.(challengeDetail.challenge.id)} busy={busy} />
          )}
        </div>
      </div>
    </div>
  );
}

function ListView({ groups, onOpen, onBrowseOpen, newGroupName, setNewGroupName, onCreate, joinCode, setJoinCode, onJoin, busy }) {
  return (
    <div className="space-y-5">
      <button onClick={onBrowseOpen}
        className="flex w-full items-center gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-left hover:bg-brand-100">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white"><Globe className="h-4 w-4" /></span>
        <div className="flex-1">
          <div className="text-sm font-bold text-brand-800">Retos abiertos</div>
          <div className="text-[11px] text-brand-600">Explora y únete a retos públicos, o crea uno para cualquiera.</div>
        </div>
        <ArrowLeft className="h-4 w-4 rotate-180 text-brand-500" />
      </button>

      <div>
        <h3 className="card-title mb-2">Mis grupos</h3>
        {groups === null ? (
          <div className="py-4 text-center text-xs text-slate-400">Cargando…</div>
        ) : groups.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-3 py-6 text-center text-xs text-slate-400">
            Aún no estás en ningún grupo. Crea uno o únete con un código.
          </div>
        ) : (
          <div className="space-y-1.5">
            {groups.map((g) => (
              <button key={g.id} onClick={() => onOpen(g.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600"><Users className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{g.name}</div>
                  <div className="text-[11px] text-slate-400">{g.memberCount} miembro{g.memberCount !== 1 ? "s" : ""} · código {g.code}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="card-title mb-2">Crear grupo</h3>
        <div className="flex gap-2">
          <input className="input" placeholder="Nombre del grupo" value={newGroupName} maxLength={40}
            onChange={(e) => setNewGroupName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onCreate()} />
          <button onClick={onCreate} disabled={busy} className="btn-primary !px-3"><Plus className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="card-title mb-2">Unirme con un código</h3>
        <div className="flex gap-2">
          <input className="input uppercase" placeholder="CÓDIGO" value={joinCode} maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && onJoin()} />
          <button onClick={onJoin} disabled={busy} className="btn-primary whitespace-nowrap">Unirme</button>
        </div>
      </div>
    </div>
  );
}

function GroupView({ detail, currentUserId, onOpenChallenge, onCopyCode, onSubmitChallenge, busy }) {
  const { group, members, challenges } = detail;
  const now = Date.now() / 1000;
  return (
    <div className="space-y-5">
      <button onClick={() => onCopyCode(group.code)}
        className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100">
        <span className="text-xs text-slate-500">Código de invitación</span>
        <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-800">{group.code} <Copy className="h-3.5 w-3.5 text-slate-400" /></span>
      </button>

      <div>
        <h3 className="card-title mb-2">Miembros ({members.length})</h3>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ backgroundColor: m.color }}>
                {m.isBot ? <Bot className="h-3 w-3" /> : m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}{m.id === currentUserId && <span className="text-slate-400">(tú)</span>}
            </span>
          ))}
        </div>
      </div>

      <ChallengeList title="Retos" list={challenges} now={now} onOpen={onOpenChallenge} />

      <ChallengeForm allowOpen onSubmit={onSubmitChallenge} busy={busy} />
    </div>
  );
}

function OpenView({ list, onOpenChallenge, onSubmitChallenge, busy }) {
  const now = Date.now() / 1000;
  return (
    <div className="space-y-5">
      {list === null ? (
        <div className="py-4 text-center text-xs text-slate-400">Cargando…</div>
      ) : (
        <ChallengeList title="Retos abiertos ahora mismo" list={list} now={now} onOpen={onOpenChallenge}
          empty="No hay retos abiertos todavía. ¡Crea el primero!" showParticipants />
      )}
      <ChallengeForm forceOpen onSubmit={onSubmitChallenge} busy={busy} />
    </div>
  );
}

function ChallengeList({ title, list, now, onOpen, empty, showParticipants }) {
  return (
    <div>
      <h3 className="card-title mb-2">{title}</h3>
      {!list || list.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
          {empty || "Todavía no hay ningún reto aquí."}
        </div>
      ) : (
        <div className="space-y-1.5">
          {list.map((c) => {
            const finished = c.end_at <= now;
            return (
              <button key={c.id} onClick={() => onOpen(c.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100">
                <span className={`flex h-9 w-9 items-center justify-center rounded-full ${finished ? "bg-slate-200 text-slate-500" : "bg-up-soft text-up"}`}>
                  {c.is_open ? <Globe className="h-4 w-4" /> : <Trophy className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                    <span className="font-semibold text-slate-500">{fmt.usd(c.initial_balance)} USDT</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {c.days}d</span>
                    <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> {c.max_trades} mov.</span>
                    {!!c.prize && <span className="flex items-center gap-1 text-warn"><Gift className="h-3 w-3" /> {fmt.compact(c.prize)}</span>}
                    {showParticipants && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {c.participantCount}{c.max_participants ? `/${c.max_participants}` : ""}</span>}
                  </div>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${finished ? "bg-slate-200 text-slate-500" : "bg-up-soft text-up"}`}>
                  {finished ? "Terminado" : "Activo"}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChallengeForm({ allowOpen, forceOpen, onSubmit, busy }) {
  const [name, setName] = useState("");
  const [initialBalance, setInitialBalance] = useState(10000);
  const [days, setDays] = useState(7);
  const [maxTrades, setMaxTrades] = useState(10);
  const [bot, setBot] = useState(true);
  const [isOpen, setIsOpen] = useState(!!forceOpen);
  const [entryFee, setEntryFee] = useState(0);
  const [prize, setPrize] = useState(0);
  const [maxParticipants, setMaxParticipants] = useState(0);
  const [markets, setMarkets] = useState(MARKETS.map((m) => m.id));

  const toggleMarket = (id) =>
    setMarkets((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const submit = () => {
    if (!name.trim()) return;
    if (markets.length === 0) return;
    onSubmit(
      {
        name: name.trim(), days: Number(days), maxTrades: Number(maxTrades), includeBot: bot,
        initialBalance: Number(initialBalance), isOpen: forceOpen ? true : isOpen,
        entryFee: Number(entryFee) || 0, prize: Number(prize) || 0,
        maxParticipants: Number(maxParticipants) || 0,
        markets: markets.length === MARKETS.length ? [] : markets,
      },
      { open: forceOpen ? true : isOpen },
    );
    setName("");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="card-title mb-3">{forceOpen ? "Crear un reto abierto" : "Crear un nuevo reto"}</h3>
      <div className="space-y-2.5">
        <input className="input" placeholder="Nombre del reto" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />

        {allowOpen && !forceOpen && (
          <div className="flex gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
            <button onClick={() => setIsOpen(false)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${!isOpen ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>
              <Users className="h-3.5 w-3.5" /> Solo mi grupo
            </button>
            <button onClick={() => setIsOpen(true)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold ${isOpen ? "bg-brand-50 text-brand-700" : "text-slate-500"}`}>
              <Globe className="h-3.5 w-3.5" /> Abierto a cualquiera
            </button>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">Cartera inicial (USDT, igual para todos)</span>
          <input className="input num" type="number" min={100} step={100} value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
        </label>

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Duración (días)</span>
            <input className="input num" type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Movimientos máx.</span>
            <input className="input num" type="number" min={1} max={1000} value={maxTrades} onChange={(e) => setMaxTrades(e.target.value)} />
          </label>
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-slate-600">Mercados en los que se opera</span>
          <div className="flex flex-wrap gap-1.5">
            {MARKETS.map((m) => {
              const on = markets.includes(m.id);
              return (
                <button key={m.id} onClick={() => toggleMarket(m.id)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ring-1 ${on ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-white text-slate-500 ring-slate-200"}`}>
                  {on && <Check className="mr-1 inline h-3 w-3" />}{m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600"><Coins className="h-3 w-3" /> Cuota</span>
            <input className="input num" type="number" min={0} step={10} value={entryFee} onChange={(e) => setEntryFee(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600"><Gift className="h-3 w-3" /> Premio</span>
            <input className="input num" type="number" min={0} step={10} value={prize} onChange={(e) => setPrize(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-medium text-slate-600"><UserPlus className="h-3 w-3" /> Aforo</span>
            <input className="input num" type="number" min={0} placeholder="∞" value={maxParticipants || ""} onChange={(e) => setMaxParticipants(e.target.value)} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={bot} onChange={(e) => setBot(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          <Bot className="h-4 w-4" /> Que compita también el Agente IA
        </label>

        <p className="text-[11px] text-slate-400">
          Cuota y premio son fichas ficticias (informativas). Cada participante juega con una cartera nueva
          independiente de su cuenta libre, así que tu práctica normal no se toca. Aforo vacío = sin límite.
        </p>
        <button onClick={submit} disabled={busy} className="btn-primary w-full"><Plus className="h-4 w-4" /> Crear reto</button>
      </div>
    </div>
  );
}

function ChallengeView({ detail, currentUserId, onJoin, onEnter, busy }) {
  const { challenge, ranking, daysLeft, finished, myTradesUsed, participantCount } = detail;
  const amIn = ranking.some((r) => r.userId === currentUserId);
  const c = challenge;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        <Tag icon={c.is_open ? Globe : Users} text={c.is_open ? "Reto abierto" : "Reto de grupo"} />
        <Tag icon={Trophy} text={marketLabels(c.markets_list)} />
        {!!c.entry_fee && <Tag icon={Coins} text={`Cuota ${fmt.compact(c.entry_fee)}`} />}
        {!!c.prize && <Tag icon={Gift} text={`Premio ${fmt.compact(c.prize)}`} warn />}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <StatBox label="Cartera inicial" value={`${fmt.usd(c.initial_balance)} USDT`} />
        <StatBox label="Días restantes" value={finished ? "0" : daysLeft} />
        <StatBox label="Participantes" value={c.max_participants ? `${participantCount}/${c.max_participants}` : participantCount} />
        <StatBox label="Tus movimientos" value={amIn ? `${myTradesUsed}/${c.max_trades}` : "—"} />
      </div>

      {!amIn && !finished && (
        <div>
          <button onClick={onJoin} disabled={busy} className="btn-primary w-full"><Trophy className="h-4 w-4" /> Unirme a este reto</button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            Juegas con una cartera nueva de {fmt.usd(c.initial_balance)} USDT (no toca tu cuenta libre).
          </p>
        </div>
      )}
      {amIn && !finished && (
        <button onClick={onEnter} className="btn-primary w-full"><Trophy className="h-4 w-4" /> Operar en mi cartera de este reto</button>
      )}

      <div>
        <h3 className="card-title mb-2">Clasificación {finished && ranking[0] && <span className="text-warn">· 🏆 {ranking[0].name}{c.prize ? ` gana ${fmt.compact(c.prize)}` : ""}</span>}</h3>
        <div className="space-y-1.5">
          {ranking.map((r) => {
            const up = r.returnPct >= 0;
            const isMe = r.userId === currentUserId;
            return (
              <div key={r.userId} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isMe ? "bg-brand-50 ring-1 ring-brand-200" : "bg-slate-50"}`}>
                <span className="w-5 text-center text-sm font-bold text-slate-400">
                  {r.rank === 1 ? <Crown className="mx-auto h-4 w-4 text-warn" /> : r.rank}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: r.color }}>
                  {r.isBot ? <Bot className="h-4 w-4" /> : r.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">{r.name} {isMe && <span className="text-slate-400">(tú)</span>}</div>
                  <div className="text-[11px] text-slate-400">{r.tradesUsed}/{r.maxTrades} movimientos</div>
                </div>
                <span className={`num text-sm font-bold ${up ? "text-up" : "text-down"}`}>{fmt.pct(r.returnPct)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Tag({ icon: Icon, text, warn }) {
  return (
    <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${warn ? "bg-warn-soft text-warn" : "bg-slate-100 text-slate-600"}`}>
      <Icon className="h-3 w-3" /> {text}
    </span>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="num text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}
