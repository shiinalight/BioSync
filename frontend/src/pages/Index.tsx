import { motion } from "framer-motion";
import { type ElementType } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Heart, Moon, Droplets,
  Bot, CalendarClock, ShoppingBag, TrendingUp, TrendingDown,
  ClipboardList, Activity, Brain,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadScores } from "@/services/api";
import type { AllScoresResult } from "@/types/health";

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-foreground"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground">Health Score</span>
      </div>
    </div>
  );
}

// ── Score cards derived from real API data ────────────────────────────────────

function ScoreCard({
  label, score, category, icon: Icon, color, detail,
}: {
  label: string;
  score: number;
  category: string;
  icon: ElementType;
  color: string;
  detail?: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-xs text-muted-foreground capitalize">{category}</span>
        </div>
        <div className="text-xl font-semibold text-foreground">
          {score}
          <span className="text-xs font-normal text-muted-foreground ml-1">/100</span>
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5 italic">{detail}</div>}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${score}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

// ── No-data banner ────────────────────────────────────────────────────────────

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <Card className="border-dashed border-2">
      <CardContent className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-semibold text-foreground">No health data yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Complete your health profile to see personalised scores from the AI models.
          </p>
        </div>
        <Button onClick={onNavigate}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Build your profile
        </Button>
      </CardContent>
    </Card>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

const weeklyPlaceholder = [65, 72, 68, 80, 75, 82, 78];

const recentActivity = [
  { text: "Completed morning walk — 4,200 steps", time: "2h ago" },
  { text: "AI Coach: Try a 10-min meditation tonight", time: "5h ago" },
  { text: "Appointment confirmed with Dr. Lee", time: "Yesterday" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const scores: AllScoresResult | null = loadScores();

  const hasData = scores !== null;
  const overallScore = hasData ? Math.round(scores.overall_score) : 82;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Good morning 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your health overview for today</p>
      </div>

      {/* Top row: Health Score + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 flex flex-col items-center justify-center py-8">
          <HealthScoreRing score={overallScore} />
          <p className="text-sm text-muted-foreground mt-3">
            {hasData ? "Based on your health profile" : "Demo score — add your data"}
          </p>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30" onClick={() => navigate("/coach")}>
              <Bot className="h-5 w-5 text-primary" />
              <span className="text-sm">Talk to Coach</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30" onClick={() => navigate("/appointments")}>
              <CalendarClock className="h-5 w-5 text-primary" />
              <span className="text-sm">Book Appointment</span>
            </Button>
            <Button variant="outline" className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30" onClick={() => navigate("/shop")}>
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span className="text-sm">Health Shop</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Health Score Breakdown — real data or empty state */}
      {hasData ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
            <ScoreCard
              label="Lifestyle"
              score={Math.round(scores.lifestyle.lifestyle_score)}
              category={scores.lifestyle.category}
              icon={Activity}
              color="text-primary"
              detail={`Weakest: ${scores.lifestyle.weakest_area}`}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <ScoreCard
              label="Sleep & Recovery"
              score={Math.round(scores.sleep.sleep_recovery_score)}
              category={scores.sleep.category}
              icon={Moon}
              color="text-indigo-500"
              detail={scores.sleep.chronic_sleep_debt ? "Chronic sleep debt detected" : undefined}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
            <ScoreCard
              label="CV Health"
              score={Math.round(Math.max(0, 100 - scores.cv_risk.cvd_risk_10yr_pct * 3))}
              category={scores.cv_risk.category}
              icon={Heart}
              color="text-red-500"
              detail={`${scores.cv_risk.cvd_risk_10yr_pct}% 10-yr CVD risk`}
            />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
            <ScoreCard
              label="Biological Age"
              score={Math.round(Math.max(0, 100 - Math.abs(scores.bio_age.bio_age_gap) * 8))}
              category={scores.bio_age.interpretation}
              icon={Brain}
              color="text-violet-500"
              detail={`Bio age: ${scores.bio_age.biological_age} vs ${scores.bio_age.chronological_age} actual`}
            />
          </motion.div>
        </div>
      ) : (
        <EmptyState onNavigate={() => navigate("/profile-data")} />
      )}

      {/* Wearable metrics strip */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Sleep", value: `${scores.sleep.sub_scores.sleep_dur?.toFixed(0) ?? "—"}`, unit: "score", icon: Moon, color: "text-indigo-500", trend: "up" as const },
            { label: "Heart Rate", value: "—", unit: "bpm", icon: Heart, color: "text-red-500", trend: "down" as const },
            { label: "HRV", value: `${scores.sleep.sub_scores.hrv?.toFixed(0) ?? "—"}`, unit: "score", icon: Activity, color: "text-primary", trend: "up" as const },
            { label: "Water intake", value: `${scores.lifestyle.sub_scores.water?.toFixed(0) ?? "—"}`, unit: "score", icon: Droplets, color: "text-sky-500", trend: "up" as const },
          ].map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <m.icon className={`h-4 w-4 ${m.color}`} />
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {m.trend === "up" ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-orange-400" />}
                    </div>
                  </div>
                  <div className="text-xl font-semibold text-foreground">
                    {m.value}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Weekly Trends + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Weekly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              {weeklyPlaceholder.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    className="w-full bg-primary/20 rounded-t-md"
                    initial={{ height: 0 }}
                    animate={{ height: `${(val / 100) * 80}px` }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                  >
                    <div className="w-full bg-primary rounded-t-md" style={{ height: `${(val / Math.max(...weeklyPlaceholder)) * 100}%` }} />
                  </motion.div>
                  <span className="text-[10px] text-muted-foreground">{["M","T","W","T","F","S","S"][i]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentActivity.map((a, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="h-2 w-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
