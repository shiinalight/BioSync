"""
Lifestyle & Behavioral Risk Score — Clinical Composite
========================================================
Computes a 0–100 score from self-reported lifestyle data using
WHO, AHA, and clinical guideline thresholds.

Sources:
- WHO Physical Activity Guidelines (2020)
- WHO Alcohol Risk Thresholds
- AHA Dietary Guidelines (2021)
- EFSA Water Intake Recommendations (2010)
- Cohen Perceived Stress thresholds
- CDC Smoking Cessation Evidence
- Ekelund et al. (2016) Sedentary Behavior & Mortality, Lancet
"""

import pandas as pd
import numpy as np

# ── 1. Load Data ──────────────────────────────────────────────

lifestyle = pd.read_csv("lifestyle_survey.csv")

# ── 2. Scoring Functions ──────────────────────────────────────
#
# Each function maps a lifestyle metric to 0–100.
# 100 = optimal, 0 = high risk.


def score_smoking(status):
    """
    CDC: Smoking is the single largest preventable cause of death.
    No safe level. Former smokers regain partial benefit after 5–10 years.
    """
    if status == "never":
        return 100
    elif status == "former":
        return 60
    elif status == "current":
        return 0
    return 50  # unknown


def score_alcohol(units_weekly):
    """
    WHO 2023 revised position: no safe level of alcohol consumption.
    UK CMO guideline: ≤14 units/week as lower-risk threshold.
    - 0 units: optimal
    - 1–14 units: low risk
    - 14–21 units: increasing risk
    - >21 units: high risk
    """
    if units_weekly <= 0:
        return 100
    elif units_weekly <= 7:
        return 90
    elif units_weekly <= 14:
        return 70
    elif units_weekly <= 21:
        return 40
    elif units_weekly <= 35:
        return 15
    else:
        return 0


def score_diet_quality(score):
    """
    Assumes diet_quality_score is on a normalized scale (e.g., 1–10).
    Maps linearly to 0–100. Higher = better diet.
    Adjust if your dataset uses a different scale.
    """
    return min(100, max(0, score * 10))


def score_fruit_veg(servings):
    """
    WHO: ≥5 servings/day of fruit and vegetables.
    AHA: 4–5 servings each (8–10 total) for optimal CV health.
    - ≥5: meets WHO minimum
    - ≥8: exceeds into AHA optimal
    - <2: critically low (associated with 30% higher CVD mortality)
    """
    if servings >= 8:
        return 100
    elif servings >= 5:
        return 70 + (servings - 5) * 10  # 70–100
    elif servings >= 3:
        return 30 + (servings - 3) * 20  # 30–70
    elif servings >= 1:
        return servings * 15  # 0–30
    else:
        return 0


def score_exercise(sessions_weekly):
    """
    WHO 2020: Adults should do ≥150 min moderate or ≥75 min vigorous
    aerobic activity per week. Assuming ~30 min per session:
    - ≥5 sessions: exceeds WHO guideline
    - 3–4 sessions: meets guideline
    - 1–2 sessions: insufficient
    - 0: sedentary (doubles all-cause mortality risk)
    """
    if sessions_weekly >= 5:
        return 100
    elif sessions_weekly >= 3:
        return 60 + (sessions_weekly - 3) * 20  # 60–100
    elif sessions_weekly >= 1:
        return 20 + (sessions_weekly - 1) * 20  # 20–60
    else:
        return 0


def score_sedentary(hrs_day):
    """
    Ekelund et al. (2016, Lancet): >8h/day sedentary behavior
    significantly increases mortality, partially offset by exercise.
    - <4h: low risk
    - 4–6h: moderate
    - 6–8h: elevated
    - 8–10h: high risk
    - >10h: very high risk
    """
    if hrs_day <= 4:
        return 100
    elif hrs_day <= 6:
        return 60 + (6 - hrs_day) * 20  # 60–100
    elif hrs_day <= 8:
        return 30 + (8 - hrs_day) * 15  # 30–60
    elif hrs_day <= 10:
        return (10 - hrs_day) * 15  # 0–30
    else:
        return 0


def score_stress(level):
    """
    Assumes stress_level is on a 1–10 scale.
    Chronic stress (Cohen 1983) is associated with:
    - Cortisol dysregulation
    - Immune suppression
    - Accelerated telomere shortening
    - 1–3: low stress
    - 4–6: moderate
    - 7–8: high
    - 9–10: severe
    """
    if level <= 2:
        return 100
    elif level <= 4:
        return 70 + (4 - level) * 15  # 70–100
    elif level <= 6:
        return 40 + (6 - level) * 15  # 40–70
    elif level <= 8:
        return 10 + (8 - level) * 15  # 10–40
    else:
        return max(0, 10 - (level - 8) * 5)


