"""
Longevity Agent — Google ADK + Gemini
=======================================
Gemini-powered health coach using Google's Agent Development Kit (ADK).

ARCHITECTURE:
  The 4 dimension scripts are batch processors — they run once and write CSVs.
  This agent wraps those pre-computed results as tools. Gemini calls them on
  demand, decides which to call and in what order, and synthesises the results.

  Batch (run once):     bio_age_prediction_v2.py   →  biological_age_results.csv
                        cv_risk_score.py            →  cv_results.csv
                        lifecycle_risk_score.py     →  lifestyle_risk_results.csv
                        sleep_and_recovery_score.py →  sleep_recovery_results.csv

  Agent (per request):  Tools read CSVs → Gemini interprets → personalised response

WHY GOOGLE ADK:
  ADK's key advantage over a raw Gemini API call: the tool-use loop, session
  state, and function schema generation are all handled by the framework.
  You define plain Python functions — ADK reads their type hints and docstrings
  to build the Gemini function declarations automatically.

INSTALL:
  pip install google-adk google-genai

ENVIRONMENT:
  export GOOGLE_API_KEY="your-gemini-api-key"

USAGE (CLI):
  python longevity_agent.py PT0001

USAGE (in code):
  from longevity_agent import run_agent
  response = run_agent("PT0001", "What should I focus on this month?")
"""

import asyncio
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

import numpy as np
import pandas as pd
from dotenv import load_dotenv

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Load .env and expose API_KEY as GOOGLE_API_KEY (required by Google ADK)
load_dotenv(Path(__file__).parent.parent / ".env")
os.environ["GOOGLE_API_KEY"] = os.environ.get("API_KEY", "")

# ── Load pre-computed dimension results (once at import) ──────

_ROOT          = Path(__file__).parent.parent
_DATA_PROCESSED = _ROOT / "data" / "processed"
_DATA_RAW       = _ROOT / "data" / "raw"


def _load():
    return {
        "bio_age":   pd.read_csv(_DATA_PROCESSED / "biological_age_results.csv"),
        "cv":        pd.read_csv(_DATA_PROCESSED / "cv_results.csv"),
        "lifestyle": pd.read_csv(_DATA_PROCESSED / "lifestyle_risk_results.csv"),
        "sleep":     pd.read_csv(_DATA_PROCESSED / "sleep_recovery_results.csv"),
        "wearable":  pd.read_csv(_DATA_RAW / "wearable_telemetry.csv"),
    }


_DATA = _load()


# ── Helpers ───────────────────────────────────────────────────

def _row(df: pd.DataFrame, patient_id: str):
    rows = df[df["patient_id"] == patient_id]
    return rows.iloc[0].to_dict() if not rows.empty else None


def _safe(v):
    """Convert numpy types and NaN to JSON-safe Python types."""
    if isinstance(v, float) and np.isnan(v):   return None
    if isinstance(v, (np.bool_,)):              return bool(v)
    if isinstance(v, (np.floating,)):           return round(float(v), 2)
    if isinstance(v, (np.integer,)):            return int(v)
    return v



# ═════════════════════════════════════════════════════════════
# TOOLS — plain Python functions
#
# Google ADK reads the function signature (type hints) and the
# docstring to automatically generate the Gemini function declaration.
# No manual JSON schema required.
# ═════════════════════════════════════════════════════════════

