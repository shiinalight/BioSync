"""
Sleep & Recovery Score — Clinical Composite
=============================================
Computes a 0–100 score from objective wearable biomarkers using
evidence-based clinical thresholds. No ML needed.

Sources:
- National Sleep Foundation (NSF) sleep duration guidelines (2015)
- Shaffer & Ginsberg (2017) HRV norms
- ATS/ERS SpO2 clinical thresholds
- AHA resting heart rate guidelines
"""

import pandas as pd
import numpy as np

# ── 1. Load & Aggregate Wearable Data ─────────────────────────

wearable = pd.read_csv("wearable_telemetry.csv")

# 90 days → 1 row per patient
agg = wearable.groupby("patient_id").agg(
    sleep_dur=("sleep_duration_hrs", "mean"),
    deep_sleep_pct=("deep_sleep_pct", "mean"),
    hrv=("hrv_rmssd_ms", "mean"),
    spo2=("spo2_avg_pct", "mean"),
    resting_hr=("resting_hr_bpm", "mean"),
    # Consistency metrics
    sleep_dur_std=("sleep_duration_hrs", "std"),
    low_sleep_days=("sleep_duration_hrs", lambda x: (x < 6).mean()),
    low_spo2_days=("spo2_avg_pct", lambda x: (x < 95).mean()),
).reset_index()


# ── 2. Scoring Functions ──────────────────────────────────────
#
# Each function maps a biomarker value to a 0–100 sub-score
# using clinical thresholds. The mapping is:
#   100 = optimal range
#   50  = borderline / suboptimal
#   0   = clinically concerning


def score_sleep_duration(hrs):
    """
    NSF guidelines (Hirshkowitz 2015):
    - 7–9 hrs: optimal for adults
    - 6–7 or 9–10: may be appropriate
    - <6 or >10: not recommended
    """
    if 7.0 <= hrs <= 9.0:
        return 100
    elif 6.0 <= hrs < 7.0:
        return 60 + (hrs - 6.0) * 40  # 60–100 linear
    elif 9.0 < hrs <= 10.0:
        return 100 - (hrs - 9.0) * 40  # 100–60 linear
    elif 5.0 <= hrs < 6.0:
        return 20 + (hrs - 5.0) * 40  # 20–60 linear
    else:
        return max(0, 20 - abs(hrs - 7.5) * 5)


def score_deep_sleep(pct):
    """
    Clinical norm: 15–25% of total sleep is deep sleep (N3).
    Below 10% is associated with poor recovery and cognitive decline.
    """
    if 15 <= pct <= 25:
        return 100
    elif 10 <= pct < 15:
        return 40 + (pct - 10) * 12  # 40–100 linear
    elif 25 < pct <= 30:
        return 100 - (pct - 25) * 10  # slight penalty
    elif pct < 10:
        return max(0, pct * 4)  # 0–40 linear
    else:
        return 50


def score_hrv(rmssd):
    """
    Shaffer & Ginsberg (2017): HRV is age-dependent.
    General population RMSSD norms:
    - >40 ms: good autonomic function
    - 20–40 ms: moderate
    - <20 ms: poor (associated with cardiac risk)

    Note: ideally this would be age-adjusted. Without age-specific
    norms in the wearable data, we use population-wide thresholds.
    """
    if rmssd >= 50:
        return 100
    elif rmssd >= 40:
        return 80 + (rmssd - 40) * 2  # 80–100
    elif rmssd >= 25:
        return 40 + (rmssd - 25) * (40 / 15)  # 40–80
    elif rmssd >= 15:
        return (rmssd - 15) * 4  # 0–40
    else:
        return 0


def score_spo2(pct):
    """
    ATS/ERS clinical thresholds:
    - ≥96%: normal
    - 94–95%: borderline
    - <94%: hypoxemia (clinical concern, possible sleep apnea)
    - <90%: severe hypoxemia
    """
    if pct >= 96:
        return 100
    elif pct >= 94:
        return 50 + (pct - 94) * 25  # 50–100
    elif pct >= 90:
        return (pct - 90) * 12.5  # 0–50
    else:
        return 0


