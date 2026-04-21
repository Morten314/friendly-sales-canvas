import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { whatsNew } from "./cohortData";

const STORAGE_KEY = "strategistWhatsNewDismissed";

const StrategistWhatsNewBanner = () => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex items-start gap-3 px-3 py-2 rounded-md border border-primary/20 bg-primary/5">
      <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-foreground">
          {whatsNew.newCohortsCount} new cohort{whatsNew.newCohortsCount !== 1 ? "s" : ""} since your last visit
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{whatsNew.summary}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 -mt-0.5 -mr-1 shrink-0"
        onClick={handleDismiss}
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default StrategistWhatsNewBanner;