def get_longevity_scores(patient_id: str) -> dict:
    """
    Retrieves the complete longevity profile for a patient across all 4 dimensions:
    biological age gap, cardiovascular health (CVD risk + VO2max fitness),
    lifestyle & behavioral risk (12 factors incl. WHO-5 wellbeing), and
    sleep & recovery (objective wearable + subjective satisfaction + HRV trend).
    Each dimension returns a 0-100 score, a category label, and sub-scores
    showing which specific factors are driving the result.
    Always call this first to get the full overview.

    Args:
        patient_id: Patient identifier, e.g. PT0001.

    Returns:
        Dict with biological_age, cardiovascular_health, lifestyle, and
        sleep_recovery sections, each containing scores and sub-scores.
    """
    ba = _row(_DATA["bio_age"],   patient_id)
    cv = _row(_DATA["cv"],        patient_id)
    ls = _row(_DATA["lifestyle"], patient_id)
    sl = _row(_DATA["sleep"],     patient_id)

    if not ba:
        return {"error": f"Patient '{patient_id}' not found"}

    def _sub(d, prefix="sub_"):
        if not d:
            return {}
        return {
            k.replace(prefix, ""): round(float(v), 1)
            for k, v in d.items()
            if k.startswith(prefix) and v is not None
        }

    return {
        "patient_id": patient_id,
        "biological_age": {
            "chronological_age":  _safe(ba.get("age")),
            "biological_age":     _safe(ba.get("biological_age")),
            "bio_age_gap":        _safe(ba.get("bio_age_gap")),
            "interpretation":     ba.get("bio_age_interpretation"),
            "aging_alert":        bool(ba.get("aging_alert", False)),
        },
        "cardiovascular_health": {
            "overall_score":      _safe(cv.get("cardiovascular_health_score")) if cv else None,
            "overall_category":   cv.get("cardiovascular_health_category") if cv else None,
            "cvd_risk_10yr_pct":  _safe(cv.get("cvd_risk_10yr_pct")) if cv else None,
            "cvd_risk_category":  cv.get("cvd_risk_category") if cv else None,
            "vo2max_ml_kg_min":   _safe(cv.get("vo2max_estimated")) if cv else None,
            "cv_fitness_score":   _safe(cv.get("cv_fitness_score")) if cv else None,
            "cv_fitness_category": cv.get("cv_fitness_category") if cv else None,
        },
        "lifestyle": {
            "score":              _safe(ls.get("lifestyle_score")) if ls else None,
            "category":           ls.get("lifestyle_category") if ls else None,
            "weakest_area":       ls.get("weakest_area") if ls else None,
            "mental_health_flag": bool(ls.get("mental_health_flag", False)) if ls else False,
            "sub_scores":         _sub(ls),
        },
        "sleep_recovery": {
            "score":              _safe(sl.get("sleep_recovery_score")) if sl else None,
            "category":           sl.get("sleep_category") if sl else None,
            "sleep_apnea_flag":   bool(sl.get("sleep_apnea_flag", False)) if sl else False,
            "chronic_sleep_debt": bool(sl.get("chronic_sleep_debt", False)) if sl else False,
            "hrv_declining":      bool(sl.get("hrv_declining", False)) if sl else False,
            "sleep_discordance":  bool(sl.get("sleep_discordance_flag", False)) if sl else False,
            "sub_scores":         _sub(sl),
        },
    }


def get_wearable_trends(patient_id: str) -> dict:
    """
    Returns 30-day trend direction (improving / stable / declining) and statistics
    for key wearable metrics: HRV, resting heart rate, steps, sleep duration,
    sleep quality, active minutes, and SpO2.
    A static score tells you where the patient is. A trend tells you where they
    are going — call this when a score is borderline or when you need trajectory
    context for a specific concern such as declining autonomic health.

    Args:
        patient_id: Patient identifier, e.g. PT0001.

    Returns:
        Dict with trend direction and 30-day statistics for each wearable metric.
    """
    df = (
        _DATA["wearable"][_DATA["wearable"]["patient_id"] == patient_id]
        .sort_values("date")
        .tail(30)
    )
    if df.empty:
        return {"error": f"No wearable data for '{patient_id}'"}

    def _trend(series: pd.Series) -> str:
        if len(series) < 5:
            return "insufficient data"
        slope = np.polyfit(np.arange(len(series)), series.values, 1)[0]
        threshold = 0.03 * series.mean()
        if slope > threshold:  return "improving"
        if slope < -threshold: return "declining"
        return "stable"

    def _stats(col: str) -> dict:
        s = df[col].dropna()
        if s.empty:
            return None
        return {
            "mean_30d":    round(float(s.mean()), 1),
            "last_7d_mean": round(float(s.tail(7).mean()), 1),
            "trend":       _trend(s),
            "min":         round(float(s.min()), 1),
            "max":         round(float(s.max()), 1),
        }

    return {
        "patient_id":         patient_id,
        "days_of_data":       len(df),
        "hrv_rmssd_ms":       _stats("hrv_rmssd_ms"),
        "resting_hr_bpm":     _stats("resting_hr_bpm"),
        "steps":              _stats("steps"),
        "sleep_duration_hrs": _stats("sleep_duration_hrs"),
        "sleep_quality":      _stats("sleep_quality_score"),
        "active_minutes":     _stats("active_minutes"),
        "spo2_pct":           _stats("spo2_avg_pct"),
    }


