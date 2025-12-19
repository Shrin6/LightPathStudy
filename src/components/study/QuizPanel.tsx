import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, HelpCircle, BarChart3, Lightbulb, Brain } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentTypeHint } from "@/pages/Study";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface QuizPanelProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
}

interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation_correct: string;
  memory_hook: string;
  skill_tag: string;
}

interface SkillMastery {
  correct: number;
  wrong: number;
  idk: number;
  total: number;
}

const sanitizeQuizJSON = (text: string): QuizQuestion[] | null => {
  try {
    let cleaned = text.trim();
    cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    cleaned = cleaned.trim();

    // Handle object wrapper
    if (cleaned.startsWith("{")) {
      const arrayMatch = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        cleaned = arrayMatch[0];
      }
    }

    // Extract array
    const firstBracket = cleaned.indexOf("[");
    const lastBracket = cleaned.lastIndexOf("]");
    if (firstBracket === -1 || lastBracket <= firstBracket) return null;
    cleaned = cleaned.substring(firstBracket, lastBracket + 1);

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Salvage valid questions
    const valid: QuizQuestion[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      if (
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        typeof q.correctAnswer === "number" &&
        q.correctAnswer >= 0 &&
        q.correctAnswer <= 3
      ) {
        valid.push({
          id: q.id || `q${i + 1}`,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          explanation_correct: q.explanation_correct || q.explanation || "This is the correct answer.",
          memory_hook: q.memory_hook || "",
          skill_tag: q.skill_tag || "general"
        });
      }
    }

    console.log("Quiz parsing: salvaged", valid.length, "valid questions");
    return valid.length >= 3 ? valid : null;
  } catch (e) {
    console.error("Quiz JSON parse error:", e);
    return null;
  }
};

