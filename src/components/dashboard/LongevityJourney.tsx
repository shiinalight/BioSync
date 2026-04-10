import { motion } from "framer-motion";
import {
  Flag,
  HeartPulse,
  MessageCircle,
  Route,
  Share2,
  Sparkles,
  Target,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Quarter = {
  id: string;
  label: string;
  title: string;
  milestones: string[];
  engagement: string[];
  healthImpact: string[];
  accent: string;
  icon: typeof Flag;
};

const QUARTERS: Quarter[] = [
  {
    id: "q1",
    label: "Q1",
    title: "Foundation",
    milestones: ["Sync records", "Health Age baseline", "Priority: HbA1c focus"],
    engagement: ["Daily AI check-ins", "Weekly action nudges"],
    healthImpact: ["Habits mapped to risk", "Coach tuned to your labs"],
    accent: "from-emerald-400/25 via-teal-400/10 to-transparent",
    icon: Flag,
  },
  {
    id: "q2",
    label: "Q2",
    title: "Habit forming",
    milestones: ["First biomarker win", "Sleep quality ↑ ~20%"],
    engagement: ["Streak rewards", "Micro-goals you can clear"],
    healthImpact: ["Weight trend ↓ 2 kg target", "Recovery consistency up"],
    accent: "from-cyan-400/20 via-emerald-400/10 to-transparent",
    icon: Sparkles,
  },
  {
    id: "q3",
    label: "Q3",
    title: "Integration",
    milestones: ["5-year risk projection", "Preventive interventions"],
    engagement: ["Proactive planning", "Social & accountability"],
    healthImpact: ["Diabetes progression risk ↓ ~40% path", "Fewer surprise spikes"],
    accent: "from-teal-400/25 via-cyan-400/10 to-transparent",
    icon: Route,
  },
  {
    id: "q4",
    label: "Q4",
    title: "Advocacy",
    milestones: ["Annual longevity review", "Referral bonus unlocked"],
    engagement: ["Family plan", "Long-term goal checkpoints"],
    healthImpact: ["Health Age −2 yr trajectory", "Sustained energy & sleep"],
    accent: "from-emerald-300/30 via-teal-300/15 to-transparent",
    icon: Share2,
  },
];

function JourneyBullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 text-[13px] leading-snug text-white/90">
          <span
            className="mt-1.5 h-2 w-2 shrink-0 rounded-[3px] bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.55)]"
            aria-hidden
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function sectionLabel(text: string) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 mb-2.5 flex items-center gap-1.5">
      <span className="h-px w-3 bg-white/40" aria-hidden />
      {text}
    </p>
  );
}

function currentQuarterIndex(): number {
  const m = new Date().getMonth();
  return Math.min(3, Math.floor(m / 3));
}

export type LongevityJourneyProps = {
  healthScore?: number;
  className?: string;
};

export function LongevityJourney({ healthScore, className }: LongevityJourneyProps) {
  const active = currentQuarterIndex();
  const displayAge =
    healthScore != null
      ? Math.max(52, Math.min(82, Math.round(70 - (healthScore - 75) * 0.35)))
      : 68;

  const quarters = QUARTERS.map((q, i) => {
    if (i !== 0) return q;
    const milestones = q.milestones.map((line) =>
      line.includes("Health Age baseline") ? `Health Age: ${displayAge} (baseline)` : line
    );
    return { ...q, milestones };
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className={cn("relative overflow-hidden rounded-2xl border border-emerald-500/25", className)}
      aria-labelledby="longevity-journey-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-teal-950/80 to-slate-950"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl"
        aria-hidden
      />

      <div className="relative px-5 py-6 sm:px-7 sm:py-8">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-emerald-300/90 mb-1">
              <HeartPulse className="h-4 w-4" aria-hidden />
              <span className="text-xs font-medium tracking-wide">Roadmap</span>
            </div>
            <h2 id="longevity-journey-heading" className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Longevity journey
            </h2>
            <p className="mt-1.5 text-sm text-emerald-200/85 max-w-xl">
              Real-time risk scoring with your existing data — no new wearables required. Each quarter builds on the last.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
            <Target className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
            <span>Today: highlight on your current quarter</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/10 gap-6 lg:gap-0">
          {quarters.map((q, i) => {
            const Icon = q.icon;
            const isActive = i === active;
            return (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 * i + 0.1, duration: 0.4 }}
                className={cn(
                  "relative px-0 lg:px-5 first:lg:pl-0 last:lg:pr-0",
                  isActive && "lg:-my-1"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity duration-300 bg-gradient-to-b pointer-events-none",
                    q.accent,
                    isActive && "opacity-100"
                  )}
                />
                <div
                  className={cn(
                    "rounded-xl border p-4 h-full flex flex-col transition-all duration-300 text-white",
                    isActive
                      ? "border-emerald-400/45 bg-white/[0.07] shadow-[0_0_0_1px_rgba(52,211,153,0.15),0_12px_40px_-12px_rgba(6,182,212,0.35)]"
                      : "border-white/10 bg-white/[0.03] hover:border-white/15"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-lg",
                          isActive
                            ? "bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/30 drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                            : "bg-white/10 text-white"
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/75">
                          {q.label}
                        </p>
                        <p className="text-sm font-medium text-white">{q.title}</p>
                      </div>
                    </div>
                    {isActive && (
                      <span className="shrink-0 rounded-full bg-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white ring-1 ring-emerald-400/40">
                        Now
                      </span>
                    )}
                  </div>

                  <div className="space-y-3 flex-1">
                    <div>
                      {sectionLabel("Milestones")}
                      <JourneyBullets items={q.milestones} />
                    </div>
                    <div>
                      {sectionLabel("Engagement")}
                      <JourneyBullets items={q.engagement} />
                    </div>
                    <div>
                      {sectionLabel("Health impact")}
                      <JourneyBullets items={q.healthImpact} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-1.5 text-[11px] text-white/75">
                    <MessageCircle className="h-3.5 w-3.5 text-white/80" aria-hidden />
                    <span>Synced with coach &amp; plan</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center gap-3">
          <div className="flex-1 relative h-px bg-gradient-to-r from-transparent via-white/25 to-white/40">
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-l-[8px] border-l-white/50"
              aria-hidden
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/50 shrink-0">
            <Users className="h-3.5 w-3.5 text-emerald-400/80" aria-hidden />
            <span>12-month arc</span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
