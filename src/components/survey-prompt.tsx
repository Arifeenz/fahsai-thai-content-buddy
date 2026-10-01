import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ClipboardCheck, PartyPopper, X } from "lucide-react";
import { api, type AuthUser } from "@/lib/api";

// Invite the user to rate the system only after they've actually used it --
// items 4-9 of the questionnaire ask about caption quality and time saved,
// which a brand-new user can't answer yet.
const FIRST_PROMPT_AT = 3;
const RE_PROMPT_AFTER = 5;
const MAX_DISMISSALS = 2;

interface LocalSurveyState {
  // Demo accounts are shared, so the server-side generation count and
  // "already submitted" flag belong to every visitor at once -- for those
  // accounts this per-browser copy is the one that counts.
  generations: number;
  submitted: boolean;
  dismissals: number;
  nextPromptAt: number;
}

const DEFAULT_STATE: LocalSurveyState = {
  generations: 0,
  submitted: false,
  dismissals: 0,
  nextPromptAt: FIRST_PROMPT_AT,
};

function storageKey(email: string) {
  return `fahsai.survey.${email}`;
}

function readLocal(email: string): LocalSurveyState {
  try {
    const raw = localStorage.getItem(storageKey(email));
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch {
    return DEFAULT_STATE;
  }
}

function writeLocal(email: string, state: LocalSurveyState) {
  try {
    localStorage.setItem(storageKey(email), JSON.stringify(state));
  } catch {
    // Private mode / blocked storage: the prompt just won't remember dismissals.
  }
  window.dispatchEvent(new Event("fahsai-survey-change"));
}

export function recordSurveyGeneration(email: string) {
  const state = readLocal(email);
  writeLocal(email, { ...state, generations: state.generations + 1 });
}

export function markSurveySubmitted(email: string) {
  writeLocal(email, { ...readLocal(email), submitted: true });
}

export function useSurveyStatus(user: AuthUser | undefined) {
  const enabled = !!user && user.role !== "admin";
  const { data } = useQuery({
    queryKey: ["survey", "me"],
    queryFn: () => api.getSurveyStatus(),
    enabled,
  });
  // localStorage isn't reactive -- re-render every mounted copy of this hook
  // (sidebar, floating button, cards) whenever any of them changes it.
  const [, setVersion] = useState(0);
  useEffect(() => {
    const refresh = () => setVersion((v) => v + 1);
    window.addEventListener("fahsai-survey-change", refresh);
    return () => window.removeEventListener("fahsai-survey-change", refresh);
  }, []);

  if (!enabled || !data || typeof window === "undefined") {
    return {
      // Admins never get a status query, so there's nothing to wait for.
      loaded: !!user && !enabled,
      visible: false,
      generations: 0,
      shouldNudge: false,
      dismiss: () => {},
    };
  }

  const local = readLocal(user.email);
  const submitted = user.is_demo ? local.submitted : data.submitted || local.submitted;
  const generations = user.is_demo ? local.generations : data.generation_count;
  const shouldNudge =
    !submitted && generations >= local.nextPromptAt && local.dismissals < MAX_DISMISSALS;

  function dismiss() {
    if (!user) return;
    const state = readLocal(user.email);
    writeLocal(user.email, {
      ...state,
      dismissals: state.dismissals + 1,
      nextPromptAt: generations + RE_PROMPT_AFTER,
    });
  }

  return { loaded: true, visible: !submitted, generations, shouldNudge, dismiss };
}

export function SurveyNudgeCard({ user }: { user: AuthUser | undefined }) {
  const { shouldNudge, dismiss } = useSurveyStatus(user);
  if (!shouldNudge) return null;
  return (
    <div className="glass-card relative flex flex-wrap items-center gap-4 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/10 to-teal/10 p-5">
      <button
        type="button"
        onClick={dismiss}
        title="ปิด"
        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <PartyPopper className="h-8 w-8 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <div className="font-bold">ลองใช้ FAHSAI มาสักพักแล้ว เป็นยังไงบ้างคะ?</div>
        <div className="text-sm text-muted-foreground">
          ช่วยประเมินระบบหน่อยนะคะ ใช้เวลาแค่ 2–3 นาที ความเห็นของคุณช่วยให้เราพัฒนาต่อได้
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={dismiss}
          className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          ไว้ทีหลัง
        </button>
        <Link
          to="/feedback"
          className="rounded-xl bg-gradient-to-r from-gold to-teal px-4 py-2 text-sm font-bold text-primary-foreground"
        >
          ประเมินเลย
        </Link>
      </div>
    </div>
  );
}

// Stays on the dashboard until the survey is done, but only once the user
// has generated something -- there's nothing to rate before that.
export function SurveyDashboardCard({ user }: { user: AuthUser | undefined }) {
  const { visible, generations } = useSurveyStatus(user);
  if (!visible || generations < 1) return null;
  return (
    <Link
      to="/feedback"
      className="glass-card mb-6 flex items-center gap-4 rounded-2xl border border-gold/30 p-4 transition hover:border-gold/60"
    >
      <ClipboardCheck className="h-6 w-6 shrink-0 text-gold" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">ช่วยประเมินความพึงพอใจระบบ FAHSAI</div>
        <div className="text-xs text-muted-foreground">ใช้เวลา 2–3 นาที • ไม่เปิดเผยชื่อ</div>
      </div>
      <span className="text-sm font-semibold text-teal">ประเมิน →</span>
    </Link>
  );
}

export function SurveySidebarLink({ user }: { user: AuthUser | undefined }) {
  const { visible } = useSurveyStatus(user);
  if (!visible) return null;
  return (
    <Link
      to="/feedback"
      className="mx-3 mb-3 flex items-center gap-3 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold/20"
    >
      <ClipboardCheck className="h-5 w-5" />
      ประเมินระบบ
    </Link>
  );
}

// Mobile bottom nav is already full, so on phones the always-visible entry
// point floats just above it instead.
export function SurveyFloatingButton({ user }: { user: AuthUser | undefined }) {
  const { visible } = useSurveyStatus(user);
  if (!visible) return null;
  return (
    <Link
      to="/feedback"
      className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-gradient-to-r from-gold to-teal px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-lg md:hidden"
    >
      <ClipboardCheck className="h-4 w-4" />
      ประเมินระบบ
    </Link>
  );
}
