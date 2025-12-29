import { ChevronRight, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  loading?: boolean;
}

export function Breadcrumbs({ items, className, loading }: BreadcrumbsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <nav className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)} data-testid="breadcrumbs-loading">
        <span className="animate-pulse">Loading...</span>
      </nav>
    );
  }

  const allItems: BreadcrumbItem[] = [
    { label: "Home", path: "/" },
    ...items,
  ];

  const handleClick = (item: BreadcrumbItem, isLast: boolean) => {
    if (isLast) return;
    if (item.onClick) {
      item.onClick();
    } else if (item.path) {
      navigate(item.path);
    }
  };

  return (
    <nav 
      className={cn("flex items-center gap-1 text-xs text-muted-foreground flex-wrap", className)} 
      aria-label="Breadcrumb"
      data-testid="breadcrumbs"
    >
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const isFirst = index === 0;

        return (
          <span key={index} className="flex items-center gap-1">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 flex-shrink-0" />
            )}
            {isFirst ? (
              <button
                onClick={() => handleClick(item, isLast)}
                className={cn(
                  "flex items-center gap-1 transition-colors",
                  !isLast && "hover:text-foreground cursor-pointer"
                )}
                disabled={isLast}
                data-testid="breadcrumb-home"
              >
                <Home className="h-3 w-3" />
                <span className="hidden sm:inline">Home</span>
              </button>
            ) : (
              <button
                onClick={() => handleClick(item, isLast)}
                className={cn(
                  "transition-colors max-w-[120px] sm:max-w-[180px] truncate",
                  isLast 
                    ? "text-foreground font-medium cursor-default" 
                    : "hover:text-foreground cursor-pointer"
                )}
                disabled={isLast}
                data-testid={`breadcrumb-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
