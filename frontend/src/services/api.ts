import type {
  HealthProfileRequest,
  AllScoresResult,
  CvRiskResult,
  LifestyleData,
  LifestyleResult,
  WearableData,
  SleepResult,
  ClinicalData,
  BioAgeResult,
} from "@/types/health";

const BASE = "/api";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Evaluate all four health scores in one call. */
export function evaluateAllScores(profile: HealthProfileRequest): Promise<AllScoresResult> {
  return post<AllScoresResult>("/scores/all", profile);
}

/** Framingham 10-year cardiovascular risk. */
export function evaluateCvRisk(clinical: ClinicalData): Promise<CvRiskResult> {
  return post<CvRiskResult>("/scores/cv-risk", clinical);
}

/** Composite lifestyle risk score. */
export function evaluateLifestyle(lifestyle: LifestyleData): Promise<LifestyleResult> {
  return post<LifestyleResult>("/scores/lifestyle", lifestyle);
}

/** Sleep & recovery score. */
export function evaluateSleep(wearable: WearableData): Promise<SleepResult> {
  return post<SleepResult>("/scores/sleep", wearable);
}

/** Biological age estimation. */
export function evaluateBioAge(profile: HealthProfileRequest): Promise<BioAgeResult> {
  return post<BioAgeResult>("/scores/bio-age", profile);
}

// ── localStorage helpers ──────────────────────────────────────────────────────
const SCORES_KEY = "biosync_health_scores";

export function saveScores(scores: AllScoresResult): void {
  localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
}

export function loadScores(): AllScoresResult | null {
  const raw = localStorage.getItem(SCORES_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AllScoresResult;
  } catch {
    return null;
  }
}

export function clearScores(): void {
  localStorage.removeItem(SCORES_KEY);
}
