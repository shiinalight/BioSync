"""
Lifestyle & Behavioral Risk Score — Clinical Composite
=======================================================
Computes a 0–100 score from self-reported lifestyle data using
WHO, AHA, and clinical guideline thresholds.

Key additions over v1:
  - mental_wellbeing_who5: WHO-5 Wellbeing Index is a validated 5-item
    instrument used in 30+ countries. Scores <52 indicate poor wellbeing,
    independently predicting chronic disease onset and all-cause mortality
    (Topp et al. 2015, Psychother Psychosom; Rumpf et al. 2001).
  - self_rated_health: single strongest non-clinical predictor of
    5-year mortality, independent of objective health status
    (Idler & Benyamini 1997, J Health Soc Behav).
  - sleep_satisfaction: subjective–objective sleep discordance identifies
    patients whose wearable sleep data alone misses the clinical picture
    (Buysse et al. 2014, Sleep Medicine Reviews).

Sources:
  - WHO Physical Activity Guidelines (2020)
  - WHO Alcohol Risk Thresholds (2023)
  - AHA Dietary Guidelines (2021)
  - EFSA Water Intake Recommendations (2010)
  - Cohen Perceived Stress thresholds (1983)
  - CDC Smoking Cessation Evidence
  - Ekelund et al. (2016) Sedentary Behavior & Mortality, Lancet
  - Topp et al. (2015) WHO-5 validation, Psychother Psychosom
  - Idler & Benyamini (1997) Self-rated health, J Health Soc Behav
"""

import pandas as pd
import numpy as np


from pathlib import Path
_ROOT = Path(__file__).parent.parent
_RAW  = _ROOT / 'data' / 'raw'
_OUT  = _ROOT / 'data' / 'processed'

# ── 1. Load Data ──────────────────────────────────────────────

lifestyle = pd.read_csv(_RAW / "lifestyle_survey.csv")

# ── 2. Scoring Functions ──────────────────────────────────────
#
# Each function maps one lifestyle metric to 0–100.
# 100 = optimal per clinical guideline, 0 = highest risk.


def score_smoking(status: str) -> float:
    """
    CDC: smoking is the single largest preventable cause of death.
    No safe level. Former smokers regain ~50% of risk reduction
    within 5–10 years of cessation (Doll & Peto 2004).
    """
    s = str(status).lower()
    if s == "never":   return 100.0
    elif s == "former": return 60.0
    elif s == "current": return 0.0
    return 50.0  # unknown


def score_alcohol(units_weekly: float) -> float:
    """
    WHO 2023 revised position: no safe level of alcohol.
    UK CMO: ≤14 units/week as lower-risk threshold.
    Dose-response for cancer and liver disease starts at 1 unit/week.
    """
    u = float(units_weekly)
    if u <= 0:    return 100.0
    elif u <= 7:  return 90.0
    elif u <= 14: return 70.0
    elif u <= 21: return 40.0
    elif u <= 35: return 15.0
    return 0.0


def score_diet_quality(score: float) -> float:
    """
    Assumes diet_quality_score on a 1–10 scale (higher = better).
    GBD 2017: poor diet responsible for 11M deaths/year globally.
    """
    return round(min(100.0, max(0.0, float(score) * 10)), 1)


def score_fruit_veg(servings: float) -> float:
    """
    WHO: ≥5 servings/day. AHA: 8–10 servings for optimal CV health.
    Wang et al. (2021): 5 servings/day → 13% lower all-cause mortality.
    """
    s = float(servings)
    if s >= 8:   return 100.0
    elif s >= 5: return 70.0 + (s - 5) * 10
    elif s >= 3: return 30.0 + (s - 3) * 20
    elif s >= 1: return s * 15
    return 0.0


def score_exercise(sessions_weekly: float) -> float:
    """
    WHO 2020: ≥150 min moderate or ≥75 min vigorous activity/week.
    Wen et al. (2011, Lancet): 15 min/day reduces all-cause mortality 14%.
    """
    s = float(sessions_weekly)
    if s >= 5:   return 100.0
    elif s >= 3: return 60.0 + (s - 3) * 20
    elif s >= 1: return 20.0 + (s - 1) * 20
    return 0.0


