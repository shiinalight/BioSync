"""
Biological Age Model — Simplified USING FEATURES FROM BOTH DATASETS
==================================
Predicts chronological age from biomarkers.
Residual (predicted - actual) = Biological Age Gap.
"""

import pandas as pd
import numpy as np
from sklearn.model_selection import cross_val_predict, KFold
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score

# ── 1. Load Data ──────────────────────────────────────────────

ehr = pd.read_csv("data/ehr_records.csv")
wearable = pd.read_csv("data/wearable_telemetry.csv")

# Aggregate 90 days of wearable data → 1 row per patient
wearable_agg = wearable.groupby("patient_id").agg(
    resting_hr=("resting_hr_bpm", "mean"),
    hrv=("hrv_rmssd_ms", "mean"),
    spo2=("spo2_avg_pct", "mean"),
    deep_sleep_pct=("deep_sleep_pct", "mean"),
    steps=("steps", "mean"),
    sleep_dur=("sleep_duration_hrs", "mean"),
).reset_index()

# Merge
df = ehr.merge(wearable_agg, on="patient_id")

# ── 2. Define Features & Target ───────────────────────────────

# Only objective biomarkers — no diagnoses, no self-reports
features = [
    # Blood markers (EHR)
    "hba1c_pct",
    "fasting_glucose_mmol",
    "egfr_ml_min",
    "crp_mg_l",
    "hdl_mmol",
    "ldl_mmol",
    "triglycerides_mmol",
    # Vitals (EHR)
    "sbp_mmhg",
    "dbp_mmhg",
    "bmi",
    # Wearable biomarkers
    "resting_hr",
    "hrv",
    "spo2",
    "deep_sleep_pct",
    "steps",
    "sleep_dur",
]

X = df[features]
y = df["age"]

# ── 3. Train Model (5-fold cross-validation) ──────────────────

model = GradientBoostingRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=4,
    random_state=42,
)

cv = KFold(n_splits=5, shuffle=True, random_state=42)
y_pred = cross_val_predict(model, X, y, cv=cv)

print(f"MAE:  {mean_absolute_error(y, y_pred):.2f} years")
print(f"R²:   {r2_score(y, y_pred):.3f}")

# ── 4. Compute Biological Age Gap ─────────────────────────────

df["biological_age"] = np.round(y_pred, 1)
df["bio_age_gap"] = np.round(y_pred - y, 1)

print("\nBio-Age Gap Stats:")
print(df["bio_age_gap"].describe())

# ── 5. Export ──────────────────────────────────────────────────

result = df[["patient_id", "age", "biological_age", "bio_age_gap"]]
result.to_csv("biological_age_results.csv", index=False)
print(f"\nSaved biological_age_results.csv ({len(result)} patients)")
print(result.head(10).to_string(index=False))
