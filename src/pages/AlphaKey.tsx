import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import lightpathLogo from "@/assets/lightpath-logo.png";
import { Key } from "lucide-react";
import { z } from "zod";

const alphaKeySchema = z.object({
  key: z.string()
    .trim()
    .min(1, "Alpha key is required")
    .max(100, "Alpha key is too long")
});

const AlphaKey = () => {
  const navigate = useNavigate();
  const [key, setKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuthAndActivation = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if already activated
      const { data: profile } = await supabase
        .from("profiles")
        .select("alpha_activated")
        .eq("user_id", session.user.id)
        .single();

      if (profile?.alpha_activated) {
        navigate("/study");
        return;
      }

      setCheckingAuth(false);
    };

    checkAuthAndActivation();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validationResult = alphaKeySchema.safeParse({ key });
    if (!validationResult.success) {
      toast.error(validationResult.error.errors[0].message);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.rpc("activate_alpha_key", {
        submitted_key: validationResult.data.key
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string };
      
      if (result.success) {
        toast.success(result.message);
        navigate("/study");
      } else {
        toast.error(result.message);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to activate key");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/5">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img src={lightpathLogo} alt="Lightpath Study" className="w-16 h-16 rounded-lg" />
          </div>
          <CardTitle className="text-2xl flex items-center justify-center gap-2">
            <Key className="h-5 w-5" />
            Alpha Access
          </CardTitle>
          <CardDescription>
            Enter your alpha key to unlock Lightpath Study
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleActivate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="alphaKey">Alpha Key</Label>
              <Input
                id="alphaKey"
                type="text"
                placeholder="Enter your alpha key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Activating..." : "Activate Key"}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm text-muted-foreground hover:underline"
            >
              Sign out
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlphaKey;
