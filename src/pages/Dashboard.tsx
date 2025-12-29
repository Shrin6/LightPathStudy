import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { 
  BookOpen, 
  Brain, 
  FileText, 
  Heart, 
  LogOut, 
  Sparkles, 
  TrendingUp,
  Clock,
  FolderOpen,
  ArrowRight,
  Settings,
  BookMarked
} from "lucide-react";
import { toast } from "sonner";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FooterNav } from "@/components/ui/footer-nav";
import lightpathLogo from "@/assets/lightpath-logo.png";

// Bible quotes with meanings
const BIBLE_QUOTES = [
  {
    id: "1",
    text: "For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.",
    reference: "Jeremiah 29:11",
    meaning: "God has a purpose for your life. Even when studying feels overwhelming, trust that every effort you put in is building towards something greater. Your hard work matters."
  },
  {
    id: "2",
    text: "Commit your work to the LORD, and your plans will be established.",
    reference: "Proverbs 16:3",
    meaning: "When you dedicate your studies to a higher purpose, you'll find more clarity and direction. Start each study session with intention and watch your understanding grow."
  },
  {
    id: "3",
    text: "Whatever you do, work heartily, as for the Lord and not for men.",
    reference: "Colossians 3:23",
    meaning: "Excellence in studying isn't about impressing others—it's about developing yourself fully. Give your best effort, not for grades alone, but for growth."
  },
  {
    id: "4",
    text: "The heart of the discerning acquires knowledge, for the ears of the wise seek it out.",
    reference: "Proverbs 18:15",
    meaning: "Being a good student means actively seeking understanding, not just passively receiving information. Ask questions, stay curious, and wisdom will follow."
  },
  {
    id: "5",
    text: "I can do all things through him who strengthens me.",
    reference: "Philippians 4:13",
    meaning: "That difficult subject? That challenging exam? You have the inner strength to overcome it. Believe in your ability to learn and grow through every challenge."
  },
  {
    id: "6",
    text: "Trust in the LORD with all your heart, and do not lean on your own understanding.",
    reference: "Proverbs 3:5",
    meaning: "Sometimes concepts don't make sense immediately—that's okay. Keep studying, stay patient, and understanding will come. Trust the learning process."
  },
  {
    id: "7",
    text: "Be strong and courageous. Do not be afraid; do not be discouraged.",
    reference: "Joshua 1:9",
    meaning: "Academic challenges can feel intimidating, but don't let fear hold you back. Approach difficult material with courage and persistence."
  }
];

// Changelog entries
const CHANGELOG = [
  { date: "Dec 2024", text: "Per-collection progress tracking on dashboard" },
  { date: "Dec 2024", text: "Added 20-question worksheet batches with topic targeting" },
  { date: "Dec 2024", text: "Improved quiz explanations with memory hooks" },
  { date: "Dec 2024", text: "Added 'I don't know' button for honest learning" },
  { date: "Nov 2024", text: "Enhanced flashcard export to Anki format" },
];

interface Collection {
  id: string;
  name: string;
}

interface CollectionProgress {
  quiz: number;
  flashcards: number;
  worksheet: number;
  overall: number;
  lastStudied: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CollectionProgress>({ overall: 0, quiz: 0, flashcards: 0, worksheet: 0, lastStudied: null });
  const [likedQuotes, setLikedQuotes] = useState<string[]>([]);
  const [todayQuote, setTodayQuote] = useState(BIBLE_QUOTES[0]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/");
      } else {
        setSession(session);
        loadCollections(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/");
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    // Load liked quotes from localStorage
    const stored = localStorage.getItem("likedQuotes");
    if (stored) {
      setLikedQuotes(JSON.parse(stored));
    }

    // Pick quote of the day based on date
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    const quoteIndex = dayOfYear % BIBLE_QUOTES.length;
    setTodayQuote(BIBLE_QUOTES[quoteIndex]);
  }, []);