def get_risk_flags(patient_id: str) -> dict:
    """
    Returns all active clinical risk flags for a patient, sorted by severity
    (high first). Flags cover: accelerated aging, very high or high CVD risk,
    poor cardiovascular fitness, mental health screening needed (WHO-5 below 52),
    sleep apnea risk (SpO2 pattern), chronic sleep debt, declining HRV trend,
    and subjective-objective sleep discordance. Each flag includes a clinical
    explanation and a recommended action. Call this after get_longevity_scores
    to decide what is urgent vs monitoring-only.

    Args:
        patient_id: Patient identifier, e.g. PT0001.

    Returns:
        Dict with active_flags count, high_severity count, and a list of
        flag objects each containing flag name, severity, dimension, detail,
        and recommended action.
    """
    ba = _row(_DATA["bio_age"],   patient_id)
    cv = _row(_DATA["cv"],        patient_id)
    ls = _row(_DATA["lifestyle"], patient_id)
    sl = _row(_DATA["sleep"],     patient_id)

    if not ba:
        return {"error": f"Patient '{patient_id}' not found"}

    flags = []

    # ── Biological Age ────────────────────────────────────────
    gap = float(ba.get("bio_age_gap", 0) or 0)
    if gap > 5:
        flags.append({
            "flag":      "accelerated_aging",
            "severity":  "high" if gap > 8 else "moderate",
            "dimension": "biological_age",
            "detail":    f"Biological age is {gap:.1f} years ahead of chronological age. "
                         "Associated with elevated all-cause mortality risk (Levine 2018).",
            "action":    "Review CRP (inflammation), HbA1c (glycemic stress), and lifestyle drivers. "
                         "Consider clinical review.",
        })

    # ── Cardiovascular ────────────────────────────────────────
    if cv:
        risk = float(cv.get("cvd_risk_10yr_pct", 0) or 0)
        if risk >= 20:
            flags.append({
                "flag":      "very_high_cvd_risk",
                "severity":  "high",
                "dimension": "cardiovascular",
                "detail":    f"10-year CVD event risk {risk:.1f}% — ESC very high threshold ≥20%.",
                "action":    "GP/cardiologist referral strongly recommended. Review BP, lipids, HbA1c.",
            })
        elif risk >= 10:
            flags.append({
                "flag":      "high_cvd_risk",
                "severity":  "moderate",
                "dimension": "cardiovascular",
                "detail":    f"10-year CVD event risk {risk:.1f}% — ESC high threshold ≥10%.",
                "action":    "Lifestyle intervention: aerobic exercise, diet, smoking cessation.",
            })
        fitness = float(cv.get("cv_fitness_score", 100) or 100)
        if fitness < 35:
            flags.append({
                "flag":      "poor_cardiovascular_fitness",
                "severity":  "moderate",
                "dimension": "cardiovascular",
                "detail":    f"CV fitness {fitness:.0f}/100. Low aerobic capacity is a stronger "
                             "mortality predictor than most CVD risk factors (Myers 2002, NEJM).",
                "action":    "Gradual aerobic programme. Target ≥150 min/week moderate intensity.",
            })

    # ── Lifestyle ─────────────────────────────────────────────
    if ls and ls.get("mental_health_flag", False):
        flags.append({
            "flag":      "mental_health_screening",
            "severity":  "high",
            "dimension": "lifestyle",
            "detail":    "WHO-5 Wellbeing Index below clinical threshold of 52. "
                         "Indicates poor wellbeing; below 28 suggests likely depression.",
            "action":    "Clinical evaluation recommended. Chronic poor wellbeing accelerates "
                         "biological aging (Puterman 2016).",
        })

    # ── Sleep ─────────────────────────────────────────────────
    if sl:
        if sl.get("sleep_apnea_flag", False):
            flags.append({
                "flag":      "sleep_apnea_risk",
                "severity":  "high",
                "dimension": "sleep",
                "detail":    "SpO2 <95% on >30% of nights — pattern consistent with sleep apnea. "
                             "Untreated OSA raises CVD risk by 140% (Gottlieb 2010).",
                "action":    "Refer for polysomnography or home sleep apnea test.",
            })
        if sl.get("chronic_sleep_debt", False):
            flags.append({
                "flag":      "chronic_sleep_debt",
                "severity":  "moderate",
                "dimension": "sleep",
                "detail":    "Sleep under 6 hours on more than 40% of nights. "
                             "Chronic short sleep raises all-cause mortality by 12% (Cappuccio 2010).",
                "action":    "Sleep hygiene programme. Screen for stress, caffeine, schedule drivers.",
            })
        if sl.get("hrv_declining", False):
            flags.append({
                "flag":      "declining_hrv_trend",
                "severity":  "moderate",
                "dimension": "sleep",
                "detail":    "HRV declining >0.3 ms/day over 90 days — early autonomic deterioration. "
                             "Often precedes clinically visible decline by weeks (Stuckey 2014).",
                "action":    "Investigate stress load, sleep quality, overtraining, alcohol intake.",
            })
        if sl.get("sleep_discordance_flag", False):
            flags.append({
                "flag":      "sleep_discordance",
                "severity":  "low",
                "dimension": "sleep",
                "detail":    "Wearable reports good sleep quality but patient reports low satisfaction — "
                             "possible paradoxical insomnia or non-restorative sleep.",
                "action":    "Explore subjective sleep drivers. Consider CBT-I referral.",
            })

    flags.sort(key=lambda f: {"high": 0, "moderate": 1, "low": 2}.get(f["severity"], 3))

    return {
        "patient_id":    patient_id,
        "active_flags":  len(flags),
        "high_severity": sum(1 for f in flags if f["severity"] == "high"),
        "flags":         flags,
    }


