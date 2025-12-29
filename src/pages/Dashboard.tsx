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
  Sparkles, 
  TrendingUp,
  Clock,
  FolderOpen,
  ArrowRight,
  BookMarked,
  Zap,
  Upload,
  GraduationCap
} from "lucide-react";
import { toast } from "sonner";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { AppShell } from "@/components/layout/AppShell";

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
    meaning: "Excellence in studying isn't about impressing others. Give your best effort for growth."
  },
  {
    id: "4",
    text: "The heart of the discerning acquires knowledge, for the ears of the wise seek it out.",
    reference: "Proverbs 18:15",
    meaning: "Being a good student means actively seeking understanding. Ask questions, stay curious."
  },
  {
    id: "5",
    text: "I can do all things through him who strengthens me.",
    reference: "Philippians 4:13",
    meaning: "You have the inner strength to overcome any challenge. Believe in your ability to learn."
  },
  {
    id: "6",
    text: "Trust in the LORD with all your heart, and do not lean on your own understanding.",
    reference: "Proverbs 3:5",
    meaning: "Sometimes concepts don't make sense immediately. Keep studying, stay patient."
  },
  {
    id: "7",
    text: "Be strong and courageous. Do not be afraid; do not be discouraged.",
    reference: "Joshua 1:9",
    meaning: "Approach difficult material with courage and persistence."
  }
];

const CHANGELOG = [
  { date: "Dec 2024", text: "Per-collection progress tracking" },
  { date: "Dec 2024", text: "20-question worksheet batches" },
  { date: "Dec 2024", text: "Improved quiz explanations" },
  { date: "Nov 2024", text: "Enhanced Anki export" },
];

// DEV_MODE: Set to true to bypass auth for testing
const DEV_MODE = true;

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
  const [loading, setLoading] = useState(!DEV_MODE);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [progress, setProgress] = useState<CollectionProgress>({ overall: 0, quiz: 0, flashcards: 0, worksheet: 0, lastStudied: null });
  const [likedQuotes, setLikedQuotes] = useState<string[]>([]);
  const [todayQuote, setTodayQuote] = useState(BIBLE_QUOTES[0]);

  useEffect(() => {
    if (DEV_MODE) {
      setLoading(false);
      return;
    }

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
    if (session?.user?.id) {
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
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session && !DEV_MODE) {
    return null;
  }

  return (
    <AppShell 
      onSignOut={handleSignOut} 
      userEmail={session?.user?.email}
      rightHeaderContent={session?.user?.id ? <FeedbackDialog userId={session.user.id} /> : undefined}
    >
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4" data-testid="card-stat-collections">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{collections.length}</p>
                <p className="text-xs text-muted-foreground">Collections</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4" data-testid="card-stat-progress">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.overall}%</p>
                <p className="text-xs text-muted-foreground">Overall Progress</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4" data-testid="card-stat-quiz">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.quiz}%</p>
                <p className="text-xs text-muted-foreground">Quiz Average</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4" data-testid="card-stat-flashcards">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{progress.flashcards}%</p>
                <p className="text-xs text-muted-foreground">Flashcard Progress</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card data-testid="card-collection-progress">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Collection Progress
                  </CardTitle>
                  {collections.length > 0 && (
                    <Select value={selectedCollectionId || ""} onValueChange={handleCollectionChange}>
                      <SelectTrigger className="w-[180px]" data-testid="select-collection">
                        <SelectValue placeholder="Select collection" />
                      </SelectTrigger>
                      <SelectContent>
                        {collections.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            <div className="flex items-center gap-2">
                              <FolderOpen className="h-3 w-3" />
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
                    <p className="text-sm">No collections yet. Create one to start!</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-bold text-primary">{progress.overall}%</span>
                      <span className="text-sm text-muted-foreground">
                        {selectedCollection?.name}
                      </span>
                    </div>
                    <Progress value={progress.overall} className="h-2" />
                    
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Brain className="h-4 w-4 mx-auto mb-1 text-primary" />
                        <div className="text-base font-semibold">{progress.quiz}%</div>
                        <div className="text-xs text-muted-foreground">Quiz</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <Sparkles className="h-4 w-4 mx-auto mb-1 text-accent" />
                        <div className="text-base font-semibold">{progress.flashcards}%</div>
                        <div className="text-xs text-muted-foreground">Flashcards</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <FileText className="h-4 w-4 mx-auto mb-1 text-green-600 dark:text-green-400" />
                        <div className="text-base font-semibold">{progress.worksheet}%</div>
                        <div className="text-xs text-muted-foreground">Worksheet</div>
                      </div>
                    </div>

                    {progress.lastStudied && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2 border-t">
                        <Clock className="h-3 w-3" />
                        <span>Last studied: {progress.lastStudied}</span>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-quick-actions">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  className="w-full justify-start" 
                  onClick={() => navigate("/study")}
                  data-testid="button-go-to-study"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Go to Study Workspace
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
                <Button 
                  variant="outline"
                  className="w-full justify-start" 
                  onClick={() => navigate("/study")}
                  data-testid="button-upload-files"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Files
                </Button>
              </CardContent>
            </Card>

            <Card data-testid="card-whats-new">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-amber-500" />
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

          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20" data-testid="card-quote">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BookOpen className="h-4 w-4 text-primary" />
                  Quote of the Day
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <blockquote className="text-sm text-foreground italic border-l-2 border-primary pl-3">
                  "{todayQuote.text}"
                </blockquote>
                <p className="text-xs font-medium text-primary">- {todayQuote.reference}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {todayQuote.meaning}
                </p>
                <Button 
                  variant={isQuoteLiked ? "default" : "outline"} 
                  size="sm" 
                  onClick={handleLikeQuote}
                  className="w-full"
                  data-testid="button-like-quote"
                >
                  <Heart className={`h-3 w-3 mr-2 ${isQuoteLiked ? "fill-current" : ""}`} />
                  {isQuoteLiked ? "Saved" : "Save Quote"}
                </Button>
              </CardContent>
            </Card>

            {likedQuotes.length > 0 && (
              <Card data-testid="card-saved-quotes">
                <CardContent className="pt-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="w-full"
                    onClick={() => navigate("/settings?tab=saved")}
                    data-testid="button-view-saved"
                  >
                    <BookMarked className="h-3 w-3 mr-2" />
                    View {likedQuotes.length} Saved Quote{likedQuotes.length > 1 ? 's' : ''}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Dashboard;
