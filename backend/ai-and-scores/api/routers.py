"""
BioSync API Routers — GET only
================================
On startup, loads raw CSVs from backend/data/, runs each scoring model,
and caches all results in memory. Endpoints are read-only GET routes.
"""

from pathlib import Path
from typing import List, Optional
import math

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import KFold, cross_val_predict

from agent.longevity_agent import run_agent_async

DATA = Path(__file__).parent.parent / "data" / "raw"

router = APIRouter(prefix="/api")


# ── Score computation (runs once on import) ───────────────────────────────────

def _compute_cv_risk(ehr: pd.DataFrame) -> pd.DataFrame:
    """Framingham 10-year CVD risk (D'Agostino et al. 2008)."""
    COEFF = {
        "log_age":           [3.06117,  2.32888],
        "log_tc":            [1.12370,  1.20904],
        "log_hdl":           [-0.93263, -0.70833],
        "log_sbp_untreated": [1.99881,  2.82263],
        "smoking":           [0.65451,  0.52873],
        "diabetes":          [0.57367,  0.69154],
    }
    BASELINE = {"M": 0.88936, "F": 0.95012}
    MEAN_SUM = {"M": 23.9802, "F": 26.1931}

    def _row(r):
        sex = str(r["sex"]).upper()
        if sex not in ("M", "F"):
            return np.nan
        idx = 0 if sex == "M" else 1
        smoking  = 1 if str(r["smoking_status"]).lower() == "current" else 0
        diabetes = 1 if r["hba1c_pct"] >= 6.5 else 0
        s = (
            COEFF["log_age"][idx]            * math.log(r["age"])
            + COEFF["log_tc"][idx]           * math.log(r["total_cholesterol_mmol"] * 38.67)
            + COEFF["log_hdl"][idx]          * math.log(r["hdl_mmol"] * 38.67)
            + COEFF["log_sbp_untreated"][idx] * math.log(r["sbp_mmhg"])
            + COEFF["smoking"][idx]          * smoking
            + COEFF["diabetes"][idx]         * diabetes
        )
        risk = (1 - BASELINE[sex] ** math.exp(s - MEAN_SUM[sex])) * 100
        return round(risk, 1)

    df = ehr[["patient_id", "age", "sex"]].copy()
    df["cvd_risk_10yr_pct"] = ehr.apply(_row, axis=1)
    df["cvd_risk_category"] = pd.cut(
        df["cvd_risk_10yr_pct"],
        bins=[0, 5, 10, 20, 100],
        labels=["low", "moderate", "high", "very high"],
    ).astype(str)
    return df


