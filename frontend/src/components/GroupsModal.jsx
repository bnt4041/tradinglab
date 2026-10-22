import { useEffect, useState } from "react";
import {
  X, Trophy, Users, Plus, Copy, ArrowLeft, Bot, Calendar, Repeat, Crown, Check,
} from "lucide-react";
import { api, fmt } from "../api";

export default function GroupsModal({ currentUserId, onClose, onToast }) {
  const [view, setView] = useState("list"); // list | group | challenge
  const [myGroups, setMyGroups] = useState(null);
  const [groupDetail, setGroupDetail] = useState(null);
  const [challengeDetail, setChallengeDetail] = useState(null);

  const [newGroupName, setNewGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);

  const [cName, setCName] = useState("");
  const [cDays, setCDays] = useState(7);
  const [cMaxTrades, setCMaxTrades] = useState(10);
  const [cBot, setCBot] = useState(true);
  const [cInitialBalance, setCInitialBalance] = useState(10000);

  const loadGroups = () => api.groups().then(setMyGroups).catch((e) => onToast?.(e.message, "danger"));
  useEffect(() => { loadGroups(); /* eslint-disable-next-line */ }, []);

  const openGroup = (id) => {
    api.groupDetail(id).then((d) => { setGroupDetail(d); setView("group"); }).catch((e) => onToast?.(e.message, "danger"));
  };
  const openChallenge = (id) => {
    api.challengeDetail(id).then((d) => { setChallengeDetail(d); setView("challenge"); }).catch((e) => onToast?.(e.message, "danger"));
  };
  const backToGroup = () => openGroup(groupDetail.group.id);
  const backToList = () => { setView("list"); loadGroups(); };

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

  const createChallenge = async () => {
    if (!cName.trim()) return onToast?.("Dale un nombre al reto", "danger");
    if (!cInitialBalance || cInitialBalance < 100) return onToast?.("El importe inicial debe ser de al menos 100 USDT", "danger");
    setBusy(true);
    try {
      const ch = await api.createChallenge(groupDetail.group.id, {
        name: cName.trim(), days: Number(cDays), maxTrades: Number(cMaxTrades), includeBot: cBot,
        initialBalance: Number(cInitialBalance),
      });
      setCName("");
      onToast?.(`Reto "${ch.name}" creado`, "success");
      openChallenge(ch.id);
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  const joinChallenge = async (id, initialBalance) => {
    const ok = window.confirm(
      `Al unirte, tu cartera se reinicia a ${fmt.usd(initialBalance)} USDT: se borran tus posiciones y ` +
      `operaciones actuales (todos los participantes empiezan igual). ¿Continuar?`
    );
    if (!ok) return;
    setBusy(true);
    try {
      await api.joinChallenge(id);
      onToast?.("Te has unido al reto — tu cartera se ha reiniciado", "success");
      openChallenge(id);
    } catch (e) { onToast?.(e.message, "danger"); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[66] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-soft">
        <div className="flex items-center justify-between border-b border-slate-100 p-5">
          <div className="flex items-center gap-2">
            {view !== "list" && (
              <button
                onClick={view === "challenge" ? backToGroup : backToList}
                className="icon-btn h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
              <Trophy className="h-5 w-5 text-brand-600" />
              {view === "list" && "Grupos y retos"}
              {view === "group" && groupDetail?.group.name}
              {view === "challenge" && challengeDetail?.challenge.name}
            </h2>
          </div>
          <button onClick={onClose} className="icon-btn h-8 w-8"><X className="h-4 w-4" /></button>
        </div>

        <div className="overflow-y-auto p-5">
          {view === "list" && (
            <ListView
              groups={myGroups}
              onOpen={openGroup}
              newGroupName={newGroupName} setNewGroupName={setNewGroupName} onCreate={createGroup}
              joinCode={joinCode} setJoinCode={setJoinCode} onJoin={joinGroup}
              busy={busy}
            />
          )}

          {view === "group" && groupDetail && (
            <GroupView
              detail={groupDetail}
              currentUserId={currentUserId}
              onOpenChallenge={openChallenge}
              onCopyCode={copyCode}
              cName={cName} setCName={setCName}
              cDays={cDays} setCDays={setCDays}
              cMaxTrades={cMaxTrades} setCMaxTrades={setCMaxTrades}
              cBot={cBot} setCBot={setCBot}
              cInitialBalance={cInitialBalance} setCInitialBalance={setCInitialBalance}
              onCreateChallenge={createChallenge}
              busy={busy}
            />
          )}

          {view === "challenge" && challengeDetail && (
            <ChallengeView
              detail={challengeDetail}
              currentUserId={currentUserId}
              onJoin={() => joinChallenge(challengeDetail.challenge.id, challengeDetail.challenge.initial_balance)}
              busy={busy}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ListView({ groups, onOpen, newGroupName, setNewGroupName, onCreate, joinCode, setJoinCode, onJoin, busy }) {
  return (
    <div className="space-y-5">
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
              <button
                key={g.id}
                onClick={() => onOpen(g.id)}
                className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <Users className="h-4 w-4" />
                </span>
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
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onCreate()} />
          <button onClick={onCreate} disabled={busy} className="btn-primary !px-3">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="card-title mb-2">Unirme con un código</h3>
        <div className="flex gap-2">
          <input className="input uppercase" placeholder="CÓDIGO" value={joinCode} maxLength={6}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && onJoin()} />
          <button onClick={onJoin} disabled={busy} className="btn-primary whitespace-nowrap">Unirme</button>
        </div>
      </div>
    </div>
  );
}

function GroupView({
  detail, currentUserId, onOpenChallenge, onCopyCode,
  cName, setCName, cDays, setCDays, cMaxTrades, setCMaxTrades, cBot, setCBot,
  cInitialBalance, setCInitialBalance, onCreateChallenge, busy,
}) {
  const { group, members, challenges } = detail;
  const now = Date.now() / 1000;
  return (
    <div className="space-y-5">
      <button
        onClick={() => onCopyCode(group.code)}
        className="flex w-full items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
      >
        <span className="text-xs text-slate-500">Código de invitación</span>
        <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-slate-800">
          {group.code} <Copy className="h-3.5 w-3.5 text-slate-400" />
        </span>
      </button>

      <div>
        <h3 className="card-title mb-2">Miembros ({members.length})</h3>
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1.5 text-xs">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: m.color }}>
                {m.isBot ? <Bot className="h-3 w-3" /> : m.name.charAt(0).toUpperCase()}
              </span>
              {m.name}
              {m.id === currentUserId && <span className="text-slate-400">(tú)</span>}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="card-title mb-2">Retos</h3>
        {challenges.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
            Todavía no hay ningún reto en este grupo.
          </div>
        ) : (
          <div className="space-y-1.5">
            {challenges.map((c) => {
              const finished = c.end_at <= now;
              return (
                <button key={c.id} onClick={() => onOpenChallenge(c.id)}
                  className="flex w-full items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full ${finished ? "bg-slate-200 text-slate-500" : "bg-up-soft text-up"}`}>
                    <Trophy className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-800">{c.name}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-500">{fmt.usd(c.initial_balance)} USDT</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {c.days} días</span>
                      <span className="flex items-center gap-1"><Repeat className="h-3 w-3" /> {c.max_trades} mov.</span>
                      {!!c.include_bot && <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> IA</span>}
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

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="card-title mb-3">Crear un nuevo reto</h3>
        <div className="space-y-2.5">
          <input className="input" placeholder="Nombre del reto (p. ej. Reto de la semana)" value={cName} maxLength={60}
            onChange={(e) => setCName(e.target.value)} />
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">Cartera inicial (USDT, igual para todos)</span>
            <input className="input num" type="number" min={100} step={100} value={cInitialBalance}
              onChange={(e) => setCInitialBalance(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Duración (días)</span>
              <input className="input num" type="number" min={1} max={365} value={cDays}
                onChange={(e) => setCDays(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Movimientos máx.</span>
              <input className="input num" type="number" min={1} max={1000} value={cMaxTrades}
                onChange={(e) => setCMaxTrades(e.target.value)} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={cBot} onChange={(e) => setCBot(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600" />
            <Bot className="h-4 w-4" /> Que compita también el Agente IA
          </label>
          <p className="text-[11px] text-slate-400">
            Al unirse a un reto, la cartera de cada participante se reinicia a esta cantidad (se borran sus
            posiciones y operaciones anteriores) para que todos empiecen en igualdad.
          </p>
          <button onClick={onCreateChallenge} disabled={busy} className="btn-primary w-full">
            <Plus className="h-4 w-4" /> Crear reto
          </button>
        </div>
      </div>
    </div>
  );
}

function ChallengeView({ detail, currentUserId, onJoin, busy }) {
  const { challenge, ranking, daysLeft, finished, myTradesUsed } = detail;
  const amIn = ranking.some((r) => r.userId === currentUserId);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5">
        <StatBox label="Cartera inicial" value={`${fmt.usd(challenge.initial_balance)} USDT`} />
        <StatBox label="Estado" value={finished ? "Terminado" : "Activo"} />
        <StatBox label="Días restantes" value={finished ? "0" : daysLeft} />
        <StatBox label="Tus movimientos" value={amIn ? `${myTradesUsed}/${challenge.max_trades}` : "—"} />
      </div>

      {!amIn && !finished && (
        <div>
          <button onClick={onJoin} disabled={busy} className="btn-primary w-full">
            <Trophy className="h-4 w-4" /> Unirme a este reto
          </button>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            Reinicia tu cartera a {fmt.usd(challenge.initial_balance)} USDT.
          </p>
        </div>
      )}

      <div>
        <h3 className="card-title mb-2">Clasificación</h3>
        <div className="space-y-1.5">
          {ranking.map((r) => {
            const up = r.returnPct >= 0;
            const isMe = r.userId === currentUserId;
            return (
              <div key={r.userId}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isMe ? "bg-brand-50 ring-1 ring-brand-200" : "bg-slate-50"}`}>
                <span className="w-5 text-center text-sm font-bold text-slate-400">
                  {r.rank === 1 ? <Crown className="mx-auto h-4 w-4 text-warn" /> : r.rank}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: r.color }}>
                  {r.isBot ? <Bot className="h-4 w-4" /> : r.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-800">
                    {r.name} {isMe && <span className="text-slate-400">(tú)</span>}
                  </div>
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

function StatBox({ label, value }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
      <div className="num text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}
