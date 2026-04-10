"""
Biological Age Model v3 — Multi-Source Biomarker Composite
===========================================================
Predicts chronological age from clinical biomarkers, wearable signals,
and lifestyle features. The residual (predicted − actual) is the
Biological Age Gap: positive = physiologically older than calendar age
(accelerated aging), negative = physiologically younger (healthy aging).

Key additions over v2:
  - n_chronic_conditions: comorbidity burden is the strongest single EHR
    aging proxy (Marengoni et al. 2011, Ageing Research Reviews)
  - HRV & steps trend over 90 days: trajectory matters — a declining HRV
    over 3 months signals accelerating aging even at baseline-normal values
  - Lifestyle features: stress (telomere shortening, Epel et al. 2004),
    exercise, diet quality, smoking
  - mental_wellbeing_who5: psychological stress accelerates epigenetic
    aging (Puterman et al. 2016, Mol Psychiatry)

References:
  - Levine et al. (2018) "An epigenetic biomarker of aging", Aging (Albany)
  - Marengoni et al. (2011) Ageing Research Reviews
  - Epel et al. (2004) PNAS — stress & telomere shortening
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import cross_val_predict, KFold
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score


from pathlib import Path
_ROOT = Path(__file__).parent.parent
_RAW  = _ROOT / 'data' / 'raw'
_OUT  = _ROOT / 'data' / 'processed'

# ── 1. Load Data ──────────────────────────────────────────────

ehr       = pd.read_csv(_RAW / "ehr_records.csv")
wearable  = pd.read_csv(_RAW / "wearable_telemetry.csv")
lifestyle = pd.read_csv(_RAW / "lifestyle_survey.csv")

# ── 2. Aggregate Wearable + Compute Trend Slopes ─────────────
#
# A 90-day HRV trend captures biological aging velocity:
# declining HRV over weeks indicates autonomic deterioration
# independent of baseline level (Shaffer & Ginsberg 2017).

def _linear_slope(series: pd.Series) -> float:
    """Returns the slope (units/day) of a linear fit over the series."""
    if len(series) < 3:
        return 0.0
    x = np.arange(len(series), dtype=float)
    return float(np.polyfit(x, series.values, 1)[0])


wearable_sorted = wearable.sort_values(["patient_id", "date"])

wearable_agg = wearable_sorted.groupby("patient_id").agg(
    resting_hr      = ("resting_hr_bpm",      "mean"),
    hrv             = ("hrv_rmssd_ms",         "mean"),
    spo2            = ("spo2_avg_pct",         "mean"),
    deep_sleep_pct  = ("deep_sleep_pct",       "mean"),
    steps           = ("steps",               "mean"),
    active_minutes  = ("active_minutes",       "mean"),
    sleep_dur       = ("sleep_duration_hrs",   "mean"),
    hrv_trend       = ("hrv_rmssd_ms",         _linear_slope),   # ms/day (+ve = improving)
    steps_trend     = ("steps",               _linear_slope),    # steps/day change
).reset_index()

# ── 3. Aggregate Lifestyle (latest survey per patient) ────────

lifestyle_latest = (
    lifestyle
    .sort_values("survey_date")
    .groupby("patient_id")
    .last()
    .reset_index()
)

# Encode smoking: current smokers show 10–15 yrs accelerated epigenetic aging
smoking_map = {"never": 0, "former": 1, "current": 2}
lifestyle_latest["smoking_encoded"] = (
    lifestyle_latest["smoking_status"].str.lower().map(smoking_map).fillna(1)
)

# ── 4. Merge All Sources ──────────────────────────────────────

df = (
    ehr
    .merge(wearable_agg, on="patient_id", how="inner")
    .merge(
        lifestyle_latest[[
            "patient_id", "exercise_sessions_weekly", "stress_level",
            "diet_quality_score", "smoking_encoded", "mental_wellbeing_who5",
        ]],
        on="patient_id",
        how="left",
    )
)

# ── 5. Feature Set ────────────────────────────────────────────
#
# Only objective or semi-objective biomarkers.
# Self-rated health excluded — it partially reflects chronological age
# awareness, which would introduce circular target leakage.

FEATURES = [
    # ── Blood biomarkers ──────────────────────────────────────
    "hba1c_pct",             # glycemic stress → advanced glycation end-products
    "fasting_glucose_mmol",  # metabolic age marker
    "egfr_ml_min",           # kidney function declines ~1 mL/min/yr after 40
    "crp_mg_l",              # systemic inflammation → epigenetic clock acceleration
    "hdl_mmol",              # cardioprotective; declines with metabolic aging
    "ldl_mmol",
    "triglycerides_mmol",
    # ── Vitals ───────────────────────────────────────────────
    "sbp_mmhg",              # vascular stiffness increases with age
    "dbp_mmhg",
    "bmi",
    # ── Comorbidity burden ───────────────────────────────────
    "n_chronic_conditions",  # strongest single EHR aging proxy (Marengoni 2011)
    # ── Wearable signals ─────────────────────────────────────
    "resting_hr",            # cardiac aging — resting HR rises ~0.7 bpm/decade
    "hrv",                   # autonomic resilience; declines with biological age
    "spo2",
    "deep_sleep_pct",        # slow-wave sleep declines with aging
    "steps",
    "active_minutes",
    "hrv_trend",             # HRV trajectory: negative slope = accelerated aging
    "steps_trend",           # physical activity trajectory
    # ── Lifestyle ────────────────────────────────────────────
    "exercise_sessions_weekly",
    "stress_level",          # chronic stress → telomere shortening (Epel 2004)
    "diet_quality_score",
    "smoking_encoded",       # smoking adds ~10 yrs to epigenetic clock (Joehanes 2016)
    "mental_wellbeing_who5", # psychological wellbeing predicts healthy aging
]

df_clean = df[FEATURES + ["patient_id", "age"]].dropna().copy()

# Impute any residual NaNs in lifestyle features with population medians
for col in ["exercise_sessions_weekly", "stress_level", "diet_quality_score",
            "smoking_encoded", "mental_wellbeing_who5"]:
    df_clean[col] = df_clean[col].fillna(df_clean[col].median())

X = df_clean[FEATURES]
y = df_clean["age"]

# ── 6. Train Model (5-fold cross-validation) ─────────────────
#
# GradientBoosting captures non-linear biomarker–age relationships.
# Cross-val prevents the residual from reflecting in-sample overfitting.

model = GradientBoostingRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=4,
    subsample=0.8,        # stochastic GBM reduces overfitting on small n
    random_state=42,
)

cv = KFold(n_splits=5, shuffle=True, random_state=42)
y_pred = cross_val_predict(model, X, y, cv=cv)

print(f"MAE:  {mean_absolute_error(y, y_pred):.2f} years")
print(f"R²:   {r2_score(y, y_pred):.3f}")

# ── 7. Biological Age Gap & Interpretation ────────────────────

df_clean["biological_age"] = np.round(y_pred, 1)
df_clean["bio_age_gap"]    = np.round(y_pred - y, 1)


def _classify_bio_age(gap: float) -> str:
    """
    Clinically meaningful thresholds inspired by Levine et al. (2018):
    a 1-year increase in phenotypic age gap is associated with a
    ~8% increase in all-cause mortality risk.
    """
    if gap <= -5:
        return "excellent — aging well below calendar age"
    elif gap <= -1:
        return "good — physiologically younger than calendar age"
    elif gap <= 1:
        return "on track with chronological age"
    elif gap <= 5:
        return "mildly accelerated aging"
    else:
        return "significantly accelerated aging"


df_clean["bio_age_interpretation"] = df_clean["bio_age_gap"].apply(_classify_bio_age)

# Aging alert flag: >5 years older = clinically actionable (Levine 2018)
df_clean["aging_alert"] = df_clean["bio_age_gap"] > 5

print("\nBio-Age Gap Stats:")
print(df_clean["bio_age_gap"].describe())
print("\nCategory Distribution:")
print(df_clean["bio_age_interpretation"].value_counts())
print(f"\nAging Alerts (gap > 5 yrs): {df_clean['aging_alert'].sum()}")

# ── 8. Export ──────────────────────────────────────────────────

result = df_clean[[
    "patient_id", "age", "biological_age", "bio_age_gap",
    "bio_age_interpretation", "aging_alert",
]]
result.to_csv(_OUT / "biological_age_results.csv", index=False)
print(f"\nSaved biological_age_results.csv ({len(result)} patients)")
print(result.head(10).to_string(index=False))
