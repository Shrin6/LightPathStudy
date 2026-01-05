import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CollectionsList } from "./CollectionsList";
import { StudyModes } from "./StudyModes";
import { StudyMode, DocumentTypeHint } from "@/pages/Study";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Collection {
  id: string;
  name: string;
  created_at: string;
  uploaded_files: any[];
}

interface SidebarProps {
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
  selectedCollection: string | null;
  setSelectedCollection: (id: string | null) => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  documentTypeHint: DocumentTypeHint;
  setDocumentTypeHint: (hint: DocumentTypeHint) => void;
}

export const Sidebar = ({
  mode,
  setMode,
  selectedCollection,
  setSelectedCollection,
  isOpen,
  setIsOpen,
  documentTypeHint,
  setDocumentTypeHint,
}: SidebarProps) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectionsOpen, setCollectionsOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  const fetchCollections = async () => {
    try {
      const { data, error } = await supabase
        .from("collections")
        .select(`
          *,
          uploaded_files (
            id,
            file_name,
            file_type,
            file_size,
            file_path,
            processing,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error("Error fetching collections:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();

    const channel = supabase
      .channel("collections-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collections" },
        () => {
          fetchCollections();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Click-outside detection to close sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!isOpen) return;
      
      const target = event.target as HTMLElement;
      // Don't close if clicking inside sidebar or on the hamburger menu button
      if (
        sidebarRef.current && 
        !sidebarRef.current.contains(target) &&
        !target.closest('[data-sidebar-toggle]')
      ) {
        setIsOpen(false);
      }
    };

    // Only add listener when sidebar is open
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, setIsOpen]);

  return (
    <>
      {/* Overlay - visible on all screen sizes when sidebar is open */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 h-screen w-[420px] bg-background border-r border-border flex flex-col z-50 transition-all duration-300 ease-in-out shadow-lg",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="h-14 px-4 border-b border-border/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">L</span>
            </div>
            <span className="font-semibold text-base">LightPath Study</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-muted/50"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {/* Study Modes */}
            <div>
              <StudyModes mode={mode} setMode={setMode} />
            </div>

            {/* Your Study Paths / Collections */}
            <Collapsible open={collectionsOpen} onOpenChange={setCollectionsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-muted-foreground py-1.5 hover:text-foreground transition-colors">
                <span>Your Study Paths</span>
                {collectionsOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <CollectionsList
                  collections={collections}
                  selectedCollection={selectedCollection}
                  setSelectedCollection={setSelectedCollection}
                  onRefresh={fetchCollections}
                  loading={loading}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Document Type Settings */}
            <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full text-sm font-semibold text-muted-foreground py-1.5 hover:text-foreground transition-colors">
                <span>Settings</span>
                {settingsOpen ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">
                    Document type hint
                  </label>
                  <Select
                    value={documentTypeHint}
                    onValueChange={(value) => setDocumentTypeHint(value as DocumentTypeHint)}
                  >
                    <SelectTrigger className="w-full h-9 text-xs">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MIXED_OR_UNSURE">Mixed / Not sure</SelectItem>
                      <SelectItem value="NOTES_OR_STUDY_GUIDE">Notes / Study Guide</SelectItem>
                      <SelectItem value="QUIZ_OR_TEST">Quiz / Test</SelectItem>
                      <SelectItem value="WORKSHEET_OR_PROBLEM_SET">Worksheet / Problems</SelectItem>
                      <SelectItem value="SLIDES_OR_IMAGES">Slides / Photos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </aside>
    </>
  );
};
