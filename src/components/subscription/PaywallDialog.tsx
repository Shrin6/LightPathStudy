import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap } from "lucide-react";

interface PaywallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubscribe: () => void;
  questionsUsed: number;
}

export function PaywallDialog({ open, onOpenChange, onSubscribe, questionsUsed }: PaywallDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Crown className="h-6 w-6 text-yellow-500" />
            <DialogTitle>Upgrade to Pro</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            You've used all {questionsUsed} free questions. Upgrade to Pro for unlimited access to all study tools.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              LightPath Pro - $9.99/month
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>✓ Unlimited questions across all study tools</li>
              <li>✓ AI Tutor, Quizzes, Flashcards, Worksheets</li>
              <li>✓ Memory tricks & Notes generation</li>
              <li>✓ Priority support</li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Maybe later
          </Button>
          <Button onClick={onSubscribe} className="gap-2">
            <Crown className="h-4 w-4" />
            Subscribe Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
