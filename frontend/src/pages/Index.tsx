import { useState, useEffect, type ElementType } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Heart, Moon, Droplets, Bot, CalendarClock, ShoppingBag,
  TrendingUp, TrendingDown, Activity, Brain, Loader2, Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getScores, getPatients } from "@/services/api";
import type { AllScoresResult } from "@/types/health";

// ── Sub-components ────────────────────────────────────────────────────────────

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative w-36 h-36">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
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

function ScoreCard({ label, score, category, icon: Icon, color, detail }: {
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
          {Math.round(score)}
          <span className="text-xs font-normal text-muted-foreground ml-1">/100</span>
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {detail && <div className="text-xs text-muted-foreground mt-0.5 italic">{detail}</div>}
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(score)}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

const weeklyPlaceholder = [65, 72, 68, 80, 75, 82, 78];

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate();
  const [patientId, setPatientId] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [scores, setScores] = useState<AllScoresResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<string[]>([]);

  // Load patient list on mount for autocomplete
  useEffect(() => {
    getPatients()
      .then((data) => setPatients(data.patient_ids))
      .catch(() => {}); // non-critical
  }, []);

  const handleLoad = async () => {
    const id = inputValue.trim().toUpperCase();
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getScores(id);
      setScores(data);
      setPatientId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scores.");
      setScores(null);
    } finally {
      setLoading(false);
    }
  };

  const cvHealthScore = scores ? Math.max(0, 100 - scores.cv_risk.cvd_risk_10yr_pct * 3) : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Health Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Enter a patient ID to load their health scores</p>
      </div>

      {/* Patient ID input */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="e.g. PT0001"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLoad()}
                list="patient-list"
                className="uppercase placeholder:normal-case"
              />
              <datalist id="patient-list">
                {patients.map((id) => <option key={id} value={id} />)}
              </datalist>
            </div>
            <Button onClick={handleLoad} disabled={loading || !inputValue.trim()}>
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <><Search className="h-4 w-4 mr-2" />Load</>}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive mt-2">{error}</p>}
        </CardContent>
      </Card>

      {scores && (
        <>
          {/* Health score ring + quick actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-1 flex flex-col items-center justify-center py-8">
              <HealthScoreRing score={Math.round(scores.overall_score)} />
              <p className="text-sm text-muted-foreground mt-3">Patient {patientId}</p>
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

          {/* Four domain score cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Lifestyle",
                score: scores.lifestyle.lifestyle_score,
                category: scores.lifestyle.category,
                icon: Activity,
                color: "text-primary",
                detail: `Weakest: ${scores.lifestyle.weakest_area}`,
              },
              {
                label: "Sleep & Recovery",
                score: scores.sleep.sleep_recovery_score,
                category: scores.sleep.category,
                icon: Moon,
                color: "text-indigo-500",
                detail: scores.sleep.chronic_sleep_debt ? "Chronic sleep debt" : undefined,
              },
              {
                label: "CV Health",
                score: cvHealthScore,
                category: scores.cv_risk.category,
                icon: Heart,
                color: "text-red-500",
                detail: `${scores.cv_risk.cvd_risk_10yr_pct}% 10-yr CVD risk`,
              },
              {
                label: "Biological Age",
                score: Math.max(0, 100 - Math.abs(scores.bio_age.bio_age_gap) * 8),
                category: scores.bio_age.interpretation,
                icon: Brain,
                color: "text-violet-500",
                detail: `Bio age ${scores.bio_age.biological_age} vs ${scores.bio_age.chronological_age} actual`,
              },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <ScoreCard {...card} />
              </motion.div>
            ))}
          </div>

          {/* Sub-score breakdown row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Sleep duration", value: scores.sleep.sub_scores.sleep_dur, icon: Moon, color: "text-indigo-500", trend: "up" as const },
              { label: "HRV", value: scores.sleep.sub_scores.hrv, icon: Activity, color: "text-primary", trend: "up" as const },
              { label: "Water intake", value: scores.lifestyle.sub_scores.water, icon: Droplets, color: "text-sky-500", trend: "up" as const },
              { label: "Exercise", value: scores.lifestyle.sub_scores.exercise, icon: Heart, color: "text-red-500", trend: scores.lifestyle.sub_scores.exercise >= 60 ? "up" as const : "down" as const },
            ].map((m, i) => (
              <motion.div key={m.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <m.icon className={`h-4 w-4 ${m.color}`} />
                      {m.trend === "up"
                        ? <TrendingUp className="h-3 w-3 text-primary" />
                        : <TrendingDown className="h-3 w-3 text-orange-400" />}
                    </div>
                    <div className="text-xl font-semibold text-foreground">
                      {Math.round(m.value)}
                      <span className="text-xs font-normal text-muted-foreground ml-1">score</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{m.label}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Weekly chart placeholder */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Weekly Trend</CardTitle>
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
        </>
      )}
    </div>
  );
}
