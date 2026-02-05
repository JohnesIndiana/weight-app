"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";

type Period = "week" | "month" | "year";
type Step = { id: string; text: string; done: boolean };
type Goal = {
  id: string;
  title: string;
  period: Period;
  startISO: string;
  endISO: string;
  steps: Step[];
  createdAt: number;
};

type BarStyle =
  | "pill"
  | "rect"
  | "rounded"
  | "thin"
  | "thick"
  | "striped"
  | "dashed"
  | "ticks"
  | "steps"
  | "diagonal";

type UiSettings = {
  bgColor: string;
  cardColor: string;
  textColor: string;

  btnColor: string;
  btnTextColor: string;

  barLow: string;
  barMid: string;
  barHigh: string;

  fontFamily: string; // CSS font-family
  barStyle: BarStyle;
};

const LS_KEY = "goals_wmy_v1";
const LS_UI_KEY = "goals_ui_v1";

function uid() {
  return Math.random().toString(36).slice(2, 10) + "-" + Date.now().toString(36);
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoToDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function dateToISO(dt: Date) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDays(iso: string, days: number) {
  const dt = isoToDate(iso);
  dt.setDate(dt.getDate() + days);
  return dateToISO(dt);
}
function addMonths(iso: string, months: number) {
  const dt = isoToDate(iso);
  const keep = dt.getDate();
  dt.setMonth(dt.getMonth() + months);
  if (dt.getDate() < keep) dt.setDate(0);
  return dateToISO(dt);
}
function addYears(iso: string, years: number) {
  const dt = isoToDate(iso);
  const keepMonth = dt.getMonth();
  dt.setFullYear(dt.getFullYear() + years);
  if (dt.getMonth() !== keepMonth) dt.setDate(0);
  return dateToISO(dt);
}
function computeEnd(startISO: string, period: Period) {
  // конец включительно
  if (period === "week") return addDays(startISO, 6);
  if (period === "month") return addDays(addMonths(startISO, 1), -1);
  return addDays(addYears(startISO, 1), -1);
}

function formatRu(iso: string) {
  return isoToDate(iso).toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" });
}

function progressPct(goal: Goal) {
  const total = goal.steps.length;
  if (total === 0) return 0;
  const done = goal.steps.filter((s) => s.done).length;
  return Math.round((done / total) * 100);
}
function progressPctFromSteps(steps: Step[]) {
  const total = steps.length;
  if (total === 0) return 0;
  const done = steps.filter((s) => s.done).length;
  return Math.round((done / total) * 100);
}
function perStep(goal: Goal) {
  const total = goal.steps.length;
  if (total === 0) return 0;
  const v = 100 / total;
  return Math.round(v * 10) / 10;
}
function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
function periodLabel(p: Period) {
  if (p === "week") return "Неделя";
  if (p === "month") return "Месяц";
  return "Год";
}

function IconPencil() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 1 1 10-10c0 2-1 3-3 3h-1a2 2 0 0 0-2 2c0 2-1 5-4 5Z" />
      <path d="M7.5 10.5h.01" />
      <path d="M12 8h.01" />
      <path d="M16.5 10.5h.01" />
      <path d="M9 15.5h.01" />
    </svg>
  );
}