  const loadCollections = async (userId: string) => {
    try {
      const { data: collectionsData } = await supabase
        .from("collections")
        .select("id, name")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (collectionsData && collectionsData.length > 0) {
        setCollections(collectionsData);
        // Auto-select the first collection
        const lastUsed = localStorage.getItem("lastCollectionId");
        const toSelect = lastUsed && collectionsData.some(c => c.id === lastUsed) 
          ? lastUsed 
          : collectionsData[0].id;
        setSelectedCollectionId(toSelect);
        loadCollectionProgress(userId, toSelect);
      }
    } catch (error) {
      console.error("Error loading collections:", error);
    }
  };

  const loadCollectionProgress = async (userId: string, collectionId: string) => {
    try {
      const { data: sessions } = await supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("collection_id", collectionId)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (sessions && sessions.length > 0) {
        // Calculate quiz progress from recent quiz sessions
        const quizSessions = sessions.filter(s => s.mode === "quiz");
        let quizAvg = 0;
        if (quizSessions.length > 0) {
          const recentQuizzes = quizSessions.slice(0, 5);
          const scores = recentQuizzes.map(s => {
            const history = s.conversation_history as any;
            if (history?.score !== undefined && history?.total !== undefined) {
              return (history.score / history.total) * 100;
            }
            if (typeof history?.score === 'number') {
              return history.score;
            }
            return 0;
          });
          quizAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        }

        // Count worksheet sessions
        const worksheetCount = sessions.filter(s => s.mode === "worksheet").length;
        const worksheetProgress = Math.min(worksheetCount * 20, 100);

        // Flashcard progress
        const flashcardSessions = sessions.filter(s => s.mode === "flashcards");
        const flashcardProgress = flashcardSessions.length > 0 ? Math.min(flashcardSessions.length * 20, 100) : 0;

        // Overall progress
        const counts = [quizAvg > 0 ? 1 : 0, worksheetProgress > 0 ? 1 : 0, flashcardProgress > 0 ? 1 : 0];
        const total = counts.reduce((a, b) => a + b, 0);
        const overall = total > 0 
          ? Math.round((quizAvg + worksheetProgress + flashcardProgress) / (total * 100) * 100)
          : 0;

        // Last studied
        const lastSession = sessions[0];
        const lastStudied = lastSession?.updated_at 
          ? new Date(lastSession.updated_at).toLocaleDateString() + " at " + 
            new Date(lastSession.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : null;

        setProgress({
          overall: Math.min(overall, 100),
          quiz: Math.round(quizAvg),
          flashcards: flashcardProgress,
          worksheet: worksheetProgress,
          lastStudied
        });
      } else {
        setProgress({ overall: 0, quiz: 0, flashcards: 0, worksheet: 0, lastStudied: null });
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    }
  };

  const handleCollectionChange = (collectionId: string) => {
    setSelectedCollectionId(collectionId);
    localStorage.setItem("lastCollectionId", collectionId);
    if (session) {
      loadCollectionProgress(session.user.id, collectionId);
    }
  };

  const handleLikeQuote = () => {
    const newLiked = likedQuotes.includes(todayQuote.id)
      ? likedQuotes.filter(id => id !== todayQuote.id)
      : [...likedQuotes, todayQuote.id];
    
    setLikedQuotes(newLiked);
    localStorage.setItem("likedQuotes", JSON.stringify(newLiked));

    if (!likedQuotes.includes(todayQuote.id)) {
      // Show toast occasionally (1 in 3 chance)
      const lastToast = localStorage.getItem("lastQuoteToast");
      const now = Date.now();
      if (!lastToast || now - parseInt(lastToast) > 86400000) { // Once per day max
        if (Math.random() < 0.33) {
          toast.info("These quotes come from the Bible. Consider reading the full chapter for deeper meaning.", {
            duration: 5000
          });
          localStorage.setItem("lastQuoteToast", now.toString());
        }
      }
      toast.success("Quote saved!");
    }
  };

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const isQuoteLiked = likedQuotes.includes(todayQuote.id);

  return (
    <div className="min-h-screen bg-background pb-14 md:pb-0">
      {/* Header */}
      <header className="h-12 border-b bg-card flex items-center justify-between px-3 sticky top-0 z-30">
        <div className="flex items-center gap-2 min-w-0">
          <img src={lightpathLogo} alt="Lightpath Study" className="w-6 h-6 rounded shrink-0" />
          <span className="font-semibold text-sm hidden sm:block">LightPath</span>
          <div className="hidden md:block border-l pl-3 ml-2">
            <Breadcrumbs items={[{ label: "Dashboard" }]} />
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <FeedbackDialog userId={session.user.id} />
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")} className="h-8" data-testid="button-settings">
            <Settings className="h-4 w-4" />
          </Button>
          {session?.user?.email && (
            <span className="text-xs text-muted-foreground hidden lg:block max-w-[120px] truncate">
              {session.user.email}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleSignOut} className="h-8 gap-1.5" data-testid="button-signout">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Progress & Quick Actions */}
          <div className="md:col-span-2 space-y-6">
            {/* Collection Selector + Progress */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Collection Progress
                  </CardTitle>
                  {collections.length > 0 && (
                    <Select value={selectedCollectionId || ""} onValueChange={handleCollectionChange}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Select collection" />
                      </SelectTrigger>
                      <SelectContent>
                        {collections.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-4 w-4" />
                              {c.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {collections.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No collections yet. Create one to start tracking progress!</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-primary">{progress.overall}%</span>
                      <span className="text-sm text-muted-foreground">
                        {selectedCollection?.name || "Select a collection"}
                      </span>
                    </div>
                    <Progress value={progress.overall} className="h-3" />
                    
                    <div className="grid grid-cols-3 gap-4 pt-2">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Brain className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <div className="text-lg font-semibold">{progress.quiz}%</div>
                        <div className="text-xs text-muted-foreground">Quiz Avg</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Sparkles className="h-5 w-5 mx-auto mb-1 text-accent" />
                        <div className="text-lg font-semibold">{progress.flashcards}%</div>
                        <div className="text-xs text-muted-foreground">Flashcards</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <FileText className="h-5 w-5 mx-auto mb-1 text-success" />
                        <div className="text-lg font-semibold">{progress.worksheet}%</div>
                        <div className="text-xs text-muted-foreground">Worksheet</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>Last studied: {progress.lastStudied || "Not started"}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Continue Learning</CardTitle>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => navigate("/study")}
                >
                  <BookOpen className="h-5 w-5 mr-2" />
                  Go to Study Workspace
                  <ArrowRight className="h-5 w-5 ml-auto" />
                </Button>
              </CardContent>
            </Card>

            {/* What's New */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-warning" />
                  What's New
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {CHANGELOG.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">{item.date}</span>
                      <span className="text-foreground">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quote + Saved */}
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Quote of the Day
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <blockquote className="text-foreground italic border-l-2 border-primary pl-4">
                  "{todayQuote.text}"
                </blockquote>
                <p className="text-sm font-medium text-primary">— {todayQuote.reference}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {todayQuote.meaning}
                </p>
                <Button 
                  variant={isQuoteLiked ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleLikeQuote}
                  className="w-full"
                >
                  <Heart className={`h-4 w-4 mr-2 ${isQuoteLiked ? "fill-current" : ""}`} />
                  {isQuoteLiked ? "Saved" : "Save Quote"}
                </Button>
              </CardContent>
            </Card>

            {/* Saved Quotes Access */}
            {likedQuotes.length > 0 && (
              <Card>
                <CardContent className="pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate("/settings?tab=saved")}
                    data-testid="button-saved-quotes"
                  >
                    <BookMarked className="h-4 w-4 mr-2" />
                    View {likedQuotes.length} Saved Quote{likedQuotes.length > 1 ? 's' : ''}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      
      <FooterNav />
    </div>
  );
};

export default Dashboard;
