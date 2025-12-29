import { Button } from "@/components/ui/button";
import { StudyMode } from "@/pages/Study";
import { BookOpen, MessageSquare, Lightbulb, FileText, GraduationCap, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyModesProps {
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
}

const modes = [
  { id: "explain" as StudyMode, label: "Tutor", icon: BookOpen, description: "Ask questions" },
  { id: "quiz" as StudyMode, label: "Quiz", icon: GraduationCap, description: "Test yourself" },
  { id: "flashcards" as StudyMode, label: "Flashcards", icon: StickyNote, description: "Review cards" },
  { id: "memory" as StudyMode, label: "Memory", icon: Lightbulb, description: "Get mnemonics" },
  { id: "worksheet" as StudyMode, label: "Worksheet", icon: FileText, description: "Practice problems" },
  { id: "notes" as StudyMode, label: "Notes", icon: MessageSquare, description: "Summarize content" },
];

export const StudyModes = ({ mode, setMode }: StudyModesProps) => {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Study Modes</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <Button
              key={m.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "h-auto py-2 px-2 flex flex-col items-center gap-1 text-xs",
                isActive && "bg-primary text-primary-foreground",
                !isActive && "hover:bg-muted"
              )}
              onClick={() => setMode(m.id)}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{m.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
