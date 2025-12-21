import { Button } from "@/components/ui/button";
import { CheckCircle, HelpCircle } from "lucide-react";

interface ProofButtonsProps {
  onCheckUnderstanding: () => void;
  onNotSure: () => void;
  disabled?: boolean;
}

export const ProofButtons = ({ 
  onCheckUnderstanding, 
  onNotSure, 
  disabled = false 
}: ProofButtonsProps) => {
  return (
    <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
      <Button
        variant="outline"
        size="sm"
        onClick={onCheckUnderstanding}
        disabled={disabled}
        className="flex-1 text-xs"
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Check my understanding
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onNotSure}
        disabled={disabled}
        className="flex-1 text-xs text-muted-foreground"
      >
        <HelpCircle className="h-3 w-3 mr-1" />
        I'm not sure
      </Button>
    </div>
  );
};
