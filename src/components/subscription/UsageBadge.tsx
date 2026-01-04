import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles } from "lucide-react";

interface UsageBadgeProps {
  subscribed: boolean;
  questionsRemaining: number | null;
  onClick?: () => void;
}

export function UsageBadge({ subscribed, questionsRemaining, onClick }: UsageBadgeProps) {
  if (subscribed) {
    return (
      <Badge 
        variant="secondary" 
        className="gap-1 cursor-pointer bg-gradient-to-r from-yellow-500/20 to-amber-500/20 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/30"
        onClick={onClick}
      >
        <Crown className="h-3 w-3" />
        Pro
      </Badge>
    );
  }

  const isLow = questionsRemaining !== null && questionsRemaining <= 5;

  return (
    <Badge 
      variant={isLow ? "destructive" : "outline"} 
      className="gap-1 cursor-pointer"
      onClick={onClick}
    >
      <Sparkles className="h-3 w-3" />
      {questionsRemaining} left
    </Badge>
  );
}