def score_sedentary(hrs_day: float) -> float:
    """
    Ekelund et al. (2016, Lancet): >8h/day sedentary significantly
    increases mortality, partially offset by exercise.
    """
    h = float(hrs_day)
    if h <= 4:    return 100.0
    elif h <= 6:  return 60.0 + (6 - h) * 20
    elif h <= 8:  return 30.0 + (8 - h) * 15
    elif h <= 10: return (10 - h) * 15
    return 0.0


def score_stress(level: float) -> float:
    """
    Cohen (1983) Perceived Stress Scale thresholds.
    Chronic stress → cortisol dysregulation, telomere shortening,
    immune suppression (Kivimäki 2012: +23% CHD risk).
    Assumes 1–10 scale.
    """
    l = float(level)
    if l <= 2:   return 100.0
    elif l <= 4: return 70.0 + (4 - l) * 15
    elif l <= 6: return 40.0 + (6 - l) * 15
    elif l <= 8: return 10.0 + (8 - l) * 15
    return max(0.0, 10.0 - (l - 8) * 5)


def score_water(glasses_daily: float) -> float:
    """
    EFSA (2010): adequate intake ~8–10 glasses/day (250ml/glass).
    Hydration supports kidney function and metabolic processes.
    """
    g = float(glasses_daily)
    if g >= 8:   return 100.0
    elif g >= 6: return 60.0 + (g - 6) * 20
    elif g >= 4: return 30.0 + (g - 4) * 15
    elif g >= 2: return (g - 2) * 15
    return 0.0


def score_meal_frequency(meals: float) -> float:
    """
    Evidence is contested. Regular patterns (3–5/day) associated with
    better metabolic control. Included with low weight.
    """
    m = float(meals)
    if 3 <= m <= 5: return 100.0
    elif m == 2:    return 60.0
    elif m == 1:    return 20.0
    elif m > 5:     return 70.0  # slight penalty for excessive grazing
    return 0.0


# ── NEW: Three additional validated dimensions ────────────────

def score_mental_wellbeing(who5_score: float) -> float:
    """
    WHO-5 Wellbeing Index (0–100 scale: sum of 5 items × 4).
    Validated across 30+ countries as a screening tool for depression
    and general wellbeing (Topp et al. 2015, Psychother Psychosom).

    Clinical thresholds:
      ≥75: good wellbeing
      52–74: moderate wellbeing
      28–51: poor wellbeing — clinical evaluation recommended
      <28: likely depression — intervention strongly indicated
    """
    w = float(who5_score)
    if w >= 75:   return 100.0
    elif w >= 52: return 60.0 + ((w - 52) / 23) * 40   # 60–100
    elif w >= 28: return 20.0 + ((w - 28) / 24) * 40   # 20–60
    return max(0.0, (w / 28) * 20)                      # 0–20


def score_self_rated_health(srh: float) -> float:
    """
    Self-rated health (assumed 1–5 Likert: 1=poor, 5=excellent).

    Idler & Benyamini (1997) reviewed 27 community studies:
    poor self-rated health predicts mortality with OR 2.0–10.0,
    independent of objective clinical status, age, and comorbidities.
    This is among the strongest single-item predictors of longevity.
    """
    mapping = {5: 100, 4: 75, 3: 50, 2: 25, 1: 5}
    return float(mapping.get(int(round(float(srh))), 50))


def score_sleep_satisfaction(satisfaction: float) -> float:
    """
    Subjective sleep satisfaction (assumed 1–10 scale).
    Buysse (2014): subjective sleep quality independently predicts
    next-day mood, cognition, pain perception, and metabolic markers.
    Discordance between wearable-measured and self-rated sleep quality
    is itself a clinical signal worth surfacing.
    """
    return round(min(100.0, max(0.0, float(satisfaction) * 10)), 1)


# ── 3. Composite Score Weights ────────────────────────────────
#
# Weights reflect relative impact on longevity from meta-analyses.
# New dimensions replace portions of previously over-weighted items.
#
# Weight rationale:
#   smoking (17%):          single largest modifiable mortality factor (Doll 2004)
#   exercise (13%):         Wen 2011: 15 min/day = 14% mortality reduction
#   alcohol (12%):          WHO 2023: dose-response for cancer and liver disease
#   diet (10%):             GBD 2017: 11M deaths/year from poor diet
#   sedentary (10%):        Ekelund 2016: independent of exercise level
#   mental_wellbeing (10%): Topp 2015 WHO-5: strong depression & mortality signal
#   self_rated_health (8%): Idler 1997: strongest single-item longevity predictor
#   fruit_veg (7%):         Wang 2021: 5 servings/day −13% all-cause mortality
#   stress (6%):            Kivimäki 2012: +23% CHD risk — softer evidence than above
#   sleep_satisfaction (4%): Buysse 2014: subjective–objective discordance signal
#   water (2%):             EFSA: weaker direct mortality evidence
#   meal_freq (1%):         contested, included for completeness

