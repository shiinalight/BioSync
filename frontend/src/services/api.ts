import type { AllScoresResult } from "@/types/health";

const BASE = "/api";

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${path} failed (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch all four scores for a specific patient. */
export function getScores(patientId: string): Promise<AllScoresResult> {
  return get<AllScoresResult>(`/scores/all?patient_id=${encodeURIComponent(patientId)}`);
}

/** Fetch the full list of patient IDs. */
export function getPatients(): Promise<{ patient_ids: string[] }> {
  return get<{ patient_ids: string[] }>("/patients");
}
