import { Button } from "@/components/ui/button";
import { StudyMode } from "@/pages/Study";
import { BookOpen, MessageSquare, Lightbulb, FileText, GraduationCap, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyModesProps {
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
}

const modes = [
  { id: "explain" as StudyMode, label: "Explain", icon: BookOpen },
  { id: "quiz" as StudyMode, label: "Quiz", icon: GraduationCap },
  { id: "flashcards" as StudyMode, label: "Flashcards", icon: StickyNote },
  { id: "memory" as StudyMode, label: "Memory", icon: Lightbulb },
  { id: "worksheet" as StudyMode, label: "Worksheet", icon: FileText },
  { id: "notes" as StudyMode, label: "Notes", icon: MessageSquare },
];

export const StudyModes = ({ mode, setMode }: StudyModesProps) => {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Study Modes</h3>
      <div className="grid grid-cols-2 gap-1.5">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <Button
              key={m.id}
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "justify-start h-8 text-xs px-2 gap-1.5",
                isActive && "bg-primary text-primary-foreground shadow-sm"
              )}
              onClick={() => setMode(m.id)}
              data-testid={`button-mode-${m.id}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {m.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
