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
  TrendingUp,
  Clock,
  FolderOpen,
  ArrowRight,
  Settings,
  Sparkles,
  Info
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { AppBreadcrumbs } from "@/components/ui/app-breadcrumbs";
import lightpathLogo from "@/assets/lightpath-logo.png";

// Bible quotes with meanings
const BIBLE_QUOTES = [
  {
    id: "1",
    text: "For I know the plans I have for you, declares the LORD, plans for welfare and not for evil, to give you a future and a hope.",
    reference: "Jeremiah 29:11",
    meaning: "God has a purpose for your life. Even when studying feels overwhelming, trust that every effort you put in is building towards something greater."
  },
  {
    id: "2",
    text: "Commit your work to the LORD, and your plans will be established.",
    reference: "Proverbs 16:3",
    meaning: "When you dedicate your studies to a higher purpose, you'll find more clarity and direction."
  },
  {
    id: "3",
    text: "Whatever you do, work heartily, as for the Lord and not for men.",
    reference: "Colossians 3:23",
    meaning: "Excellence in studying isn't about impressing others—it's about developing yourself fully."
  },
  {
    id: "4",
    text: "The heart of the discerning acquires knowledge, for the ears of the wise seek it out.",
    reference: "Proverbs 18:15",
    meaning: "Being a good student means actively seeking understanding, not just passively receiving information."
  },
  {
    id: "5",
    text: "I can do all things through him who strengthens me.",
    reference: "Philippians 4:13",
    meaning: "That difficult subject? That challenging exam? You have the inner strength to overcome it."
  },
  {
    id: "6",
    text: "Trust in the LORD with all your heart, and do not lean on your own understanding.",
    reference: "Proverbs 3:5",
    meaning: "Sometimes concepts don't make sense immediately—that's okay. Keep studying, stay patient."
  },
  {
    id: "7",
    text: "Be strong and courageous. Do not be afraid; do not be discouraged.",
    reference: "Joshua 1:9",
    meaning: "Academic challenges can feel intimidating, but don't let fear hold you back."
  }
];

