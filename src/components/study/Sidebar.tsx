import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CollectionsList } from "./CollectionsList";
import { StudyModes } from "./StudyModes";
import { StudyMode, DocumentTypeHint } from "@/pages/Study";
import { X, Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

    // Subscribe to changes
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

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-[220px] bg-card border-r flex flex-col z-50 transition-transform duration-200 overflow-x-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="px-2 py-2 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Study Workspace</h2>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-6 w-6"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <ScrollArea className="flex-1 overflow-y-auto">
          <div className="px-2 py-2 space-y-3">
            <CollectionsList
              collections={collections}
              selectedCollection={selectedCollection}
              setSelectedCollection={setSelectedCollection}
              onRefresh={fetchCollections}
              loading={loading}
            />

            <Separator />

            <StudyModes mode={mode} setMode={setMode} />

            <Separator />

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                What are these materials?
              </label>
              <Select
                value={documentTypeHint}
                onValueChange={(value) => setDocumentTypeHint(value as DocumentTypeHint)}
              >
                <SelectTrigger className="w-full h-8 text-xs">
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
          </div>
        </ScrollArea>
      </aside>
    </>
  );
};