def _compute_lifestyle(lifestyle: pd.DataFrame) -> pd.DataFrame:
    """Composite lifestyle score 0–100 (WHO/AHA/CDC guidelines)."""

    def score_smoking(s):
        return {"never": 100, "former": 60, "ex": 60, "current": 0}.get(str(s).lower(), 50)

    def score_alcohol(u):
        if u <= 0:    return 100
        elif u <= 7:  return 90
        elif u <= 14: return 70
        elif u <= 21: return 40
        elif u <= 35: return 15
        return 0

    def score_diet(s):     return min(100, max(0, float(s) * 10))

    def score_fruit_veg(s):
        if s >= 8:   return 100
        elif s >= 5: return 70 + (s - 5) * 10
        elif s >= 3: return 30 + (s - 3) * 20
        elif s >= 1: return s * 15
        return 0

    def score_exercise(s):
        if s >= 5:   return 100
        elif s >= 3: return 60 + (s - 3) * 20
        elif s >= 1: return 20 + (s - 1) * 20
        return 0

    def score_sedentary(h):
        if h <= 4:    return 100
        elif h <= 6:  return 60 + (6 - h) * 20
        elif h <= 8:  return 30 + (8 - h) * 15
        elif h <= 10: return (10 - h) * 15
        return 0

    def score_stress(l):
        if l <= 2:   return 100
        elif l <= 4: return 70 + (4 - l) * 15
        elif l <= 6: return 40 + (6 - l) * 15
        elif l <= 8: return 10 + (8 - l) * 15
        return max(0, 10 - (l - 8) * 5)

    def score_water(g):
        if g >= 8:   return 100
        elif g >= 6: return 60 + (g - 6) * 20
        elif g >= 4: return 30 + (g - 4) * 15
        elif g >= 2: return (g - 2) * 15
        return 0

    def score_meal_freq(m):
        if 3 <= m <= 5: return 100
        elif m == 2:    return 60
        elif m == 1:    return 20
        elif m > 5:     return 70
        return 0

    WEIGHTS = {
        "smoking": 0.20, "exercise": 0.15, "alcohol": 0.15,
        "diet": 0.12, "sedentary": 0.12, "fruit_veg": 0.08,
        "stress": 0.08, "water": 0.05, "meal_freq": 0.05,
    }

    def _row(r):
        sub = {
            "smoking":   score_smoking(r["smoking_status"]),
            "alcohol":   score_alcohol(r["alcohol_units_weekly"]),
            "diet":      score_diet(r["diet_quality_score"]),
            "fruit_veg": score_fruit_veg(r["fruit_veg_servings_daily"]),
            "exercise":  score_exercise(r["exercise_sessions_weekly"]),
            "sedentary": score_sedentary(r["sedentary_hrs_day"]),
            "stress":    score_stress(r["stress_level"]),
            "water":     score_water(r["water_glasses_daily"]),
            "meal_freq": score_meal_freq(r["meal_frequency_daily"]),
        }
        score = round(sum(sub[k] * WEIGHTS[k] for k in WEIGHTS), 1)
        weakest = min(sub, key=sub.get)
        return pd.Series({"lifestyle_score": score, "weakest_area": weakest, **{f"sub_{k}": v for k, v in sub.items()}})

    scores = lifestyle.apply(_row, axis=1)
    df = pd.concat([lifestyle[["patient_id"]], scores], axis=1)
    df["lifestyle_category"] = pd.cut(
        df["lifestyle_score"],
        bins=[0, 40, 60, 80, 100],
        labels=["high risk", "moderate risk", "low risk", "optimal"],
    ).astype(str)
    return df


def _compute_sleep(wearable: pd.DataFrame) -> pd.DataFrame:
    """Sleep & Recovery score 0–100 (NSF / AHA / ATS thresholds)."""
    agg = wearable.groupby("patient_id").agg(
        sleep_dur=("sleep_duration_hrs", "mean"),
        deep_sleep_pct=("deep_sleep_pct", "mean"),
        hrv=("hrv_rmssd_ms", "mean"),
        spo2=("spo2_avg_pct", "mean"),
        resting_hr=("resting_hr_bpm", "mean"),
        sleep_dur_std=("sleep_duration_hrs", "std"),
        low_sleep_days=("sleep_duration_hrs", lambda x: (x < 6).mean()),
        low_spo2_days=("spo2_avg_pct", lambda x: (x < 95).mean()),
    ).reset_index()

    def score_sleep_duration(hrs):
        if 7.0 <= hrs <= 9.0:   return 100
        elif 6.0 <= hrs < 7.0:  return 60 + (hrs - 6.0) * 40
        elif 9.0 < hrs <= 10.0: return 100 - (hrs - 9.0) * 40
        elif 5.0 <= hrs < 6.0:  return 20 + (hrs - 5.0) * 40
        return max(0, 20 - abs(hrs - 7.5) * 5)

    def score_deep_sleep(pct):
        if 15 <= pct <= 25:  return 100
        elif 10 <= pct < 15: return 40 + (pct - 10) * 12
        elif 25 < pct <= 30: return 100 - (pct - 25) * 10
        elif pct < 10:       return max(0, pct * 4)
        return 50

    def score_hrv(r):
        if r >= 50:   return 100
        elif r >= 40: return 80 + (r - 40) * 2
        elif r >= 25: return 40 + (r - 25) * (40 / 15)
        elif r >= 15: return (r - 15) * 4
        return 0

    def score_spo2(p):
        if p >= 96:   return 100
        elif p >= 94: return 50 + (p - 94) * 25
        elif p >= 90: return (p - 90) * 12.5
        return 0

    def score_resting_hr(b):
        if 50 <= b <= 65:  return 100
        elif 65 < b <= 75: return 70 + (75 - b) * 3
        elif 75 < b <= 85: return 30 + (85 - b) * 4
        elif b > 85:       return max(0, 30 - (b - 85) * 3)
        return max(0, 60 + (b - 50) * 4)

    def score_consistency(s):
        if s <= 0.5:   return 100
        elif s <= 1.0: return 60 + (1.0 - s) * 80
        elif s <= 1.5: return 20 + (1.5 - s) * 80
        return max(0, 20 - (s - 1.5) * 20)

    WEIGHTS = {
        "sleep_dur": 0.25, "deep_sleep": 0.20, "hrv": 0.20,
        "spo2": 0.15, "resting_hr": 0.10, "consistency": 0.10,
    }

    def _row(r):
        sub = {
            "sleep_dur":   score_sleep_duration(r["sleep_dur"]),
            "deep_sleep":  score_deep_sleep(r["deep_sleep_pct"]),
            "hrv":         score_hrv(r["hrv"]),
            "spo2":        score_spo2(r["spo2"]),
            "resting_hr":  score_resting_hr(r["resting_hr"]),
            "consistency": score_consistency(r["sleep_dur_std"]),
        }
        score = round(sum(sub[k] * WEIGHTS[k] for k in WEIGHTS), 1)
        return pd.Series({"sleep_recovery_score": score, **{f"sub_{k}": v for k, v in sub.items()}})

    scores = agg.apply(_row, axis=1)
    df = pd.concat([agg[["patient_id", "low_spo2_days", "low_sleep_days"]], scores], axis=1)
    df["sleep_apnea_flag"] = df["low_spo2_days"] > 0.3
    df["chronic_sleep_debt"] = df["low_sleep_days"] > 0.4
    df["sleep_category"] = pd.cut(
        df["sleep_recovery_score"],
        bins=[0, 40, 60, 80, 100],
        labels=["poor", "fair", "good", "excellent"],
    ).astype(str)
    return df.drop(columns=["low_spo2_days", "low_sleep_days"])


