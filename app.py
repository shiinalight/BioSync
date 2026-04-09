from fastapi import FastAPI, UploadFile, File, Form
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import shutil
import os

from pipeline_logic import build_unified_profile

app = FastAPI()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
def home():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return f.read()


@app.post("/generate-profile")
async def generate_profile(
    ehr_file: UploadFile | None = File(None),
    wearable_file: UploadFile | None = File(None),
    lifestyle_file: UploadFile | None = File(None),
    pdf_file: UploadFile | None = File(None),

    manual_sbp_mmhg: str = Form(""),
    manual_dbp_mmhg: str = Form(""),
    manual_glucose_mmol: str = Form(""),
    manual_notes: str = Form(""),

    manual_water_glasses_daily: str = Form(""),
    manual_exercise_sessions_weekly: str = Form(""),
    manual_stress_level: str = Form(""),
    manual_diet_notes: str = Form("")
):
    ehr_path = None
    wearable_path = None
    lifestyle_path = None
    uploaded_pdf_name = None

    if ehr_file and ehr_file.filename:
        ehr_path = os.path.join(UPLOAD_DIR, ehr_file.filename)
        with open(ehr_path, "wb") as f:
            shutil.copyfileobj(ehr_file.file, f)

    if wearable_file and wearable_file.filename:
        wearable_path = os.path.join(UPLOAD_DIR, wearable_file.filename)
        with open(wearable_path, "wb") as f:
            shutil.copyfileobj(wearable_file.file, f)

    if lifestyle_file and lifestyle_file.filename:
        lifestyle_path = os.path.join(UPLOAD_DIR, lifestyle_file.filename)
        with open(lifestyle_path, "wb") as f:
            shutil.copyfileobj(lifestyle_file.file, f)

    if pdf_file and pdf_file.filename:
        pdf_path = os.path.join(UPLOAD_DIR, pdf_file.filename)
        with open(pdf_path, "wb") as f:
            shutil.copyfileobj(pdf_file.file, f)
        uploaded_pdf_name = pdf_file.filename

    manual_clinical = {
        "manual_sbp_mmhg": manual_sbp_mmhg,
        "manual_dbp_mmhg": manual_dbp_mmhg,
        "manual_glucose_mmol": manual_glucose_mmol,
        "manual_notes": manual_notes
    }

    manual_lifestyle = {
        "manual_water_glasses_daily": manual_water_glasses_daily,
        "manual_exercise_sessions_weekly": manual_exercise_sessions_weekly,
        "manual_stress_level": manual_stress_level,
        "manual_diet_notes": manual_diet_notes
    }

    has_any_input = any([
        ehr_path,
        wearable_path,
        lifestyle_path,
        uploaded_pdf_name,
        any(v.strip() for v in manual_clinical.values() if isinstance(v, str)),
        any(v.strip() for v in manual_lifestyle.values() if isinstance(v, str)),
    ])

    if not has_any_input:
        return JSONResponse(
            status_code=400,
            content={"error": "Please upload at least one file or enter manual data."}
        )

    try:
        profile = build_unified_profile(
            ehr_file=ehr_path,
            wear_file=wearable_path,
            life_file=lifestyle_path,
            manual_clinical=manual_clinical,
            manual_lifestyle=manual_lifestyle,
            uploaded_pdf_name=uploaded_pdf_name
        )
        return JSONResponse(content={"profile": profile})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})