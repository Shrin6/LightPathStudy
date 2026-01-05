import { Button } from "@/components/ui/button";
import { StudyMode } from "@/pages/Study";
import { BookOpen, MessageSquare, Lightbulb, FileText, GraduationCap, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudyModesProps {
  mode: StudyMode;
  setMode: (mode: StudyMode) => void;
}

const modes = [
  { id: "explain" as StudyMode, label: "Tutor", icon: MessageSquare, description: "Ask questions" },
  { id: "worksheet" as StudyMode, label: "Worksheet", icon: FileText, description: "Practice problems" },
  { id: "flashcards" as StudyMode, label: "Flashcards", icon: StickyNote, description: "Review cards" },
  { id: "quiz" as StudyMode, label: "Quiz", icon: GraduationCap, description: "Test yourself" },
  { id: "memory" as StudyMode, label: "Memory", icon: Lightbulb, description: "Get mnemonics" },
  { id: "notes" as StudyMode, label: "Notes", icon: BookOpen, description: "Summarize content" },
];

export const StudyModes = ({ mode, setMode }: StudyModesProps) => {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-sm text-muted-foreground">Study Paths</h3>
      <div className="space-y-1">
        {modes.map((m) => {
          const Icon = m.icon;
          const isActive = mode === m.id;
          return (
            <Button
              key={m.id}
              variant="ghost"
              className={cn(
                "w-full h-10 justify-start gap-3 px-3 rounded-lg text-sm font-medium transition-all",
                isActive 
                  ? "bg-blue-600 text-white hover:bg-blue-700" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
              onClick={() => setMode(m.id)}
            >
              <Icon className="h-4 w-4" />
              <span>{m.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
