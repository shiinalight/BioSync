"""
Cardiovascular Risk Score — Framingham General CVD (2008)
=========================================================
Uses published coefficients from D'Agostino et al. (2008)
"General Cardiovascular Risk Profile for Use in Primary Care"
Circulation, 117(6), 743-753.

Estimates 10-year risk of CVD events (coronary death, MI, stroke,
heart failure, peripheral artery disease).

Inputs: age, sex, SBP, total cholesterol, HDL, smoking, diabetes proxy
"""

import pandas as pd
import numpy as np

# ── 1. Load Data ──────────────────────────────────────────────

ehr = pd.read_csv("data/ehr_records.csv")

# ── 2. Framingham Risk Calculation ────────────────────────────
#
# Published coefficients from D'Agostino 2008, Table 4.
# All variables are log-transformed except smoking and diabetes (binary).
# Separate coefficients for men and women.

# Coefficients: [men, women]
COEFF = {
    "log_age":        [3.06117,   2.32888],
    "log_tc":         [1.12370,   1.20904],
    "log_hdl":        [-0.93263, -0.70833],
    "log_sbp_treated":   [1.93303,   2.76157],  # if on BP meds
    "log_sbp_untreated": [1.99881,   2.82263],  # if not on BP meds
    "smoking":        [0.65451,   0.52873],
    "diabetes":       [0.57367,   0.69154],
}

# Baseline survival at 10 years and mean coefficient sum
# From D'Agostino 2008, Table 4
BASELINE_SURVIVAL = {"M": 0.88936, "F": 0.95012}
MEAN_COEFF_SUM =    {"M": 23.9802, "F": 26.1931}


def framingham_10yr_risk(row):
    """Compute 10-year general CVD risk for one patient."""

    sex = row["sex"]  # "M" or "F"
    if sex not in ("M", "F"):
        return np.nan

    idx = 0 if sex == "M" else 1

    # Log-transform continuous variables
    log_age = np.log(row["age"])
    log_tc  = np.log(row["total_cholesterol_mmol"] * 38.67)  # mmol/L → mg/dL
    log_hdl = np.log(row["hdl_mmol"] * 38.67)                # mmol/L → mg/dL
    log_sbp = np.log(row["sbp_mmhg"])

    # Diabetes proxy: HbA1c >= 6.5%
    diabetes = 1 if row["hba1c_pct"] >= 6.5 else 0

    # Smoking: current = 1, else = 0
    smoking = 1 if row["smoking_status"] == "current" else 0

    # We assume untreated SBP (no medication data for BP treatment)
    coeff_sbp = COEFF["log_sbp_untreated"][idx]

    # Individual sum
    individual_sum = (
        COEFF["log_age"][idx]  * log_age
        + COEFF["log_tc"][idx] * log_tc
        + COEFF["log_hdl"][idx] * log_hdl
        + coeff_sbp             * log_sbp
        + COEFF["smoking"][idx] * smoking
        + COEFF["diabetes"][idx] * diabetes
    )

    # 10-year risk
    s0 = BASELINE_SURVIVAL[sex]
    mean_sum = MEAN_COEFF_SUM[sex]
    risk = 1 - s0 ** np.exp(individual_sum - mean_sum)

    return round(risk * 100, 1)  # as percentage


# ── 3. Apply to all patients ──────────────────────────────────

ehr["cvd_risk_10yr_pct"] = ehr.apply(framingham_10yr_risk, axis=1)

# ESC-style risk categories (adapted thresholds)
ehr["cvd_risk_category"] = pd.cut(
    ehr["cvd_risk_10yr_pct"],
    bins=[0, 5, 10, 20, 100],
    labels=["low (<5%)", "moderate (5-10%)", "high (10-20%)", "very high (>20%)"],
)

print("10-Year CVD Risk Distribution:")
print(ehr["cvd_risk_10yr_pct"].describe())
print(f"\nRisk Categories:")
print(ehr["cvd_risk_category"].value_counts().sort_index())

# ── 4. Export ──────────────────────────────────────────────────

result = ehr[["patient_id", "age", "sex", "cvd_risk_10yr_pct", "cvd_risk_category"]]
result.to_csv("cv_risk_results.csv", index=False)
print(f"\nSaved cv_risk_results.csv ({len(result)} patients)")
print(result.head(10).to_string(index=False))
