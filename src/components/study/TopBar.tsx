import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Menu, Home, Sparkles } from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface TopBarProps {
  session: Session | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const TopBar = ({ session, sidebarOpen, setSidebarOpen }: TopBarProps) => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  return (
    <header className="h-12 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center justify-between px-3 sticky top-0 z-50" data-testid="header-topbar">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          data-testid="button-toggle-sidebar"
        >
          <Menu className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm hidden sm:inline">Lightpath Study</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(session ? "/dashboard" : "/")}
          data-testid="button-home"
        >
          <Home className="h-4 w-4 mr-1.5" />
          <span className="hidden sm:inline">Home</span>
        </Button>
        {session?.user?.email && (
          <span className="text-xs text-muted-foreground hidden md:block max-w-[150px] truncate" data-testid="text-user-email">
            {session.user.email}
          </span>
        )}
        {session && (
          <Button variant="outline" size="sm" onClick={handleSignOut} data-testid="button-signout">
            <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        )}
      </div>
    </header>
  );
};