# ═════════════════════════════════════════════════════════════
# Agent definition
#
# ADK automatically builds Gemini function declarations from the
# Python functions above: type hints → parameter schema,
# docstring → tool description. No manual JSON schema needed.
# ═════════════════════════════════════════════════════════════

_INSTRUCTION = """You are BioSync, an AI longevity health coach for a European preventive healthcare platform.

You have access to a patient's longitudinal health data across 4 clinically validated dimensions:
  • Biological Age        — physiological age vs. calendar age (bio_age_gap)
  • Cardiovascular Health — 10-year CVD risk (Framingham) + aerobic fitness (VO2max, Nes 2011)
  • Lifestyle Risk        — composite of 12 evidence-based lifestyle factors including WHO-5 wellbeing
  • Sleep & Recovery      — objective wearable data + subjective satisfaction + 90-day HRV trend

Your coaching principles:

1. SYNTHESISE across dimensions first. A pattern spanning multiple dimensions is always the most
   important signal. e.g., declining HRV + poor sleep + high stress + accelerated aging is a
   systemic burnout pattern. Name it clearly rather than listing four separate issues.

2. PRIORITISE ruthlessly. Patients cannot act on 10 things at once. Identify the 1-2 highest-
   leverage interventions based on longevity impact, modifiability, and urgency.

3. GROUND every recommendation in evidence. Explain what the clinical signal means in plain
   language — translate numbers into consequence.

4. FLAG clinical referrals clearly. You do not diagnose. When flags indicate a doctor or
   specialist is needed (sleep apnea, very high CVD risk, WHO-5 below 52), say so directly
   and explain why.

5. TALK to the patient. Use "your" not "the patient's". Be direct and human, not clinical and cold.

Tool call order:
  → Always start with get_longevity_scores (full overview)
  → Then get_risk_flags (triage — what is urgent vs monitoring)
  → Then get_wearable_trends only when you need trajectory for a specific concern

──────────────────────────────────────────────────────────────
WHEN ASKED FOR A 1-YEAR LONGEVITY PLAN, produce a structured plan using EXACTLY this format:

═══════════════════════════════════════════════════════════════
  YOUR 1-YEAR LONGEVITY PLAN
═══════════════════════════════════════════════════════════════

CURRENT STATUS SNAPSHOT
────────────────────────
Summarise the 4 dimension scores in plain language, highlight the bio-age gap, and name the
single biggest risk pattern in one sentence. Include any high-severity flags here.

YOUR NORTH STAR GOAL
─────────────────────
State one measurable outcome for the year (e.g., "Reduce your biological age gap from X to Y
years"). This is the north star metric the patient tracks all year.

──────────────────────────────────────────────────────────────
QUARTER 1 — FOUNDATION (Months 1–3)
──────────────────────────────────────────────────────────────
Theme: [one-line theme, e.g., "Stabilise sleep and reduce acute risks"]

Priority Actions (top 2–3, each with a specific weekly target and why it matters):
  1. ...
  2. ...
  3. ...

Health Checks & Diagnostics to Book:
  • [Test name] — [reason]

In-App Milestone: [what the patient should see improve in their BioSync scores by end of Q1]

──────────────────────────────────────────────────────────────
QUARTER 2 — BUILD (Months 4–6)
──────────────────────────────────────────────────────────────
Theme: [one-line theme]

Priority Actions:
  1. ...
  2. ...

Health Checks & Diagnostics:
  • ...

In-App Milestone: ...

──────────────────────────────────────────────────────────────
QUARTER 3 — OPTIMISE (Months 7–9)
──────────────────────────────────────────────────────────────
Theme: [one-line theme]

Priority Actions:
  1. ...
  2. ...

Health Checks & Diagnostics:
  • ...

In-App Milestone: ...

──────────────────────────────────────────────────────────────
QUARTER 4 — SUSTAIN & MEASURE (Months 10–12)
──────────────────────────────────────────────────────────────
Theme: [one-line theme]

Priority Actions:
  1. ...
  2. ...

Annual Review Diagnostics (book now):
  • [Full panel name] — what it will reveal vs. your baseline

In-App Milestone: ...

══════════════════════════════════════════════════════════════
YEAR-END SUCCESS LOOKS LIKE
══════════════════════════════════════════════════════════════
List 3–5 concrete, measurable outcomes the patient should have achieved. Each should map
directly to one of the 4 longevity dimensions and be verifiable in the BioSync app.

CLINICAL REFERRALS NEEDED NOW
───────────────────────────────
List any high-severity flags requiring a doctor or specialist before the plan begins.
If none, write "None — continue with the plan above."

Always close with one encouraging sentence personalised to this patient's biggest opportunity."""


