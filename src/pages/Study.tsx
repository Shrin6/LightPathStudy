import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/study/Sidebar";
import { ChatPane } from "@/components/study/ChatPane";
import { FlashcardsViewer } from "@/components/study/FlashcardsViewer";
import { QuizPanel } from "@/components/study/QuizPanel";
import { WorksheetPanel } from "@/components/study/WorksheetPanel";
import { NotesViewer } from "@/components/study/NotesViewer";
import { TopBar } from "@/components/study/TopBar";
import { Session } from "@supabase/supabase-js";

export type StudyMode = "explain" | "quiz" | "flashcards" | "worksheet" | "memory" | "notes";
export type DocumentTypeHint = "NOTES_OR_STUDY_GUIDE" | "QUIZ_OR_TEST" | "WORKSHEET_OR_PROBLEM_SET" | "SLIDES_OR_IMAGES" | "MIXED_OR_UNSURE";

// DEV_MODE: Set to true to bypass auth for testing
const DEV_MODE = true;

const Study = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<StudyMode>("explain");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [collectionContent, setCollectionContent] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [documentTypeHint, setDocumentTypeHint] = useState<DocumentTypeHint>("MIXED_OR_UNSURE");

  useEffect(() => {
    // Check authentication
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && !DEV_MODE) {
        navigate("/auth");
      } else {
        setSession(session);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && !DEV_MODE) {
        navigate("/auth");
      } else {
        setSession(session);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const loadCollectionData = async () => {
      if (!selectedCollection) {
        setCollectionContent("");
        setCollectionName(null);
        return;
      }

      const [filesResult, collectionResult] = await Promise.all([
        supabase
          .from("uploaded_files")
          .select("parsed_content")
          .eq("collection_id", selectedCollection),
        supabase
          .from("collections")
          .select("name")
          .eq("id", selectedCollection)
          .single(),
      ]);

      if (filesResult.error) {
        console.error("Error loading collection content:", filesResult.error);
        setCollectionContent("");
      } else {
        const allContent = filesResult.data.map((file) => file.parsed_content || "").join("\n\n");
        setCollectionContent(allContent);
      }

      if (collectionResult.error) {
        console.error("Error loading collection name:", collectionResult.error);
        setCollectionName(null);
      } else {
        setCollectionName(collectionResult.data?.name || null);
      }
    };

    loadCollectionData();
  }, [selectedCollection]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!session && !DEV_MODE) {
    return null;
  }

  const renderMainContent = () => {
    switch (mode) {
      case "flashcards":
        return <FlashcardsViewer collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} />;
      case "quiz":
        return <QuizPanel collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} />;
      case "worksheet":
        return <WorksheetPanel collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} />;
      case "notes":
        return <NotesViewer collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} />;
      default:
        return <ChatPane mode={mode} collectionId={selectedCollection} collectionContent={collectionContent} documentTypeHint={documentTypeHint} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full">
      <TopBar 
        session={session} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen}
        collectionName={collectionName}
        mode={mode}
        onClearCollection={() => setSelectedCollection(null)}
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
    </div>
  );
};

export default Study;