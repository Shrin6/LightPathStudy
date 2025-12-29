import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  to?: string;
  label?: string;
  className?: string;
}

export function BackButton({ to, label = "Back", className }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={cn("gap-1 text-muted-foreground hover:text-foreground h-7 px-2", className)}
      data-testid="button-back"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <span className="text-xs">{label}</span>
    </Button>
  );
}
