import { Button } from "@/components/ui/button";
import { CheckCircle, HelpCircle, RefreshCw } from "lucide-react";

interface ProofButtonsProps {
  onGotIt: () => void;
  onNotSure: () => void;
  onCheckMe: () => void;
  disabled?: boolean;
}

export const ProofButtons = ({ 
  onGotIt, 
  onNotSure, 
  onCheckMe,
  disabled = false 
}: ProofButtonsProps) => {
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={onGotIt}
        disabled={disabled}
        className="text-xs"
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        Got it
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onNotSure}
        disabled={disabled}
        className="text-xs text-muted-foreground"
      >
        <HelpCircle className="h-3 w-3 mr-1" />
        Not sure
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCheckMe}
        disabled={disabled}
        className="text-xs text-muted-foreground"
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Check me
      </Button>
    </div>
  );
};
