"""
Sleep & Recovery Score — Clinical Composite
=============================================
Computes a 0–100 score from objective wearable biomarkers AND
subjective self-report, using evidence-based clinical thresholds.

Key additions over v1:
  - sleep_quality_score: device-generated quality index from wearable —
    this is the wearable algorithm's own composite output and should not
    be ignored in favour of only raw signals.
  - sleep_satisfaction from lifestyle_survey: subjective sleep quality
    independently predicts health outcomes even when objective metrics
    look normal (Buysse 2014, Sleep Medicine Reviews). Discordance
    between objective and subjective sleep is itself a clinical signal
    (e.g., paradoxical insomnia, idiopathic hypersomnia).
  - HRV trend over 90 days: a declining HRV trajectory is an early
    marker of autonomic deterioration, independently of the average
    value (Shaffer & Ginsberg 2017; Stuckey et al. 2014).
  - active_minutes as daytime recovery capacity: physical activity
    during the day improves slow-wave sleep (Kredlow 2015, J Behav Med).

Sources:
  - Hirshkowitz (2015) NSF sleep duration guidelines
  - Shaffer & Ginsberg (2017) HRV norms, Front Public Health
  - ATS/ERS SpO2 clinical thresholds
  - AHA resting heart rate guidelines
  - Buysse et al. (2014) Sleep Medicine Reviews
  - Kredlow et al. (2015) J Behav Med — exercise and sleep quality
"""

import pandas as pd
import numpy as np


from pathlib import Path
_ROOT = Path(__file__).parent.parent
_RAW  = _ROOT / 'data' / 'raw'
_OUT  = _ROOT / 'data' / 'processed'

# ── 1. Load Data ──────────────────────────────────────────────

wearable  = pd.read_csv(_RAW / "wearable_telemetry.csv")
lifestyle = pd.read_csv(_RAW / "lifestyle_survey.csv")

# ── 2. Aggregate Wearable (90 days → 1 row per patient) ──────

def _linear_slope(series: pd.Series) -> float:
    """Returns the linear trend slope (units/day) over the series."""
    if len(series) < 3:
        return 0.0
    x = np.arange(len(series), dtype=float)
    return float(np.polyfit(x, series.values, 1)[0])


wearable_sorted = wearable.sort_values(["patient_id", "date"])

agg = wearable_sorted.groupby("patient_id").agg(
    sleep_dur          = ("sleep_duration_hrs",  "mean"),
    deep_sleep_pct     = ("deep_sleep_pct",       "mean"),
    hrv                = ("hrv_rmssd_ms",         "mean"),
    spo2               = ("spo2_avg_pct",         "mean"),
    resting_hr         = ("resting_hr_bpm",       "mean"),
    sleep_quality_raw  = ("sleep_quality_score",  "mean"),   # NEW: wearable quality index
    active_minutes     = ("active_minutes",       "mean"),   # NEW: daytime recovery
    # Consistency & risk metrics
    sleep_dur_std      = ("sleep_duration_hrs",   "std"),
    low_sleep_days     = ("sleep_duration_hrs",   lambda x: (x < 6).mean()),
    low_spo2_days      = ("spo2_avg_pct",         lambda x: (x < 95).mean()),
    # NEW: HRV trend over 90 days (ms/day; negative = declining autonomic health)
    hrv_trend          = ("hrv_rmssd_ms",         _linear_slope),
).reset_index()

# ── 3. Merge Subjective Sleep Satisfaction ────────────────────
#
# Use the latest survey response per patient.

lifestyle_latest = (
    lifestyle
    .sort_values("survey_date")
    .groupby("patient_id")
    .last()[["sleep_satisfaction"]]
    .reset_index()
)

agg = agg.merge(lifestyle_latest, on="patient_id", how="left")
agg["sleep_satisfaction"] = agg["sleep_satisfaction"].fillna(agg["sleep_satisfaction"].median())

# ── 4. Scoring Functions ──────────────────────────────────────


def score_sleep_duration(hrs: float) -> float:
    """
    NSF guidelines (Hirshkowitz 2015):
    7–9 hrs optimal; 6–7 or 9–10 may be appropriate; <6 or >10 not recommended.
    """
    if 7.0 <= hrs <= 9.0:   return 100.0
    elif 6.0 <= hrs < 7.0:  return 60.0 + (hrs - 6.0) * 40
    elif 9.0 < hrs <= 10.0: return 100.0 - (hrs - 9.0) * 40
    elif 5.0 <= hrs < 6.0:  return 20.0 + (hrs - 5.0) * 40
    return max(0.0, 20.0 - abs(hrs - 7.5) * 5)


