import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ReportFeature = "quiz" | "worksheet" | "flashcards" | "tutor" | "tutor_message";

export interface ReportPayload {
  feature: ReportFeature;
  collection_id?: string | null;
  question_id?: string;
  question_index?: number;
  question_text?: string;
  user_answer?: string;
  correct_answer?: string;
  explanation?: string;
  raw_ai_output?: string;
  displayed_content?: string;
  model_name?: string;
  source_file_ids?: string[];
  // For tutor_message reports
  content_type?: string;
  content_id?: string;
  content_text?: string;
}

interface ReportDialogProps {
  feature: ReportFeature;
  payload: ReportPayload;
  trigger?: React.ReactNode;
  variant?: "ghost" | "outline" | "default";
  size?: "default" | "sm" | "icon";
}

const REPORT_REASONS = [
  { value: "wrong_answer", label: "Wrong answer / Incorrect explanation" },
  { value: "confusing", label: "Confusing / Unclear" },
  { value: "off_topic", label: "Off-topic / Not based on my material" },
  { value: "formatting", label: "Formatting / JSON broken" },
  { value: "inappropriate", label: "Inappropriate / Other" },
];

export const ReportDialog = ({ 
  feature, 
  payload, 
  trigger,
  variant = "ghost",
  size = "sm"
}: ReportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [includeData, setIncludeData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in");
        return;
      }

      // Build payload with size limits
      const reportPayload: Record<string, any> = {
        ...payload,
        timestamp: new Date().toISOString(),
        app_version: "1.0.0",
      };

      // Truncate large fields
      if (reportPayload.raw_ai_output) {
        reportPayload.raw_ai_output = reportPayload.raw_ai_output.substring(0, 2000);
      }
      if (reportPayload.displayed_content) {
        reportPayload.displayed_content = reportPayload.displayed_content.substring(0, 2000);
      }

      // Remove data if user unchecked
      if (!includeData) {
        delete reportPayload.raw_ai_output;
        delete reportPayload.displayed_content;
        delete reportPayload.user_answer;
      }

      const { error } = await supabase.from("content_reports").insert({
        user_id: user.id,
        collection_id: payload.collection_id || null,
        feature,
        reason,
        comment: comment || null,
        payload: reportPayload,
      });

      if (error) throw error;

      toast.success("Thanks — report saved.");
      setOpen(false);
      setReason("");
      setComment("");
      setIncludeData(true);
    } catch (error) {
      console.error("Error submitting report:", error);
      toast.error("Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant={variant} size={size} className="text-muted-foreground hover:text-destructive">
            <Flag className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Issue</DialogTitle>
          <DialogDescription>
            Help us improve by reporting problems with {feature} content.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">What's wrong? *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">Additional details (optional)</Label>
            <Textarea
              id="comment"
              placeholder="What went wrong?"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="includeData"
              checked={includeData}
              onCheckedChange={(checked) => setIncludeData(checked === true)}
            />
            <Label htmlFor="includeData" className="text-sm text-muted-foreground">
              Include content snippet for debugging
            </Label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !reason}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Report
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
