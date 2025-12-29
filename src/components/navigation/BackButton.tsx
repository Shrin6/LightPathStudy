import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface BackButtonProps {
  label?: string;
  fallbackPath?: string;
  onClick?: () => void;
  className?: string;
}

export function BackButton({ 
  label = "Back", 
  fallbackPath = "/dashboard",
  onClick,
  className 
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
      return;
    }
    
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className={className}
      data-testid="button-back"
    >
      <ArrowLeft className="h-4 w-4 mr-1.5" />
      {label}
    </Button>
  );
}