def _compute_bio_age(ehr: pd.DataFrame, wearable: pd.DataFrame) -> pd.DataFrame:
    """Biological age via Gradient Boosting trained on the full dataset."""
    wearable_agg = wearable.groupby("patient_id").agg(
        resting_hr=("resting_hr_bpm", "mean"),
        hrv=("hrv_rmssd_ms", "mean"),
        spo2=("spo2_avg_pct", "mean"),
        deep_sleep_pct=("deep_sleep_pct", "mean"),
        steps=("steps", "mean"),
        sleep_dur=("sleep_duration_hrs", "mean"),
    ).reset_index()

    merged = ehr.merge(wearable_agg, on="patient_id")
    features = [
        "hba1c_pct", "fasting_glucose_mmol", "egfr_ml_min", "crp_mg_l",
        "hdl_mmol", "ldl_mmol", "triglycerides_mmol",
        "sbp_mmhg", "dbp_mmhg", "bmi",
        "resting_hr", "hrv", "spo2", "deep_sleep_pct", "steps", "sleep_dur",
    ]
    X, y = merged[features], merged["age"]
    model = GradientBoostingRegressor(n_estimators=300, learning_rate=0.05, max_depth=4, random_state=42)
    cv = KFold(n_splits=5, shuffle=True, random_state=42)
    y_pred = cross_val_predict(model, X, y, cv=cv)

    df = merged[["patient_id", "age"]].copy()
    df["biological_age"] = np.round(y_pred, 1)
    df["bio_age_gap"] = np.round(y_pred - y, 1)
    df["interpretation"] = df["bio_age_gap"].apply(
        lambda g: "younger than chronological age" if g < -1
        else "older than chronological age" if g > 1
        else "on track with chronological age"
    )
    return df


# ── Load & cache everything once at import time ───────────────────────────────

def _load():
    ehr       = pd.read_csv(DATA / "ehr_records.csv")
    wearable  = pd.read_csv(DATA / "wearable_telemetry.csv")
    lifestyle = pd.read_csv(DATA / "lifestyle_survey.csv")
    return {
        "cv":        _compute_cv_risk(ehr),
        "lifestyle": _compute_lifestyle(lifestyle),
        "sleep":     _compute_sleep(wearable),
        "bio_age":   _compute_bio_age(ehr, wearable),
    }

