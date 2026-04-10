"""
Cardiovascular Health — Risk + Fitness Composite
=================================================
Combines two clinically distinct but complementary dimensions:

1. CARDIOVASCULAR RISK (Framingham General CVD, D'Agostino 2008)
   10-year probability of a major CVD event (MI, stroke, heart failure,
   peripheral artery disease). Uses validated published coefficients.
   Source: D'Agostino et al. (2008) Circulation, 117(6), 743-753.

2. CARDIOVASCULAR FITNESS (VO2max Estimate + Activity Score)
   Aerobic capacity is a stronger predictor of all-cause mortality than
   most traditional CVD risk factors (Myers et al. 2002, NEJM).
   VO2max estimated from resting HR, age, and sex using the validated
   non-exercise formula of Nes et al. (2011).
   Source: Nes et al. (2011) Scand J Med Sci Sports, 21(1):e56-63.
   Supplemented with steps, active_minutes, and HRV autonomic fitness.

Combined into cardiovascular_health_score (0–100):
  100 = low CVD risk AND high aerobic fitness
  0   = very high CVD risk AND poor fitness

References:
  - D'Agostino et al. (2008) Circulation 117(6):743-753
  - Nes et al. (2011) Scand J Med Sci Sports 21(1):e56-63
  - Myers et al. (2002) NEJM 346(11):793-801 — fitness as mortality predictor
  - ACSM Guidelines for Exercise Testing (11th ed., 2021) — VO2max norms
  - Shaffer & Ginsberg (2017) Front Public Health — HRV norms
"""

import pandas as pd
import numpy as np


from pathlib import Path
_ROOT = Path(__file__).parent.parent
_RAW  = _ROOT / 'data' / 'raw'
_OUT  = _ROOT / 'data' / 'processed'

# ── 1. Load Data ──────────────────────────────────────────────

ehr      = pd.read_csv(_RAW / "ehr_records.csv")
wearable = pd.read_csv(_RAW / "wearable_telemetry.csv")

wearable_agg = wearable.groupby("patient_id").agg(
    resting_hr     = ("resting_hr_bpm",  "mean"),
    hrv            = ("hrv_rmssd_ms",    "mean"),
    steps          = ("steps",           "mean"),
    active_minutes = ("active_minutes",  "mean"),
).reset_index()

df = ehr.merge(wearable_agg, on="patient_id", how="left")

# ── 2. Framingham 10-Year CVD Risk ───────────────────────────
#
# Published coefficients from D'Agostino 2008, Table 4.
# Cholesterol converted from mmol/L to mg/dL (× 38.67).
# Diabetes proxy: HbA1c ≥ 6.5% (ADA diagnostic criterion).

COEFF = {
    "log_age":           [3.06117,  2.32888],
    "log_tc":            [1.12370,  1.20904],
    "log_hdl":           [-0.93263, -0.70833],
    "log_sbp_untreated": [1.99881,  2.82263],
    "smoking":           [0.65451,  0.52873],
    "diabetes":          [0.57367,  0.69154],
}
BASELINE_SURVIVAL = {"M": 0.88936, "F": 0.95012}
MEAN_COEFF_SUM    = {"M": 23.9802, "F": 26.1931}


def framingham_10yr_risk(row) -> float:
    sex = str(row["sex"]).upper()
    if sex not in ("M", "F"):
        return np.nan
    idx      = 0 if sex == "M" else 1
    smoking  = 1 if str(row["smoking_status"]).lower() == "current" else 0
    diabetes = 1 if row["hba1c_pct"] >= 6.5 else 0
    s = (
        COEFF["log_age"][idx]             * np.log(row["age"])
        + COEFF["log_tc"][idx]            * np.log(row["total_cholesterol_mmol"] * 38.67)
        + COEFF["log_hdl"][idx]           * np.log(row["hdl_mmol"] * 38.67)
        + COEFF["log_sbp_untreated"][idx] * np.log(row["sbp_mmhg"])
        + COEFF["smoking"][idx]           * smoking
        + COEFF["diabetes"][idx]          * diabetes
    )
    risk = (1 - BASELINE_SURVIVAL[sex] ** np.exp(s - MEAN_COEFF_SUM[sex])) * 100
    return round(float(risk), 1)