WEIGHTS = {
    "smoking":           0.17,
    "exercise":          0.13,
    "alcohol":           0.12,
    "diet":              0.10,
    "sedentary":         0.10,
    "mental_wellbeing":  0.10,
    "self_rated_health": 0.08,
    "fruit_veg":         0.07,
    "stress":            0.06,
    "sleep_satisfaction":0.04,
    "water":             0.02,
    "meal_freq":         0.01,
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"


def compute_lifestyle_score(row) -> tuple:
    sub_scores = {
        "smoking":            score_smoking(row["smoking_status"]),
        "alcohol":            score_alcohol(row["alcohol_units_weekly"]),
        "diet":               score_diet_quality(row["diet_quality_score"]),
        "fruit_veg":          score_fruit_veg(row["fruit_veg_servings_daily"]),
        "exercise":           score_exercise(row["exercise_sessions_weekly"]),
        "sedentary":          score_sedentary(row["sedentary_hrs_day"]),
        "stress":             score_stress(row["stress_level"]),
        "water":              score_water(row["water_glasses_daily"]),
        "meal_freq":          score_meal_frequency(row["meal_frequency_daily"]),
        "mental_wellbeing":   score_mental_wellbeing(row["mental_wellbeing_who5"]),
        "self_rated_health":  score_self_rated_health(row["self_rated_health"]),
        "sleep_satisfaction": score_sleep_satisfaction(row["sleep_satisfaction"]),
    }
    weighted = sum(sub_scores[k] * WEIGHTS[k] for k in WEIGHTS)
    return round(weighted, 1), sub_scores


# ── 4. Apply ──────────────────────────────────────────────────

results  = lifestyle.apply(lambda row: compute_lifestyle_score(row), axis=1)
lifestyle["lifestyle_score"] = [r[0] for r in results]
sub_df   = pd.DataFrame([r[1] for r in results])
sub_df.columns = [f"sub_{c}" for c in sub_df.columns]
lifestyle = pd.concat([lifestyle, sub_df], axis=1)

lifestyle["lifestyle_category"] = pd.cut(
    lifestyle["lifestyle_score"],
    bins=[0, 40, 60, 80, 100],
    labels=["high risk", "moderate risk", "low risk", "optimal"],
)

# Weakest dimension for AI coach prioritisation
sub_cols = [c for c in lifestyle.columns if c.startswith("sub_")]
lifestyle["weakest_area"] = (
    lifestyle[sub_cols].idxmin(axis=1).str.replace("sub_", "", regex=False)
)

# Depression screening flag (WHO-5 <52 threshold)
lifestyle["mental_health_flag"] = lifestyle["mental_wellbeing_who5"] < 52

print("Lifestyle Score Distribution:")
print(lifestyle["lifestyle_score"].describe())
print("\nCategories:")
print(lifestyle["lifestyle_category"].value_counts().sort_index())
print("\nMost common weakest area:")
print(lifestyle["weakest_area"].value_counts().head())
print(f"\nMental health screening flags (WHO-5 <52): {lifestyle['mental_health_flag'].sum()}")

# ── 5. Export ──────────────────────────────────────────────────

output_cols = [
    "patient_id", "lifestyle_score", "lifestyle_category",
    "weakest_area", "mental_health_flag",
    "sub_smoking", "sub_alcohol", "sub_diet", "sub_fruit_veg",
    "sub_exercise", "sub_sedentary", "sub_stress", "sub_water",
    "sub_meal_freq", "sub_mental_wellbeing",
    "sub_self_rated_health", "sub_sleep_satisfaction",
]
lifestyle[output_cols].to_csv(_OUT / "lifestyle_risk_results.csv", index=False)
print(f"\nSaved lifestyle_risk_results.csv ({len(lifestyle)} patients)")
print(lifestyle[output_cols].head(10).to_string(index=False))
