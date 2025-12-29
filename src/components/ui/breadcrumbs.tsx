import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav 
      aria-label="Breadcrumb" 
      className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}
      data-testid="breadcrumbs"
    >
      <Link 
        to="/" 
        className="flex items-center gap-1 hover:text-foreground transition-colors"
        data-testid="breadcrumb-home"
      >
        <Home className="h-3 w-3" />
        <span className="hidden sm:inline">Home</span>
      </Link>
      
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        
        return (
          <span key={index} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
            {isLast || !item.href ? (
              <span 
                className={cn(
                  "max-w-[120px] sm:max-w-[200px] truncate",
                  isLast ? "text-foreground font-medium" : ""
                )}
                data-testid={`breadcrumb-${index}`}
              >
                {item.label}
              </span>
            ) : (
              <Link 
                to={item.href} 
                className="max-w-[120px] sm:max-w-[200px] truncate hover:text-foreground transition-colors"
                data-testid={`breadcrumb-${index}`}
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
