
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Footprints, Heart, Moon, Flame, Droplets, 
  Bot, CalendarClock, ShoppingBag, TrendingUp, TrendingDown 
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LongevityJourney } from "@/components/dashboard/LongevityJourney";

 
const metrics = [
  { label: "Steps", value: "8,432", target: "10,000", icon: Footprints, trend: "up" as const, change: "+12%", color: "text-primary" },
  { label: "Heart Rate", value: "72", unit: "bpm", icon: Heart, trend: "down" as const, change: "-3%", color: "text-red-500" },
  { label: "Sleep", value: "7.2", unit: "hrs", icon: Moon, trend: "up" as const, change: "+8%", color: "text-indigo-500" },
  { label: "Calories", value: "1,840", target: "2,200", icon: Flame, trend: "up" as const, change: "+5%", color: "text-orange-500" },
  { label: "Water", value: "6", unit: "glasses", icon: Droplets, trend: "down" as const, change: "-1", color: "text-sky-500" },
];

const weeklyData = [65, 72, 68, 80, 75, 82, 78];

const persona = {
  name: "Jean",
  age: 66,
  conditions: ["Type 2 Diabetes", "Dyslipidemia"],

  metrics: {
    steps: 8452,
    heartRate: 72,
    sleep: 6.4,
    sleepQuality: 62,
    calories: 1840,
    water: 12,
  },

  lifestyle: {
    alcohol: 16,
    fruitVeg: 2.6,
    exercise: 3,
    sedentary: 9.3,
  }
};

