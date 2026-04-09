import pandas as pd
import pdfplumber
import re
from datetime import datetime


def clean_value(value):
    if value is None:
        return None
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


def parse_int(value):
    if value is None or value == "":
        return None
    try:
        return int(value)
    except Exception:
        return None


def parse_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except Exception:
        return None


def get_first_row(df):
    if df is None or df.empty:
        return {}
    return df.iloc[0].to_dict()


def detect_patient_id(ehr_df=None, wear_df=None, life_df=None):
    for df in [ehr_df, wear_df, life_df]:
        if df is not None and not df.empty and "patient_id" in df.columns:
            val = df.iloc[0]["patient_id"]
            if pd.notna(val):
                return str(val)
    return "USER_001"


def extract_pdf_text(pdf_path):
    if not pdf_path:
        return ""

    text_parts = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception:
        return ""

    return "\n".join(text_parts)


def extract_first_number(pattern, text):
    match = re.search(pattern, text, flags=re.IGNORECASE)
    if not match:
        return None
    try:
        return float(match.group(1))
    except Exception:
        return None


def extract_pdf_metrics(pdf_text):
    if not pdf_text:
        return {}

    extracted = {
        "glucose_mmol_l": extract_first_number(r"glucose[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "hba1c_pct": extract_first_number(r"hba1c[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "crp_mg_l": extract_first_number(r"crp[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "cholesterol_mmol_l": extract_first_number(r"cholesterol[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "ldl_mmol_l": extract_first_number(r"ldl[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "hdl_mmol_l": extract_first_number(r"hdl[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "triglycerides_mmol_l": extract_first_number(r"triglycerides[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
        "egfr_ml_min": extract_first_number(r"egfr[:\s]+([0-9]+(?:\.[0-9]+)?)", pdf_text),
    }

    systolic = re.search(r"(?:blood pressure|bp)[:\s]+([0-9]{2,3})\s*/\s*([0-9]{2,3})", pdf_text, flags=re.IGNORECASE)
    if systolic:
        try:
            extracted["sbp_mmhg"] = int(systolic.group(1))
            extracted["dbp_mmhg"] = int(systolic.group(2))
        except Exception:
            extracted["sbp_mmhg"] = None
            extracted["dbp_mmhg"] = None
    else:
        extracted["sbp_mmhg"] = None
        extracted["dbp_mmhg"] = None

    return {k: v for k, v in extracted.items() if v is not None}


def build_unified_profile(
    ehr_file=None,
    wear_file=None,
    life_file=None,
    manual_clinical=None,
    manual_lifestyle=None,
    uploaded_pdf_name=None,
    pdf_path=None,
):
    ehr = pd.read_csv(ehr_file) if ehr_file else None
    wear = pd.read_csv(wear_file) if wear_file else None
    life = pd.read_csv(life_file) if life_file else None

    patient_id = detect_patient_id(ehr, wear, life)

    ehr_row = {}
    wear_summary_row = {}
    life_row = {}

    if ehr is not None and not ehr.empty:
        if "patient_id" in ehr.columns:
            ehr = ehr[ehr["patient_id"].astype(str) == patient_id]
        ehr_row = get_first_row(ehr)

    if wear is not None and not wear.empty:
        if "patient_id" in wear.columns:
            wear = wear[wear["patient_id"].astype(str) == patient_id]

        if not wear.empty:
            wear_summary = wear.groupby("patient_id").agg({
                "steps": "mean",
                "resting_hr_bpm": "mean",
                "sleep_duration_hrs": "mean",
                "spo2_avg_pct": "mean",
                "calories_burned_kcal": "mean",
                "hrv_rmssd_ms": "mean",
                "active_minutes": "mean",
                "sleep_quality_score": "mean"
            }).reset_index()

            wear_summary = wear_summary.rename(columns={
                "steps": "avg_steps",
                "resting_hr_bpm": "avg_resting_hr",
                "sleep_duration_hrs": "avg_sleep_duration",
                "spo2_avg_pct": "avg_spo2",
                "calories_burned_kcal": "avg_calories_burned",
                "hrv_rmssd_ms": "avg_hrv_rmssd",
                "active_minutes": "avg_active_minutes",
                "sleep_quality_score": "avg_sleep_quality"
            })

            wear_summary_row = get_first_row(wear_summary)

    if life is not None and not life.empty:
        if "patient_id" in life.columns:
            life = life[life["patient_id"].astype(str) == patient_id]
        life_row = get_first_row(life)

    manual_clinical = manual_clinical or {}
    manual_lifestyle = manual_lifestyle or {}

    pdf_text = extract_pdf_text(pdf_path) if pdf_path else ""
    pdf_extracted = extract_pdf_metrics(pdf_text)

    sources = []

    if ehr_file:
        sources.append({
            "type": "ehr_csv",
            "source_name": "uploaded_ehr_file",
            "ingested_at": datetime.utcnow().isoformat() + "Z"
        })

    if wear_file:
        sources.append({
            "type": "wearable_csv",
            "source_name": "uploaded_wearable_file",
            "ingested_at": datetime.utcnow().isoformat() + "Z"
        })

    if life_file:
        sources.append({
            "type": "lifestyle_csv",
            "source_name": "uploaded_lifestyle_file",
            "ingested_at": datetime.utcnow().isoformat() + "Z"
        })

    if uploaded_pdf_name:
        sources.append({
            "type": "pdf_document",
            "source_name": uploaded_pdf_name,
            "ingested_at": datetime.utcnow().isoformat() + "Z",
            "status": "extracted" if pdf_extracted else "uploaded_no_values_detected"
        })

    if any(v not in [None, ""] for v in manual_clinical.values()):
        sources.append({
            "type": "manual_clinical_entry",
            "source_name": "browser_form",
            "ingested_at": datetime.utcnow().isoformat() + "Z"
        })

    if any(v not in [None, ""] for v in manual_lifestyle.values()):
        sources.append({
            "type": "manual_lifestyle_entry",
            "source_name": "browser_form",
            "ingested_at": datetime.utcnow().isoformat() + "Z"
        })

    profile = {
        "patient_id": patient_id,
        "sources": sources,
        "demographics": {
            "age": clean_value(ehr_row.get("age")),
            "sex": clean_value(ehr_row.get("sex")),
            "country": clean_value(ehr_row.get("country")),
            "height_cm": clean_value(ehr_row.get("height_cm")),
            "weight_kg": clean_value(ehr_row.get("weight_kg")),
            "bmi": clean_value(ehr_row.get("bmi"))
        },
        "clinical": {
            "smoking_status": clean_value(ehr_row.get("smoking_status")),
            "alcohol_units_weekly": clean_value(ehr_row.get("alcohol_units_weekly")),
            "chronic_conditions": clean_value(ehr_row.get("chronic_conditions")),
            "medications": clean_value(ehr_row.get("medications")),
            "sbp_mmhg": clean_value(ehr_row.get("sbp_mmhg")),
            "dbp_mmhg": clean_value(ehr_row.get("dbp_mmhg")),
            "hba1c_pct": clean_value(ehr_row.get("hba1c_pct")),
            "fasting_glucose_mmol": clean_value(ehr_row.get("fasting_glucose_mmol")),
            "crp_mg_l": clean_value(ehr_row.get("crp_mg_l")),
            "egfr_ml_min": clean_value(ehr_row.get("egfr_ml_min"))
        },
        "wearable_summary": {
            "avg_steps": clean_value(wear_summary_row.get("avg_steps")),
            "avg_resting_hr": clean_value(wear_summary_row.get("avg_resting_hr")),
            "avg_sleep_duration": clean_value(wear_summary_row.get("avg_sleep_duration")),
            "avg_spo2": clean_value(wear_summary_row.get("avg_spo2")),
            "avg_calories_burned": clean_value(wear_summary_row.get("avg_calories_burned")),
            "avg_hrv_rmssd": clean_value(wear_summary_row.get("avg_hrv_rmssd")),
            "avg_active_minutes": clean_value(wear_summary_row.get("avg_active_minutes")),
            "avg_sleep_quality": clean_value(wear_summary_row.get("avg_sleep_quality"))
        },
        "lifestyle": {
            "survey_date": clean_value(life_row.get("survey_date")),
            "smoking_status": clean_value(life_row.get("smoking_status")),
            "alcohol_units_weekly": clean_value(life_row.get("alcohol_units_weekly")),
            "diet_quality_score": clean_value(life_row.get("diet_quality_score")),
            "fruit_veg_servings_daily": clean_value(life_row.get("fruit_veg_servings_daily")),
            "meal_frequency_daily": clean_value(life_row.get("meal_frequency_daily")),
            "exercise_sessions_weekly": clean_value(life_row.get("exercise_sessions_weekly")),
            "sedentary_hrs_day": clean_value(life_row.get("sedentary_hrs_day")),
            "stress_level": clean_value(life_row.get("stress_level")),
            "sleep_satisfaction": clean_value(life_row.get("sleep_satisfaction")),
            "mental_wellbeing_who5": clean_value(life_row.get("mental_wellbeing_who5")),
            "self_rated_health": clean_value(life_row.get("self_rated_health")),
            "water_glasses_daily": clean_value(life_row.get("water_glasses_daily"))
        },
        "manual_entries": {
            "clinical": {
                "manual_sbp_mmhg": parse_int(manual_clinical.get("manual_sbp_mmhg")),
                "manual_dbp_mmhg": parse_int(manual_clinical.get("manual_dbp_mmhg")),
                "manual_glucose_mmol": parse_float(manual_clinical.get("manual_glucose_mmol")),
                "manual_notes": manual_clinical.get("manual_notes") or None
            },
            "lifestyle": {
                "manual_water_glasses_daily": parse_int(manual_lifestyle.get("manual_water_glasses_daily")),
                "manual_exercise_sessions_weekly": parse_int(manual_lifestyle.get("manual_exercise_sessions_weekly")),
                "manual_stress_level": parse_int(manual_lifestyle.get("manual_stress_level")),
                "manual_diet_notes": manual_lifestyle.get("manual_diet_notes") or None
            }
        },
        "documents": [
            {
                "file_name": uploaded_pdf_name,
                "type": "pdf",
                "status": "extracted" if pdf_extracted else "uploaded_no_values_detected"
            }
        ] if uploaded_pdf_name else [],
        "pdf_extracted_data": pdf_extracted,
        "pdf_text_preview": pdf_text[:1000] if pdf_text else None
    }

    return profile