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
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [mode, setMode] = useState<StudyMode>("explain");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionContent, setCollectionContent] = useState<string>("");
  const [collectionName, setCollectionName] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem("sidebarOpen");
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [documentTypeHint, setDocumentTypeHint] = useState<DocumentTypeHint>("MIXED_OR_UNSURE");
  const [showPaywall, setShowPaywall] = useState(false);

  const subscription = useSubscription();

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(sidebarOpen));
  }, [sidebarOpen]);

  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Subscription activated! You now have unlimited access.");
      setTimeout(() => {
        subscription.checkSubscription();
      }, 2000);
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuthAndActivation = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Guest user - allow read-only access
        setIsReadOnly(true);
        setLoading(false);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("alpha_activated")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error("Error checking activation:", profileError);
      } else if (!profile?.alpha_activated) {
        navigate("/activate");
        return;
      }

      setSession(session);
      setIsReadOnly(false);
      setLoading(false);
    };

    checkAuthAndActivation();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setSession(session);
        setIsReadOnly(false);
      } else {
        setSession(null);
        setIsReadOnly(true);
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

      const { data: collectionData } = await supabase
        .from("collections")
        .select("name")
        .eq("id", selectedCollection)
        .single();

      if (collectionData) {
        setCollectionName(collectionData.name);
      }

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

  const handleUsageCheck = async (): Promise<boolean> => {
    if (isReadOnly) {
      // Guest users need to sign in
      navigate("/auth");
      return false;
    }

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
          return (
            <FlashcardsViewer
              collectionId={selectedCollection}
              collectionContent={collectionContent}
              documentTypeHint={documentTypeHint}
              onUsageCheck={handleUsageCheck}
              readOnly={isReadOnly}
            />
          );
        case "quiz":
          return (
            <QuizPanel
              collectionId={selectedCollection}
              collectionContent={collectionContent}
              documentTypeHint={documentTypeHint}
              onUsageCheck={handleUsageCheck}
              readOnly={isReadOnly}
            />
          );
        case "worksheet":
          return (
            <WorksheetPanel
              collectionId={selectedCollection}
              collectionContent={collectionContent}
              documentTypeHint={documentTypeHint}
              onUsageCheck={handleUsageCheck}
              readOnly={isReadOnly}
            />
          );
        case "notes":
          return (
            <NotesViewer
              collectionId={selectedCollection}
              collectionContent={collectionContent}
              documentTypeHint={documentTypeHint}
              onUsageCheck={handleUsageCheck}
              readOnly={isReadOnly}
            />
          );
        case "memory":
          return (
            <MemoryExperience
              collectionId={selectedCollection}
              collectionContent={collectionContent}
              documentTypeHint={documentTypeHint}
              onUsageCheck={handleUsageCheck}
              readOnly={isReadOnly}
            />
          );
        default:
          return (
            <ChatPane
              mode={mode}
              collectionId={selectedCollection}
              collectionContent={collectionContent}
              documentTypeHint={documentTypeHint}
              onUsageCheck={handleUsageCheck}
              readOnly={isReadOnly}
            />
          );
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
    <div className="min-h-screen flex flex-col w-full bg-background">
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

        <main className="flex-1 overflow-auto transition-all duration-200">
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
