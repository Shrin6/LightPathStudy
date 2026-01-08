import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemoryGame } from "./MemoryGame";
import { ChatPane } from "@/components/study/ChatPane";
import type { DocumentTypeHint } from "@/pages/Study";

interface MemoryExperienceProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
  readOnly?: boolean;
}

export const MemoryExperience = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck, readOnly = false }: MemoryExperienceProps) => {
  const [tab, setTab] = useState<"game" | "classic">("game");

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as "game" | "classic")} className="h-full">
      <div className="border-b px-5 py-3 bg-card/60 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Memory Tricks</p>
          <h2 className="text-lg font-semibold">Pick your memory mode</h2>
          <p className="text-sm text-muted-foreground">Game mode is default. Classic panel is still here if you need it.</p>
        </div>
        <TabsList>
          <TabsTrigger value="game">Game mode</TabsTrigger>
          <TabsTrigger value="classic">Classic</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="game" className="h-[calc(100%-60px)] m-0">
        <MemoryGame
          collectionId={collectionId}
          collectionContent={collectionContent}
          documentTypeHint={documentTypeHint}
          onUsageCheck={onUsageCheck}
          readOnly={readOnly}
        />
      </TabsContent>

      <TabsContent value="classic" className="h-[calc(100%-60px)] m-0">
        <ChatPane
          mode="memory"
          collectionId={collectionId}
          collectionContent={collectionContent}
          documentTypeHint={documentTypeHint}
          onUsageCheck={onUsageCheck}
          readOnly={readOnly}
        />
      </TabsContent>
    </Tabs>
  );
};
