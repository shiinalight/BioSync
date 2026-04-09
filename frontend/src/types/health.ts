// ── Request types (match backend Pydantic schemas) ────────────────────────────

export interface ClinicalData {
  age: number;
  sex: "M" | "F";
  hba1c_pct: number;
  fasting_glucose_mmol: number;
  egfr_ml_min: number;
  crp_mg_l: number;
  hdl_mmol: number;
  ldl_mmol: number;
  triglycerides_mmol: number;
  total_cholesterol_mmol: number;
  sbp_mmhg: number;
  dbp_mmhg: number;
  bmi: number;
  smoking_status: "never" | "former" | "current";
}

export interface WearableData {
  resting_hr: number;
  hrv: number;
  spo2: number;
  deep_sleep_pct: number;
  steps: number;
  sleep_dur: number;
  sleep_dur_std?: number;
}

export interface LifestyleData {
  smoking_status: "never" | "former" | "current";
  alcohol_units_weekly: number;
  diet_quality_score: number;
  fruit_veg_servings_daily: number;
  exercise_sessions_weekly: number;
  sedentary_hrs_day: number;
  stress_level: number;
  water_glasses_daily: number;
  meal_frequency_daily: number;
}

export interface HealthProfileRequest {
  clinical: ClinicalData;
  wearable: WearableData;
  lifestyle: LifestyleData;
}

// ── Response types (match backend return shapes) ──────────────────────────────

export interface BioAgeResult {
  biological_age: number;
  chronological_age: number;
  bio_age_gap: number;
  interpretation: string;
}

export interface CvRiskResult {
  cvd_risk_10yr_pct: number;
  category: "low" | "moderate" | "high" | "very high";
}

export interface LifestyleResult {
  lifestyle_score: number;
  category: "high risk" | "moderate risk" | "low risk" | "optimal";
  weakest_area: string;
  sub_scores: Record<string, number>;
}

export interface SleepResult {
  sleep_recovery_score: number;
  category: "poor" | "fair" | "good" | "excellent";
  sub_scores: Record<string, number>;
  sleep_apnea_flag: boolean;
  chronic_sleep_debt: boolean;
}

export interface AllScoresResult {
  overall_score: number;
  bio_age: BioAgeResult;
  cv_risk: CvRiskResult;
  lifestyle: LifestyleResult;
  sleep: SleepResult;
}
