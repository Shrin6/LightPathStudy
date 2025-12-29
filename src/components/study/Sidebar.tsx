import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CollectionsList } from "./CollectionsList";
import { StudyModes } from "./StudyModes";
import { StudyMode, DocumentTypeHint } from "@/pages/Study";
import { X } from "lucide-react";
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
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed lg:sticky top-0 left-0 h-screen w-[240px] bg-muted/30 border-r flex flex-col z-50 transition-transform duration-200",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        data-testid="sidebar-main"
      >
        <div className="h-12 px-3 border-b flex items-center justify-between bg-background/50">
          <span className="font-medium text-sm text-foreground">Workspace</span>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-7 w-7"
            onClick={() => setIsOpen(false)}
            data-testid="button-close-sidebar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-4">
            <CollectionsList
              collections={collections}
              selectedCollection={selectedCollection}
              setSelectedCollection={setSelectedCollection}
              onRefresh={fetchCollections}
              loading={loading}
            />

            <Separator className="my-3" />

            <StudyModes mode={mode} setMode={setMode} />

            <Separator className="my-3" />

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Material Type
              </label>
              <Select
                value={documentTypeHint}
                onValueChange={(value) => setDocumentTypeHint(value as DocumentTypeHint)}
              >
                <SelectTrigger className="w-full h-8 text-xs" data-testid="select-document-type">
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
