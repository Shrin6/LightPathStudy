import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const FeatureQuizzes = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Allow both authenticated and guest users
    setLoading(false);
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sticky top-0 z-40">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <span className="font-semibold text-lg">Practice Quizzes</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>Home</Button>
            <Button size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Practice Quizzes</h1>
          <p className="text-muted-foreground text-lg">
            One question at a time with clear explanations. Built directly from your uploaded materials.
          </p>
        </div>

        <Card className="p-4 bg-card/70 border shadow-sm">
          <div className="aspect-video rounded-lg border bg-muted/40 flex items-center justify-center text-muted-foreground">
            <div className="flex items-center gap-2 text-sm"><Play className="h-4 w-4" /> Demo video placeholder</div>
          </div>
        </Card>

        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4 space-y-2">
            <h3 className="font-semibold">What it does</h3>
            <p className="text-sm text-muted-foreground">
              Generates quizzes from your collection with reasoning for each answer, so you understand why it’s right or wrong.
            </p>
          </Card>
          <Card className="p-4 space-y-2">
            <h3 className="font-semibold">How to use it</h3>
            <p className="text-sm text-muted-foreground">
              Pick a collection, open Study → Quiz, and start. Use the self-check flow to track where you need more practice.
            </p>
          </Card>
        </div>

        <div className="flex gap-3">
          <Button onClick={() => navigate("/auth")}>Sign in to try</Button>
          <Button variant="outline" onClick={() => navigate("/study")}>Open Study workspace</Button>
        </div>
      </main>
    </div>
  );
};

export default FeatureQuizzes;
