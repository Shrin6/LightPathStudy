import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Brain, FileText, Sparkles, Upload, Zap, ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PublicShell } from "@/components/layout/PublicShell";

const Index = () => {
  const navigate = useNavigate();

  return (
    <PublicShell>
      <section className="relative overflow-hidden" id="hero">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 py-16 md:py-24 relative">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-primary font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              AI-Powered Study Companion
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight">
              Master Any Subject with{" "}
              <span className="text-primary">Your Own Notes</span>
            </h1>
            
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Upload your notes, slides, and documents. Get personalized explanations, flashcards, quizzes, and memory tricks tailored to your materials.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                data-testid="button-start-learning"
              >
                <Upload className="w-4 h-4 mr-2" />
                Start Learning Free
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}
                data-testid="button-see-how"
              >
                <Brain className="w-4 h-4 mr-2" />
                See How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4" id="features">
        <div className="container mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Everything You Need to Study Smarter
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Built from your materials. No random facts or generic content.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            <Card className="p-5 border-border bg-card" data-testid="card-feature-tutoring">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1.5">AI Tutoring</h3>
              <p className="text-sm text-muted-foreground">
                Step-by-step explanations in plain language. Ask to slow down or simplify anytime.
              </p>
            </Card>

            <Card className="p-5 border-border bg-card" data-testid="card-feature-flashcards">
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <Zap className="w-5 h-5 text-accent" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1.5">Smart Flashcards</h3>
              <p className="text-sm text-muted-foreground">
                Auto-generate flashcards with terms and definitions. Export to Anki or Quizlet.
              </p>
            </Card>

            <Card className="p-5 border-border bg-card" data-testid="card-feature-quizzes">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1.5">Practice Quizzes</h3>
              <p className="text-sm text-muted-foreground">
                One question at a time with clear explanations for every answer.
              </p>
            </Card>

            <Card className="p-5 border-border bg-card" data-testid="card-feature-worksheets">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1.5">Worksheets</h3>
              <p className="text-sm text-muted-foreground">
                Fill-in-blanks, matching, and exam-style questions from your content.
              </p>
            </Card>

            <Card className="p-5 border-border bg-card" data-testid="card-feature-memory">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1.5">Memory Tricks</h3>
              <p className="text-sm text-muted-foreground">
                Mnemonics, acronyms, and memorable phrases for complex concepts.
              </p>
            </Card>

            <Card className="p-5 border-border bg-card" data-testid="card-feature-upload">
              <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
                <Upload className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-card-foreground mb-1.5">Upload Anything</h3>
              <p className="text-sm text-muted-foreground">
                PDFs, slides, Word docs, images. Your notes become your curriculum.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-muted/30" id="how-it-works">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">
              Three Steps to Better Learning
            </h2>
            <p className="text-muted-foreground">
              Simple, patient, effective
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4 items-start p-4 rounded-lg bg-background border">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Upload Your Materials</h3>
                <p className="text-sm text-muted-foreground">
                  Drop in your lecture slides, textbook PDFs, or notes. We organize everything for you.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 rounded-lg bg-background border">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-accent-foreground font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Study Your Way</h3>
                <p className="text-sm text-muted-foreground">
                  Chat with your AI tutor, generate flashcards, take quizzes, or build worksheets.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start p-4 rounded-lg bg-background border">
              <div className="w-10 h-10 rounded-full bg-green-600 dark:bg-green-500 flex items-center justify-center text-white font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Learn at Your Pace</h3>
                <p className="text-sm text-muted-foreground">
                  Repeat concepts, get corrections, go slow when needed. No rushing.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden bg-primary p-8 md:p-12 text-center border-0 max-w-3xl mx-auto">
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-foreground mb-3">
                Ready to Study Smarter?
              </h2>
              <p className="text-primary-foreground/80 mb-6 max-w-lg mx-auto">
                Join students who are learning better with their personalized AI study companion.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  size="lg" 
                  variant="secondary"
                  onClick={() => navigate("/auth")}
                  data-testid="button-get-started"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Get Started Free
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </PublicShell>
  );
};

export default Index;