const user = persona;

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
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          {score}
        </motion.span>
  <span className="text-xs text-muted-foreground">Longevity Score</span>
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={width} height={height} className="mt-1">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const recentActivity = [
  { text: "Completed morning walk — 4,200 steps", time: "2h ago" },
  { text: "AI Coach: Try a 10-min meditation tonight", time: "5h ago" },
  { text: "Appointment confirmed with Dr. Lee", time: "Yesterday" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const loadProfile = () => {
      const stored = localStorage.getItem("unifiedProfile");
      if (stored) {
        setProfile(JSON.parse(stored));
      }
    };

    loadProfile();
    window.addEventListener("focus", loadProfile);

    return () => {
      window.removeEventListener("focus", loadProfile);
    };
  }, []);

  const healthScore = profile?.profile?.health_score || 82;

  const metricsWithProfile = metrics.map((m) => {
    // Prefer profile values when available, otherwise fall back to persona `user.metrics`
    if (m.label === "Steps") {
      const val = profile?.profile?.wearable_summary?.avg_steps ?? user.metrics.steps;
      return { ...m, value: typeof val === "number" ? Math.round(val).toLocaleString() : String(val) };
    }
    if (m.label === "Heart Rate") {
      const val = profile?.profile?.wearable_summary?.avg_resting_hr ?? user.metrics.heartRate;
      return { ...m, value: typeof val === "number" ? Math.round(val).toString() : String(val) };
    }
    if (m.label === "Sleep") {
      const val = profile?.profile?.wearable_summary?.avg_sleep_hours ?? user.metrics.sleep;
      return { ...m, value: typeof val === "number" ? String(val) : String(val) };
    }
    if (m.label === "Water") {
      const val =
        profile?.profile?.manual_entries?.lifestyle?.manual_water_glasses_daily ??
        profile?.profile?.lifestyle?.water_glasses_daily ??
        user.metrics.water;
      return { ...m, value: typeof val === "number" ? String(val) : String(val) };
    }
    return m;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Good morning, {user.name} 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your health overview for today</p>
      </div>

      

{/* Top row: Health Score + Longevity Plan */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <Card className="md:col-span-1 flex flex-col items-center justify-center py-8">
    <HealthScoreRing score={healthScore} />
    <p className="text-sm text-muted-foreground mt-3">
      Based on Jean’s current lifestyle and health indicators.
    </p>
  </Card>

  <Card className="md:col-span-2">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Longevity Plan</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {user.metrics.steps < 10000 && (
          <div className="p-4 border rounded-lg">
            <p className="font-medium">🚶 Activity Goal</p>
            <p className="text-sm text-muted-foreground">
              Current average: {user.metrics.steps.toLocaleString()} steps/day. Increase toward
              10,000 steps/day to support cardiovascular and metabolic health.
            </p>
          </div>
        )}

        {user.metrics.sleep < 7 && (
          <div className="p-4 border rounded-lg">
            <p className="font-medium">😴 Sleep Improvement</p>
            <p className="text-sm text-muted-foreground">
              Current sleep is {user.metrics.sleep} hours/night. Aim for 7+ hours to reduce
              metabolic and stress-related risk.
            </p>
          </div>
        )}

        {user.lifestyle.fruitVeg < 5 && (
          <div className="p-4 border rounded-lg">
            <p className="font-medium">🥗 Nutrition Boost</p>
            <p className="text-sm text-muted-foreground">
              Current intake is {user.lifestyle.fruitVeg} fruit/veg servings per day. Increase
              toward 5+ daily servings for better long-term health outcomes.
            </p>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
</div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
  {metricsWithProfile.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <m.icon className={`h-4 w-4 ${m.color}`} />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    {m.trend === "up" ? <TrendingUp className="h-3 w-3 text-primary" /> : <TrendingDown className="h-3 w-3 text-orange-400" />}
                    {m.change}
                  </div>
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {m.label === "Steps" ? `${m.value} steps` : m.value}
                  {m.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>}
                </div>
                {/* Inline risk / early-warning indicators for key metrics */}
                {m.label === "Sleep" && (
                  Number(profile?.profile?.wearable_summary?.avg_sleep_hours ?? user.metrics.sleep) < 7 && (
                    <div className="text-yellow-500 text-xs mt-1">Below recommended (7h+) → increased metabolic risk</div>
                  )
                )}
                {m.label === "Heart Rate" && (
                  Number(profile?.profile?.wearable_summary?.avg_resting_hr ?? user.metrics.heartRate) > 70 && (
                    <div className="text-red-500 text-xs mt-1">Elevated resting heart rate → possible stress/cardiovascular risk</div>
                  )
                )}
                <div className="text-xs text-muted-foreground">{m.label}</div>
                {m.target && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(parseInt(String(m.value).replace(",", "")) / parseInt(m.target.replace(",", ""))) * 100}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Weekly Trends + Recent Activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Weekly Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              {weeklyData.map((val, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <motion.div
                    className="w-full bg-primary/20 rounded-t-md"
                    initial={{ height: 0 }}
                    animate={{ height: `${(val / 100) * 80}px` }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                  >
                    <div
                      className="w-full bg-primary rounded-t-md"
                      style={{ height: `${(val / Math.max(...weeklyData)) * 100}%` }}
                    />
                  </motion.div>
                  <span className="text-[10px] text-muted-foreground">
                    {["M", "T", "W", "T", "F", "S", "S"][i]}
                  </span>
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

      <LongevityJourney healthScore={healthScore} />
    </div>
  );
const longevityPlan = [
  {
    id: "baseline",
    label: "Now",
    title: "Build Your Baseline",
    focus: "Understand current diabetes and lifestyle risk patterns.",
    actions: [
      "Track daily steps and sleep",
      "Monitor diet consistency",
      "Identify key risk factors"
    ],
    impact: [
      "Clear visibility into health status",
      "Personalized prevention starting point"
    ]
  },
  {
    id: "30days",
    label: "30 Days",
    title: "Strengthen Habits",
    focus: "Improve movement, sleep, and nutrition.",
    actions: [
      "Increase steps toward 10,000/day",
      "Improve sleep to 7+ hours",
      "Increase fruit & vegetable intake"
    ],
    impact: [
      "Better energy and consistency",
      "Early metabolic improvements"
    ]
  },
  {
    id: "90days",
    label: "90 Days",
    title: "Reduce Risk",
    focus: "Turn habits into measurable prevention.",
    actions: [
      "Respond to early warnings",
      "Maintain consistent routines",
      "Follow recommended checks"
    ],
    impact: [
      "Lower diabetes progression risk",
      "Improved cardiovascular health"
    ]
  },
  {
    id: "1year",
    label: "1 Year",
    title: "Healthy Aging",
    focus: "Sustain long-term health improvements.",
    actions: [
      "Maintain habits",
      "Adjust plan with data",
      "Continue preventive care"
    ],
    impact: [
      "Reduced long-term risk",
      "Stronger health confidence"
    ]
  }
];  
}
