import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Brain, FileText, Lightbulb, Upload, GraduationCap, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import lightpathLogo from "@/assets/lightpath-logo.png";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={lightpathLogo} alt="Lightpath Study" className="w-8 h-8 rounded-lg" />
            <span className="font-semibold text-lg">Lightpath Study</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              Home
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>Dashboard</Button>
            <Button size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 px-4">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <div className="flex justify-center mb-6">
            <img src={lightpathLogo} alt="Lightpath Study" className="w-20 h-20 rounded-2xl shadow-md" />
          </div>
          
          <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
            Study smarter from your own materials
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload notes, slides, worksheets, and images. Get tutor help, quizzes, flashcards, and clean notes—all based on YOUR content.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button 
              size="lg" 
              className="gap-2"
              onClick={() => navigate("/dashboard")}
            >
              Go to Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => navigate("/auth")}
            >
              Try a Sample
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Everything you need to master any subject
            </h2>
            <p className="text-muted-foreground">
              Light works exclusively from your uploaded materials—no random facts, just your course content.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/tutor")}>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">AI Tutor</h3>
              <p className="text-sm text-muted-foreground">
                Step-by-step explanations in simple language. Ask to slow down anytime.
              </p>
            </Card>

            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/quizzes")}>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-3">
                <GraduationCap className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Practice Quizzes</h3>
              <p className="text-sm text-muted-foreground">
                One question at a time with clear explanations for each answer.
              </p>
            </Card>

            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/flashcards")}>
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5 text-info" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Smart Flashcards</h3>
              <p className="text-sm text-muted-foreground">
                Auto-generate flashcards with terms, definitions, and examples.
              </p>
            </Card>

            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/memory")}>
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center mb-3">
                <Lightbulb className="w-5 h-5 text-warning" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Memory Tricks</h3>
              <p className="text-sm text-muted-foreground">
                Get mnemonics and silly phrases to remember complex concepts.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Simple, patient, effective
            </h2>
            <p className="text-muted-foreground">
              Three steps to start learning better
            </p>
          </div>

          <div className="space-y-8">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">
                1
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Upload Your Materials</h3>
                <p className="text-muted-foreground">
                  Drop in lecture slides, textbook PDFs, or handwritten notes. Light reads and organizes everything.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Ask Questions or Generate Content</h3>
                <p className="text-muted-foreground">
                  Chat with your AI tutor, create flashcards, take quizzes, or build practice worksheets.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center text-info-foreground font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Learn at Your Own Pace</h3>
                <p className="text-muted-foreground">
                  Go slow when you need to, repeat concepts, get corrections. Light never rushes you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Ready to study smarter?
          </h2>
          <p className="text-muted-foreground mb-6">
            Join students who are learning better with their own personalized AI tutor.
          </p>
          <Button 
            size="lg"
            className="gap-2"
            onClick={() => navigate("/auth")}
          >
            <Upload className="w-4 h-4" />
            Get Started Free
          </Button>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl space-y-3 text-center">
          <h3 className="text-xl font-semibold">Why we built Lightpath</h3>
          <p className="text-muted-foreground text-sm">
            We believe AI is a helpful tool, not something to idolize. Use it to support your learning, keep your own judgment, and stay grounded in your values.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t bg-card">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2024 Lightpath Study. Your patient, personal study companion.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