_cache = _load()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_patient(df: pd.DataFrame, patient_id: Optional[str]) -> List[dict]:
    if patient_id:
        row = df[df["patient_id"] == patient_id]
        if row.empty:
            raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")
        return row.to_dict(orient="records")
    return df.to_dict(orient="records")


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/health")
def health_check():
    return {"status": "ok", "service": "BioSync API", "patients_loaded": len(_cache["cv"])}


@router.get("/patients")
def list_patients():
    """All patient IDs in the dataset."""
    return {"patient_ids": _cache["cv"]["patient_id"].tolist()}


@router.get("/scores/cv-risk")
def cv_risk(patient_id: Optional[str] = Query(None)):
    return _get_patient(_cache["cv"], patient_id)


@router.get("/scores/lifestyle")
def lifestyle(patient_id: Optional[str] = Query(None)):
    return _get_patient(_cache["lifestyle"], patient_id)


@router.get("/scores/sleep")
def sleep(patient_id: Optional[str] = Query(None)):
    return _get_patient(_cache["sleep"], patient_id)


@router.get("/scores/bio-age")
def bio_age(patient_id: Optional[str] = Query(None)):
    return _get_patient(_cache["bio_age"], patient_id)


class ChatRequest(BaseModel):
    patient_id: str
    message: str
    session_id: Optional[str] = None


@router.post("/chat")
async def chat(body: ChatRequest):
    """Send a message to the AI longevity agent and get a response."""
    try:
        response, session_id = await run_agent_async(
            body.patient_id, body.message, body.session_id
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return {"response": response, "session_id": session_id}


@router.get("/scores/all")
def all_scores(patient_id: str = Query(..., description="Patient ID, e.g. PT0001")):
    """All four scores for a single patient as a nested object."""
    cv_df = _cache["cv"]
    ls_df = _cache["lifestyle"]
    sl_df = _cache["sleep"]
    ba_df = _cache["bio_age"]

    cv_row = cv_df[cv_df["patient_id"] == patient_id]
    if cv_row.empty:
        raise HTTPException(status_code=404, detail=f"Patient '{patient_id}' not found")

    cv = cv_row.iloc[0]
    ls = ls_df[ls_df["patient_id"] == patient_id].iloc[0]
    sl = sl_df[sl_df["patient_id"] == patient_id].iloc[0]
    ba = ba_df[ba_df["patient_id"] == patient_id].iloc[0]

    cv_risk_pct    = float(cv["cvd_risk_10yr_pct"])
    lifestyle_score = float(ls["lifestyle_score"])
    sleep_score    = float(sl["sleep_recovery_score"])
    bio_age_gap    = float(ba["bio_age_gap"])

    cv_health_score = max(0.0, 100 - cv_risk_pct * 3)
    bio_age_score   = max(0.0, 100 - abs(bio_age_gap) * 8)
    overall = round((cv_health_score + lifestyle_score + sleep_score + bio_age_score) / 4, 1)

    ls_sub_cols = [c for c in ls_df.columns if c.startswith("sub_")]
    sl_sub_cols = [c for c in sl_df.columns if c.startswith("sub_")]

    return {
        "patient_id": patient_id,
        "overall_score": overall,
        "cv_risk": {
            "cvd_risk_10yr_pct": cv_risk_pct,
            "category": cv["cvd_risk_category"],
        },
        "lifestyle": {
            "lifestyle_score": lifestyle_score,
            "category": ls["lifestyle_category"],
            "weakest_area": ls["weakest_area"],
            "sub_scores": {c.replace("sub_", ""): round(float(ls[c]), 1) for c in ls_sub_cols},
        },
        "sleep": {
            "sleep_recovery_score": sleep_score,
            "category": sl["sleep_category"],
            "sub_scores": {c.replace("sub_", ""): round(float(sl[c]), 1) for c in sl_sub_cols},
            "sleep_apnea_flag": bool(sl["sleep_apnea_flag"]),
            "chronic_sleep_debt": bool(sl["chronic_sleep_debt"]),
        },
        "bio_age": {
            "biological_age": float(ba["biological_age"]),
            "chronological_age": float(ba["age"]),
            "bio_age_gap": bio_age_gap,
            "interpretation": ba["interpretation"],
        },
    }
