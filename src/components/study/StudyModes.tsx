import { Button } from "@/components/ui/button";
import { StudyMode } from "@/pages/Study";
import { BookOpen, MessageSquare, Lightbulb, FileText, GraduationCap, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyModesProps {
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
}

const modes = [
  { id: "explain" as StudyMode, label: "Explain Mode", icon: BookOpen },
  { id: "quiz" as StudyMode, label: "Quiz Mode", icon: GraduationCap },
  { id: "flashcards" as StudyMode, label: "Flashcards", icon: StickyNote },
  { id: "memory" as StudyMode, label: "Memory Tricks", icon: Lightbulb },
  { id: "worksheet" as StudyMode, label: "Worksheet", icon: FileText },
  { id: "notes" as StudyMode, label: "Simple Notes", icon: MessageSquare },
];

export const StudyModes = ({ mode, setMode }: StudyModesProps) => {
  return (
    <div className="space-y-2">
      <h3 className="font-medium text-sm">Study Modes</h3>
      <div className="space-y-0.5">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <Button
              key={m.id}
              variant={mode === m.id ? "default" : "ghost"}
              className={cn(
                "w-full justify-start h-8 text-xs px-2",
                mode === m.id && "bg-primary text-primary-foreground"
              )}
              onClick={() => setMode(m.id)}
            >
              <Icon className="h-3 w-3 mr-1.5" />
              {m.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};