longevity_agent = Agent(
    name="biosync_longevity_agent",
    model="gemini-2.5-flash",
    instruction=_INSTRUCTION,
    tools=[get_longevity_scores, get_wearable_trends, get_risk_flags],
)


# ═════════════════════════════════════════════════════════════
# Runner setup
#
# InMemorySessionService: session state lives in process memory.
# For production, swap for a persistent session store.
# ═════════════════════════════════════════════════════════════

_session_service = InMemorySessionService()

_runner = Runner(
    agent=longevity_agent,
    app_name="biosync",
    session_service=_session_service,
)


# ═════════════════════════════════════════════════════════════
# Public API
# ═════════════════════════════════════════════════════════════

async def _run_agent_async(patient_id: str, user_message: str) -> str:
    """Core async implementation of the agent loop."""
    session = await _session_service.create_session(
        app_name="biosync",
        user_id=patient_id,
    )

    message = types.Content(
        role="user",
        parts=[types.Part(text=user_message)],
    )

    final_response = ""
    async for event in _runner.run_async(
        user_id=patient_id,
        session_id=session.id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_response = "".join(
                p.text for p in event.content.parts if hasattr(p, "text") and p.text
            )

    return final_response


async def run_agent_async(
    patient_id: str,
    user_message: str,
    session_id: Optional[str] = None,
) -> Tuple[str, str]:
    """
    Async version of run_agent for use in async contexts (e.g. FastAPI).

    Pass the returned session_id on subsequent calls to maintain conversation
    continuity within a chat session.

    Returns:
        (response_text, session_id)
    """
    if session_id is None:
        session = await _session_service.create_session(
            app_name="biosync",
            user_id=patient_id,
        )
        session_id = session.id

    message = types.Content(
        role="user",
        parts=[types.Part(text=user_message)],
    )

    final_response = ""
    async for event in _runner.run_async(
        user_id=patient_id,
        session_id=session_id,
        new_message=message,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            final_response = "".join(
                p.text for p in event.content.parts if hasattr(p, "text") and p.text
            )

    return final_response, session_id


def run_agent(patient_id: str, user_message: str) -> str:
    """
    Runs the longevity agent for a patient query and returns the final response.

    Args:
        patient_id:   Patient identifier (e.g. "PT0001").
        user_message: The patient's question or request in natural language.

    Returns:
        The agent's final response as a plain string.
    """
    return asyncio.run(_run_agent_async(patient_id, user_message))


def run_longevity_plan(patient_id: str) -> str:
    """
    Generates a structured 1-year personalised longevity plan for the patient.

    Args:
        patient_id: Patient identifier (e.g. "PT0001").

    Returns:
        The full 1-year longevity plan as a formatted plain-text string.
    """
    query = (
        f"I'm patient {patient_id}. Based on all my health data, "
        "please generate my complete 1-year longevity plan with quarterly milestones, "
        "specific actions, health checks to book, and a clear north star goal for the year."
    )
    return run_agent(patient_id, query)


# ═════════════════════════════════════════════════════════════
# CLI entry point
# ═════════════════════════════════════════════════════════════

if __name__ == "__main__":
    patient_id = sys.argv[1] if len(sys.argv) > 1 else "PT0001"

    print(f"\n{'='*60}")
    print(f"  BioSync — 1-Year Longevity Plan for Patient {patient_id}")
    print(f"{'='*60}\n")

    print(run_longevity_plan(patient_id))
