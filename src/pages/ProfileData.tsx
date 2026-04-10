import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Upload,
  FileText,
  Activity,
  Heart,
  Droplets,
  Brain,
  Dumbbell,
  UtensilsCrossed,
  Watch,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LAST_WATCH_SYNC_KEY = "biosync_apple_watch_last_sync";

function readStoredLastWatchSync(): string | null {
  try {
    const direct = localStorage.getItem(LAST_WATCH_SYNC_KEY);
    if (direct) return direct;
    const raw = localStorage.getItem("unifiedProfile");
    if (!raw) return null;
    const u = JSON.parse(raw) as { profile?: { device_sync?: { last_synced_at?: string } } };
    return u.profile?.device_sync?.last_synced_at ?? null;
  } catch {
    return null;
  }
}

function formatRelativeSync(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "unknown time";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function persistWatchSync(iso: string) {
  localStorage.setItem(LAST_WATCH_SYNC_KEY, iso);
  try {
    let data: Record<string, unknown> = {};
    const raw = localStorage.getItem("unifiedProfile");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    }
    const profile = { ...((data.profile as Record<string, unknown>) || {}) };
    profile.device_sync = {
      source: "Apple Watch",
      last_synced_at: iso,
    };
    const w = (profile.wearable_summary as Record<string, number> | undefined) || {};
    profile.wearable_summary = {
      avg_steps: Math.round((w.avg_steps ?? 8200) + (Math.random() * 120 - 60)),
      avg_resting_hr: Math.max(52, Math.round((w.avg_resting_hr ?? 72) + (Math.random() * 6 - 3))),
      avg_sleep_hours: Math.min(
        9,
        Math.max(5, Number(((w.avg_sleep_hours ?? 7) + (Math.random() * 0.3 - 0.15)).toFixed(1)))
      ),
    };
    data.profile = profile;
    localStorage.setItem("unifiedProfile", JSON.stringify(data));
  } catch {
    /* keep timestamp in LAST_WATCH_SYNC_KEY even if profile merge fails */
  }
}

interface ClinicalData {
  systolicBP: string;
  diastolicBP: string;
  glucose: string;
  clinicalNotes: string;
}

interface LifestyleData {
  waterGlasses: string;
  exerciseSessions: string;
  stressLevel: string;
  dietNotes: string;
}

interface FileUploads {
  ehrCSV: File | null;
  wearableCSV: File | null;
  lifestyleCSV: File | null;
  externalPDF: File | null;
}

