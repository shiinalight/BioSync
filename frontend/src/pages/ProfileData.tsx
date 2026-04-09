import { useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity, Heart, Droplets, Brain, Dumbbell,
  Loader2, CheckCircle2, AlertCircle, Moon, Footprints,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { evaluateAllScores, saveScores } from "@/services/api";
import type { HealthProfileRequest } from "@/types/health";

// ── Form state type ───────────────────────────────────────────────────────────
type FormState = {
  // Clinical
  age: string;
  sex: string;
  hba1c_pct: string;
  fasting_glucose_mmol: string;
  egfr_ml_min: string;
  crp_mg_l: string;
  hdl_mmol: string;
  ldl_mmol: string;
  triglycerides_mmol: string;
  total_cholesterol_mmol: string;
  sbp_mmhg: string;
  dbp_mmhg: string;
  bmi: string;
  smoking_status: string;
  // Wearable
  resting_hr: string;
  hrv: string;
  spo2: string;
  deep_sleep_pct: string;
  steps: string;
  sleep_dur: string;
  sleep_dur_std: string;
  // Lifestyle
  alcohol_units_weekly: string;
  diet_quality_score: string;
  fruit_veg_servings_daily: string;
  exercise_sessions_weekly: string;
  sedentary_hrs_day: string;
  stress_level: string;
  water_glasses_daily: string;
  meal_frequency_daily: string;
};

const EMPTY: FormState = {
  age: "", sex: "", hba1c_pct: "", fasting_glucose_mmol: "", egfr_ml_min: "",
  crp_mg_l: "", hdl_mmol: "", ldl_mmol: "", triglycerides_mmol: "",
  total_cholesterol_mmol: "", sbp_mmhg: "", dbp_mmhg: "", bmi: "",
  smoking_status: "",
  resting_hr: "", hrv: "", spo2: "", deep_sleep_pct: "", steps: "",
  sleep_dur: "", sleep_dur_std: "",
  alcohol_units_weekly: "", diet_quality_score: "", fruit_veg_servings_daily: "",
  exercise_sessions_weekly: "", sedentary_hrs_day: "", stress_level: "",
  water_glasses_daily: "", meal_frequency_daily: "",
};

function n(v: string, fallback = 0) {
  const parsed = parseFloat(v);
  return isNaN(parsed) ? fallback : parsed;
}

function Field({
  label, name, value, onChange, placeholder, step, icon: Icon, hint,
}: {
  label: string;
  name: keyof FormState;
  value: string;
  onChange: (name: keyof FormState, v: string) => void;
  placeholder?: string;
  step?: string;
  icon?: ElementType;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        {label}
        {hint && <span className="text-xs text-muted-foreground font-normal">({hint})</span>}
      </Label>
      <Input
        type="number"
        step={step ?? "any"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
      />
    </div>
  );
}

export default function ProfileData() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);

  const set = (name: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [name]: value }));

  const handleSubmit = async () => {
    // Basic required fields check
    const requiredText = ["age", "sex", "smoking_status"] as const;
    for (const f of requiredText) {
      if (!form[f]) {
        toast({ title: "Missing fields", description: `Please fill in: ${f.replace(/_/g, " ")}`, variant: "destructive" });
        return;
      }
    }

    const profile: HealthProfileRequest = {
      clinical: {
        age:                    n(form.age),
        sex:                    form.sex as "M" | "F",
        hba1c_pct:              n(form.hba1c_pct, 5.4),
        fasting_glucose_mmol:   n(form.fasting_glucose_mmol, 5.0),
        egfr_ml_min:            n(form.egfr_ml_min, 90),
        crp_mg_l:               n(form.crp_mg_l, 1.0),
        hdl_mmol:               n(form.hdl_mmol, 1.5),
        ldl_mmol:               n(form.ldl_mmol, 2.5),
        triglycerides_mmol:     n(form.triglycerides_mmol, 1.2),
        total_cholesterol_mmol: n(form.total_cholesterol_mmol, 4.5),
        sbp_mmhg:               n(form.sbp_mmhg, 120),
        dbp_mmhg:               n(form.dbp_mmhg, 80),
        bmi:                    n(form.bmi, 24),
        smoking_status:         form.smoking_status as "never" | "former" | "current",
      },
      wearable: {
        resting_hr:    n(form.resting_hr, 70),
        hrv:           n(form.hrv, 35),
        spo2:          n(form.spo2, 97),
        deep_sleep_pct: n(form.deep_sleep_pct, 18),
        steps:         n(form.steps, 7500),
        sleep_dur:     n(form.sleep_dur, 7.5),
        sleep_dur_std: n(form.sleep_dur_std, 0.7),
      },
      lifestyle: {
        smoking_status:          form.smoking_status as "never" | "former" | "current",
        alcohol_units_weekly:    n(form.alcohol_units_weekly, 0),
        diet_quality_score:      n(form.diet_quality_score, 6),
        fruit_veg_servings_daily: n(form.fruit_veg_servings_daily, 4),
        exercise_sessions_weekly: n(form.exercise_sessions_weekly, 3),
        sedentary_hrs_day:       n(form.sedentary_hrs_day, 6),
        stress_level:            n(form.stress_level, 5),
        water_glasses_daily:     n(form.water_glasses_daily, 6),
        meal_frequency_daily:    n(form.meal_frequency_daily, 3),
      },
    };

    setLoading(true);
    try {
      const scores = await evaluateAllScores(profile);
      saveScores(scores);
      toast({
        title: "Profile evaluated",
        description: `Overall health score: ${scores.overall_score}/100`,
      });
      navigate("/");
    } catch (err) {
      toast({
        title: "Backend error",
        description: err instanceof Error ? err.message : "Could not reach the API. Is the backend running?",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Health Profile Builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Enter your health data below. Blank fields use population-average defaults.
          Submit to generate your personalised scores.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Clinical Biomarkers */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Clinical Biomarkers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Age" name="age" value={form.age} onChange={set} placeholder="e.g. 42" hint="years" icon={Heart} />
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Sex</Label>
                <Select value={form.sex} onValueChange={(v) => set("sex", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Smoking status</Label>
              <Select value={form.smoking_status} onValueChange={(v) => set("smoking_status", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never smoked</SelectItem>
                  <SelectItem value="former">Former smoker</SelectItem>
                  <SelectItem value="current">Current smoker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Field label="HbA1c" name="hba1c_pct" value={form.hba1c_pct} onChange={set} placeholder="e.g. 5.4" hint="%" step="0.1" />
            <Field label="Fasting glucose" name="fasting_glucose_mmol" value={form.fasting_glucose_mmol} onChange={set} placeholder="e.g. 5.0" hint="mmol/L" step="0.1" />
            <Field label="eGFR" name="egfr_ml_min" value={form.egfr_ml_min} onChange={set} placeholder="e.g. 90" hint="ml/min" />
            <Field label="CRP" name="crp_mg_l" value={form.crp_mg_l} onChange={set} placeholder="e.g. 1.0" hint="mg/L" step="0.1" />
            <Field label="HDL cholesterol" name="hdl_mmol" value={form.hdl_mmol} onChange={set} placeholder="e.g. 1.5" hint="mmol/L" step="0.01" />
            <Field label="LDL cholesterol" name="ldl_mmol" value={form.ldl_mmol} onChange={set} placeholder="e.g. 2.5" hint="mmol/L" step="0.01" />
            <Field label="Total cholesterol" name="total_cholesterol_mmol" value={form.total_cholesterol_mmol} onChange={set} placeholder="e.g. 4.5" hint="mmol/L" step="0.01" />
            <Field label="Triglycerides" name="triglycerides_mmol" value={form.triglycerides_mmol} onChange={set} placeholder="e.g. 1.2" hint="mmol/L" step="0.01" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Systolic BP" name="sbp_mmhg" value={form.sbp_mmhg} onChange={set} placeholder="120" hint="mmHg" icon={Heart} />
              <Field label="Diastolic BP" name="dbp_mmhg" value={form.dbp_mmhg} onChange={set} placeholder="80" hint="mmHg" />
            </div>
            <Field label="BMI" name="bmi" value={form.bmi} onChange={set} placeholder="e.g. 23.5" step="0.1" />
          </CardContent>
        </Card>

        {/* Wearable / Sleep */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Moon className="h-5 w-5 text-primary" />
              Wearable & Sleep Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Resting heart rate" name="resting_hr" value={form.resting_hr} onChange={set} placeholder="e.g. 62" hint="bpm" icon={Heart} />
            <Field label="HRV (RMSSD)" name="hrv" value={form.hrv} onChange={set} placeholder="e.g. 42" hint="ms" />
            <Field label="SpO2" name="spo2" value={form.spo2} onChange={set} placeholder="e.g. 97" hint="%" step="0.1" />
            <Field label="Deep sleep" name="deep_sleep_pct" value={form.deep_sleep_pct} onChange={set} placeholder="e.g. 18" hint="% of sleep" step="0.1" />
            <Field label="Avg daily steps" name="steps" value={form.steps} onChange={set} placeholder="e.g. 8000" icon={Footprints} />
            <Field label="Sleep duration" name="sleep_dur" value={form.sleep_dur} onChange={set} placeholder="e.g. 7.5" hint="hrs" step="0.1" icon={Moon} />
            <Field label="Sleep consistency (std dev)" name="sleep_dur_std" value={form.sleep_dur_std} onChange={set} placeholder="e.g. 0.7" hint="hrs" step="0.1" />

            <div className="mt-4 p-3 bg-muted/40 rounded-md text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Where to find these values:</p>
              <p>• HRV & SpO2: Apple Health, Garmin, Whoop, Oura Ring</p>
              <p>• Deep sleep %: Fitbit, Garmin Connect, Sleep Cycle</p>
              <p>• Steps: any fitness tracker or phone health app</p>
            </div>
          </CardContent>
        </Card>

        {/* Lifestyle */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Dumbbell className="h-5 w-5 text-primary" />
              Lifestyle & Behaviour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Exercise sessions / week" name="exercise_sessions_weekly" value={form.exercise_sessions_weekly} onChange={set} placeholder="e.g. 4" icon={Dumbbell} />
            <Field label="Sedentary hours / day" name="sedentary_hrs_day" value={form.sedentary_hrs_day} onChange={set} placeholder="e.g. 6" />
            <Field label="Water glasses / day" name="water_glasses_daily" value={form.water_glasses_daily} onChange={set} placeholder="e.g. 8" icon={Droplets} />
            <Field label="Fruit & veg servings / day" name="fruit_veg_servings_daily" value={form.fruit_veg_servings_daily} onChange={set} placeholder="e.g. 5" />
            <Field label="Meals / day" name="meal_frequency_daily" value={form.meal_frequency_daily} onChange={set} placeholder="e.g. 3" />
            <Field label="Alcohol units / week" name="alcohol_units_weekly" value={form.alcohol_units_weekly} onChange={set} placeholder="e.g. 4" />
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                Stress level
                <span className="text-xs text-muted-foreground font-normal">(1 = low, 10 = high)</span>
              </Label>
              <Input
                type="number" min={1} max={10} step="1"
                placeholder="e.g. 4"
                value={form.stress_level}
                onChange={(e) => set("stress_level", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                Diet quality
                <span className="text-xs text-muted-foreground font-normal ml-1">(1 = poor, 10 = excellent)</span>
              </Label>
              <Input
                type="number" min={1} max={10} step="1"
                placeholder="e.g. 7"
                value={form.diet_quality_score}
                onChange={(e) => set("diet_quality_score", e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSubmit} disabled={loading} className="px-8">
          {loading ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analysing…</>
          ) : (
            <><CheckCircle2 className="h-4 w-4 mr-2" /> Generate Health Scores</>
          )}
        </Button>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-4 w-4" />
          Blank fields fall back to healthy population averages
        </p>
      </div>
    </div>
  );
}