def score_deep_sleep(pct: float) -> float:
    """
    Clinical norm: 15–25% of total sleep is deep sleep (N3).
    Below 10%: poor recovery, cognitive decline risk.
    """
    if 15 <= pct <= 25:  return 100.0
    elif 10 <= pct < 15: return 40.0 + (pct - 10) * 12
    elif 25 < pct <= 30: return 100.0 - (pct - 25) * 10
    elif pct < 10:       return max(0.0, pct * 4)
    return 50.0


def score_hrv(rmssd: float) -> float:
    """
    Shaffer & Ginsberg (2017): RMSSD norms for autonomic function.
    >50 ms: good; 20–40 ms: moderate; <20 ms: poor.
    """
    if rmssd >= 50:   return 100.0
    elif rmssd >= 40: return 80.0 + (rmssd - 40) * 2
    elif rmssd >= 25: return 40.0 + (rmssd - 25) * (40 / 15)
    elif rmssd >= 15: return (rmssd - 15) * 4
    return 0.0


def score_spo2(pct: float) -> float:
    """
    ATS/ERS thresholds:
    ≥96%: normal; 94–95%: borderline; <94%: hypoxemia (possible sleep apnea).
    """
    if pct >= 96:   return 100.0
    elif pct >= 94: return 50.0 + (pct - 94) * 25
    elif pct >= 90: return (pct - 90) * 12.5
    return 0.0


def score_resting_hr(bpm: float) -> float:
    """
    AHA: 50–70 bpm = excellent cardiovascular fitness.
    >85 bpm associated with higher all-cause mortality (Cooney 2010).
    """
    if 50 <= bpm <= 65:  return 100.0
    elif 65 < bpm <= 75: return 70.0 + (75 - bpm) * 3
    elif 75 < bpm <= 85: return 30.0 + (85 - bpm) * 4
    elif bpm > 85:       return max(0.0, 30.0 - (bpm - 85) * 3)
    return max(0.0, 60.0 + (bpm - 50) * 4)  # bradycardia <50


def score_consistency(std: float) -> float:
    """
    Irregular sleep independently associated with metabolic dysfunction
    (Lunsford-Avery 2018; Huang 2020, SLEEP). Std ≥ 1.5 hrs = irregular.
    """
    if std <= 0.5:   return 100.0
    elif std <= 1.0: return 60.0 + (1.0 - std) * 80
    elif std <= 1.5: return 20.0 + (1.5 - std) * 80
    return max(0.0, 20.0 - (std - 1.5) * 20)


def score_sleep_quality_device(raw_score: float) -> float:
    """
    Wearable device quality index (assumed 1–10 scale).
    Device-generated sleep scores incorporate multiple signals
    (movement, HR, SpO2 cycles) into a composite quality assessment.
    Normalised to 0–100.
    """
    return round(min(100.0, max(0.0, float(raw_score) * 10)), 1)


def score_sleep_satisfaction_subjective(satisfaction: float) -> float:
    """
    Self-reported sleep satisfaction (assumed 1–10 scale).
    Buysse (2014): subjective sleep quality predicts daytime function,
    mood, and metabolic markers independently of objective measures.
    """
    return round(min(100.0, max(0.0, float(satisfaction) * 10)), 1)


def score_hrv_trend(slope: float) -> float:
    """
    Maps HRV trend slope (ms/day) to a 0–100 score.
    A positive slope (improving HRV) = good; negative (declining) = concern.
    Stuckey et al. (2014): HRV trajectory predicts autonomic deterioration
    earlier than single-point measurements.

    Typical daily HRV change in healthy adults: ±0.1 ms/day.
    Clinically significant decline: < −0.3 ms/day over 90 days (~27 ms drop).
    """
    if slope >= 0.2:    return 100.0              # clearly improving
    elif slope >= 0.0:  return 70.0 + slope / 0.2 * 30   # stable-to-improving
    elif slope >= -0.2: return 40.0 + (slope + 0.2) / 0.2 * 30  # slight decline
    elif slope >= -0.4: return (slope + 0.4) / 0.2 * 40  # moderate decline
    return 0.0                                    # steep decline


def score_active_minutes(mins: float) -> float:
    """
    Kredlow et al. (2015): acute and regular aerobic exercise improves
    slow-wave sleep duration and subjective sleep quality.
    WHO 2020: ≥21 min/day moderate activity as minimum threshold.
    """
    if mins >= 30:    return 100.0
    elif mins >= 21:  return 70.0 + (mins - 21) / 9 * 30
    elif mins >= 10:  return 20.0 + (mins - 10) / 11 * 50
    return (mins / 10) * 20


