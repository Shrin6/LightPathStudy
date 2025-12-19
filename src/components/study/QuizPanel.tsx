import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
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
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

export const QuizPanel = ({ collectionId, collectionContent, documentTypeHint }: QuizPanelProps) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isChecked, setIsChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);

  const sanitizeJSON = (text: string): string => {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "");
    // Remove any text before first [ and after last ]
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found");
    return match[0];
  };

  const generateQuiz = async () => {
    if (!collectionId || collectionContent.length < 300) {
      toast.error("Not enough content to generate quiz");
      return;
    }

    setIsGenerating(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
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
          messages: [
            {
              role: "user",
              content:
                'Generate 5 multiple-choice quiz questions. Return ONLY valid JSON array: [{"question":"Q1","options":["A","B","C","D"],"correctAnswer":0}]. correctAnswer is index 0-3.',
            },
          ],
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
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) generatedText += content;
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
      // ---- POST-STREAM NORMALIZATION ----
      generatedText = generatedText
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();

      // If model accidentally returned a single object, wrap it
      if (generatedText.startsWith("{") && !generatedText.startsWith("[")) {
        // Try to extract multiple objects and wrap them
        const objects = generatedText.match(/\{[\s\S]*?\}/g);
        if (objects && objects.length > 0) {
          generatedText = `[${objects.join(",")}]`;
        }
      }

      // Log raw AI output for debugging
      console.log("Quiz raw AI output:", generatedText);

      // Length validation (increased to 25000)
      if (generatedText.length > 25000) {
        toast.error("Quiz response too large. Please try with simpler content.");
        setIsGenerating(false);
        return;
      }

      // Sanitize and parse JSON
      let parsedQuestions: QuizQuestion[];
      try {
        const sanitized = sanitizeJSON(generatedText);
        parsedQuestions = JSON.parse(sanitized);
      } catch (cleanupError) {
        console.error("Quiz JSON parse error:", cleanupError, "Raw:", generatedText.substring(0, 500));
        toast.error("Quiz could not be generated. Please try again.");
        setIsGenerating(false);
        return;
      }

      // Validate structure
      if (!Array.isArray(parsedQuestions) || parsedQuestions.length === 0) {
        console.error("Quiz validation failed: not an array or empty");
        toast.error("Quiz generation returned invalid format. Please try again.");
        setIsGenerating(false);
        return;
      }

      // Validate each question
      const validQuestions = parsedQuestions.filter((q, idx) => {
        if (!q.question || typeof q.question !== "string") {
          console.warn(`Question ${idx}: missing question text`);
          return false;
        }
        if (!Array.isArray(q.options) || q.options.length !== 4) {
          console.warn(`Question ${idx}: options must be array of 4`);
          return false;
        }
        if (typeof q.correctAnswer !== "number" || q.correctAnswer < 0 || q.correctAnswer > 3) {
          console.warn(`Question ${idx}: correctAnswer must be 0-3`);
          return false;
        }
        if (!q.explanation || typeof q.explanation !== "string") {
          console.warn(`Question ${idx}: missing explanation`);
          // Still allow it but provide default
          q.explanation = "No explanation provided.";
        }
        return true;
      });

      if (validQuestions.length === 0) {
        console.error("Quiz validation failed: no valid questions after filtering");
        toast.error("Quiz generation failed validation. Please try again.");
        setIsGenerating(false);
        return;
      }

      parsedQuestions = validQuestions;

      setQuestions(parsedQuestions);
      setCurrentIndex(0);
      setScore(0);
      setQuizComplete(false);
      toast.success("Quiz generated!");
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      toast.error("Quiz could not be generated because the source material was too complex or formatted incorrectly.");
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
    if (selectedAnswer === currentQuestion.correctAnswer) {
      setScore(score + 1);
      toast.success("Correct!");
    } else {
      toast.error("Incorrect");
    }
    setIsChecked(true);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setIsChecked(false);
    } else {
      setQuizComplete(true);
      saveScore();
    }
  };

  const saveScore = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !collectionId) return;

      const percentage = Math.round((score / questions.length) * 100);

      // Save to study_sessions as a quiz record
      await supabase.from("study_sessions").insert({
        user_id: user.id,
        collection_id: collectionId,
        mode: "quiz",
        conversation_history: {
          score: percentage,
          total: questions.length,
          correct: score,
        },
      });

      toast.success("Quiz score saved!");
    } catch (error) {
      console.error("Error saving score:", error);
    }
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
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-2">
              <p className="text-4xl font-bold">{percentage}%</p>
              <p className="text-muted-foreground">
                You scored {score} out of {questions.length}
              </p>
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

  return (
    <div className="flex items-center justify-center h-full p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>
              Question {currentIndex + 1} of {questions.length}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              Score: {score}/{currentIndex}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg">{currentQuestion.question}</p>

          <RadioGroup value={selectedAnswer?.toString()} onValueChange={(val) => setSelectedAnswer(parseInt(val))}>
            {currentQuestion.options.map((option, idx) => (
              <div key={idx} className="flex items-center space-x-2">
                <RadioGroupItem value={idx.toString()} id={`option-${idx}`} disabled={isChecked} />
                <Label
                  htmlFor={`option-${idx}`}
                  className={`flex-1 cursor-pointer ${
                    isChecked && idx === currentQuestion.correctAnswer
                      ? "text-green-600 font-semibold"
                      : isChecked && idx === selectedAnswer
                        ? "text-red-600"
                        : ""
                  }`}
                >
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

          {isChecked && currentQuestion.explanation && (
            <div
              className={`p-4 rounded-lg border ${isCorrect ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800" : "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"}`}
            >
              <p className="text-sm font-medium mb-1">{isCorrect ? "Correct!" : "Incorrect"}</p>
              <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            {!isChecked ? (
              <Button onClick={handleCheckAnswer}>Check Answer</Button>
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
