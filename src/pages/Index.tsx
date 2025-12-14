import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Brain, FileText, Sparkles, Upload, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-10"></div>
        <div className="container mx-auto px-4 py-20 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary font-medium text-sm">
              <Sparkles className="w-4 h-4" />
              Your Personal AI Study Tutor
            </div>
            
            <h1 className="text-5xl md:text-6xl font-bold text-foreground leading-tight">
              Learn Smarter with
              <span className="bg-gradient-primary bg-clip-text text-transparent"> StudyBuddy AI</span>
            </h1>
            
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Upload your notes, slides, and documents. Get personalized explanations, flashcards, quizzes, and memory tricks—all from your own materials.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                <Upload className="w-5 h-5 mr-2" />
                Start Learning Free
              </Button>
              <Button size="lg" variant="outline" className="text-lg px-8">
                <Brain className="w-5 h-5 mr-2" />
                See How It Works
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Everything You Need to Master Any Subject
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              StudyBuddy AI works exclusively from your uploaded materials—no random facts, just your course content.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            <Card className="p-6 hover:shadow-lg transition-shadow border-border bg-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Brain className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">AI Tutoring</h3>
              <p className="text-muted-foreground">
                Get step-by-step explanations in simple language. Ask to slow down, repeat, or simplify anytime.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border bg-card">
              <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Zap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Smart Flashcards</h3>
              <p className="text-muted-foreground">
                Auto-generate flashcards with terms, definitions, and examples. Export to Anki or Quizlet.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border bg-card">
              <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center mb-4">
                <BookOpen className="w-6 h-6 text-success" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Practice Quizzes</h3>
              <p className="text-muted-foreground">
                One question at a time, with gentle corrections and clear explanations for each answer.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border bg-card">
              <div className="w-12 h-12 rounded-lg bg-info/10 flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-info" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Worksheets</h3>
              <p className="text-muted-foreground">
                Create custom practice sheets with fill-in-blanks, matching, and exam-style questions.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border bg-card">
              <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center mb-4">
                <Sparkles className="w-6 h-6 text-warning" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Memory Tricks</h3>
              <p className="text-muted-foreground">
                Get mnemonics, acronyms, and silly phrases to remember complex concepts forever.
              </p>
            </Card>

            <Card className="p-6 hover:shadow-lg transition-shadow border-border bg-card">
              <div className="w-12 h-12 rounded-lg bg-secondary/50 flex items-center justify-center mb-4">
                <Upload className="w-6 h-6 text-secondary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-card-foreground mb-2">Upload Anything</h3>
              <p className="text-muted-foreground">
                PDFs, PowerPoints, Word docs, images—up to 800MB. Your notes become your curriculum.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Simple, Patient, Effective
            </h2>
            <p className="text-muted-foreground text-lg">
              Just three steps to start learning better
            </p>
          </div>

          <div className="space-y-12">
            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center text-primary-foreground font-bold text-xl shrink-0">
                1
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">Upload Your Materials</h3>
                <p className="text-muted-foreground text-lg">
                  Drop in your lecture slides, textbook PDFs, or handwritten notes. StudyBuddy reads and organizes everything.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-accent flex items-center justify-center text-accent-foreground font-bold text-xl shrink-0">
                2
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">Ask Questions or Generate Content</h3>
                <p className="text-muted-foreground text-lg">
                  Chat with your AI tutor, create flashcards, take quizzes, or build practice worksheets—all from your content.
                </p>
              </div>
            </div>

            <div className="flex gap-6 items-start">
              <div className="w-12 h-12 rounded-full bg-gradient-secondary flex items-center justify-center text-success-foreground font-bold text-xl shrink-0">
                3
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">Learn at Your Own Pace</h3>
                <p className="text-muted-foreground text-lg">
                  Go slow when you need to, repeat concepts, get corrections. StudyBuddy never rushes you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="relative overflow-hidden bg-gradient-primary p-12 text-center border-0">
            <div className="relative z-10">
              <h2 className="text-4xl font-bold text-primary-foreground mb-4">
                Ready to Study Smarter?
              </h2>
              <p className="text-primary-foreground/90 text-lg mb-8 max-w-2xl mx-auto">
                Join thousands of students who are learning better with their own personalized AI tutor.
              </p>
              <Button 
                size="lg" 
                variant="secondary" 
                className="text-lg px-8"
                onClick={() => navigate("/auth")}
              >
                <Upload className="w-5 h-5 mr-2" />
                Get Started Free
              </Button>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>© 2024 StudyBuddy AI. Your patient, personal study companion.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
