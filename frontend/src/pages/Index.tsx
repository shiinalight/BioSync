import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Footprints, Heart, Moon, Flame, Droplets, 
  Bot, CalendarClock, ShoppingBag, TrendingUp, TrendingDown 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const healthScore = 82;

const metrics = [
  { label: "Steps", value: "8,432", target: "10,000", icon: Footprints, trend: "up" as const, change: "+12%", color: "text-primary" },
  { label: "Heart Rate", value: "72", unit: "bpm", icon: Heart, trend: "down" as const, change: "-3%", color: "text-red-500" },
  { label: "Sleep", value: "7.2", unit: "hrs", icon: Moon, trend: "up" as const, change: "+8%", color: "text-indigo-500" },
  { label: "Calories", value: "1,840", target: "2,200", icon: Flame, trend: "up" as const, change: "+5%", color: "text-orange-500" },
  { label: "Water", value: "6", unit: "glasses", icon: Droplets, trend: "down" as const, change: "-1", color: "text-sky-500" },
];

const weeklyData = [65, 72, 68, 80, 75, 82, 78];

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
        <span className="text-xs text-muted-foreground">Health Score</span>
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

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Good morning, Jane 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Here's your health overview for today</p>
      </div>

      {/* Top row: Health Score + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 flex flex-col items-center justify-center py-8">
          <HealthScoreRing score={healthScore} />
          <p className="text-sm text-muted-foreground mt-3">Great progress this week!</p>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate("/coach")}
            >
              <Bot className="h-5 w-5 text-primary" />
              <span className="text-sm">Talk to Coach</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate("/appointments")}
            >
              <CalendarClock className="h-5 w-5 text-primary" />
              <span className="text-sm">Book Appointment</span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-primary/5 hover:border-primary/30"
              onClick={() => navigate("/shop")}
            >
              <ShoppingBag className="h-5 w-5 text-primary" />
              <span className="text-sm">Health Shop</span>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {metrics.map((m, i) => (
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
                  {m.value}
                  {m.unit && <span className="text-xs font-normal text-muted-foreground ml-1">{m.unit}</span>}
                </div>
                <div className="text-xs text-muted-foreground">{m.label}</div>
                {m.target && (
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${(parseInt(m.value.replace(",", "")) / parseInt(m.target.replace(",", ""))) * 100}%` }}
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
            <CardTitle className="text-base">Weekly Trends</CardTitle>
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
    </div>
  );
}