df["cvd_risk_10yr_pct"] = df.apply(framingham_10yr_risk, axis=1)

df["cvd_risk_category"] = pd.cut(
    df["cvd_risk_10yr_pct"],
    bins=[0, 5, 10, 20, 100],
    labels=["low (<5%)", "moderate (5–10%)", "high (10–20%)", "very high (>20%)"],
)

# ── 3. VO2max Estimate (Nes et al. 2011) ─────────────────────
#
# Non-exercise formula validated in 4,631 healthy adults.
# Formula: VO2max (mL/kg/min) = 88.313 + 8.465×sex_male
#                               − 0.185×age − 0.377×resting_HR
# The model was developed without BMI — resting HR is the dominant
# physiological driver of aerobic capacity variation.

def estimate_vo2max(row) -> float:
    sex_male = 1.0 if str(row["sex"]).upper() == "M" else 0.0
    vo2 = 88.313 + 8.465 * sex_male - 0.185 * row["age"] - 0.377 * row["resting_hr"]
    return round(max(10.0, float(vo2)), 1)


df["vo2max_estimated"] = df.apply(estimate_vo2max, axis=1)


def score_vo2max(row) -> float:
    """
    Maps estimated VO2max to 0–100 using ACSM age/sex fitness norms
    (11th edition, 2021). Categories: Poor / Fair / Good / Excellent / Superior.
    A 1 MET increase in fitness (≈3.5 mL/kg/min) reduces mortality 13%
    (Myers 2002, NEJM).
    """
    vo2 = row["vo2max_estimated"]
    age = row["age"]
    sex = str(row["sex"]).upper()

    # Thresholds: [poor_max, fair_max, good_max, excellent_max] in mL/kg/min
    norms = {
        "M": {(0, 30): (31, 37, 44, 51), (30, 40): (29, 35, 42, 48),
              (40, 50): (26, 32, 38, 44), (50, 60): (23, 29, 35, 41),
              (60, 200): (20, 26, 31, 37)},
        "F": {(0, 30): (23, 28, 34, 41), (30, 40): (21, 26, 31, 38),
              (40, 50): (19, 24, 28, 35), (50, 60): (17, 22, 26, 32),
              (60, 200): (15, 20, 24, 29)},
    }

    thresholds = (20, 26, 31, 37)  # fallback
    for (lo, hi), vals in norms.get(sex, {}).items():
        if lo <= age < hi:
            thresholds = vals
            break

    poor, fair, good, excellent = thresholds
    if vo2 <= poor:
        return round(min(20.0, (vo2 / poor) * 20), 1)
    elif vo2 <= fair:
        return round(20.0 + (vo2 - poor) / (fair - poor) * 20, 1)
    elif vo2 <= good:
        return round(40.0 + (vo2 - fair) / (good - fair) * 20, 1)
    elif vo2 <= excellent:
        return round(60.0 + (vo2 - good) / (excellent - good) * 20, 1)
    else:
        return round(min(100.0, 80.0 + (vo2 - excellent) / 10 * 20), 1)


# ── 4. Activity Score (steps + active minutes) ───────────────
#
# WHO 2020 Physical Activity Guidelines: ≥150 min moderate activity/week
# ≈ 21 min/day. AHA: 10,000 steps/day as CV health target.

def score_activity(row) -> float:
    steps = row["steps"]
    mins  = row["active_minutes"]

    # Steps score (0–100)
    if steps >= 10000:   s_steps = 100.0
    elif steps >= 7500:  s_steps = 70.0 + (steps - 7500) / 2500 * 30
    elif steps >= 5000:  s_steps = 40.0 + (steps - 5000) / 2500 * 30
    elif steps >= 2500:  s_steps = (steps / 2500) * 40
    else:                s_steps = 0.0

    # Active minutes score (0–100) — WHO: 21 min/day = adequate
    if mins >= 30:    s_mins = 100.0
    elif mins >= 21:  s_mins = 70.0 + (mins - 21) / 9 * 30
    elif mins >= 10:  s_mins = 20.0 + (mins - 10) / 11 * 50
    else:             s_mins = (mins / 10) * 20

    return round(s_steps * 0.5 + s_mins * 0.5, 1)


