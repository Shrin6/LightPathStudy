import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Menu, LayoutDashboard } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Breadcrumbs, BreadcrumbItem } from "@/components/ui/breadcrumbs";
import lightpathLogo from "@/assets/lightpath-logo.png";

interface TopBarProps {
  session: Session | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  collectionName?: string | null;
  modeName?: string | null;
}

export const TopBar = ({ 
  session, 
  sidebarOpen, 
  setSidebarOpen,
  collectionName,
  modeName
}: TopBarProps) => {
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

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Dashboard", href: "/dashboard" },
  ];
  
  if (collectionName) {
    breadcrumbItems.push({ label: collectionName, href: "/study" });
  }
  
  if (modeName) {
    breadcrumbItems.push({ label: modeName });
  }

  return (
    <header className="h-12 border-b bg-card flex items-center justify-between px-3 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          data-testid="button-sidebar-toggle"
        >
          <Menu className="h-4 w-4" />
        </Button>
        
        <div className="flex items-center gap-2 shrink-0">
          <img 
            src={lightpathLogo} 
            alt="Lightpath Study" 
            className="w-6 h-6 rounded"
          />
          <span className="font-semibold text-sm hidden sm:block">LightPath</span>
        </div>
        
        <div className="hidden md:block border-l pl-3 ml-2">
          <Breadcrumbs items={breadcrumbItems} />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/dashboard")}
          className="h-8 gap-1.5"
          data-testid="button-dashboard"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline text-xs">Dashboard</span>
        </Button>
        
        {session?.user?.email && (
          <span className="text-xs text-muted-foreground hidden lg:block max-w-[120px] truncate">
            {session.user.email}
          </span>
        )}
        
        {session && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSignOut}
            className="h-8 gap-1.5"
            data-testid="button-signout"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Sign Out</span>
          </Button>
        )}
      </div>
    </header>
  );
};