def score_water(glasses_daily):
    """
    EFSA (2010): adequate water intake ~2.0L women, ~2.5L men.
    Assuming 250ml per glass → 8–10 glasses/day.
    - ≥8 glasses: adequate
    - 6–8: slightly low
    - <4: dehydration risk
    """
    if glasses_daily >= 8:
        return 100
    elif glasses_daily >= 6:
        return 60 + (glasses_daily - 6) * 20  # 60–100
    elif glasses_daily >= 4:
        return 30 + (glasses_daily - 4) * 15  # 30–60
    elif glasses_daily >= 2:
        return (glasses_daily - 2) * 15  # 0–30
    else:
        return 0


# ── 3. Compute Composite Score ────────────────────────────────
#
# Weights reflect relative impact on longevity from meta-analyses.
#
# Weight rationale:
# - Smoking (20%): single largest modifiable mortality risk factor
#   (Doll & Peto 2004: smokers lose ~10 years of life expectancy)
# - Exercise (15%): Wen et al. (2011, Lancet): 15 min/day exercise
#   reduces all-cause mortality by 14%
# - Alcohol (15%): WHO 2023: significant dose-response for cancer,
#   liver disease, CVD at higher intake levels
# - Diet quality (12%): GBD 2017: poor diet responsible for 11M
#   deaths/year globally, more than any other risk factor
# - Sedentary behavior (12%): independent of exercise —
#   Ekelund 2016 meta-analysis of 1M+ adults
# - Fruit/veg (8%): Wang et al. (2021): 5 servings/day associated
#   with 13% lower all-cause mortality
# - Stress (8%): Kivimäki 2012: chronic stress increases CHD risk
#   by 23%, but weaker evidence than smoking/exercise
# - Water (5%): hydration has weaker direct mortality evidence,
#   but supports kidney function and metabolic processes
# - Meal frequency (5%): weak and contested evidence, included
#   for completeness with minimal weight

WEIGHTS = {
    "smoking":    0.20,
    "exercise":   0.15,
    "alcohol":    0.15,
    "diet":       0.12,
    "sedentary":  0.12,
    "fruit_veg":  0.08,
    "stress":     0.08,
    "water":      0.05,
    "meal_freq":  0.05,
}


def score_meal_frequency(meals):
    """
    Evidence is weak and contested. Regular meal patterns (3–5/day)
    are associated with better metabolic control in some studies.
    Included with low weight (5%).
    """
    if 3 <= meals <= 5:
        return 100
    elif meals == 2:
        return 60
    elif meals == 1:
        return 20
    elif meals > 5:
        return 70  # slight penalty for grazing
    else:
        return 0


def compute_lifestyle_score(row):
    sub_scores = {
        "smoking":   score_smoking(row["smoking_status"]),
        "alcohol":   score_alcohol(row["alcohol_units_weekly"]),
        "diet":      score_diet_quality(row["diet_quality_score"]),
        "fruit_veg": score_fruit_veg(row["fruit_veg_servings_daily"]),
        "exercise":  score_exercise(row["exercise_sessions_weekly"]),
        "sedentary": score_sedentary(row["sedentary_hrs_day"]),
        "stress":    score_stress(row["stress_level"]),
        "water":     score_water(row["water_glasses_daily"]),
        "meal_freq": score_meal_frequency(row["meal_frequency_daily"]),
    }

    weighted = sum(sub_scores[k] * WEIGHTS[k] for k in WEIGHTS)
    return round(weighted, 1), sub_scores


# Apply
results = lifestyle.apply(lambda row: compute_lifestyle_score(row), axis=1)
lifestyle["lifestyle_score"] = [r[0] for r in results]
sub_df = pd.DataFrame([r[1] for r in results])
sub_df.columns = [f"sub_{c}" for c in sub_df.columns]
lifestyle = pd.concat([lifestyle, sub_df], axis=1)

# Categories
lifestyle["lifestyle_category"] = pd.cut(
    lifestyle["lifestyle_score"],
    bins=[0, 40, 60, 80, 100],
    labels=["high risk", "moderate risk", "low risk", "optimal"],
)

# Identify weakest dimension per patient (for AI coach)
sub_cols = [c for c in lifestyle.columns if c.startswith("sub_")]
lifestyle["weakest_area"] = lifestyle[sub_cols].idxmin(axis=1).str.replace("sub_", "")

print("Lifestyle Score Distribution:")
print(lifestyle["lifestyle_score"].describe())
print(f"\nCategories:")
print(lifestyle["lifestyle_category"].value_counts().sort_index())
print(f"\nMost common weakest area:")
print(lifestyle["weakest_area"].value_counts().head())

# ── 4. Export ──────────────────────────────────────────────────

output_cols = [
    "patient_id", "lifestyle_score", "lifestyle_category", "weakest_area",
    "sub_smoking", "sub_alcohol", "sub_diet", "sub_fruit_veg",
    "sub_exercise", "sub_sedentary", "sub_stress", "sub_water", "sub_meal_freq",
]
lifestyle[output_cols].to_csv("lifestyle_risk_results.csv", index=False)
print(f"\nSaved lifestyle_risk_results.csv ({len(lifestyle)} patients)")
print(lifestyle[output_cols].head(10).to_string(index=False))