// Changelog entries
const CHANGELOG = [
  { date: "Dec 2024", text: "Per-collection progress tracking" },
  { date: "Dec 2024", text: "20-question worksheet batches" },
  { date: "Dec 2024", text: "Quiz explanations with memory hooks" },
  { date: "Nov 2024", text: "Enhanced flashcard export" },
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
  const [showAlpha, setShowAlpha] = useState<boolean>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("alphaBannerDismissed") : null;
    return stored !== "true";
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
        loadCollections(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const stored = localStorage.getItem("likedQuotes");
    if (stored) {
      setLikedQuotes(JSON.parse(stored));
    }

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

        const worksheetCount = sessions.filter(s => s.mode === "worksheet").length;
        const worksheetProgress = Math.min(worksheetCount * 20, 100);

        const flashcardSessions = sessions.filter(s => s.mode === "flashcards");
        const flashcardProgress = flashcardSessions.length > 0 ? Math.min(flashcardSessions.length * 20, 100) : 0;

        const counts = [quizAvg > 0 ? 1 : 0, worksheetProgress > 0 ? 1 : 0, flashcardProgress > 0 ? 1 : 0];
        const total = counts.reduce((a, b) => a + b, 0);
        const overall = total > 0 
          ? Math.round((quizAvg + worksheetProgress + flashcardProgress) / (total * 100) * 100)
          : 0;

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
      const lastToast = localStorage.getItem("lastQuoteToast");
      const now = Date.now();
      if (!lastToast || now - parseInt(lastToast) > 86400000) {
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
  const isQuoteLiked = likedQuotes.includes(todayQuote.id);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {showAlpha && (
        <div className="bg-amber-100 border-b border-amber-200 px-4 py-3 text-amber-900 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="font-medium">Alpha testing</p>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-amber-700 hover:text-amber-900 hover:bg-amber-200">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 text-sm" align="start">
                <div className="space-y-2">
                  <p className="font-medium">What does alpha testing mean?</p>
                  <p className="text-muted-foreground">
                    This is alpha testing for the core functions. Features may change and bugs are expected as we refine the experience.
                  </p>
                  <p className="text-muted-foreground">
                    If you encounter any problems, please use the <strong>Feedback</strong> button in the header to report them.
                  </p>
                  <p className="text-muted-foreground">
                    You can also use the Feedback button to recommend new features you'd like to see!
                  </p>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowAlpha(false);
              localStorage.setItem("alphaBannerDismissed", "true");
            }}
          >
            Dismiss
          </Button>
        </div>
      )}
      {/* Header */}
      <header className="sticky top-0 z-50 h-14 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <img src={lightpathLogo} alt="Lightpath Study" className="w-7 h-7 rounded-lg" />
            <span className="font-semibold hidden sm:inline">Lightpath Study</span>
          </div>
          <AppBreadcrumbs items={[{ label: "Dashboard" }]} />
        </div>
        <div className="flex items-center gap-2">
          <FeedbackDialog userId={session.user.id} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/settings")}>
            <Settings className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground hidden md:block">
            {session?.user?.email}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-5">
            {/* Collection Progress */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Collection Progress
                  </CardTitle>
                  {collections.length > 0 && (
                    <Select value={selectedCollectionId || ""} onValueChange={handleCollectionChange}>
                      <SelectTrigger className="w-[180px] h-8 text-sm">
                        <SelectValue placeholder="Select collection" />
                      </SelectTrigger>
                      <SelectContent>
                        {collections.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-3.5 w-3.5" />
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
                  <div className="text-center py-6 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No collections yet. Create one to start tracking progress!</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold text-primary">{progress.overall}%</span>
                      <span className="text-sm text-muted-foreground">
                        {selectedCollection?.name}
                      </span>
                    </div>
                    <Progress value={progress.overall} className="h-2" />
                    
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Brain className="h-4 w-4 mx-auto mb-1 text-primary" />
                        <div className="text-lg font-semibold">{progress.quiz}%</div>
                        <div className="text-xs text-muted-foreground">Quiz</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Sparkles className="h-4 w-4 mx-auto mb-1 text-info" />
                        <div className="text-lg font-semibold">{progress.flashcards}%</div>
                        <div className="text-xs text-muted-foreground">Flashcards</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <FileText className="h-4 w-4 mx-auto mb-1 text-success" />
                        <div className="text-lg font-semibold">{progress.worksheet}%</div>
                        <div className="text-xs text-muted-foreground">Worksheet</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
                      <Clock className="h-3.5 w-3.5" />
                      <span>Last studied: {progress.lastStudied || "Not started"}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Continue Learning */}
            <Card>
              <CardContent className="py-4">
                <Button 
                  className="w-full justify-between" 
                  size="lg"
                  onClick={() => navigate("/study")}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Go to Study Workspace
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>

            {/* What's New */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-warning" />
                  What's New
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {CHANGELOG.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{item.date}</span>
                      <span className="text-foreground">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Quote */}
          <div>
            <Card className="bg-gradient-to-br from-primary/5 to-info/5 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Quote of the Day
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <blockquote className="text-sm text-foreground italic border-l-2 border-primary pl-3">
                  "{todayQuote.text}"
                </blockquote>
                <p className="text-xs font-medium text-primary">— {todayQuote.reference}</p>
                <p className="text-sm text-muted-foreground">{todayQuote.meaning}</p>
                <Button
                  variant={isQuoteLiked ? "default" : "outline"}
                  size="sm"
                  className="w-full"
                  onClick={handleLikeQuote}
                >
                  <Heart className={`h-3.5 w-3.5 mr-2 ${isQuoteLiked ? "fill-current" : ""}`} />
                  {isQuoteLiked ? "Saved" : "Save Quote"}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
