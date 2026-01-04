import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useSubscription } from "@/hooks/useSubscription";
import { 
  ArrowLeft, 
  Moon, 
  Sun, 
  Monitor, 
  Heart, 
  BookMarked, 
  Brain,
  History,
  Trash2,
  BookOpen,
  Flag,
  FileText,
  CreditCard,
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

// Same quotes as Dashboard
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

interface StudySession {
  id: string;
  mode: string;
  created_at: string;
  collection_id: string | null;
  conversation_history: any;
}

interface Collection {
  id: string;
  name: string;
}

interface ContentReport {
  id: string;
  created_at: string;
  feature: string;
  reason: string;
  comment: string | null;
  status: string;
  payload: any;
}

const Settings = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "preferences";
  const subscription = useSubscription();
  
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [subscriptionEndDate, setSubscriptionEndDate] = useState<string | null>(null);
  
  // Preferences
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [reducedMotion, setReducedMotion] = useState(false);
  
  // Saved quotes
  const [likedQuotes, setLikedQuotes] = useState<string[]>([]);
  
  // History
  const [studySessions, setStudySessions] = useState<StudySession[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [historyFilter, setHistoryFilter] = useState<string>("all");
  
  // Memory tricks (stored in localStorage)
  const [savedTricks, setSavedTricks] = useState<Array<{concept: string; trick: string; date: string}>>([]);
  
  // Reports
  const [reports, setReports] = useState<ContentReport[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth");
      } else {
        setSession(session);
        loadData(session.user.id);
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
    // Load saved data from localStorage
    const storedQuotes = localStorage.getItem("likedQuotes");
    if (storedQuotes) {
      setLikedQuotes(JSON.parse(storedQuotes));
    }
    
    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (storedTheme) {
      setTheme(storedTheme);
      applyTheme(storedTheme);
    }
    
    const storedMotion = localStorage.getItem("reducedMotion");
    if (storedMotion) {
      setReducedMotion(storedMotion === "true");
    }
    
    const storedTricks = localStorage.getItem("savedMemoryTricks");
    if (storedTricks) {
      setSavedTricks(JSON.parse(storedTricks));
    }
  }, []);

  const loadData = async (userId: string) => {
    // Load subscription end date
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_end')
      .eq('user_id', userId)
      .single();
    
    if (profile?.subscription_end) {
      setSubscriptionEndDate(profile.subscription_end);
    }
    try {
      // Load collections
      const { data: collectionsData } = await supabase
        .from("collections")
        .select("id, name")
        .eq("user_id", userId);
      
      if (collectionsData) {
        setCollections(collectionsData);
      }
      
      // Load study sessions
      const { data: sessionsData } = await supabase
        .from("study_sessions")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (sessionsData) {
        setStudySessions(sessionsData);
      }
      
      // Load reports
      const { data: reportsData } = await supabase
        .from("content_reports")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (reportsData) {
        setReports(reportsData as ContentReport[]);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const applyTheme = (newTheme: "light" | "dark" | "system") => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    
    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  };

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const handleReducedMotionChange = (enabled: boolean) => {
    setReducedMotion(enabled);
    localStorage.setItem("reducedMotion", enabled.toString());
  };

  const removeQuote = (quoteId: string) => {
    const newLiked = likedQuotes.filter(id => id !== quoteId);
    setLikedQuotes(newLiked);
    localStorage.setItem("likedQuotes", JSON.stringify(newLiked));
    toast.success("Quote removed");
  };

  const removeTrick = (index: number) => {
    const newTricks = savedTricks.filter((_, i) => i !== index);
    setSavedTricks(newTricks);
    localStorage.setItem("savedMemoryTricks", JSON.stringify(newTricks));
    toast.success("Memory trick removed");
  };

  const deleteReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("content_reports")
        .delete()
        .eq("id", reportId);
      
      if (error) throw error;
      
      setReports(prev => prev.filter(r => r.id !== reportId));
      toast.success("Report deleted");
    } catch (error) {
      console.error("Error deleting report:", error);
      toast.error("Failed to delete report");
    }
  };

  const getReasonLabel = (reason: string): string => {
    const labels: Record<string, string> = {
      wrong_answer: "Wrong answer",
      confusing: "Confusing",
      off_topic: "Off-topic",
      formatting: "Formatting",
      inappropriate: "Other",
    };
    return labels[reason] || reason;
  };

  const getCollectionName = (collectionId: string | null): string => {
    if (!collectionId) return "No collection";
    const col = collections.find(c => c.id === collectionId);
    return col?.name || "Unknown";
  };

  const filteredSessions = historyFilter === "all" 
    ? studySessions 
    : studySessions.filter(s => s.mode === historyFilter);

  const savedQuotesData = BIBLE_QUOTES.filter(q => likedQuotes.includes(q.id));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b bg-card flex items-center gap-4 px-4">
        <Button variant="ghost" size="sm" onClick={()5">
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="subscription">Subscription
          Back
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-4xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preferences">Preferences</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Appearance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Theme</Label>
                    <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeChange("light")}
                    >
                      <Sun className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeChange("dark")}
                    >
                      <Moon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleThemeChange("system")}
                    >
                      <Monitor className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Reduce Motion</Label>
                    <p className="text-sm text-muted-foreground">Minimize animations</p>
                  </div>
                  <Switch
                    checked={reducedMotion}
                    onCheckedChange={handleReducedMotionChange}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value="subscription" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CreditCard className="h-5 w-5" />
                  Subscription Plan
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Current Plan */}
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">
                        {subscription.subscribed ? "Pro Plan" : "Free Plan"}
                      </h3>
                      {subscription.subscribed && (
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {subscription.subscribed 
                        ? "Unlimited questions and full access to all features"
                        : "20 questions per month with basic features"
                      }
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">
                      {subscription.subscribed ? "$9.99" : "$0"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {subscription.subscribed ? "per month" : "forever"}
                    </div>
                  </div>
                </div>

                {/* Usage Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Questions Used</div>
                    <div className="text-2xl font-bold">{subscription.questionsUsed}</div>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Questions Remaining</div>
                    <div className="text-2xl font-bold">
                      {subscription.questionsRemaining === null 
                        ? "∞" 
                        : subscription.questionsRemaining
                      }
                    </div>
                  </div>
                </div>

                {/* Subscription Details */}
                {subscription.subscribed && subscriptionEndDate && (
                  <div className="p-4 border rounded-lg">
                    <div className="text-sm text-muted-foreground mb-1">Next Billing Date</div>
                    <div className="font-medium">
                      {new Date(subscriptionEndDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-3">
                  {subscription.subscribed ? (
                    <>
                      <Button 
                        onClick={subscription.openCustomerPortal}
                        className="w-full"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Update payment method, view invoices, or cancel subscription
                      </p>
                    </>
                  ) : (
                    <>
                      <Button 
                        onClick={subscription.openCheckout}
                        className="w-full"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Upgrade to Pro
                      </Button>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p className="font-medium">Pro features include:</p>
                        <ul className="space-y-1 ml-4 list-disc">
                          <li>Unlimited questions</li>
                          <li>Advanced AI tutor</li>
                          <li>Full quiz & flashcard library</li>
                          <li>Study session history</li>
                          <li>Progress tracking & analytics</li>
                          <li>Priority support</li>
                        </ul>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5" />
                    Study Sessions
                  </CardTitle>
                  <Select value={historyFilter} onValueChange={setHistoryFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Modes</SelectItem>
                      <SelectItem value="quiz">Quiz</SelectItem>
                      <SelectItem value="worksheet">Worksheet</SelectItem>
                      <SelectItem value="flashcards">Flashcards</SelectItem>
                      <SelectItem value="explain">Explain</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No study sessions yet</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {filteredSessions.map(session => {
                      const history = session.conversation_history as any;
                      const score = history?.score !== undefined ? `${history.score}%` : null;
                      
                      return (
                        <div key={session.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Brain className="h-5 w-5 text-primary" />
                            <div>
                              <p className="font-medium capitalize">{session.mode}</p>
                              <p className="text-xs text-muted-foreground">
                                {getCollectionName(session.collection_id)}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            {score && <p className="font-medium text-primary">{score}</p>}
                            <p className="text-xs text-muted-foreground">
                              {new Date(session.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Saved Tab */}
          <TabsContent value="saved" className="space-y-6">
            {/* Saved Quotes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BookMarked className="h-5 w-5" />
                  Saved Quotes ({savedQuotesData.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {savedQuotesData.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Heart className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No saved quotes yet</p>
                    <p className="text-sm">Like quotes from the dashboard to save them</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {savedQuotesData.map(quote => (
                      <div key={quote.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <blockquote className="text-foreground italic border-l-2 border-primary pl-3">
                          "{quote.text}"
                        </blockquote>
                        <p className="text-sm font-medium text-primary">— {quote.reference}</p>
                        <p className="text-sm text-muted-foreground">{quote.meaning}</p>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeQuote(quote.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Saved Memory Tricks */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Brain className="h-5 w-5" />
                  Saved Memory Tricks ({savedTricks.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {savedTricks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No saved memory tricks yet</p>
                    <p className="text-sm">Generate memory tricks during quizzes to save them</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[400px] overflow-y-auto">
                    {savedTricks.map((trick, index) => (
                      <div key={index} className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <p className="font-medium text-primary">{trick.concept}</p>
                        <p className="text-sm text-foreground">{trick.trick}</p>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">{trick.date}</p>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => removeTrick(index)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Flag className="h-5 w-5" />
                  My Reports ({reports.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reports.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Flag className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No reports submitted yet</p>
                    <p className="text-sm">Use the report button on quiz/worksheet content to flag issues</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {reports.map(report => (
                      <div key={report.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {report.feature}
                            </Badge>
                            <Badge variant="secondary">
                              {getReasonLabel(report.reason)}
                            </Badge>
                            <Badge 
                              variant={report.status === "submitted" ? "default" : "outline"}
                              className="text-xs"
                            >
                              {report.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        
                        {report.comment && (
                          <p className="text-sm text-foreground">{report.comment}</p>
                        )}
                        
                        {report.payload?.question_text && (
                          <div className="text-xs text-muted-foreground bg-background/50 p-2 rounded">
                            <FileText className="h-3 w-3 inline mr-1" />
                            {report.payload.question_text.substring(0, 100)}
                            {report.payload.question_text.length > 100 && "..."}
                          </div>
                        )}
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteReport(report.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Settings;
