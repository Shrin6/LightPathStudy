import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/study/Sidebar";
import { ChatPane } from "@/components/study/ChatPane";
import { FlashcardsViewer } from "@/components/study/FlashcardsViewer";
import { QuizPanel } from "@/components/study/QuizPanel";
import { WorksheetPanel } from "@/components/study/WorksheetPanel";
import { NotesViewer } from "@/components/study/NotesViewer";
import { TopBar } from "@/components/study/TopBar";
import { Session } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { MemoryExperience } from "@/components/memory/MemoryExperience";
import { useSubscription } from "@/hooks/useSubscription";
import { PaywallDialog } from "@/components/subscription/PaywallDialog";
import { toast } from "sonner";

export type StudyMode = "explain" | "quiz" | "flashcards" | "worksheet" | "memory" | "notes";
export type DocumentTypeHint = "NOTES_OR_STUDY_GUIDE" | "QUIZ_OR_TEST" | "WORKSHEET_OR_PROBLEM_SET" | "SLIDES_OR_IMAGES" | "MIXED_OR_UNSURE";

const modeLabels: Record<StudyMode, string> = {
  explain: "Tutor",
  quiz: "Quiz",
  flashcards: "Flashcards",
  worksheet: "Worksheet",
  memory: "Memory Tricks",
  notes: "Notes",
};

const Study = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>("explain");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionContent, setCollectionContent] = useState<string>("");
  const [collectionName, setCollectionName] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [documentTypeHint, setDocumentTypeHint] = useState<DocumentTypeHint>("MIXED_OR_UNSURE");
  const [showPaywall, setShowPaywall] = useState(false);
  
  const subscription = useSubscription();

  // Handle checkout success
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Subscription activated! You now have unlimited access.");
      // Wait a moment for Stripe to process, then check subscription
      setTimeout(() => {
        subscription.checkSubscription();
      }, 2000);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuthAndActivation = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setSession(session);
      setLoading(false);
    };

    checkAuthAndActivation();

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
    const loadCollectionContent = async () => {
      if (!selectedCollection) {
        setCollectionContent("");
        setCollectionName("");
        return;
      }

      // Fetch collection name
      const { data: collectionData } = await supabase
        .from("collections")
        .select("name")
        .eq("id", selectedCollection)
        .single();
      
      if (collectionData) {
        setCollectionName(collectionData.name);
      }

      // Fetch content
      const { data, error } = await supabase
        .from("uploaded_files")
        .select("parsed_content")
        .eq("collection_id", selectedCollection);

      if (error) {
        console.error("Error loading collection content:", error);
        setCollectionContent("");
        return;
      }

      const allContent = data.map((file) => file.parsed_content || "").join("\n\n");
      setCollectionContent(allContent);
    };

    loadCollectionContent();
  }, [selectedCollection]);

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

  const handleUsageCheck = async (): Promise<boolean> => {
    if (subscription.subscribed) return true;
    
    const allowed = await subscription.incrementUsage();
    if (!allowed) {
      setShowPaywall(true);
      return false;
    }
    return true;
  };

  const renderMainContent = () => {
    const content = (() => {
      switch (mode) {
        case "flashcards":
          return <FlashcardsViewer collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} onUsageCheck={handleUsageCheck} />;
        case "quiz":
          return <QuizPanel collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} onUsageCheck={handleUsageCheck} />;
        case "worksheet":
          return <WorksheetPanel collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} onUsageCheck={handleUsageCheck} />;
        case "notes":
          return <NotesViewer collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} onUsageCheck={handleUsageCheck} />;
        case "memory":
          return <MemoryExperience collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} onUsageCheck={handleUsageCheck} />;
        default:
          return <ChatPane mode={mode} collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} onUsageCheck={handleUsageCheck} />;
      }
    })();

    return (
      <div className="h-full p-3">
        <Card className="h-full overflow-hidden">
          {content}
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col w-full bg-muted/30">
      <TopBar 
        session={session} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        collectionName={collectionName}
        modeName={modeLabels[mode]}
        subscription={subscription}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          mode={mode}
          setMode={setMode}
          selectedCollection={selectedCollection}
          setSelectedCollection={setSelectedCollection}
          isOpen={sidebarOpen}
          setIsOpen={setSidebarOpen}
          documentTypeHint={documentTypeHint}
          setDocumentTypeHint={setDocumentTypeHint}
        />

        <main className="flex-1 overflow-auto">
          {renderMainContent()}
        </main>
      </div>

      <PaywallDialog
        open={showPaywall}
        onOpenChange={setShowPaywall}
        onSubscribe={() => {
          setShowPaywall(false);
          subscription.openCheckout();
        }}
        questionsUsed={subscription.questionsUsed}
      />
    </div>
  );
};

export default Study;
