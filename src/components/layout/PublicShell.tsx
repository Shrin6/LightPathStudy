import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PublicShellProps {
  children: React.ReactNode;
}

export function PublicShell({ children }: PublicShellProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto h-full flex items-center justify-between px-4">
          <button 
            onClick={() => navigate("/")} 
            className="flex items-center gap-2 hover-elevate rounded-md px-2 py-1"
            data-testid="link-home-logo"
          >
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="font-semibold text-lg">Lightpath Study</span>
          </button>
          
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-features">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-how-it-works">
              How it works
            </a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="link-alpha">
              Alpha Access
            </a>
          </nav>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate("/auth")}
              data-testid="button-sign-in"
            >
              Sign In
            </Button>
            <Button 
              size="sm" 
              onClick={() => navigate("/auth")}
              data-testid="button-try-alpha"
            >
              Try Alpha
            </Button>
          </div>
        </div>
      </header>
      
      <main className="flex-1">
        {children}
      </main>
      
      <footer className="py-6 px-4 border-t border-border bg-muted/30">
        <div className="container mx-auto flex flex-col gap-4 text-sm text-muted-foreground">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span>Lightpath Study</span>
            </div>
            <nav className="flex items-center gap-4" data-testid="footer-nav">
              <button
                onClick={() => navigate("/")}
                className="hover:text-foreground transition-colors"
                data-testid="footer-link-home"
              >
                Home
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="hover:text-foreground transition-colors"
                data-testid="footer-link-dashboard"
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate("/study")}
                className="hover:text-foreground transition-colors"
                data-testid="footer-link-study"
              >
                Study
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="hover:text-foreground transition-colors"
                data-testid="footer-link-settings"
              >
                Settings
              </button>
            </nav>
          </div>
          <p className="text-center sm:text-left">Your patient, personal AI study companion.</p>
        </div>
      </footer>
    </div>
  );
}