def score_resting_hr(bpm):
    """
    AHA guidelines:
    - 50–70 bpm: excellent cardiovascular fitness
    - 70–80 bpm: normal
    - 80–90 bpm: elevated (associated with higher mortality)
    - >90 bpm: tachycardic range
    """
    if 50 <= bpm <= 65:
        return 100
    elif 65 < bpm <= 75:
        return 70 + (75 - bpm) * 3  # 70–100
    elif 75 < bpm <= 85:
        return 30 + (85 - bpm) * 4  # 30–70
    elif bpm > 85:
        return max(0, 30 - (bpm - 85) * 3)
    else:  # <50 bpm (bradycardia)
        return max(0, 60 + (bpm - 50) * 4)


def score_sleep_consistency(std):
    """
    Irregular sleep schedules are independently associated with
    metabolic dysfunction (Huang 2020, Lunsford-Avery 2018).
    - Std < 0.5 hrs: very consistent
    - Std 0.5–1.0 hrs: normal variation
    - Std > 1.5 hrs: irregular (concern)
    """
    if std <= 0.5:
        return 100
    elif std <= 1.0:
        return 60 + (1.0 - std) * 80  # 60–100
    elif std <= 1.5:
        return 20 + (1.5 - std) * 80  # 20–60
    else:
        return max(0, 20 - (std - 1.5) * 20)


# ── 3. Compute Composite Score ────────────────────────────────
#
# Weighted average of sub-scores. Weights reflect clinical
# importance for sleep quality and recovery capacity.
#
# Weight rationale:
# - Sleep duration (25%): strongest evidence for all-cause mortality
# - Deep sleep (20%): critical for physical recovery and memory
# - HRV (20%): best single marker of autonomic recovery
# - SpO2 (15%): key for detecting sleep apnea
# - Resting HR (10%): recovery capacity indicator
# - Sleep consistency (10%): emerging evidence for metabolic health

WEIGHTS = {
    "sleep_dur": 0.25,
    "deep_sleep": 0.20,
    "hrv": 0.20,
    "spo2": 0.15,
    "resting_hr": 0.10,
    "consistency": 0.10,
}


def compute_sleep_recovery_score(row):
    sub_scores = {
        "sleep_dur": score_sleep_duration(row["sleep_dur"]),
        "deep_sleep": score_deep_sleep(row["deep_sleep_pct"]),
        "hrv": score_hrv(row["hrv"]),
        "spo2": score_spo2(row["spo2"]),
        "resting_hr": score_resting_hr(row["resting_hr"]),
        "consistency": score_sleep_consistency(row["sleep_dur_std"]),
    }

    weighted = sum(sub_scores[k] * WEIGHTS[k] for k in WEIGHTS)
    return round(weighted, 1), sub_scores


# Apply to all patients
results = agg.apply(
    lambda row: compute_sleep_recovery_score(row), axis=1
)

agg["sleep_recovery_score"] = [r[0] for r in results]
sub_scores_df = pd.DataFrame([r[1] for r in results])
sub_scores_df.columns = [f"sub_{c}" for c in sub_scores_df.columns]
agg = pd.concat([agg, sub_scores_df], axis=1)

# Risk flags
agg["sleep_apnea_flag"] = agg["low_spo2_days"] > 0.3  # >30% of nights with SpO2 <95%
agg["chronic_sleep_debt"] = agg["low_sleep_days"] > 0.4  # >40% of nights <6h

# Categories
agg["sleep_category"] = pd.cut(
    agg["sleep_recovery_score"],
    bins=[0, 40, 60, 80, 100],
    labels=["poor", "fair", "good", "excellent"],
)

print("Sleep & Recovery Score Distribution:")
print(agg["sleep_recovery_score"].describe())
print(f"\nCategories:")
print(agg["sleep_category"].value_counts().sort_index())
print(f"\nSleep Apnea Flags: {agg['sleep_apnea_flag'].sum()}")
print(f"Chronic Sleep Debt: {agg['chronic_sleep_debt'].sum()}")

# ── 4. Export ──────────────────────────────────────────────────

output_cols = [
    "patient_id", "sleep_recovery_score", "sleep_category",
    "sub_sleep_dur", "sub_deep_sleep", "sub_hrv",
    "sub_spo2", "sub_resting_hr", "sub_consistency",
    "sleep_apnea_flag", "chronic_sleep_debt",
]
agg[output_cols].to_csv("sleep_recovery_results.csv", index=False)
print(f"\nSaved sleep_recovery_results.csv ({len(agg)} patients)")
print(agg[output_cols].head(10).to_string(index=False))