function IconButton({
  children,
  onClick,
  title,
  colors,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  colors: UiSettings;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm active:scale-[0.99]"
      style={{
        backgroundColor: colors.cardColor,
        color: colors.textColor,
        borderColor: "rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
  colors,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  colors: UiSettings;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: colors.btnColor,
        color: colors.btnTextColor,
      }}
    >
      {children}
    </button>
  );
}
function SoftButton({
  children,
  onClick,
  disabled,
  type = "button",
  colors,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  colors: UiSettings;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="rounded-2xl border px-4 py-2 text-sm font-medium shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{
        backgroundColor: colors.cardColor,
        color: colors.textColor,
        borderColor: "rgba(0,0,0,0.12)",
      }}
    >
      {children}
    </button>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
  onClick,
  colors,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  colors: UiSettings;
}) {
  return (
    <section
      className={`rounded-3xl p-6 shadow-sm ring-1 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      style={{
        backgroundColor: colors.cardColor,
        color: colors.textColor,
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>{subtitle}</p> : null}
        </div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Tab({
  active,
  children,
  onClick,
  colors,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
  colors: UiSettings;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm ring-1 active:scale-[0.99]"
      style={{
        backgroundColor: active ? colors.btnColor : colors.cardColor,
        color: active ? colors.btnTextColor : colors.textColor,
        borderColor: "rgba(0,0,0,0.06)",
      }}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children, colors }: { children: ReactNode; colors: UiSettings }) {
  return <div className="text-sm font-medium" style={{ color: colors.textColor, opacity: 0.7 }}>{children}</div>;
}

function ColorSwatch({
  color,
  selected,
  onPick,
}: {
  color: string;
  selected: boolean;
  onPick: (hex: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(color)}
      title={color}
      className={`h-7 w-7 rounded-md border shadow-sm active:scale-[0.98] ${selected ? "ring-2 ring-black/50" : ""}`}
      style={{ backgroundColor: color, borderColor: "rgba(0,0,0,0.12)" }}
    />
  );
}

function pickBarColor(pct: number, ui: UiSettings) {
  if (pct >= 80) return ui.barHigh;
  if (pct >= 50) return ui.barMid;
  return ui.barLow;
}

function ProgressBar({ pct, ui }: { pct: number; ui: UiSettings }) {
  const v = clamp(pct);
  const fillColor = pickBarColor(v, ui);

  const baseHeight = ui.barStyle === "thin" ? 8 : ui.barStyle === "thick" ? 18 : 12;
  const radius =
    ui.barStyle === "rect" ? 4 :
    ui.barStyle === "rounded" ? 10 :
    ui.barStyle === "pill" ? 999 : 999;

  let trackBg = "rgba(0,0,0,0.10)";
  let fillBg: string = fillColor;

  if (ui.barStyle === "striped") {
    fillBg = `repeating-linear-gradient(45deg, ${fillColor}, ${fillColor} 8px, rgba(255,255,255,0.45) 8px, rgba(255,255,255,0.45) 16px)`;
  }
  if (ui.barStyle === "dashed") {
    trackBg = `repeating-linear-gradient(90deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12) 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 16px)`;
    fillBg = `repeating-linear-gradient(90deg, ${fillColor}, ${fillColor} 10px, rgba(255,255,255,0.25) 10px, rgba(255,255,255,0.25) 16px)`;
  }
  if (ui.barStyle === "ticks") {
    trackBg = `repeating-linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0.10) 1px, rgba(0,0,0,0.03) 1px, rgba(0,0,0,0.03) 12px)`;
    fillBg = `repeating-linear-gradient(90deg, ${fillColor}, ${fillColor} 1px, rgba(255,255,255,0.25) 1px, rgba(255,255,255,0.25) 12px)`;
  }
  if (ui.barStyle === "steps") {
    trackBg = `repeating-linear-gradient(90deg, rgba(0,0,0,0.10), rgba(0,0,0,0.10) 18px, rgba(0,0,0,0.02) 18px, rgba(0,0,0,0.02) 22px)`;
    fillBg = `repeating-linear-gradient(90deg, ${fillColor}, ${fillColor} 18px, rgba(255,255,255,0.30) 18px, rgba(255,255,255,0.30) 22px)`;
  }
  if (ui.barStyle === "diagonal") {
    trackBg = `repeating-linear-gradient(135deg, rgba(0,0,0,0.08), rgba(0,0,0,0.08) 10px, rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px)`;
    fillBg = `repeating-linear-gradient(135deg, ${fillColor}, ${fillColor} 10px, rgba(255,255,255,0.35) 10px, rgba(255,255,255,0.35) 20px)`;
  }

  return (
    <div className="w-full">
      <div
        className="w-full overflow-hidden"
        style={{
          height: baseHeight,
          borderRadius: radius,
          background: trackBg,
        }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: `${v}%`,
            borderRadius: radius,
            background: fillBg,
          }}
        />
      </div>
    </div>
  );
}

// 10 “популярных” шрифтов (без внешних загрузок)
const FONT_PRESETS: { name: string; value: string }[] = [
  { name: "Inter (системный)", value: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif' },
  { name: "Arial", value: "Arial, Helvetica, sans-serif" },
  { name: "Roboto (если есть)", value: 'Roboto, "Segoe UI", Arial, sans-serif' },
  { name: "Segoe UI", value: '"Segoe UI", Arial, sans-serif' },
  { name: "Helvetica", value: 'Helvetica, Arial, sans-serif' },
  { name: "Georgia", value: "Georgia, serif" },
  { name: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { name: "Courier New", value: '"Courier New", Courier, monospace' },
  { name: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { name: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
];

const PAINT_PALETTE = [
  "#000000", "#444444", "#888888", "#CCCCCC", "#FFFFFF",
  "#FF0000", "#FF7A00", "#FFD400", "#00C853", "#00B0FF",
  "#2962FF", "#651FFF", "#D500F9", "#FF4081", "#795548",
  "#1B5E20", "#0D47A1", "#4E342E", "#263238", "#F5F5F5",
];

const DEFAULT_UI: UiSettings = {
  bgColor: "#F6F7FB",
  cardColor: "#FFFFFF",
  textColor: "#111827",
  btnColor: "#111827",
  btnTextColor: "#FFFFFF",
  barLow: "#F43F5E",
  barMid: "#F59E0B",
  barHigh: "#059669",
  fontFamily: FONT_PRESETS[0].value,
  barStyle: "pill",
};

// --------- 🎉 CONFETTI + BALLOONS OVERLAY ----------
type ConfettiPiece = { id: string; left: number; size: number; rot: number; delay: number; dur: number; color: string };
type BalloonPiece = { id: string; left: number; size: number; delay: number; dur: number; color: string };

function ConfettiBalloonsOverlay({
  active,
  ui,
  title,
}: {
  active: boolean;
  ui: UiSettings;
  title: string;
}) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [balloons, setBalloons] = useState<BalloonPiece[]>([]);

  useEffect(() => {
    if (!active) return;

    const colors = [
      ui.barHigh, ui.barMid, ui.barLow,
      "#00B0FF", "#651FFF", "#FF4081", "#FFD400", "#00C853",
    ];

    const conf: ConfettiPiece[] = Array.from({ length: 110 }).map((_, i) => ({
      id: `${Date.now()}-c-${i}`,
      left: Math.random() * 100,
      size: 6 + Math.random() * 10,
      rot: Math.random() * 360,
      delay: Math.random() * 0.7,
      dur: 3.8 + Math.random() * 2.2,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    const bal: BalloonPiece[] = Array.from({ length: 14 }).map((_, i) => ({
      id: `${Date.now()}-b-${i}`,
      left: 5 + Math.random() * 90,
      size: 28 + Math.random() * 24,
      delay: Math.random() * 0.8,
      dur: 6.5 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));

    setConfetti(conf);
    setBalloons(bal);
  }, [active, ui]);

  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      {/* немного “праздничного” затемнения */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.06)" }} />

      {/* текст */}
      <div className="absolute left-1/2 top-10 -translate-x-1/2 rounded-3xl px-5 py-3 shadow-sm"
           style={{ backgroundColor: ui.cardColor, color: ui.textColor, border: "1px solid rgba(0,0,0,0.08)" }}>
        <div className="text-sm font-semibold">🎉 Цель выполнена на 100%!</div>
        <div className="text-xs" style={{ opacity: 0.75 }}>{title}</div>
      </div>

      {/* CSS keyframes */}
      <style>{`
        @keyframes fall {
          0%   { transform: translate3d(0,-20px,0) rotate(0deg); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(0,110vh,0) rotate(720deg); opacity: 1; }
        }
        @keyframes floatUp {
          0%   { transform: translate3d(0, 110vh, 0); opacity: 0; }
          10%  { opacity: 1; }
          100% { transform: translate3d(0, -30vh, 0); opacity: 1; }
        }
        @keyframes sway {
          0%,100% { transform: translateX(0); }
          50% { transform: translateX(24px); }
        }
        @keyframes pop {
          0% { transform: scale(0.98); }
          50% { transform: scale(1.02); }
          100% { transform: scale(0.98); }
        }
      `}</style>

      {/* confetti */}
      {confetti.map((p) => (
        <div
          key={p.id}
          className="absolute top-0"
          style={{
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${Math.max(6, p.size * 0.45)}px`,
            background: p.color,
            borderRadius: "3px",
            opacity: 0,
            transform: `rotate(${p.rot}deg)`,
            animation: `fall ${p.dur}s linear ${p.delay}s forwards`,
            boxShadow: "0 1px 0 rgba(0,0,0,0.08)",
          }}
        />
      ))}

      {/* balloons */}
      {balloons.map((b) => (
        <div
          key={b.id}
          className="absolute bottom-0"
          style={{
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${Math.round(b.size * 1.25)}px`,
            borderRadius: "999px",
            background: b.color,
            opacity: 0,
            animation: `floatUp ${b.dur}s ease-in ${b.delay}s forwards, sway 1.8s ease-in-out ${b.delay}s infinite, pop 1.2s ease-in-out ${b.delay}s infinite`,
            filter: "drop-shadow(0 8px 10px rgba(0,0,0,0.10))",
          }}
        >
          {/* блик */}
          <div
            style={{
              position: "absolute",
              left: "20%",
              top: "18%",
              width: "28%",
              height: "22%",
              background: "rgba(255,255,255,0.40)",
              borderRadius: "999px",
              transform: "rotate(-18deg)",
            }}
          />
          {/* верёвочка */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "100%",
              width: "2px",
              height: "45px",
              background: "rgba(0,0,0,0.20)",
              transform: "translateX(-50%)",
            }}
          />
        </div>
      ))}
    </div>
  );
}
// ---------------------------------------------------

export default function Page() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
const [user, setUser] = useState<any>(null);

  // список: вкладки
  const [filter, setFilter] = useState<"all" | Period>("all");

  // UI: форма создания цели
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPeriod, setNewPeriod] = useState<Period>("week");
  const [newStartISO, setNewStartISO] = useState(todayISO());

console.log("ENV URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

  // внутри цели: добавление шага
  const [stepDraft, setStepDraft] = useState<Record<string, string>>({});

  // редактирование цели
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  // 🎨 оформление
  const [ui, setUi] = useState<UiSettings>(DEFAULT_UI);
  const [showDesign, setShowDesign] = useState(false);

  // 🎉 праздник
  const [celebrate, setCelebrate] = useState(false);
  const [celebrateTitle, setCelebrateTitle] = useState("");
  const celebrateTimerRef = useRef<number | null>(null);
  const celebratedGoalIdsRef = useRef<Set<string>>(new Set()); // чтобы не запускать бесконечно на одной и той же цели

  // загрузка целей
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Goal[];
        if (Array.isArray(parsed)) setGoals(parsed);
      }
    } catch {}
  }, []);

  // сохранение целей
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(goals));
    } catch {}
  }, [goals]);

  // загрузка оформления
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_UI_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UiSettings>;
        if (parsed && typeof parsed === "object") setUi((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  // сохранение оформления
  useEffect(() => {
    try {
      localStorage.setItem(LS_UI_KEY, JSON.stringify(ui));
    } catch {}
  }, [ui]);

useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    setUser(data.user ?? null);
  });
}, []);

  // цели с сортировкой + фильтром
  const goalsSortedFiltered = useMemo(() => {
    const arr = filter === "all" ? goals : goals.filter((g) => g.period === filter);
    return [...arr].sort((a, b) => (a.endISO < b.endISO ? -1 : a.endISO > b.endISO ? 1 : b.createdAt - a.createdAt));
  }, [goals, filter]);

  const openGoal = useMemo(() => goals.find((g) => g.id === openGoalId) ?? null, [goals, openGoalId]);

  function startCelebration(goalTitle: string) {
    // если уже идет — перезапускаем таймер
    if (celebrateTimerRef.current) {
      window.clearTimeout(celebrateTimerRef.current);
      celebrateTimerRef.current = null;
    }

    setCelebrateTitle(goalTitle);
    setCelebrate(true);

    celebrateTimerRef.current = window.setTimeout(() => {
      setCelebrate(false);
      setCelebrateTitle("");
      celebrateTimerRef.current = null;
    }, 10_000);
  }

  useEffect(() => {
    // cleanup на всякий
    return () => {
      if (celebrateTimerRef.current) {
        window.clearTimeout(celebrateTimerRef.current);
        celebrateTimerRef.current = null;
      }
    };
  }, []);

  // --- действия ---
  function createGoal() {
    const t = newTitle.trim();
    if (!t) return;

    const s = newStartISO || todayISO();
    const e = computeEnd(s, newPeriod);

    const g: Goal = {
      id: uid(),
      title: t,
      period: newPeriod,
      startISO: s,
      endISO: e,
      steps: [],
      createdAt: Date.now(),
    };

    setGoals((prev) => [g, ...prev]);

    setNewTitle("");
    setNewPeriod("week");
    setNewStartISO(todayISO());
    setShowCreate(false);
  }

  function updateGoalMain(goalId: string, patch: Partial<Pick<Goal, "title" | "period" | "startISO">>) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;

        const next: Goal = { ...g, ...patch } as Goal;
        const s = patch.startISO ?? g.startISO;
        const p = (patch.period ?? g.period) as Period;

        next.startISO = s;
        next.period = p;
        next.endISO = computeEnd(s, p);

        return next;
      })
    );
  }

  function deleteGoal(goalId: string) {
    const ok = confirm("Удалить цель целиком?");
    if (!ok) return;
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
    setOpenGoalId(null);
    setEditingGoal(false);
    setEditingStepId(null);
  }

  function toggleStep(goalId: string, stepId: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;

        const beforePct = progressPct(g);

        const nextSteps = g.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
        const afterPct = progressPctFromSteps(nextSteps);

        // 🎉 если стало 100% (и раньше не было 100%) — запускаем праздник на 10 секунд
        if (beforePct < 100 && afterPct === 100 && !celebratedGoalIdsRef.current.has(g.id)) {
          celebratedGoalIdsRef.current.add(g.id);
          startCelebration(g.title);
        }

        // если человек снял галочку и прогресс упал — разрешим праздновать снова при следующем достижении 100
        if (afterPct < 100 && celebratedGoalIdsRef.current.has(g.id)) {
          celebratedGoalIdsRef.current.delete(g.id);
        }

        return { ...g, steps: nextSteps };
      })
    );
  }

  function addStep(goalId: string) {
    const text = (stepDraft[goalId] ?? "").trim();
    if (!text) return;

    const step: Step = { id: uid(), text, done: false };
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, steps: [...g.steps, step] } : g)));
    setStepDraft((prev) => ({ ...prev, [goalId]: "" }));
  }

  function updateStepText(goalId: string, stepId: string, text: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return { ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, text } : s)) };
      })
    );
  }

  function deleteStep(goalId: string, stepId: string) {
    const ok = confirm("Удалить этот шаг?");
    if (!ok) return;
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, steps: g.steps.filter((s) => s.id !== stepId) } : g)));
    if (editingStepId === stepId) setEditingStepId(null);
  }

  function onBackToList() {
    setOpenGoalId(null);
    setEditingGoal(false);
    setEditingStepId(null);
  }

  function resetUi() {
    setUi(DEFAULT_UI);
  }

  const pageStyle: React.CSSProperties = {
    backgroundColor: ui.bgColor,
    color: ui.textColor,
    fontFamily: ui.fontFamily,
  };

  // =========================
  // ЭКРАН 1: СПИСОК ЦЕЛЕЙ
  // =========================
  if (!openGoal) {
    return (
      <main className="min-h-screen" style={pageStyle}>
        <ConfettiBalloonsOverlay active={celebrate} ui={ui} title={celebrateTitle} />

        <div className="mx-auto max-w-3xl px-4 py-10">
          <header className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Мои цели</h1>
              <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>
                Нажми на цель, чтобы открыть шаги.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <SoftButton
                colors={ui}
                onClick={() => {
                  setShowDesign((v) => !v);
                  setShowCreate(false);
                }}
              >
                <span className="inline-flex items-center gap-2">
                  <IconPalette /> Оформление
                </span>
              </SoftButton>

              <PrimaryButton
                colors={ui}
                onClick={() => {
                  setShowCreate((v) => !v);
                  setShowDesign(false);
                }}
              >
                {showCreate ? "Закрыть" : "+ Добавить"}
              </PrimaryButton>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap gap-2">
            <Tab active={filter === "all"} onClick={() => setFilter("all")} colors={ui}>Все</Tab>
            <Tab active={filter === "week"} onClick={() => setFilter("week")} colors={ui}>Неделя</Tab>
            <Tab active={filter === "month"} onClick={() => setFilter("month")} colors={ui}>Месяц</Tab>
            <Tab active={filter === "year"} onClick={() => setFilter("year")} colors={ui}>Год</Tab>
          </div>

          {/* 🎨 Панель оформления */}
          {showDesign ? (
            <div className="mt-6">
              <Card
                colors={ui}
                title="🎨 Оформление"
                subtitle="Выбирай цвета, шрифт и вид шкалы. Всё сохраняется автоматически."
                right={
                  <SoftButton colors={ui} onClick={resetUi}>
                    Сбросить
                  </SoftButton>
                }
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <FieldLabel colors={ui}>Цвет фона</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PAINT_PALETTE.map((c) => (
                        <ColorSwatch key={c} color={c} selected={ui.bgColor.toLowerCase() === c.toLowerCase()} onPick={(hex) => setUi((p) => ({ ...p, bgColor: hex }))} />
                      ))}
                      <label className="ml-2 inline-flex items-center gap-2 text-sm" style={{ opacity: 0.8 }}>
                        <span>Другой:</span>
                        <input type="color" value={ui.bgColor} onChange={(e) => setUi((p) => ({ ...p, bgColor: e.target.value }))} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Цвет карточек</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PAINT_PALETTE.map((c) => (
                        <ColorSwatch key={c} color={c} selected={ui.cardColor.toLowerCase() === c.toLowerCase()} onPick={(hex) => setUi((p) => ({ ...p, cardColor: hex }))} />
                      ))}
                      <label className="ml-2 inline-flex items-center gap-2 text-sm" style={{ opacity: 0.8 }}>
                        <span>Другой:</span>
                        <input type="color" value={ui.cardColor} onChange={(e) => setUi((p) => ({ ...p, cardColor: e.target.value }))} />
                      </label>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Цвет кнопок</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PAINT_PALETTE.map((c) => (
                        <ColorSwatch key={c} color={c} selected={ui.btnColor.toLowerCase() === c.toLowerCase()} onPick={(hex) => setUi((p) => ({ ...p, btnColor: hex }))} />
                      ))}
                      <label className="ml-2 inline-flex items-center gap-2 text-sm" style={{ opacity: 0.8 }}>
                        <span>Другой:</span>
                        <input type="color" value={ui.btnColor} onChange={(e) => setUi((p) => ({ ...p, btnColor: e.target.value }))} />
                      </label>
                    </div>

                    <div className="mt-3">
                      <FieldLabel colors={ui}>Цвет текста на кнопках</FieldLabel>
                      <div className="mt-2 flex items-center gap-3">
                        <input type="color" value={ui.btnTextColor} onChange={(e) => setUi((p) => ({ ...p, btnTextColor: e.target.value }))} />
                        <span className="text-sm" style={{ opacity: 0.7 }}>Например белый/чёрный</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Цвета шкалы (низкий/средний/высокий)</FieldLabel>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ opacity: 0.7 }}>Низкий</span>
                        <input type="color" value={ui.barLow} onChange={(e) => setUi((p) => ({ ...p, barLow: e.target.value }))} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ opacity: 0.7 }}>Средний</span>
                        <input type="color" value={ui.barMid} onChange={(e) => setUi((p) => ({ ...p, barMid: e.target.value }))} />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ opacity: 0.7 }}>Высокий</span>
                        <input type="color" value={ui.barHigh} onChange={(e) => setUi((p) => ({ ...p, barHigh: e.target.value }))} />
                      </div>

                      <div className="mt-2 rounded-2xl border p-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                        <div className="text-xs mb-2" style={{ opacity: 0.7 }}>Пример:</div>
                        <ProgressBar pct={25} ui={ui} />
                        <div className="h-2" />
                        <ProgressBar pct={60} ui={ui} />
                        <div className="h-2" />
                        <ProgressBar pct={90} ui={ui} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Шрифт (10 вариантов)</FieldLabel>
                    <select
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={ui.fontFamily}
                      onChange={(e) => setUi((p) => ({ ...p, fontFamily: e.target.value }))}
                    >
                      {FONT_PRESETS.map((f) => (
                        <option key={f.name} value={f.value}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <div className="mt-2 text-xs" style={{ opacity: 0.7 }}>
                      *Шрифт берётся из системы. Если какого-то нет — будет подстановка похожего.
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Форма/стиль шкалы (10 вариантов)</FieldLabel>
                    <select
                      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={ui.barStyle}
                      onChange={(e) => setUi((p) => ({ ...p, barStyle: e.target.value as BarStyle }))}
                    >
                      <option value="pill">Овальная (как сейчас)</option>
                      <option value="rect">Прямоугольная</option>
                      <option value="rounded">Скруглённая</option>
                      <option value="thin">Тонкая</option>
                      <option value="thick">Толстая</option>
                      <option value="striped">Полосатая</option>
                      <option value="dashed">Пунктир</option>
                      <option value="ticks">Штрихи</option>
                      <option value="steps">Ступеньки</option>
                      <option value="diagonal">Диагональный орнамент</option>
                    </select>

                    <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                      <div className="text-xs mb-2" style={{ opacity: 0.7 }}>Пример выбранного вида:</div>
                      <ProgressBar pct={72} ui={ui} />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {showCreate ? (
            <div className="mt-6">
              <Card colors={ui} title="Новая цель" subtitle="Заполни и нажми “Создать”">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <FieldLabel colors={ui}>Название</FieldLabel>
                    <input
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      placeholder="Например: Запустить сайт"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && createGoal()}
                    />
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Период</FieldLabel>
                    <select
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={newPeriod}
                      onChange={(e) => setNewPeriod(e.target.value as Period)}
                    >
                      <option value="week">Неделя</option>
                      <option value="month">Месяц</option>
                      <option value="year">Год</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <FieldLabel colors={ui}>Дата начала</FieldLabel>
                    <input
                      type="date"
                      className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={newStartISO}
                      onChange={(e) => setNewStartISO(e.target.value)}
                    />
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Дата конца (авто)</FieldLabel>
                    <div className="mt-1 rounded-2xl border px-4 py-3 text-sm"
                      style={{ backgroundColor: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.12)" }}
                    >
                      {formatRu(computeEnd(newStartISO, newPeriod))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <PrimaryButton colors={ui} onClick={createGoal} disabled={!newTitle.trim()}>
                    Создать
                  </PrimaryButton>
                  <SoftButton colors={ui} onClick={() => setShowCreate(false)}>
                    Отмена
                  </SoftButton>
                </div>
              </Card>
            </div>
          ) : null}

          <div className="mt-6 grid gap-5">
            {goalsSortedFiltered.length === 0 ? (
              <Card colors={ui} title="Пока нет целей" subtitle="Нажми “+ Добавить”, чтобы создать первую.">
                <div className="text-sm" style={{ opacity: 0.7 }}>Оформление можно менять через кнопку “Оформление”.</div>
              </Card>
            ) : null}

            {goalsSortedFiltered.map((g) => {
              const pct = progressPct(g);

              return (
                <Card
                  key={g.id}
                  colors={ui}
                  title={g.title}
                  subtitle={`${periodLabel(g.period)} · ${formatRu(g.startISO)} — ${formatRu(g.endISO)}`}
                  onClick={() => setOpenGoalId(g.id)}
                >
                  <div className="rounded-2xl border p-4"
                    style={{ backgroundColor: ui.cardColor, borderColor: "rgba(0,0,0,0.12)" }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold" style={{ opacity: 0.85 }}>
                        Прогресс: {pct}%
                      </div>
                      <div className="text-xs" style={{ opacity: 0.6 }}>
                        {g.steps.length ? `Шагов: ${g.steps.length}` : "Шагов пока нет"}
                      </div>
                    </div>
                    <div className="mt-3">
                      <ProgressBar pct={pct} ui={ui} />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <footer className="mt-10 text-xs" style={{ opacity: 0.6 }}>
            Данные и оформление сохраняются в браузере на этом компьютере.
          </footer>
        </div>
      </main>
    );
  }

  // =========================
  // ЭКРАН 2: ВНУТРИ ЦЕЛИ
  // =========================
  const pct = progressPct(openGoal);
  const stepPct = perStep(openGoal);

  return (
    <main className="min-h-screen" style={pageStyle}>
      <ConfettiBalloonsOverlay active={celebrate} ui={ui} title={celebrateTitle} />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <PrimaryButton colors={ui} onClick={onBackToList}>
            ← Назад
          </PrimaryButton>

          <div className="flex items-center gap-2">
            <IconButton
              colors={ui}
              title={editingGoal ? "Закрыть редактирование цели" : "Редактировать цель"}
              onClick={() => {
                setEditingGoal((v) => !v);
                setEditingStepId(null);
              }}
            >
              <IconPencil />
            </IconButton>

            <IconButton colors={ui} title="Удалить цель" onClick={() => deleteGoal(openGoal.id)}>
              <IconTrash />
            </IconButton>
          </div>
        </div>

        <div className="mt-6 grid gap-5">
          <Card
            colors={ui}
            title={openGoal.title}
            subtitle={`${periodLabel(openGoal.period)} · ${formatRu(openGoal.startISO)} — ${formatRu(openGoal.endISO)}`}
          >
            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold" style={{ opacity: 0.85 }}>Прогресс: {pct}%</div>
                <div className="text-xs" style={{ opacity: 0.6 }}>{openGoal.steps.length ? `≈ ${stepPct}% за шаг` : "Добавь шаги"}</div>
              </div>
              <div className="mt-3">
                <ProgressBar pct={pct} ui={ui} />
              </div>
            </div>

            {editingGoal ? (
              <div className="mt-4 grid gap-3 rounded-2xl border p-4 sm:grid-cols-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                <div className="sm:col-span-2">
                  <FieldLabel colors={ui}>Название</FieldLabel>
                  <input
                    className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                    value={openGoal.title}
                    onChange={(e) => updateGoalMain(openGoal.id, { title: e.target.value })}
                  />
                </div>

                <div>
                  <FieldLabel colors={ui}>Период</FieldLabel>
                  <select
                    className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                    value={openGoal.period}
                    onChange={(e) => updateGoalMain(openGoal.id, { period: e.target.value as Period })}
                  >
                    <option value="week">Неделя</option>
                    <option value="month">Месяц</option>
                    <option value="year">Год</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <FieldLabel colors={ui}>Дата начала</FieldLabel>
                  <input
                    type="date"
                    className="mt-1 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                    value={openGoal.startISO}
                    onChange={(e) => updateGoalMain(openGoal.id, { startISO: e.target.value })}
                  />
                </div>

                <div>
                  <FieldLabel colors={ui}>Дата конца (авто)</FieldLabel>
                  <div className="mt-1 rounded-2xl border px-4 py-3 text-sm" style={{ backgroundColor: "rgba(0,0,0,0.03)", borderColor: "rgba(0,0,0,0.12)" }}>
                    {formatRu(openGoal.endISO)}
                  </div>
                </div>
              </div>
            ) : null}
          </Card>

          <Card colors={ui} title="Шаги">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                placeholder="Добавить шаг…"
                value={stepDraft[openGoal.id] ?? ""}
                onChange={(e) => setStepDraft((prev) => ({ ...prev, [openGoal.id]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && addStep(openGoal.id)}
              />
              <PrimaryButton colors={ui} onClick={() => addStep(openGoal.id)}>
                Добавить
              </PrimaryButton>
            </div>

            {openGoal.steps.length === 0 ? (
              <div className="mt-4 text-sm" style={{ opacity: 0.7 }}>Шагов пока нет. Добавь первый шаг сверху.</div>
            ) : (
              <div className="mt-4 grid gap-2">
                {openGoal.steps.map((s, idx) => {
                  const isEditing = editingStepId === s.id;

                  return (
                    <div key={s.id} className="rounded-2xl border px-4 py-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <label className="flex cursor-pointer items-center gap-3">
                          <input
                            type="checkbox"
                            className="h-5 w-5"
                            checked={s.done}
                            onChange={() => toggleStep(openGoal.id, s.id)}
                          />
                          <span className="text-xs" style={{ opacity: 0.6 }}>#{idx + 1}</span>
                        </label>

                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ opacity: 0.6 }}>≈ {stepPct}%</span>

                          <IconButton
                            colors={ui}
                            title={isEditing ? "Закончить редактирование шага" : "Редактировать шаг"}
                            onClick={() => {
                              setEditingStepId(isEditing ? null : s.id);
                              setEditingGoal(false);
                            }}
                          >
                            <IconPencil />
                          </IconButton>

                          <IconButton colors={ui} title="Удалить шаг" onClick={() => deleteStep(openGoal.id, s.id)}>
                            <IconTrash />
                          </IconButton>
                        </div>
                      </div>

                      {isEditing ? (
                        <input
                          className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                          style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                          value={s.text}
                          onChange={(e) => updateStepText(openGoal.id, s.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") setEditingStepId(null);
                          }}
                          onBlur={() => setEditingStepId(null)}
                        />
                      ) : (
                        <div className="mt-2 text-sm font-medium" style={{ opacity: s.done ? 0.55 : 0.85, textDecoration: s.done ? "line-through" : "none" }}>
                          {s.text}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <footer className="mt-10 text-xs" style={{ opacity: 0.6 }}>
          Данные и оформление сохраняются в браузере на этом компьютере.
        </footer>
      </div>
    </main>
  );
}
