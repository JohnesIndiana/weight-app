"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

/* -------------------- TYPES -------------------- */

type Period = "week" | "month" | "year";

type Step = {
  id: string;
  text: string;
  done: boolean;
  dueISO?: string; // дедлайн шага
};

type Goal = {
  id: string;
  title: string;
  period: Period;
  startISO: string;
  endISO: string; // дата окончания задаёт пользователь
  steps: Step[];
  createdAt: number;
};

type BarStyle = "pill" | "striped" | "dashed" | "diagonal"; // 4 разных варианта

type UiSettings = {
  bgColor: string;
  cardColor: string;
  textColor: string;

  btnColor: string;
  btnTextColor: string;

  barLow: string;
  barMid: string;
  barHigh: string;

  fontFamily: string;
  barStyle: BarStyle;
};

/* -------------------- CONST -------------------- */

const LS_KEY = "goalix_goals_v1";
const LS_UI_KEY = "goalix_ui_v1";

/* -------------------- HELPERS -------------------- */

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
function defaultEndForPeriod(startISO: string, period: Period) {
  if (period === "week") return addDays(startISO, 6);
  if (period === "month") return addDays(addMonths(startISO, 1), -1);
  return addDays(addYears(startISO, 1), -1);
}
function formatRu(iso: string) {
  return isoToDate(iso).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function clamp(n: number) {
  return Math.max(0, Math.min(100, n));
}
function periodLabel(p: Period) {
  if (p === "week") return "Неделя";
  if (p === "month") return "Месяц";
  return "Год";
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
  return Math.round((100 / total) * 10) / 10;
}
function isOverdue(endISO: string) {
  return todayISO() > endISO;
}

/* -------------------- UI DATA -------------------- */

const FONT_PRESETS: { name: string; value: string }[] = [
  { name: "Roboto", value: 'var(--font-roboto), Helvetica, Arial, sans-serif' },
  { name: "Open Sans", value: 'var(--font-open-sans), Helvetica, Arial, sans-serif' },
  { name: "Montserrat", value: 'var(--font-montserrat), Helvetica, Arial, sans-serif' },
  { name: "Helvetica", value: 'Helvetica, Arial, sans-serif' },
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

/* -------------------- ICONS -------------------- */

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
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* -------------------- PRIMITIVES -------------------- */

function IconButton({
  children,
  onClick,
  title,
  colors,
}: {
  children: ReactNode;
  onClick: () => void;
  title?: string;
  colors: UiSettings;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border shadow-sm active:scale-[0.99]"
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
      className="cursor-pointer rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
      style={{ backgroundColor: colors.btnColor, color: colors.btnTextColor }}
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
      className="cursor-pointer rounded-2xl border px-4 py-2 text-sm font-medium shadow-sm active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
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
      className="cursor-pointer rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm ring-1 active:scale-[0.99]"
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
  return (
    <div className="text-sm font-medium" style={{ color: colors.textColor, opacity: 0.7 }}>
      {children}
    </div>
  );
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
      className={`cursor-pointer h-7 w-7 rounded-md border shadow-sm active:scale-[0.98] ${selected ? "ring-2 ring-black/40" : ""}`}
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

  const height = 12;
  const radius = 999;

  let trackBg = "rgba(0,0,0,0.10)";
  let fillBg: string = fillColor;

  if (ui.barStyle === "striped") {
    fillBg = `repeating-linear-gradient(45deg, ${fillColor}, ${fillColor} 8px, rgba(255,255,255,0.45) 8px, rgba(255,255,255,0.45) 16px)`;
  }
  if (ui.barStyle === "dashed") {
    trackBg = `repeating-linear-gradient(90deg, rgba(0,0,0,0.12), rgba(0,0,0,0.12) 10px, rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.04) 16px)`;
    fillBg = `repeating-linear-gradient(90deg, ${fillColor}, ${fillColor} 10px, rgba(255,255,255,0.25) 10px, rgba(255,255,255,0.25) 16px)`;
  }
  if (ui.barStyle === "diagonal") {
    trackBg = `repeating-linear-gradient(135deg, rgba(0,0,0,0.08), rgba(0,0,0,0.08) 10px, rgba(0,0,0,0.02) 10px, rgba(0,0,0,0.02) 20px)`;
    fillBg = `repeating-linear-gradient(135deg, ${fillColor}, ${fillColor} 10px, rgba(255,255,255,0.35) 10px, rgba(255,255,255,0.35) 20px)`;
  }

  return (
    <div className="w-full">
      <div className="w-full overflow-hidden" style={{ height, borderRadius: radius, background: trackBg }}>
        <div className="h-full transition-all" style={{ width: `${v}%`, borderRadius: radius, background: fillBg }} />
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  right,
  children,
  onClick,
  colors,
  tone,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
  colors: UiSettings;
  tone?: "normal" | "overdue";
}) {
  const overdueBg = "rgba(244,63,94,0.09)";
  const overdueRing = "rgba(244,63,94,0.22)";

  return (
    <section
      className={`rounded-3xl p-6 shadow-sm ring-1 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      style={{
        backgroundColor: tone === "overdue" ? overdueBg : colors.cardColor,
        color: colors.textColor,
        borderColor: "rgba(0,0,0,0.06)",
        boxShadow: tone === "overdue" ? `0 0 0 1px ${overdueRing}` : undefined,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="flex items-center gap-2">{right}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/* -------------------- MODAL CONFIRM -------------------- */

function ConfirmModal({
  open,
  message,
  onConfirm,
  onCancel,
  ui,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  ui: UiSettings;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onCancel} />
      <div
        className="relative w-full max-w-md rounded-3xl p-6 shadow-xl ring-1"
        style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.06)" }}
      >
        <div className="text-base font-semibold">Подтверждение</div>
        <div className="mt-2 text-sm" style={{ opacity: 0.75 }}>
          {message}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <SoftButton colors={ui} onClick={onCancel}>
            Отмена
          </SoftButton>
          <button
            className="cursor-pointer rounded-2xl px-4 py-2 text-sm font-semibold shadow-sm active:scale-[0.99]"
            style={{ background: "rgba(244,63,94,1)", color: "#fff" }}
            onClick={onConfirm}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------- CHECKBOX (rounded, black bg, white check) -------------------- */

function NiceCheckbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange();
      }}
      className="cursor-pointer inline-flex h-6 w-6 items-center justify-center rounded-lg border shadow-sm active:scale-[0.99]"
      style={{
        borderColor: "rgba(0,0,0,0.14)",
        background: checked ? "#111827" : "rgba(0,0,0,0.02)",
        color: checked ? "#FFFFFF" : "transparent",
      }}
      aria-pressed={checked}
    >
      {checked ? <IconCheck /> : null}
    </button>
  );
}

/* -------------------- CONFETTI (оставил как было) -------------------- */

type ConfettiPiece = { id: string; left: number; size: number; rot: number; delay: number; dur: number; color: string };
type BalloonPiece = { id: string; left: number; size: number; delay: number; dur: number; color: string };

function ConfettiBalloonsOverlay({ active, ui, title }: { active: boolean; ui: UiSettings; title: string }) {
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [balloons, setBalloons] = useState<BalloonPiece[]>([]);

  useEffect(() => {
    if (!active) return;
    const colors = [ui.barHigh, ui.barMid, ui.barLow, "#00B0FF", "#651FFF", "#FF4081", "#FFD400", "#00C853"];

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
    <div className="fixed inset-0 z-[9999] pointer-events-none overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.06)" }} />

      <div
        className="absolute left-1/2 top-10 -translate-x-1/2 rounded-3xl px-5 py-3 shadow-sm"
        style={{ backgroundColor: ui.cardColor, color: ui.textColor, border: "1px solid rgba(0,0,0,0.08)" }}
      >
        <div className="text-sm font-semibold">🎉 Цель выполнена на 100%!</div>
        <div className="text-xs" style={{ opacity: 0.75 }}>
          {title}
        </div>
      </div>

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

/* -------------------- PAGE -------------------- */

export default function Page() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [openGoalId, setOpenGoalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Period>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPeriod, setNewPeriod] = useState<Period>("week");
  const [newStartISO, setNewStartISO] = useState(todayISO());
  const [newEndISO, setNewEndISO] = useState(defaultEndForPeriod(todayISO(), "week"));

  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [authReady, setAuthReady] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPass, setAuthPass] = useState("");
  const [authMsg, setAuthMsg] = useState("");

  const [stepDraft, setStepDraft] = useState<Record<string, string>>({});
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const [ui, setUi] = useState<UiSettings>(DEFAULT_UI);
  const [showDesign, setShowDesign] = useState(false);

  const [celebrate, setCelebrate] = useState(false);
  const [celebrateTitle, setCelebrateTitle] = useState("");
  const celebrateTimerRef = useRef<number | null>(null);
  const celebratedGoalIdsRef = useRef<Set<string>>(new Set());

  // confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmActionRef = useRef<null | (() => void)>(null);
  const [confirmMessage, setConfirmMessage] = useState("");

  function askConfirm(message: string, action: () => void) {
    setConfirmMessage(message);
    confirmActionRef.current = action;
    setConfirmOpen(true);
  }

  /* ---- CSS patches for color input + consistent pointers ---- */
  const cssPatch = (
    <style>{`
      input[type="color"]{
        -webkit-appearance: none;
        appearance: none;
        padding: 0;
        border: none;
        background: transparent;
        width: 40px;
        height: 34px;
        cursor: pointer;
      }
      input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
      input[type="color"]::-webkit-color-swatch { border: none; border-radius: 12px; }
      input[type="color"]::-moz-color-swatch { border: none; border-radius: 12px; }

     
    `}</style>
  );

  /* -------------------- LOAD/SAVE -------------------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Goal[];
        if (Array.isArray(parsed)) setGoals(parsed);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(goals));
    } catch {}
  }, [goals]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_UI_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<UiSettings>;
        if (parsed && typeof parsed === "object") setUi((prev) => ({ ...prev, ...parsed }));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_UI_KEY, JSON.stringify(ui));
    } catch {}
  }, [ui]);

  /* -------------------- AUTH -------------------- */

  useEffect(() => {
    let alive = true;

    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;
      if (error) {
        setUser(null);
        setAuthReady(true);
        return;
      }
      setUser(data.user ?? null);
      setAuthReady(true);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn() {
    setAuthMsg("");
    const email = authEmail.trim();
    if (!email || !authPass) return setAuthMsg("Введите email и пароль.");
    const { error } = await supabase.auth.signInWithPassword({ email, password: authPass });
    if (error) setAuthMsg(error.message);
  }

 async function signUp() {
  setAuthMsg("");
  const email = authEmail.trim();
  if (!email || !authPass) return setAuthMsg("Введите email и пароль.");

  const { error } = await supabase.auth.signUp({
    email,
    password: authPass,
    options: {
      emailRedirectTo: `${window.location.origin}/confirmed`,
    },
  });

  if (error) return setAuthMsg(error.message);

  setAuthMsg("Аккаунт создан ✅ Проверь почту и подтверди e-mail.");
}


  async function signOut() {
    await supabase.auth.signOut();
  }

  /* -------------------- COMPUTED -------------------- */

  const goalsSortedFiltered = useMemo(() => {
    const arr = filter === "all" ? goals : goals.filter((g) => g.period === filter);
    return [...arr].sort((a, b) => (a.endISO < b.endISO ? -1 : a.endISO > b.endISO ? 1 : b.createdAt - a.createdAt));
  }, [goals, filter]);

  const openGoal = useMemo(() => goals.find((g) => g.id === openGoalId) ?? null, [goals, openGoalId]);

  /* -------------------- CELEBRATION -------------------- */

  function startCelebration(goalTitle: string) {
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
    return () => {
      if (celebrateTimerRef.current) {
        window.clearTimeout(celebrateTimerRef.current);
        celebrateTimerRef.current = null;
      }
    };
  }, []);

  /* -------------------- ACTIONS -------------------- */

  function closeDesignOnAnyNav() {
    setShowDesign(false);
  }

  function createGoal() {
    const t = newTitle.trim();
    if (!t) return;

    const s = newStartISO || todayISO();
    const e = newEndISO || defaultEndForPeriod(s, newPeriod);

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
    const start = todayISO();
    setNewStartISO(start);
    setNewEndISO(defaultEndForPeriod(start, "week"));
    setShowCreate(false);
  }

  function updateGoalMain(goalId: string, patch: Partial<Pick<Goal, "title" | "period" | "startISO" | "endISO">>) {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, ...patch } : g)));
  }

  function deleteGoal(goalId: string) {
    askConfirm("Удалить цель целиком? Это действие нельзя отменить.", () => {
      setGoals((prev) => prev.filter((g) => g.id !== goalId));
      setOpenGoalId(null);
      setEditingGoal(false);
      setEditingStepId(null);
      setConfirmOpen(false);
    });
  }

  function toggleStep(goalId: string, stepId: string) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;

        const beforePct = progressPct(g);
        const nextSteps = g.steps.map((s) => (s.id === stepId ? { ...s, done: !s.done } : s));
        const afterPct = progressPctFromSteps(nextSteps);

        if (beforePct < 100 && afterPct === 100 && !celebratedGoalIdsRef.current.has(g.id)) {
          celebratedGoalIdsRef.current.add(g.id);
          startCelebration(g.title);
        }
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

    const step: Step = { id: uid(), text, done: false, dueISO: "" };
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, steps: [...g.steps, step] } : g)));
    setStepDraft((prev) => ({ ...prev, [goalId]: "" }));
  }

  function updateStep(goalId: string, stepId: string, patch: Partial<Pick<Step, "text" | "dueISO">>) {
    setGoals((prev) =>
      prev.map((g) => {
        if (g.id !== goalId) return g;
        return { ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) };
      })
    );
  }

  function deleteStep(goalId: string, stepId: string) {
    askConfirm("Удалить шаг? Это действие нельзя отменить.", () => {
      setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, steps: g.steps.filter((s) => s.id !== stepId) } : g)));
      if (editingStepId === stepId) setEditingStepId(null);
      setConfirmOpen(false);
    });
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

  /* -------------------- RENDER: AUTH LOADING -------------------- */

  if (!authReady) {
    return (
      <main className="min-h-screen" style={pageStyle}>
        {cssPatch}
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="rounded-3xl p-6 shadow-sm ring-1" style={{ backgroundColor: ui.cardColor, borderColor: "rgba(0,0,0,0.06)" }}>
            <div className="text-sm font-semibold">Goalix</div>
            <div className="mt-2 text-sm" style={{ opacity: 0.7 }}>
              Проверяем сессию…
            </div>
            <div className="mt-4 h-2 w-full rounded-full" style={{ background: "rgba(0,0,0,0.08)" }} />
          </div>
        </div>
      </main>
    );
  }

  /* -------------------- RENDER: LOGIN -------------------- */

  if (!user) {
    return (
      <main className="min-h-screen" style={pageStyle}>
        {cssPatch}
        <div className="mx-auto max-w-md px-4 py-12">
          <h1 className="text-2xl font-bold">Вход</h1>
          <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>
            Введите email и пароль. Если аккаунта нет — нажмите «Регистрация».
          </p>

          <div className="mt-6 grid gap-3 rounded-3xl p-6 shadow-sm ring-1" style={{ backgroundColor: ui.cardColor, borderColor: "rgba(0,0,0,0.06)" }}>
            <input
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
              placeholder="Email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
            />
            <input
              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
              style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
              placeholder="Пароль"
              type="password"
              value={authPass}
              onChange={(e) => setAuthPass(e.target.value)}
            />

            <div className="flex gap-2">
              <PrimaryButton colors={ui} onClick={signIn}>
                Войти
              </PrimaryButton>
              <SoftButton colors={ui} onClick={signUp}>
                Регистрация
              </SoftButton>
            </div>

            {authMsg ? (
              <div className="rounded-2xl border px-4 py-3 text-sm" style={{ borderColor: "rgba(0,0,0,0.12)", background: "rgba(0,0,0,0.02)" }}>
                {authMsg}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    );
  }

  /* -------------------- RENDER: GOALS LIST -------------------- */

  if (!openGoal) {
    return (
      <main className="min-h-screen" style={pageStyle}>
        {cssPatch}

        <ConfirmModal
          open={confirmOpen}
          message={confirmMessage}
          ui={ui}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => confirmActionRef.current?.()}
        />

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

              <SoftButton colors={ui} onClick={signOut}>
                Выйти
              </SoftButton>
            </div>
          </header>

          <div className="mt-6 flex flex-wrap gap-2">
            <Tab active={filter === "all"} onClick={() => { setFilter("all"); closeDesignOnAnyNav(); }} colors={ui}>Все</Tab>
            <Tab active={filter === "week"} onClick={() => { setFilter("week"); closeDesignOnAnyNav(); }} colors={ui}>Неделя</Tab>
            <Tab active={filter === "month"} onClick={() => { setFilter("month"); closeDesignOnAnyNav(); }} colors={ui}>Месяц</Tab>
            <Tab active={filter === "year"} onClick={() => { setFilter("year"); closeDesignOnAnyNav(); }} colors={ui}>Год</Tab>
          </div>

          {/* ОФОРМЛЕНИЕ */}
          {showDesign ? (
            <div className="mt-6">
              <Card
                colors={ui}
                title="🎨 Оформление"
                subtitle="Настраивай цвета, шрифты и стиль шкалы."
                right={<SoftButton colors={ui} onClick={resetUi}>Сбросить</SoftButton>}
              >
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <FieldLabel colors={ui}>Цвет фона</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PAINT_PALETTE.map((c) => (
                        <ColorSwatch
                          key={c}
                          color={c}
                          selected={ui.bgColor.toLowerCase() === c.toLowerCase()}
                          onPick={(hex) => setUi((p) => ({ ...p, bgColor: hex }))}
                        />
                      ))}
                      <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm" style={{ opacity: 0.8 }}>
                        <span>Другой:</span>
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.bgColor} onChange={(e) => setUi((p) => ({ ...p, bgColor: e.target.value }))} />
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Цвет карточек</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PAINT_PALETTE.map((c) => (
                        <ColorSwatch
                          key={c}
                          color={c}
                          selected={ui.cardColor.toLowerCase() === c.toLowerCase()}
                          onPick={(hex) => setUi((p) => ({ ...p, cardColor: hex }))}
                        />
                      ))}
                      <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm" style={{ opacity: 0.8 }}>
                        <span>Другой:</span>
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.cardColor} onChange={(e) => setUi((p) => ({ ...p, cardColor: e.target.value }))} />
                        </span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Цвет кнопок</FieldLabel>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PAINT_PALETTE.map((c) => (
                        <ColorSwatch
                          key={c}
                          color={c}
                          selected={ui.btnColor.toLowerCase() === c.toLowerCase()}
                          onPick={(hex) => setUi((p) => ({ ...p, btnColor: hex }))}
                        />
                      ))}
                      <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-sm" style={{ opacity: 0.8 }}>
                        <span>Другой:</span>
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.btnColor} onChange={(e) => setUi((p) => ({ ...p, btnColor: e.target.value }))} />
                        </span>
                      </label>
                    </div>

                    <div className="mt-3">
                      <FieldLabel colors={ui}>Цвет текста на кнопках</FieldLabel>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1 cursor-pointer" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.btnTextColor} onChange={(e) => setUi((p) => ({ ...p, btnTextColor: e.target.value }))} />
                        </span>
                        <span className="text-sm" style={{ opacity: 0.7 }}>Например белый/чёрный</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Цвета шкалы</FieldLabel>
                    <div className="mt-3 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ opacity: 0.7 }}>Низкий</span>
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1 cursor-pointer" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.barLow} onChange={(e) => setUi((p) => ({ ...p, barLow: e.target.value }))} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ opacity: 0.7 }}>Средний</span>
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1 cursor-pointer" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.barMid} onChange={(e) => setUi((p) => ({ ...p, barMid: e.target.value }))} />
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm" style={{ opacity: 0.7 }}>Высокий</span>
                        <span className="inline-flex items-center justify-center rounded-xl border px-2 py-1 cursor-pointer" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                          <input type="color" value={ui.barHigh} onChange={(e) => setUi((p) => ({ ...p, barHigh: e.target.value }))} />
                        </span>
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
                    <FieldLabel colors={ui}>Шрифты</FieldLabel>
                    <select
                      className="mt-2 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
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
                  </div>

                  <div>
                    <FieldLabel colors={ui}>Стиль шкалы</FieldLabel>
                    <select
                      className="mt-2 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={ui.barStyle}
                      onChange={(e) => setUi((p) => ({ ...p, barStyle: e.target.value as BarStyle }))}
                    >
                      <option value="pill">Овальная</option>
                      <option value="striped">Полосатая</option>
                      <option value="dashed">Пунктир</option>
                      <option value="diagonal">Диагональ</option>
                    </select>

                    <div className="mt-3 rounded-2xl border p-3" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
                      <div className="text-xs mb-2" style={{ opacity: 0.7 }}>Пример:</div>
                      <ProgressBar pct={72} ui={ui} />
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {/* СОЗДАНИЕ ЦЕЛИ */}
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
                      className="mt-1 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={newPeriod}
                      onChange={(e) => {
                        const p = e.target.value as Period;
                        setNewPeriod(p);
                        setShowDesign(false);
                        // end по умолчанию, но пользователь может поменять
                        setNewEndISO(defaultEndForPeriod(newStartISO, p));
                      }}
                    >
                      <option value="week">Неделя</option>
                      <option value="month">Месяц</option>
                      <option value="year">Год</option>
                    </select>
                  </div>

                  <div className="sm:col-span-1">
                    <FieldLabel colors={ui}>Дата начала</FieldLabel>
                    <input
                      type="date"
                      className="mt-1 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={newStartISO}
                      onChange={(e) => setNewStartISO(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <FieldLabel colors={ui}>Дата окончания</FieldLabel>
                    <input
                      type="date"
                      className="mt-1 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                      style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                      value={newEndISO}
                      onChange={(e) => setNewEndISO(e.target.value)}
                    />
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

          {/* СПИСОК ЦЕЛЕЙ */}
          <div className="mt-6 grid gap-5">
            {goalsSortedFiltered.length === 0 ? (
              <Card colors={ui} title="Пока нет целей" subtitle="Нажми “+ Добавить”, чтобы создать первую.">
                <div className="text-sm" style={{ opacity: 0.7 }}>
                  Оформление можно менять через кнопку “Оформление”.
                </div>
              </Card>
            ) : null}

            {goalsSortedFiltered.map((g) => {
              const pct = progressPct(g);
              const overdue = isOverdue(g.endISO) && pct < 100;

              return (
                <Card
                  key={g.id}
                  colors={ui}
                  tone={overdue ? "overdue" : "normal"}
                  title={g.title}
                  subtitle={`${periodLabel(g.period)} · ${formatRu(g.startISO)} — ${formatRu(g.endISO)}${overdue ? " · Просрочено" : ""}`}
                  onClick={() => {
                    setOpenGoalId(g.id);
                    setShowDesign(false);
                    setShowCreate(false);
                  }}
                  right={
                    <>
                      <IconButton
                        colors={ui}
                        title="Редактировать"
                        onClick={() => {
                          setOpenGoalId(g.id);
                          setEditingGoal(true);
                          setEditingStepId(null);
                          setShowDesign(false);
                          setShowCreate(false);
                        }}
                      >
                        <IconPencil />
                      </IconButton>
                      <IconButton colors={ui} title="Удалить" onClick={() => deleteGoal(g.id)}>
                        <IconTrash />
                      </IconButton>
                    </>
                  }
                >
                  <div className="rounded-2xl border p-4" style={{ backgroundColor: ui.cardColor, borderColor: "rgba(0,0,0,0.12)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold" style={{ opacity: 0.85 }}>Прогресс: {pct}%</div>
                      <div className="text-xs" style={{ opacity: 0.6 }}>{g.steps.length ? `Шагов: ${g.steps.length}` : "Шагов пока нет"}</div>
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

  /* -------------------- RENDER: INSIDE GOAL -------------------- */

  const pct = progressPct(openGoal);
  const stepPct = perStep(openGoal);
  const overdueGoal = isOverdue(openGoal.endISO) && pct < 100;

  return (
    <main className="min-h-screen" style={pageStyle}>
      {cssPatch}

      <ConfirmModal
        open={confirmOpen}
        message={confirmMessage}
        ui={ui}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => confirmActionRef.current?.()}
      />

      <ConfettiBalloonsOverlay active={celebrate} ui={ui} title={celebrateTitle} />

      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="flex items-center justify-between gap-3">
          <PrimaryButton colors={ui} onClick={onBackToList}>
            ← Назад
          </PrimaryButton>

          <div className="flex items-center gap-2">
            <IconButton
              colors={ui}
              title={editingGoal ? "Закрыть редактирование" : "Редактировать цель"}
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
            tone={overdueGoal ? "overdue" : "normal"}
            title={openGoal.title}
            subtitle={`${periodLabel(openGoal.period)} · ${formatRu(openGoal.startISO)} — ${formatRu(openGoal.endISO)}${overdueGoal ? " · Просрочено" : ""}`}
          >
            <div className="rounded-2xl border p-4" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold" style={{ opacity: 0.85 }}>
                  Прогресс: {pct}%
                </div>
                <div className="text-xs" style={{ opacity: 0.6 }}>
                  {openGoal.steps.length ? `≈ ${stepPct}% за шаг` : "Добавь шаги"}
                </div>
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
                    className="mt-1 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                    value={openGoal.period}
                    onChange={(e) => updateGoalMain(openGoal.id, { period: e.target.value as Period })}
                  >
                    <option value="week">Неделя</option>
                    <option value="month">Месяц</option>
                    <option value="year">Год</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <FieldLabel colors={ui}>Дата начала</FieldLabel>
                  <input
                    type="date"
                    className="mt-1 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                    value={openGoal.startISO}
                    onChange={(e) => updateGoalMain(openGoal.id, { startISO: e.target.value })}
                  />
                </div>

                <div className="sm:col-span-2">
                  <FieldLabel colors={ui}>Дата окончания</FieldLabel>
                  <input
                    type="date"
                    className="mt-1 w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                    style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                    value={openGoal.endISO}
                    onChange={(e) => updateGoalMain(openGoal.id, { endISO: e.target.value })}
                  />
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
              <div className="mt-4 text-sm" style={{ opacity: 0.7 }}>
                Шагов пока нет. Добавь первый шаг сверху.
              </div>
            ) : (
              <div className="mt-4 grid gap-2">
                {openGoal.steps.map((s) => {
                  const isEditing = editingStepId === s.id;

                  return (
                 <div
  key={s.id}
  className="rounded-2xl border px-4 py-3"
  style={{ borderColor: "rgba(0,0,0,0.12)" }}
>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <NiceCheckbox checked={s.done} onChange={() => toggleStep(openGoal.id, s.id)} />
                          <div
                            className="text-sm font-medium"
                            style={{
                              opacity: s.done ? 0.55 : 0.9,
                              textDecoration: s.done ? "line-through" : "none",
                            }}
                          >
                            {s.text}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs" style={{ opacity: 0.6 }}>
                            ≈ {stepPct}%
                          </span>

                          <IconButton
                            colors={ui}
                            title={isEditing ? "Закончить редактирование" : "Редактировать"}
                            onClick={() => {
                              setEditingStepId(isEditing ? null : s.id);
                              setEditingGoal(false);
                            }}
                          >
                            <IconPencil />
                          </IconButton>

                          <IconButton colors={ui} title="Удалить" onClick={() => deleteStep(openGoal.id, s.id)}>
                            <IconTrash />
                          </IconButton>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="sm:col-span-2">
                          {isEditing ? (
                            <input
                              className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                              style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                              value={s.text}
                              onChange={(e) => updateStep(openGoal.id, s.id, { text: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") setEditingStepId(null);
                              }}
                              onBlur={() => setEditingStepId(null)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <div className="text-xs" style={{ opacity: 0.65 }}>
                              {s.dueISO ? `Дедлайн: ${formatRu(s.dueISO)}` : "Дедлайн: не задан"}
                            </div>
                          )}
                        </div>

                        <div>
                          <input
                            type="date"
                            className="w-full cursor-pointer rounded-2xl border px-4 py-3 text-sm outline-none"
                            style={{ backgroundColor: ui.cardColor, color: ui.textColor, borderColor: "rgba(0,0,0,0.12)" }}
                            value={s.dueISO ?? ""}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateStep(openGoal.id, s.id, { dueISO: e.target.value })}
                          />
                        </div>
                      </div>
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
