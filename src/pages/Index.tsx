import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BookOpen, Brain, FileText, Lightbulb, Upload, GraduationCap, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import lightpathLogo from "@/assets/lightpath-logo.png";
import { PricingPlans } from "@/components/pricing/PricingPlans";

const Index = () => {
  const navigate = useNavigate();

  const handleDashboardClick = () => {
    // 1% chance to play easter egg audio
    if (Math.random() < 0.01) {
      const audio = new Audio("/public/easter-egg.mp3");
      audio.play().catch(err => console.log("Audio play failed:", err));
    }
    navigate("/dashboard");
  };

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
            <Button variant="ghost" size="sm" onClick={handleDashboardClick}>Dashboard</Button>
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
            Stop using AI to get answers.<br />Start using an AI tutor to actually learn.
          </h1>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ChatGPT gets your homework done. But when exam day comes? You're stuck. Lightpath is an AI study coach that forces you to <span className="font-semibold text-foreground">think, recall, and understand</span>—so the knowledge actually sticks.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button 
              size="lg" 
              className="gap-2"
              onClick={() => navigate("/auth")}
            >
              Start Actually Learning
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={handleDashboardClick}
            >
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* The Problem Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              The AI shortcut is making you worse at learning
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              You copy-paste questions into ChatGPT, get perfect answers, and feel like you understand. But your brain never did the work. You need an AI tutor that teaches, not one that gives answers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-6 border-2 border-destructive/20 bg-destructive/5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                  <span className="text-xl">❌</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Passive AI Use</h3>
                  <p className="text-sm text-muted-foreground">Get instant answers → Feel smart → Forget everything by test day</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Zero cognitive effort = zero retention</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Answers you can't explain in your own words</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Dependent on AI for every single problem</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">•</span>
                  <span>Panic when you face a test without ChatGPT</span>
                </li>
              </ul>
            </Card>

            <Card className="p-6 border-2 border-success/20 bg-success/5">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
                  <span className="text-xl">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Active Learning with Lightpath</h3>
                  <p className="text-sm text-muted-foreground">Struggle productively → Build understanding → Ace tests confidently</p>
                </div>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">•</span>
                  <span>Forces retrieval practice = better memory</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">•</span>
                  <span>Guides you to think, not just copy answers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">•</span>
                  <span>Makes you explain concepts = deeper understanding</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-success mt-0.5">•</span>
                  <span>Walk into exams knowing you actually learned it</span>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              How Lightpath makes you actually learn
            </h2>
            <p className="text-muted-foreground">
              AI tools designed to force active thinking—not passive consumption. All from YOUR uploaded materials.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/tutor")}>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">AI Tutor</h3>
              <p className="text-sm text-muted-foreground">
                Asks YOU questions to check understanding. No spoon-feeding—you build the explanation.
              </p>
            </Card>

            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/quizzes")}>
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center mb-3">
                <GraduationCap className="w-5 h-5 text-success" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Practice Quizzes</h3>
              <p className="text-sm text-muted-foreground">
                Retrieval practice = stronger memory. Answer before seeing explanations.
              </p>
            </Card>

            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/flashcards")}>
              <div className="w-10 h-10 rounded-lg bg-info/10 flex items-center justify-center mb-3">
                <BookOpen className="w-5 h-5 text-info" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Smart Flashcards</h3>
              <p className="text-sm text-muted-foreground">
                Spaced repetition keeps you reviewing. Forces you to recall, not just recognize.
              </p>
            </Card>

            <Card className="p-5 hover:shadow-md transition-shadow bg-card border cursor-pointer" onClick={() => navigate("/features/memory")}>
              <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center mb-3">
                <Lightbulb className="w-5 h-5 text-warning" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Memory Tricks</h3>
              <p className="text-sm text-muted-foreground">
                Elaborative encoding with mnemonics. Makes concepts sticky and memorable.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              From your notes to deep understanding
            </h2>
            <p className="text-muted-foreground">
              Three step-by-step stages to stop cramming and start mastering
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
                  Lecture slides, textbook chapters, class notes—Lightpath analyzes YOUR content, not generic Wikipedia summaries.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-success flex items-center justify-center text-success-foreground font-bold shrink-0">
                2
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Engage Actively</h3>
                <p className="text-muted-foreground">
                  Quiz yourself, chat with the tutor, make flashcards. Every tool forces you to retrieve and apply knowledge.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center text-info-foreground font-bold shrink-0">
                3
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Build Real Understanding</h3>
                <p className="text-muted-foreground">
                  Not just memorization—you'll explain concepts in your own words and apply them to new problems.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Lightpath Works */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
              Why this actually works (backed by science)
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 bg-card border">
              <div className="text-3xl mb-3">🧠</div>
              <h3 className="font-semibold text-foreground mb-2">Retrieval Practice</h3>
              <p className="text-sm text-muted-foreground">
                The act of recalling information makes it stick better than re-reading. Quizzing yourself = stronger memory.
              </p>
            </Card>

            <Card className="p-6 bg-card border">
              <div className="text-3xl mb-3">🔄</div>
              <h3 className="font-semibold text-foreground mb-2">Spaced Repetition</h3>
              <p className="text-sm text-muted-foreground">
                Reviewing material at increasing intervals prevents forgetting. Flashcards aren't just review—they're memory training.
              </p>
            </Card>

            <Card className="p-6 bg-card border">
              <div className="text-3xl mb-3">💡</div>
              <h3 className="font-semibold text-foreground mb-2">Elaborative Encoding</h3>
              <p className="text-sm text-muted-foreground">
                Connecting new info to what you know makes it memorable. That's why mnemonics and explanations work.
              </p>
            </Card>
          </div>

          <div className="mt-10 p-6 bg-primary/5 border-l-4 border-primary rounded-lg">
            <p className="text-foreground font-medium mb-2">
              💬 "I used to copy ChatGPT answers and feel smart. Then I'd bomb tests. Lightpath forced me to actually think through problems—my grades went from C's to A's."
            </p>
            <p className="text-sm text-muted-foreground">— College sophomore using Lightpath for Organic Chemistry</p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, Student-Friendly Pricing
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Start free. Upgrade when you're ready to unlock unlimited learning.
            </p>
          </div>
          <PricingPlans />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Stop wasting time. Start your learning journey.
          </h2>
          <p className="text-muted-foreground mb-6">
            Join students who actually understand their material—not just copy answers. No credit card required.
          </p>
          <Button 
            size="lg"
            className="gap-2"
            onClick={() => navigate("/auth")}
          >
            <Upload className="w-4 h-4" />
            Start Learning for Free
          </Button>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-8 text-center">
            Frequently Asked Questions
          </h2>
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="font-semibold text-foreground mb-2">What subjects does Lightpath help with?</h3>
              <p className="text-muted-foreground text-sm">
                Lightpath works for any subject—math, science, history, languages, and more. Upload your notes and our AI tutor adapts to your material.
              </p>
            </div>
            <div className="border-b pb-4">
              <h3 className="font-semibold text-foreground mb-2">How is this different from ChatGPT?</h3>
              <p className="text-muted-foreground text-sm">
                ChatGPT gives you answers. Lightpath helps you find the answer yourself through guided questions and active recall—the AI-powered approach proven to improve retention.
              </p>
            </div>
            <div className="border-b pb-4">
              <h3 className="font-semibold text-foreground mb-2">Does it adapt to my learning style?</h3>
              <p className="text-muted-foreground text-sm">
                Yes. Whether you learn best through quizzes, flashcards, or conversation, Lightpath offers multiple study modes to match your learning style.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-2">Is it free to try?</h3>
              <p className="text-muted-foreground text-sm">
                Absolutely. Start with our free tier—no credit card required. Upgrade when you're ready for unlimited access.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="container mx-auto max-w-3xl space-y-3 text-center">
          <h3 className="text-xl font-semibold">AI is a tool, not a crutch</h3>
          <p className="text-muted-foreground text-sm">
            We built Lightpath because students deserve AI that helps them learn—not AI that does the learning for them. Use technology wisely. Build real understanding. Keep your own judgment.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 px-4 border-t bg-card">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>© 2024 Lightpath Study. Learn deeply, think critically, remember permanently.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
