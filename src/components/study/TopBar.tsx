import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LogOut, Menu, LayoutDashboard } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { AppBreadcrumbs, BreadcrumbItem } from "@/components/ui/app-breadcrumbs";
import lightpathLogo from "@/assets/lightpath-logo.png";
import { UsageBadge } from "@/components/subscription/UsageBadge";

interface TopBarProps {
  session: Session | null;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  collectionName?: string;
  modeName?: string;
  subscription?: {
    subscribed: boolean;
    questionsRemaining: number | null;
    openCheckout: () => void;
    openCustomerPortal: () => void;
  };
}

export const TopBar = ({ session, sidebarOpen, setSidebarOpen, collectionName, modeName, subscription }: TopBarProps) => {
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
    breadcrumbItems.push({ label: collectionName, href: undefined });
  }
  
  if (modeName) {
    breadcrumbItems.push({ label: modeName });
  }

  return (
    <header className="sticky top-0 z-50 h-12 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between px-3 gap-2">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setSidebarOpen(!sidebarOpen)}          data-sidebar-toggle        >
          <Menu className="h-4 w-4" />
        </Button>
        
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <img src={lightpathLogo} alt="Lightpath" className="w-6 h-6 rounded" />
        </div>
        
        <AppBreadcrumbs items={breadcrumbItems} className="min-w-0" />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {subscription && (
          <UsageBadge
            subscribed={subscription.subscribed}
            questionsRemaining={subscription.questionsRemaining}
            onClick={subscription.subscribed ? subscription.openCustomerPortal : subscription.openCheckout}
          />
        )}
        
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5"
          onClick={() => navigate("/dashboard")}
        >
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </Button>
        
        {session?.user?.email && (
          <span className="text-xs text-muted-foreground hidden md:block max-w-[120px] truncate">
            {session.user.email}
          </span>
        )}
        
        {session && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleSignOut} title="Sign Out">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </header>
  );
};