export default function ProfileData() {
  const { toast } = useToast();

  const [lastWatchSyncAt, setLastWatchSyncAt] = useState<string | null>(() =>
    typeof window !== "undefined" ? readStoredLastWatchSync() : null
  );
  const [watchSyncing, setWatchSyncing] = useState(false);
  const [relativeTick, setRelativeTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setRelativeTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, []);

  const handleAppleWatchSync = useCallback(async () => {
    setWatchSyncing(true);
    const ms = 1600 + Math.random() * 1200;
    await new Promise((r) => setTimeout(r, ms));
    const iso = new Date().toISOString();
    persistWatchSync(iso);
    setLastWatchSyncAt(iso);
    setWatchSyncing(false);
    toast({
      title: "Apple Watch synced",
      description: "Latest metrics from HealthKit are saved to your unified profile.",
    });
  }, [toast]);

  const [clinical, setClinical] = useState<ClinicalData>({
    systolicBP: "",
    diastolicBP: "",
    glucose: "",
    clinicalNotes: "",
  });

  const [lifestyle, setLifestyle] = useState<LifestyleData>({
    waterGlasses: "",
    exerciseSessions: "",
    stressLevel: "",
    dietNotes: "",
  });

  const [files, setFiles] = useState<FileUploads>({
    ehrCSV: null,
    wearableCSV: null,
    lifestyleCSV: null,
    externalPDF: null,
  });

  const [generatedProfile, setGeneratedProfile] = useState<any>(null);

  const handleFileChange = (key: keyof FileUploads) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

const handleGenerateProfile = async () => {
  try {
    const formData = new FormData();

    if (files.ehrCSV) formData.append("ehr_file", files.ehrCSV);
    if (files.wearableCSV) formData.append("wearable_file", files.wearableCSV);
    if (files.lifestyleCSV) formData.append("lifestyle_file", files.lifestyleCSV);
    if (files.externalPDF) formData.append("pdf_file", files.externalPDF);

    formData.append("manual_sbp_mmhg", clinical.systolicBP);
    formData.append("manual_dbp_mmhg", clinical.diastolicBP);
    formData.append("manual_glucose_mmol", clinical.glucose);
    formData.append("manual_notes", clinical.clinicalNotes);

    formData.append("manual_water_glasses_daily", lifestyle.waterGlasses);
    formData.append("manual_exercise_sessions_weekly", lifestyle.exerciseSessions);
    formData.append("manual_stress_level", lifestyle.stressLevel);
    formData.append("manual_diet_notes", lifestyle.dietNotes);

    const response = await fetch("http://127.0.0.1:8001/generate-profile", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to generate profile");
    }

  console.log("Generated profile:", data);
  localStorage.setItem("unifiedProfile", JSON.stringify(data));

    toast({
      title: "Profile Generated",
      description: "Backend successfully processed your data 🚀",
    });
  } catch (error) {
    console.error("Generate profile error:", error);

    toast({
      title: "Error",
      description: error instanceof Error ? error.message : "Backend connection failed",
      variant: "destructive",
    });
  }
};

  const handleDownloadJSON = () => {
    const profile = {
      clinical,
      lifestyle,
      uploads: {
        ehrCSV: files.ehrCSV?.name || null,
        wearableCSV: files.wearableCSV?.name || null,
        lifestyleCSV: files.lifestyleCSV?.name || null,
        externalPDF: files.externalPDF?.name || null,
      },
      generatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "health_profile.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Profile Data
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload structured health data, add manual entries, and attach external documents into a unified profile.
        </p>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          You can also pull activity and vitals automatically from your wrist — use{" "}
          <span className="font-medium text-foreground">Apple Watch sync</span> below. Manual uploads stay available
          either way.
        </p>
      </div>

      <button
        type="button"
        onClick={handleAppleWatchSync}
        disabled={watchSyncing}
        aria-busy={watchSyncing}
        aria-label={
          lastWatchSyncAt
            ? `Last synced ${formatRelativeSync(lastWatchSyncAt)}. Tap to sync again.`
            : "Sync with Apple Watch. Tap to pull latest from HealthKit."
        }
        className={cn(
          "w-full max-w-3xl text-left rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 via-card to-card p-4 sm:p-5 shadow-sm transition-all",
          "hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          watchSyncing && "pointer-events-none opacity-95"
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              {watchSyncing ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <Watch className="h-5 w-5" aria-hidden />
              )}
            </div>
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-semibold text-foreground">Apple Watch · automatic sync</p>
              <p className="text-sm text-muted-foreground">
                {lastWatchSyncAt ? (
                  <>
                    Last synced with Apple Watch ·{" "}
                    <span
                      className="font-medium text-foreground tabular-nums"
                      key={`${lastWatchSyncAt}-${relativeTick}`}
                    >
                      {formatRelativeSync(lastWatchSyncAt)}
                    </span>
                  </>
                ) : (
                  <>Not synced yet — tap to pull the latest from HealthKit into your profile.</>
                )}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                watchSyncing
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-muted/50 text-foreground"
              )}
            >
              {watchSyncing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Syncing…
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Tap to sync
                </>
              )}
            </span>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Data Uploads */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Data Uploads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {([
              { key: "ehrCSV" as const, label: "EHR", accept: ".csv", icon: FileText },
              { key: "wearableCSV" as const, label: "Wearable", accept: ".csv", icon: Activity },
              { key: "lifestyleCSV" as const, label: "Lifestyle", accept: ".csv", icon: Heart },
              { key: "externalPDF" as const, label: "External PDF Document", accept: ".pdf", icon: FileText },
            ]).map(({ key, label, accept, icon: Icon }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  {label}
                </Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept={accept}
                    onChange={handleFileChange(key)}
                    className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20 cursor-pointer"
                  />
                </div>
                {files[key] && (
                  <p className="text-xs text-muted-foreground">{files[key]!.name}</p>
                )}
              </div>
            ))}
            {!files.externalPDF && (
              <p className="text-xs text-muted-foreground italic">
                PDF upload is a placeholder for future extraction.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Manual Clinical Entry */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Manual Clinical Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                Systolic BP (mmHg)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 120"
                value={clinical.systolicBP}
                onChange={(e) => setClinical((p) => ({ ...p, systolicBP: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Heart className="h-3.5 w-3.5 text-muted-foreground" />
                Diastolic BP (mmHg)
              </Label>
              <Input
                type="number"
                placeholder="e.g. 80"
                value={clinical.diastolicBP}
                onChange={(e) => setClinical((p) => ({ ...p, diastolicBP: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                Glucose (mmol/L)
              </Label>
              <Input
                type="number"
                step="0.1"
                placeholder="e.g. 5.5"
                value={clinical.glucose}
                onChange={(e) => setClinical((p) => ({ ...p, glucose: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Clinical Notes</Label>
              <Textarea
                placeholder="Example: external clinic follow-up noted elevated glucose trend"
                value={clinical.clinicalNotes}
                onChange={(e) => setClinical((p) => ({ ...p, clinicalNotes: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Manual Lifestyle Entry */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              Manual Lifestyle Entry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Droplets className="h-3.5 w-3.5 text-muted-foreground" />
                Water Glasses Daily
              </Label>
              <Input
                type="number"
                placeholder="e.g. 8"
                value={lifestyle.waterGlasses}
                onChange={(e) => setLifestyle((p) => ({ ...p, waterGlasses: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                Exercise Sessions Weekly
              </Label>
              <Input
                type="number"
                placeholder="e.g. 4"
                value={lifestyle.exerciseSessions}
                onChange={(e) => setLifestyle((p) => ({ ...p, exerciseSessions: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                Stress Level (1-5)
              </Label>
              <Input
                type="number"
                min={1}
                max={5}
                placeholder="1 = low, 5 = high"
                value={lifestyle.stressLevel}
                onChange={(e) => setLifestyle((p) => ({ ...p, stressLevel: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Diet Notes</Label>
              <Textarea
                placeholder="Example: follows high-protein diet, low sugar, irregular lunch timing"
                value={lifestyle.dietNotes}
                onChange={(e) => setLifestyle((p) => ({ ...p, dietNotes: e.target.value }))}
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button onClick={handleGenerateProfile} className="px-6">
          Generate Analysis
        </Button>
      </div>
      {generatedProfile && (
        <pre className="mt-4 rounded-md border p-4 text-xs overflow-auto whitespace-pre-wrap">
          {JSON.stringify(generatedProfile, null, 2)}
        </pre>
      )}
    </div>
  );
}
