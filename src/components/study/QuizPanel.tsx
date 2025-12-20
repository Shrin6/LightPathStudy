import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, HelpCircle, BarChart3, Lightbulb, Brain, Sparkles } from "lucide-react";
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

    // Salvage valid questions with lenient parsing
    const valid: QuizQuestion[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      const questionText = q.question || q.prompt || '';
      const options = q.options || q.choices || [];
      const correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 
                           typeof q.correct_answer === 'number' ? q.correct_answer : 0;
      
      if (
        typeof questionText === "string" && questionText.length > 5 &&
        Array.isArray(options) && options.length >= 2
      ) {
        // Normalize to 4 options
        const normalizedOptions = options.slice(0, 4).map(String);
        while (normalizedOptions.length < 4) {
          normalizedOptions.push(`Option ${String.fromCharCode(65 + normalizedOptions.length)}`);
        }
        
        valid.push({
          id: q.id || `q${i + 1}`,
          question: questionText,
          options: normalizedOptions,
          correctAnswer: Math.min(Math.max(0, correctAnswer), 3),
          explanation_correct: q.explanation_correct || q.explanation || "No explanation provided.",
          memory_hook: q.memory_hook || q.hint || "",
          skill_tag: q.skill_tag || q.topic || "general"
        });
      }
    }

    console.log("Quiz parsing: salvaged", valid.length, "valid questions");
    return valid.length >= 1 ? valid : null;
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
  
  // Memory Tricks state
  const [showMemoryTrick, setShowMemoryTrick] = useState(false);
  const [memoryStyle, setMemoryStyle] = useState("");
  const [generatedMemoryTrick, setGeneratedMemoryTrick] = useState("");
  const [isGeneratingTrick, setIsGeneratingTrick] = useState(false);
  const [saveToNotes, setSaveToNotes] = useState(false);

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
    if (!collectionId || collectionContent.length < 100) {
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
      toast.success(`Generated ${parsedQuestions.length} questions!`);
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
    setGeneratedMemoryTrick("");
    setShowMemoryTrick(false);
  };

  const handleIdk = () => {
    const currentQuestion = questions[currentIndex];
    setSelectedAnswer(-1);
    setUsedIdk(true);
    updateMastery(currentQuestion.skill_tag, "idk");
    setIsChecked(true);
    setShowMemoryTrick(true);
    setGeneratedMemoryTrick("");
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setIsChecked(false);
      setUsedIdk(false);
      setShowMemoryTrick(false);
      setGeneratedMemoryTrick("");
      setMemoryStyle("");
      setSaveToNotes(false);
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

  const generateMemoryTrick = async () => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) return;
    
    setIsGeneratingTrick(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be logged in");
        return;
      }

      const stylePrompt = memoryStyle 
        ? `Use a ${memoryStyle}-style analogy or reference.` 
        : "Use a simple, memorable analogy.";
      
      const wrongChoice = selectedAnswer !== null && selectedAnswer >= 0 && selectedAnswer !== currentQuestion.correctAnswer
        ? `The user incorrectly chose: "${currentQuestion.options[selectedAnswer]}". Address why this was wrong.`
        : "";

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ 
            role: "user", 
            content: `Create a short memory trick (2-4 lines max) to help remember this concept:

Question: ${currentQuestion.question}
Correct Answer: ${currentQuestion.options[currentQuestion.correctAnswer]}
${wrongChoice}

${stylePrompt}

Be creative, fun, and memorable. Focus on WHY the answer is correct.` 
          }],
          mode: "memory",
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok) throw new Error("Failed to generate memory trick");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let trickText = "";

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
              if (content) {
                trickText += content;
                setGeneratedMemoryTrick(trickText);
              }
            } catch {}
          }
        }
      }

      if (saveToNotes && trickText) {
        toast.success("Memory trick saved to notes!");
      }
    } catch (error) {
      console.error("Error generating memory trick:", error);
      toast.error("Could not generate memory trick");
    } finally {
      setIsGeneratingTrick(false);
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

  if (!collectionContent || collectionContent.length < 100) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Not enough content to generate quiz. Upload more files.</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Ready to test your knowledge?</p>
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
                <p className="text-sm text-muted-foreground">Understanding</p>
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
              <span className="text-muted-foreground">Understanding: {overallMastery}%</span>
              <Dialog open={showProgress} onOpenChange={setShowProgress}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    <BarChart3 className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Progress & Understanding</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Overall Understanding</span>
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

              {/* Memory Trick Section - show for wrong/IDK answers */}
              {(!isCorrect || usedIdk) && (
                <div className="mt-4 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Memory Trick</span>
                  </div>
                  
                  {!generatedMemoryTrick ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="memoryStyle" className="text-xs text-muted-foreground">
                          How do you want to remember this? (optional)
                        </Label>
                        <Input
                          id="memoryStyle"
                          value={memoryStyle}
                          onChange={(e) => setMemoryStyle(e.target.value)}
                          placeholder="e.g., DBZ, cooking, sports, simple..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={generateMemoryTrick}
                          disabled={isGeneratingTrick}
                          className="flex-1"
                        >
                          {isGeneratingTrick ? (
                            <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generating...</>
                          ) : (
                            <><Sparkles className="mr-2 h-3 w-3" /> Generate Memory Trick</>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="p-3 bg-primary/5 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{generatedMemoryTrick}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox 
                          id="saveToNotes" 
                          checked={saveToNotes}
                          onCheckedChange={(checked) => setSaveToNotes(checked === true)}
                        />
                        <Label htmlFor="saveToNotes" className="text-xs text-muted-foreground cursor-pointer">
                          Add this to Simple Notes
                        </Label>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setGeneratedMemoryTrick("");
                          setMemoryStyle("");
                        }}
                      >
                        Generate Another
                      </Button>
                    </div>
                  )}
                </div>
              )}
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