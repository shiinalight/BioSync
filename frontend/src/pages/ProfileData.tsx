import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Activity, Heart, Droplets, Brain, Dumbbell, UtensilsCrossed } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  const handleFileChange = (key: keyof FileUploads) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const handleGenerateProfile = () => {
    toast({
      title: "Profile Generated",
      description: "Your unified health profile has been created successfully.",
    });
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
          Unified Health Profile Builder
        </h1>
        <p className="text-muted-foreground mt-1">
          Upload structured health data, add manual entries, and attach external documents into a unified profile.
        </p>
      </div>

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
              { key: "ehrCSV" as const, label: "EHR CSV", accept: ".csv", icon: FileText },
              { key: "wearableCSV" as const, label: "Wearable CSV", accept: ".csv", icon: Activity },
              { key: "lifestyleCSV" as const, label: "Lifestyle CSV", accept: ".csv", icon: Heart },
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
          Generate Unified Profile
        </Button>
        <Button variant="outline" onClick={handleDownloadJSON} className="px-6">
          Download JSON
        </Button>
      </div>
    </div>
  );
}
