import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useSubscription } from "@/hooks/useSubscription";
import { CollectionsGrid } from "@/components/dashboard/CollectionsGrid";
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
  Flame,
  MessageSquare,
  Info
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
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
  const subscription = useSubscription();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CollectionProgress>({ overall: 0, quiz: 0, flashcards: 0, worksheet: 0, lastStudied: null });
  const [likedQuotes, setLikedQuotes] = useState<string[]>([]);
  const [todayQuote, setTodayQuote] = useState(BIBLE_QUOTES[0]);
  const [studyStreak, setStudyStreak] = useState(0);
  const [totalStudyTime, setTotalStudyTime] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
        return;
      }
      
      // Check if alpha activated
      supabase
        .from("profiles")
        .select("alpha_activated")
        .eq("id", session.user.id)
        .single()
        .then(({ data: profile, error }) => {
          if (error) {
            console.error("Error fetching profile:", error);
            setLoading(false);
            return;
          }
          
          if (!profile || profile.alpha_activated !== true) {
            navigate("/activate");
            return;
          }
          
          setSession(session);
          loadCollections(session.user.id);
          setLoading(false);
        });
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
      
      // Load study stats
      loadStudyStats(userId);
    } catch (error) {
      console.error("Error loading collections:", error);
    }
  };

  const loadStudyStats = async (userId: string) => {
    try {
      // Calculate study streak
      const { data: allSessions } = await supabase
        .from("study_sessions")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (allSessions && allSessions.length > 0) {
        let streak = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let checkDate = new Date(today);

        const sessionDates = new Set(
          allSessions.map(s => {
            const date = new Date(s.created_at);
            date.setHours(0, 0, 0, 0);
            return date.getTime();
          })
        );

        // Check if studied today or yesterday to start streak
        const todayTime = today.getTime();
        const yesterdayTime = todayTime - 86400000;
        
        if (sessionDates.has(todayTime)) {
          streak = 1;
          checkDate = new Date(yesterdayTime);
        } else if (sessionDates.has(yesterdayTime)) {
          streak = 1;
          checkDate = new Date(yesterdayTime - 86400000);
        }

        // Count consecutive days backwards
        while (sessionDates.has(checkDate.getTime())) {
          streak++;
          checkDate = new Date(checkDate.getTime() - 86400000);
        }

        setStudyStreak(streak);

        // Estimate total study time (5 minutes per session as baseline)
        setTotalStudyTime(allSessions.length * 5);
      }
    } catch (error) {
      console.error("Error loading study stats:", error);
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
          {subscription.subscribed ? (
            <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 hidden sm:flex">
              <Sparkles className="h-3 w-3 mr-1" />
              Pro
            </Badge>
          ) : (
            <Badge variant="outline" className="hidden sm:flex">
              Free
            </Badge>
          )}
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
            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/10 rounded-lg">
                      <Flame className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{studyStreak}</div>
                      <div className="text-xs text-muted-foreground">Day Streak</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{totalStudyTime}</div>
                      <div className="text-xs text-muted-foreground">Minutes</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <MessageSquare className="h-5 w-5 text-purple-500" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold">
                        {subscription.questionsRemaining === null ? "∞" : subscription.questionsUsed}
                      </div>
                      <div className="text-xs text-muted-foreground">Questions</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Collections Grid */}
            <div className="lg:col-span-3">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FolderOpen className="h-5 w-5 text-primary" />
                  <h2 className="text-xl font-bold">Your Collections</h2>
                </div>
                <CollectionsGrid
                  selectedCollectionId={selectedCollectionId}
                  onSelect={handleCollectionChange}
                />
              </div>
            </div>

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