# ── 5. HRV as Autonomic Cardiovascular Reserve ───────────────
#
# HRV (RMSSD) reflects vagal tone and autonomic flexibility.
# Low HRV independently predicts CVD events and all-cause mortality
# (Thayer et al. 2010, Neuroscience & Biobehavioral Reviews).
# Norms: Shaffer & Ginsberg (2017).

def score_hrv_fitness(rmssd: float) -> float:
    if rmssd >= 50:   return 100.0
    elif rmssd >= 35: return 70.0 + (rmssd - 35) / 15 * 30
    elif rmssd >= 20: return 30.0 + (rmssd - 20) / 15 * 40
    elif rmssd >= 10: return (rmssd - 10) / 10 * 30
    return 0.0


df["vo2max_score"]      = df.apply(score_vo2max, axis=1)
df["activity_score"]    = df.apply(score_activity, axis=1)
df["hrv_fitness_score"] = df["hrv"].apply(score_hrv_fitness)

# Composite fitness (weighted):
# VO2max proxy 50% — strongest mortality predictor (Myers 2002)
# Activity 30%     — independent of VO2max, dose-response mortality benefit
# HRV 20%          — autonomic CV reserve
df["cv_fitness_score"] = (
    df["vo2max_score"]      * 0.50
    + df["activity_score"]  * 0.30
    + df["hrv_fitness_score"] * 0.20
).round(1)

df["cv_fitness_category"] = pd.cut(
    df["cv_fitness_score"],
    bins=[0, 30, 50, 70, 100],
    labels=["poor", "fair", "good", "excellent"],
)

# ── 6. Combined Cardiovascular Health Score ───────────────────
#
# Inverts CVD risk into a "safety score", then averages with fitness.
#
# Risk inversion:
#   ESC 2021 very-high risk threshold = 20% → maps to score 0.
#   0% risk → score 100. Linear between these anchors.
#   Using a hard cap at 30% (beyond that, risk is very high regardless).
#
# Weights: 50% risk (disease prevention), 50% fitness (functional capacity).
# Both dimensions carry independent mortality signal (Myers 2002).

def _risk_to_score(risk_pct: float) -> float:
    """Linear inversion: 0% risk → 100 pts, ≥30% → 0 pts."""
    return round(max(0.0, 100.0 * (1.0 - risk_pct / 30.0)), 1)


df["cv_risk_score_inverted"]      = df["cvd_risk_10yr_pct"].apply(_risk_to_score)
df["cardiovascular_health_score"] = (
    df["cv_risk_score_inverted"] * 0.50
    + df["cv_fitness_score"]     * 0.50
).round(1)

df["cardiovascular_health_category"] = pd.cut(
    df["cardiovascular_health_score"],
    bins=[0, 30, 50, 70, 100],
    labels=["critical", "needs attention", "moderate", "healthy"],
)

# ── 7. Report ──────────────────────────────────────────────────

print("10-Year CVD Risk Distribution:")
print(df["cvd_risk_10yr_pct"].describe())
print("\nCVD Risk Categories:")
print(df["cvd_risk_category"].value_counts().sort_index())
print("\nVO2max Estimates (mL/kg/min):")
print(df["vo2max_estimated"].describe())
print("\nCV Fitness Score Distribution:")
print(df["cv_fitness_score"].describe())
print("\nCV Fitness Categories:")
print(df["cv_fitness_category"].value_counts().sort_index())
print("\nCombined Cardiovascular Health Score:")
print(df["cardiovascular_health_score"].describe())
print("\nCardiovascular Health Categories:")
print(df["cardiovascular_health_category"].value_counts().sort_index())

# ── 8. Export ──────────────────────────────────────────────────

result = df[[
    "patient_id", "age", "sex",
    "cvd_risk_10yr_pct", "cvd_risk_category",
    "vo2max_estimated", "vo2max_score",
    "activity_score", "hrv_fitness_score",
    "cv_fitness_score", "cv_fitness_category",
    "cardiovascular_health_score", "cardiovascular_health_category",
]]
result.to_csv(_OUT / "cv_results.csv", index=False)
print(f"\nSaved cv_results.csv ({len(result)} patients)")
print(result.head(10).to_string(index=False))
