import { Button } from "@/components/ui/button";
import { StudyMode } from "@/pages/Study";
import { BookOpen, MessageSquare, Lightbulb, FileText, GraduationCap, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyModesProps {
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
}

const modes = [
  { id: "explain" as StudyMode, label: "Tutor", description: "Ask questions", icon: BookOpen },
  { id: "quiz" as StudyMode, label: "Quiz", description: "Test yourself", icon: GraduationCap },
  { id: "flashcards" as StudyMode, label: "Flashcards", description: "Review cards", icon: StickyNote },
  { id: "memory" as StudyMode, label: "Memory", description: "Mnemonics", icon: Lightbulb },
  { id: "worksheet" as StudyMode, label: "Worksheet", description: "Practice sets", icon: FileText },
  { id: "notes" as StudyMode, label: "Notes", description: "Key points", icon: MessageSquare },
];

export const StudyModes = ({ mode, setMode }: StudyModesProps) => {
  return (
    <div className="space-y-1.5">
      <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide px-1">Study Modes</h3>
      <div className="space-y-0.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <Button
              key={m.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start h-9 text-xs px-2 gap-2",
                isActive 
                  ? "bg-primary text-primary-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setMode(m.id)}
              data-testid={`button-mode-${m.id}`}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "" : "text-muted-foreground")} />
              <div className="flex flex-col items-start min-w-0">
                <span className="font-medium">{m.label}</span>
              </div>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
