import { Button } from "@/components/ui/button";
import { Sparkles, Home, BookOpen, LayoutDashboard, Settings, LogOut, Menu, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  onSignOut?: () => void;
  userEmail?: string;
  rightHeaderContent?: React.ReactNode;
}

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: BookOpen, label: "Study", path: "/study" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppShell({ children, onSignOut, userEmail, rightHeaderContent }: AppShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const currentPath = location.pathname;

  return (
    <div className="min-h-screen bg-background flex">
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-56 bg-sidebar border-r transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="h-12 flex items-center gap-2 px-4 border-b">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold">Lightpath Study</span>
            <Button 
              variant="ghost" 
              size="icon" 
              className="ml-auto md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <nav className="flex-1 p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = currentPath === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-sidebar-accent text-sidebar-accent-foreground" 
                      : "text-muted-foreground hover-elevate"
                  )}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          
          <div className="p-3 border-t space-y-2">
            {userEmail && (
              <div className="px-3 py-2 text-xs text-muted-foreground truncate">
                {userEmail}
              </div>
            )}
            {onSignOut && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start gap-2"
                onClick={onSignOut}
                data-testid="button-sign-out"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </aside>
      
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={() => navigate("/")}
              data-testid="button-home"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            {rightHeaderContent}
          </div>
        </header>
        
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