# ── 5. Composite Score Weights ────────────────────────────────
#
# Weight rationale (updated):
#   sleep_dur (20%):          strongest evidence for all-cause mortality
#   deep_sleep (15%):         critical for physical recovery and memory
#   hrv (15%):                best single autonomic recovery marker
#   sleep_quality_device (12%): wearable composite — multi-signal quality proxy
#   spo2 (10%):               key for detecting sleep apnea / nocturnal hypoxia
#   sleep_satisfaction (8%):  subjective quality — independent clinical signal
#   resting_hr (8%):          recovery capacity indicator
#   consistency (6%):         irregular sleep → metabolic dysfunction
#   hrv_trend (4%):           aging velocity signal; trajectory > snapshot
#   active_minutes (2%):      daytime exercise→ sleep quality pathway

WEIGHTS = {
    "sleep_dur":          0.20,
    "deep_sleep":         0.15,
    "hrv":                0.15,
    "sleep_quality":      0.12,
    "spo2":               0.10,
    "sleep_satisfaction": 0.08,
    "resting_hr":         0.08,
    "consistency":        0.06,
    "hrv_trend":          0.04,
    "active_minutes":     0.02,
}
assert abs(sum(WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1.0"


def compute_sleep_recovery_score(row) -> tuple:
    sub = {
        "sleep_dur":          score_sleep_duration(row["sleep_dur"]),
        "deep_sleep":         score_deep_sleep(row["deep_sleep_pct"]),
        "hrv":                score_hrv(row["hrv"]),
        "sleep_quality":      score_sleep_quality_device(row["sleep_quality_raw"]),
        "spo2":               score_spo2(row["spo2"]),
        "sleep_satisfaction": score_sleep_satisfaction_subjective(row["sleep_satisfaction"]),
        "resting_hr":         score_resting_hr(row["resting_hr"]),
        "consistency":        score_consistency(row["sleep_dur_std"]),
        "hrv_trend":          score_hrv_trend(row["hrv_trend"]),
        "active_minutes":     score_active_minutes(row["active_minutes"]),
    }
    score = round(sum(sub[k] * WEIGHTS[k] for k in WEIGHTS), 1)
    return score, sub


# ── 6. Apply ──────────────────────────────────────────────────

results = agg.apply(lambda row: compute_sleep_recovery_score(row), axis=1)
agg["sleep_recovery_score"] = [r[0] for r in results]

sub_scores_df = pd.DataFrame([r[1] for r in results])
sub_scores_df.columns = [f"sub_{c}" for c in sub_scores_df.columns]
agg = pd.concat([agg, sub_scores_df], axis=1)

# Clinical risk flags
agg["sleep_apnea_flag"]    = agg["low_spo2_days"] > 0.3   # >30% nights SpO2 <95%
agg["chronic_sleep_debt"]  = agg["low_sleep_days"] > 0.4  # >40% nights <6h sleep
agg["hrv_declining"]       = agg["hrv_trend"] < -0.3      # steep HRV decline

# Categories
agg["sleep_category"] = pd.cut(
    agg["sleep_recovery_score"],
    bins=[0, 40, 60, 80, 100],
    labels=["poor", "fair", "good", "excellent"],
)

# Subjective–objective discordance flag:
# device says quality is good (>70) but patient reports poor satisfaction (<40)
agg["sleep_discordance_flag"] = (
    (agg["sub_sleep_quality"] > 70) & (agg["sub_sleep_satisfaction"] < 40)
)

print("Sleep & Recovery Score Distribution:")
print(agg["sleep_recovery_score"].describe())
print("\nCategories:")
print(agg["sleep_category"].value_counts().sort_index())
print(f"\nSleep Apnea Flags:    {agg['sleep_apnea_flag'].sum()}")
print(f"Chronic Sleep Debt:   {agg['chronic_sleep_debt'].sum()}")
print(f"Declining HRV Trend:  {agg['hrv_declining'].sum()}")
print(f"Subj/Obj Discordance: {agg['sleep_discordance_flag'].sum()}")

# ── 7. Export ──────────────────────────────────────────────────

output_cols = [
    "patient_id", "sleep_recovery_score", "sleep_category",
    "sub_sleep_dur", "sub_deep_sleep", "sub_hrv",
    "sub_sleep_quality", "sub_spo2", "sub_sleep_satisfaction",
    "sub_resting_hr", "sub_consistency", "sub_hrv_trend", "sub_active_minutes",
    "sleep_apnea_flag", "chronic_sleep_debt",
    "hrv_declining", "sleep_discordance_flag",
]
agg[output_cols].to_csv(_OUT / "sleep_recovery_results.csv", index=False)
print(f"\nSaved sleep_recovery_results.csv ({len(agg)} patients)")
print(agg[output_cols].head(10).to_string(index=False))
