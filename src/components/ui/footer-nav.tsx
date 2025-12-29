import { Home, LayoutDashboard, BookOpen, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/study", icon: BookOpen, label: "Study" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface FooterNavProps {
  className?: string;
}

export function FooterNav({ className }: FooterNavProps) {
  const location = useLocation();

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 bg-card border-t z-40 md:hidden",
        className
      )}
      data-testid="footer-nav"
    >
      <div className="flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href !== "/" && location.pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 px-3 rounded-md transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