export const QuizPanel = ({ collectionId, collectionContent, documentTypeHint }: QuizPanelProps) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [usedIdk, setUsedIdk] = useState(false);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [masteryBySkill, setMasteryBySkill] = useState<Record<string, SkillMastery>>({});
  const [showProgress, setShowProgress] = useState(false);

  const updateMastery = (skillTag: string, outcome: "correct" | "wrong" | "idk") => {
    setMasteryBySkill(prev => {
      const current = prev[skillTag] || { correct: 0, wrong: 0, idk: 0, total: 0 };
      return {
        ...prev,
        [skillTag]: {
          correct: current.correct + (outcome === "correct" ? 1 : 0),
          wrong: current.wrong + (outcome === "wrong" ? 1 : 0),
          idk: current.idk + (outcome === "idk" ? 1 : 0),
          total: current.total + 1
        }
      };
    });
  };

  const getOverallMastery = (): number => {
    const skills = Object.values(masteryBySkill);
    if (skills.length === 0) return 0;
    const avg = skills.reduce((sum, s) => sum + (s.correct / Math.max(s.total, 1)), 0) / skills.length;
    return Math.round(avg * 100);
  };

  const getSkillIcon = (skill: SkillMastery) => {
    const pct = (skill.correct / Math.max(skill.total, 1)) * 100;
    if (pct >= 80) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (pct >= 50) return <HelpCircle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const generateQuiz = async () => {
    if (!collectionId || collectionContent.length < 300) {
      toast.error("Not enough content to generate quiz");
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be logged in");
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Generate 5 multiple-choice quiz questions." }],
          mode: "quiz",
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate quiz");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let generatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) generatedText += content;
            } catch {}
          }
        }
      }

      console.log("Quiz raw AI output:", generatedText.substring(0, 500));

      const parsedQuestions = sanitizeQuizJSON(generatedText);
      if (!parsedQuestions) {
        toast.error("Quiz generation failed. Please try again.");
        return;
      }

      setQuestions(parsedQuestions);
      setCurrentIndex(0);
      setScore(0);
      setQuizComplete(false);
      setMasteryBySkill({});
      toast.success("Quiz generated!");
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Quiz could not be generated. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheckAnswer = () => {
    if (selectedAnswer === null) {
      toast.error("Please select an answer");
      return;
    }
    const currentQuestion = questions[currentIndex];
    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      setScore(score + 1);
      updateMastery(currentQuestion.skill_tag, "correct");
    } else {
      updateMastery(currentQuestion.skill_tag, "wrong");
    }
    setIsChecked(true);
  };

  const handleIdk = () => {
    const currentQuestion = questions[currentIndex];
    setSelectedAnswer(-1); // Mark as IDK
    setUsedIdk(true);
    updateMastery(currentQuestion.skill_tag, "idk");
    setIsChecked(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setIsChecked(false);
      setUsedIdk(false);
    } else {
      setQuizComplete(true);
      saveScore();
    }
  };

  const saveScore = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !collectionId) return;

      const percentage = Math.round((score / questions.length) * 100);
      await supabase.from("study_sessions").insert([{
        user_id: user.id,
        collection_id: collectionId,
        mode: "quiz",
        conversation_history: JSON.parse(JSON.stringify({
          score: percentage,
          total: questions.length,
          correct: score,
          mastery: masteryBySkill
        })),
      }]);
    } catch (error) {
      console.error("Error saving score:", error);
    }
  };

  const generateWrongFeedback = (selectedIdx: number, correctIdx: number, options: string[]): string => {
    if (selectedIdx === -1) {
      return `The correct answer was "${options[correctIdx]}".`;
    }
    return `You picked "${options[selectedIdx]}". The correct answer is "${options[correctIdx]}".`;
  };

  if (!collectionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a collection to start a quiz</p>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 300) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Not enough content to generate quiz. Upload more detailed files.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No quiz yet</p>
          <Button onClick={generateQuiz} disabled={isGenerating}>
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? "Generating..." : "Generate Quiz"}
          </Button>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.round((score / questions.length) * 100);
    const overallMastery = getOverallMastery();
    
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold">{percentage}%</p>
                <p className="text-sm text-muted-foreground">Score</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-3xl font-bold">{overallMastery}%</p>
                <p className="text-sm text-muted-foreground">Mastery</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-sm">Skill Breakdown</p>
              {Object.entries(masteryBySkill).map(([tag, skill]) => (
                <div key={tag} className="flex items-center gap-2 text-sm">
                  {getSkillIcon(skill)}
                  <span className="flex-1">{tag.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{skill.correct}/{skill.total}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-center">
              <Button onClick={generateQuiz}>Take Another Quiz</Button>
              <Button variant="outline" onClick={() => setQuizComplete(false)}>
                Review Answers
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
  const overallMastery = getOverallMastery();

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-base">
              Q{currentIndex + 1}/{questions.length}
            </CardTitle>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Score: {score}/{currentIndex}</span>
              <span className="text-muted-foreground">Mastery: {overallMastery}%</span>
              <Dialog open={showProgress} onOpenChange={setShowProgress}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Skill Progress</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Overall Mastery</span>
                        <span className="font-medium">{overallMastery}%</span>
                      </div>
                      <Progress value={overallMastery} className="h-2" />
                    </div>
                    <div className="space-y-3">
                      {Object.entries(masteryBySkill).length === 0 ? (
                        <p className="text-sm text-muted-foreground">Answer questions to see skill breakdown.</p>
                      ) : (
                        Object.entries(masteryBySkill).map(([tag, skill]) => {
                          const pct = Math.round((skill.correct / Math.max(skill.total, 1)) * 100);
                          return (
                            <div key={tag} className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                {getSkillIcon(skill)}
                                <span className="flex-1 capitalize">{tag.replace(/_/g, " ")}</span>
                                <span className="text-muted-foreground">{skill.correct}/{skill.total}</span>
                              </div>
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-base font-medium">{currentQuestion.question}</p>

          <RadioGroup
            value={selectedAnswer?.toString()}
            onValueChange={(val) => setSelectedAnswer(parseInt(val))}
            className="space-y-2"
          >
            {currentQuestion.options.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-center space-x-2 p-2 rounded-md border transition-colors ${
                  isChecked && idx === currentQuestion.correctAnswer
                    ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800"
                    : isChecked && idx === selectedAnswer && idx !== currentQuestion.correctAnswer
                      ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800"
                      : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value={idx.toString()} id={`option-${idx}`} disabled={isChecked} />
                <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer text-sm">
                  {option}
                  {isChecked && idx === currentQuestion.correctAnswer && (
                    <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-600" />
                  )}
                  {isChecked && idx === selectedAnswer && idx !== currentQuestion.correctAnswer && (
                    <XCircle className="inline ml-2 h-4 w-4 text-red-600" />
                  )}
                </Label>
              </div>
            ))}
          </RadioGroup>

          {isChecked && (
            <div
              className={`p-4 rounded-lg border space-y-3 ${
                isCorrect && !usedIdk
                  ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                  : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
              }`}
            >
              <p className="text-sm font-semibold flex items-center gap-2">
                {isCorrect && !usedIdk ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-green-600" /> Correct!
                  </>
                ) : usedIdk ? (
                  <>
                    <HelpCircle className="h-4 w-4 text-amber-600" /> You chose: I don't know
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-600" /> Incorrect
                  </>
                )}
              </p>

              {(!isCorrect || usedIdk) && (
                <p className="text-sm text-muted-foreground">
                  {generateWrongFeedback(selectedAnswer ?? -1, currentQuestion.correctAnswer, currentQuestion.options)}
                </p>
              )}

              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-sm"><strong>Why correct:</strong> {currentQuestion.explanation_correct}</p>
                </div>
                {currentQuestion.memory_hook && (
                  <div className="flex items-start gap-2">
                    <Brain className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm"><strong>Remember:</strong> {currentQuestion.memory_hook}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {!isChecked ? (
              <>
                <Button variant="outline" onClick={handleIdk}>
                  <HelpCircle className="mr-1 h-4 w-4" /> I don't know
                </Button>
                <Button onClick={handleCheckAnswer}>Check Answer</Button>
              </>
            ) : (
              <Button onClick={handleNext}>
                {currentIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};