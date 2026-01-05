import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface SaveSessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "quiz" | "worksheet" | "flashcards";
  collectionName: string;
  onSave: (sessionName: string) => Promise<void>;
  onSkip: () => void;
}

export const SaveSessionDialog = ({
  open,
  onOpenChange,
  mode,
  collectionName,
  onSave,
  onSkip,
}: SaveSessionDialogProps) => {
  const [sessionName, setSessionName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getModeLabel = () => {
    switch (mode) {
      case "quiz":
        return "quiz";
      case "worksheet":
        return "worksheet";
      case "flashcards":
        return "flashcards";
      default:
        return "study session";
    }
  };

  const handleSave = async () => {
    if (!sessionName.trim()) {
      toast.error("Please enter a session name");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(sessionName);
      toast.success("Session saved! You can return to it later.");
      setSessionName("");
      onOpenChange(false);
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = () => {
    onSkip();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save Your {getModeLabel()} Session?</DialogTitle>
          <DialogDescription className="space-y-3 pt-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
              <p>
                Save this session to come back to it later and avoid regenerating questions. This helps preserve your token usage!
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              Collection: <span className="font-medium text-foreground">{collectionName}</span>
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Session Name (optional)</label>
            <Input
              placeholder={`e.g., "Biology Chapter 5 Quiz"`}
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              disabled={isSaving}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSaving}
          >
            Skip for Now
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            Save Session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
