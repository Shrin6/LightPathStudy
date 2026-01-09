import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, HelpCircle, BarChart3, Lightbulb, Brain, Sparkles, Flag, GraduationCap, FileUp } from "lucide-react";
import { formatQuestion, formatAnswer, formatExplanation } from "@/lib/textFormatting";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentTypeHint } from "@/pages/Study";
import { ReportDialog, ReportPayload } from "./ReportDialog";
import { SaveSessionDialog } from "./SaveSessionDialog";
import { insertLearningEvent } from "@/lib/learningEvents";
import { useTimeTracking } from "@/hooks/useTimeTracking";
import { saveSession, updateSession, getIncompleteSessions } from "@/lib/sessionManager";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface QuizPanelProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
  readOnly?: boolean;
}

interface QuizQuestion {
  id?: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: {
    correct: string;
    incorrect: Record<string, string>;
  };
  memory_hook?: string;
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
    
    // Remove markdown fences
    cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    cleaned = cleaned.trim();

    // Try to extract JSON array using regex if direct parse fails
    let jsonStr = cleaned;
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parsed: any[];
    try {
      const result = JSON.parse(jsonStr);
      parsed = Array.isArray(result) ? result : [result];
    } catch {
      // Try extracting from first [ to last ]
      const firstBracket = cleaned.indexOf("[");
      const lastBracket = cleaned.lastIndexOf("]");
      if (firstBracket === -1 || lastBracket <= firstBracket) return null;
      jsonStr = cleaned.substring(firstBracket, lastBracket + 1);
      const result = JSON.parse(jsonStr);
      parsed = Array.isArray(result) ? result : [result];
    }

    // Validate we have an array with question-like objects
    if (!parsed || parsed.length === 0) return null;
    if (!parsed[0] || typeof parsed[0] !== 'object' || !parsed[0].question) return null;

    // Validate and normalize questions
    const valid: QuizQuestion[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const q = parsed[i];
      const questionText = q.question || q.prompt || '';
      const options = q.options || q.choices || [];
      const correctAnswer = typeof q.correctAnswer === 'number' ? q.correctAnswer : 
                           typeof q.correct_answer === 'number' ? q.correct_answer : 0;
      
      // Validate required fields
      if (
        typeof questionText !== "string" || questionText.length < 5 ||
        !Array.isArray(options) || options.length !== 4
      ) {
        console.warn(`Skipping invalid question ${i}:`, q);
        continue;
      }

      // Validate correctAnswer is 0-3
      const normalizedCorrectAnswer = Math.min(Math.max(0, correctAnswer), 3);

      // Build explanation object
      let explanation: { correct: string; incorrect: Record<string, string> };
      if (q.explanation && typeof q.explanation === 'object' && q.explanation.correct) {
        explanation = {
          correct: q.explanation.correct || "No explanation provided.",
          incorrect: q.explanation.incorrect || {}
        };
      } else {
        // Fallback for old format - ensure we only take string values
        let correctText = q.explanation_correct || "";
        if (!correctText && q.explanation && typeof q.explanation === 'string') {
          correctText = q.explanation;
        }
        explanation = {
          correct: correctText || "No explanation provided.",
          incorrect: {}
        };
      }

      // Validate explanation exists
      if (!explanation.correct || typeof explanation.correct !== 'string') {
        explanation.correct = "No explanation provided.";
      }

      // Ensure skill_tag is a single string
      let skillTag = (q.skill_tag || q.topic || "general").toString().trim();
      // If skill_tag is an array, take the first element
      if (Array.isArray(skillTag)) {
        skillTag = skillTag[0]?.toString()?.trim() || "general";
      }
      
      valid.push({
        id: q.id || `q${i + 1}`,
        question: questionText,
        options: options.map(String),
        correctAnswer: normalizedCorrectAnswer,
        explanation,
        memory_hook: q.memory_hook || q.hint || "",
        skill_tag: skillTag
      });
    }

    console.log("Quiz parsing: validated", valid.length, "questions from", parsed.length);
    return valid.length >= 1 ? valid : null;
  } catch (e) {
    console.error("Quiz JSON parse error:", e);
    return null;
  }
};

export const QuizPanel = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck, readOnly = false }: QuizPanelProps) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string>("");
  const [isChecked, setIsChecked] = useState(false);
  const [usedIdk, setUsedIdk] = useState(false);
  const [score, setScore] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [masteryBySkill, setMasteryBySkill] = useState<Record<string, SkillMastery>>({});
  const [showProgress, setShowProgress] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  
  // Memory Tricks state
  const [showMemoryTrick, setShowMemoryTrick] = useState(false);
  const [memoryStyle, setMemoryStyle] = useState("");
  const [generatedMemoryTrick, setGeneratedMemoryTrick] = useState("");
  const [isGeneratingTrick, setIsGeneratingTrick] = useState(false);
  const [saveToNotes, setSaveToNotes] = useState(false);

  // Auto-save state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const { elapsedSeconds } = useTimeTracking({ enabled: questions.length > 0 });

  const updateMastery = (skillTag: string, outcome: "correct" | "wrong" | "idk") => {
    setMasteryBySkill(prev => {
      const current = prev[skillTag] || { correct: 0, wrong: 0, idk: 0, total: 0 };
      const updated = {
        correct: current.correct + (outcome === "correct" ? 1 : 0),
        wrong: current.wrong + (outcome === "wrong" ? 1 : 0),
        idk: current.idk + (outcome === "idk" ? 1 : 0),
        total: current.total + 1
      };
      return {
        ...prev,
        [skillTag]: updated
      };
    });
  };

  const getOverallMastery = (): number => {
    const skills = Object.values(masteryBySkill);
    if (skills.length === 0) return 0;
    const avg = skills.reduce((sum, s) => sum + (s.correct / Math.max(s.total, 1)), 0) / skills.length;
    return Math.min(100, Math.round(avg * 100));
  };

  // Load collection name and check for resume on mount
  useEffect(() => {
    if (!collectionId) return;
    
    const loadCollectionData = async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('name')
        .eq('id', collectionId)
        .single();
      if (data) setCollectionName(data.name);

      // Check for incomplete sessions to resume
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        const incompleteSessions = await getIncompleteSessions(
          user.user.id,
          collectionId,
          'quiz'
        );
        if (incompleteSessions.length > 0) {
          setHasResume(true);
        }
      }
    };

    loadCollectionData();
  }, [collectionId]);

  // Auto-save quiz progress periodically and on beforeunload
  useEffect(() => {
    if (!currentSessionId || !collectionId || questions.length === 0) return;

    const autoSave = async () => {
      const progressPercentage = Math.min(100, Math.round((currentIndex / questions.length) * 100));
      
      await updateSession(currentSessionId, {
        sessionData: {
          questions,
          currentIndex,
          selectedAnswer,
          score,
          masteryBySkill,
        },
        progressPercentage,
        currentIndex,
        totalItems: questions.length,
        durationSeconds: elapsedSeconds,
      });
    };

    // Auto-save every 30 seconds
    autoSaveRef.current = setInterval(autoSave, 30000);

    // Save on page beforeunload
    const handleBeforeUnload = () => {
      autoSave();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentSessionId, collectionId, questions, currentIndex, selectedAnswer, score, masteryBySkill, elapsedSeconds]);

  const getSkillIcon = (skill: SkillMastery) => {
    const pct = (skill.correct / Math.max(skill.total, 1)) * 100;
    if (pct >= 80) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (pct >= 50) return <HelpCircle className="h-4 w-4 text-yellow-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const generateQuiz = async () => {
    // Spam prevention: don't allow multiple simultaneous generations
    if (isGenerating) {
      console.warn("Quiz generation already in progress");
      return;
    }

    if (readOnly) {
      toast.error("Sign in to generate quizzes");
      return;
    }
    
    if (!collectionId || collectionContent.length < 100) {
      toast.error("Not enough content to generate quiz");
      return;
    }

    // Check usage limit
    if (onUsageCheck) {
      const allowed = await onUsageCheck();
      if (!allowed) return;
    }
    
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("You must be logged in");
        return;
      }

      const quizPrompt = `Generate EXACTLY 5 multiple-choice quiz questions based on the provided study material.

Return ONLY a valid JSON array with NO extra text, NO markdown fences.

Each question MUST have this EXACT structure:
[
  {
    "question": "question text here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": {
      "correct": "Step-by-step explanation of why the correct answer is right",
      "incorrect": {
        "0": "Why option 0 is wrong (skip if this is the correct answer)",
        "1": "Why option 1 is wrong (skip if this is the correct answer)",
        "2": "Why option 2 is wrong (skip if this is the correct answer)",
        "3": "Why option 3 is wrong (skip if this is the correct answer)"
      }
    },
    "skill_tag": "topic_name"
  }
]

Rules:
- options array MUST have exactly 4 items
- correctAnswer MUST be 0, 1, 2, or 3 (index of correct option)
- explanation.correct MUST explain WHY the answer is correct step-by-step
- explanation.incorrect MUST explain why EACH wrong option is wrong
- Return ONLY the JSON array, nothing else`;

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: quizPrompt }],
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

      console.log(`Quiz generated with ${parsedQuestions.length} questions (expected 5)`);
      if (parsedQuestions.length < 5) {
        console.warn(`Warning: Only ${parsedQuestions.length} questions generated instead of 5`);
      }

      // Create a new saved session for auto-save
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user?.id && collectionId) {
        const sessionData = await saveSession({
          userId: userData.user.id,
          collectionId,
          mode: 'quiz',
          sessionData: {
            questions: parsedQuestions,
            currentIndex: 0,
            selectedAnswer: "",
            score: 0,
            masteryBySkill: {},
          },
          progressPercentage: 0,
          currentIndex: 0,
          totalItems: parsedQuestions.length,
          durationSeconds: 0,
          isCompleted: false,
        });
        if (sessionData?.id) {
          setCurrentSessionId(sessionData.id);
        }
      }

      setQuestions(parsedQuestions);
      setCurrentIndex(0);
      setScore(0);
      setQuizComplete(false);
      setSelectedAnswer("");
      setIsChecked(false);
      setUsedIdk(false);
      setGeneratedMemoryTrick("");
      setShowMemoryTrick(false);
      setMasteryBySkill({}); // Reset mastery for new quiz
      toast.success(`Generated ${parsedQuestions.length} questions!`);
    } catch (error) {
      console.error("Error generating quiz:", error);
      toast.error("Quiz could not be generated. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheckAnswer = async () => {
    if (selectedAnswer === "") {
      toast.error("Please select an answer");
      return;
    }
    const currentQuestion = questions[currentIndex];
    const selectedIdx = parseInt(selectedAnswer);
    const isCorrect = selectedIdx === currentQuestion.correctAnswer;
    
    if (isCorrect) {
      setScore(score + 1);
      updateMastery(currentQuestion.skill_tag, "correct");
    } else {
      updateMastery(currentQuestion.skill_tag, "wrong");
    }
    setIsChecked(true);
    setGeneratedMemoryTrick("");
    setShowMemoryTrick(false);

    // Insert learning event
    await insertLearningEvent(
      collectionId,
      isCorrect ? "QUIZ_RIGHT" : "QUIZ_WRONG",
      currentQuestion.skill_tag || currentQuestion.question.substring(0, 100),
      {
        question: currentQuestion.question,
        correctAnswer: currentQuestion.correctAnswer,
        selectedAnswer: selectedAnswer,
        explanation: currentQuestion.explanation?.correct || "",
        options: currentQuestion.options,
      }
    );
  };

  const handleIdk = () => {
    const currentQuestion = questions[currentIndex];
    setSelectedAnswer("-1");
    setUsedIdk(true);
    updateMastery(currentQuestion.skill_tag, "idk");
    setIsChecked(true);
    setShowMemoryTrick(true);
    setGeneratedMemoryTrick("");
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer("");
      setIsChecked(false);
      setUsedIdk(false);
      setShowMemoryTrick(false);
      setGeneratedMemoryTrick("");
      setMemoryStyle("");
      setSaveToNotes(false);
    } else {
      setQuizComplete(true);
      saveScore();
      
      // Mark session as completed
      if (currentSessionId) {
        updateSession(currentSessionId, {
          isCompleted: true,
          ended_at: new Date().toISOString(),
          durationSeconds: elapsedSeconds,
        });
      }
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
      
      const wrongChoice = selectedAnswer !== "" && parseInt(selectedAnswer) >= 0 && parseInt(selectedAnswer) !== currentQuestion.correctAnswer
        ? `The user incorrectly chose: "${currentQuestion.options[parseInt(selectedAnswer)]}". Address why this was wrong.`
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
        // Save to localStorage
        const existing = localStorage.getItem("savedMemoryTricks");
        const tricks = existing ? JSON.parse(existing) : [];
        tricks.push({
          concept: currentQuestion.question.substring(0, 100),
          trick: trickText,
          date: new Date().toLocaleDateString()
        });
        localStorage.setItem("savedMemoryTricks", JSON.stringify(tricks));
        toast.success("Memory trick saved!");
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
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-green-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-green-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Test Your Knowledge</h3>
          <p className="text-muted-foreground">Select a collection from the sidebar to generate practice quizzes</p>
        </div>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 20) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-amber-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-amber-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FileUp className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Need More Content</h3>
          <p className="text-muted-foreground">Upload files to this collection to generate quiz questions</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Ready to test your knowledge?</p>
          <Button onClick={generateQuiz} disabled={isGenerating || readOnly} size="sm">
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? "Generating..." : "Generate Quiz"}
          </Button>
        </div>
      </div>
    );
  }

  if (quizComplete) {
    const percentage = Math.min(100, Math.round((score / questions.length) * 100));
    const overallMastery = getOverallMastery();
    
    // Debug: Log the mastery breakdown
    const skillBreakdown = Object.entries(masteryBySkill).map(([skill, data]) => ({
      skill,
      correct: data.correct,
      wrong: data.wrong,
      idk: data.idk,
      total: data.total,
      percentage: Math.round((data.correct / Math.max(data.total, 1)) * 100)
    }));
    
    console.log(`=== QUIZ COMPLETE ===`);
    console.log(`Score: ${score}/${questions.length} (${percentage}%)`);
    console.log(`Overall Understanding: ${overallMastery}%`);
    console.log(`Skills Tracked: ${skillBreakdown.length}`);
    skillBreakdown.forEach(s => {
      console.log(`  • ${s.skill}: ${s.correct}/${s.total} (${s.percentage}%)`);
    });
    
    return (
      <div className="flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quiz Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{percentage}%</p>
                <p className="text-xs text-muted-foreground">Score</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{overallMastery}%</p>
                <p className="text-xs text-muted-foreground">Understanding</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-xs">Skill Breakdown</p>
              {Object.entries(masteryBySkill).map(([tag, skill]) => (
                <div key={tag} className="flex items-center gap-2 text-xs">
                  {getSkillIcon(skill)}
                  <span className="flex-1 capitalize">{tag.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground">{skill.correct}/{skill.total}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-center pt-2">
              <Button onClick={generateQuiz} size="sm" disabled={isGenerating || readOnly}>
                {isGenerating ? "Generating..." : "Take Another Quiz"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuizComplete(false)}>
                Review Answers
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const isCorrect = parseInt(selectedAnswer) === currentQuestion.correctAnswer;
  const overallMastery = getOverallMastery();

  return (
    <>
      <div className="flex items-center justify-center h-full p-4">
        <Card className="w-full max-w-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm font-medium">
              Q{currentIndex + 1}/{questions.length}
            </CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Score: {score}/{currentIndex}</span>
              <span>•</span>
              <span>{overallMastery}% mastery</span>
              <Dialog open={showProgress} onOpenChange={setShowProgress}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <BarChart3 className="h-3.5 w-3.5" />
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
          <div className="flex items-start justify-between gap-2">
            <p className="text-base font-medium flex-1">{formatQuestion(currentQuestion.question)}</p>
            <ReportDialog
              feature="quiz"
              payload={{
                feature: "quiz",
                collection_id: collectionId,
                question_id: currentQuestion.id,
                question_index: currentIndex,
                question_text: currentQuestion.question,
                correct_answer: currentQuestion.options[currentQuestion.correctAnswer],
                explanation: currentQuestion.explanation.correct,
              }}
            />
          </div>

          <RadioGroup
            value={selectedAnswer}
            onValueChange={setSelectedAnswer}
            className="space-y-2"
          >
            {currentQuestion.options.map((option, idx) => (
              <div
                key={idx}
                className={`flex items-center space-x-2 p-2 rounded-md border transition-colors ${
                  isChecked && idx === currentQuestion.correctAnswer
                    ? "bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-800"
                    : isChecked && idx === parseInt(selectedAnswer) && idx !== currentQuestion.correctAnswer
                      ? "bg-red-50 border-red-300 dark:bg-red-950/30 dark:border-red-800"
                      : "hover:bg-muted/50"
                }`}
              >
                <RadioGroupItem value={idx.toString()} id={`option-${idx}`} disabled={isChecked} />
                <Label htmlFor={`option-${idx}`} className="flex-1 cursor-pointer text-sm">
                  {formatAnswer(option)}
                  {isChecked && idx === currentQuestion.correctAnswer && (
                    <CheckCircle2 className="inline ml-2 h-4 w-4 text-green-600" />
                  )}
                  {isChecked && parseInt(selectedAnswer) === idx && idx !== currentQuestion.correctAnswer && (
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
                  {generateWrongFeedback(selectedAnswer ? parseInt(selectedAnswer) : -1, currentQuestion.correctAnswer, currentQuestion.options)}
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-700 dark:text-green-400 mb-1">Why the correct answer is correct:</p>
                    <p className="text-muted-foreground">{formatExplanation(currentQuestion.explanation.correct)}</p>
                  </div>
                </div>
                
                {Object.keys(currentQuestion.explanation.incorrect).length > 0 && (
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-amber-700 dark:text-amber-400 mb-1">Why other options are wrong:</p>
                      <ul className="space-y-1 text-muted-foreground">
                        {currentQuestion.options.map((opt, idx) => {
                          if (idx === currentQuestion.correctAnswer) return null;
                          const reason = currentQuestion.explanation.incorrect[idx.toString()];
                          if (!reason) return null;
                          return (
                            <li key={idx} className="flex gap-1">
                              <span className="font-medium shrink-0">{String.fromCharCode(65 + idx)}:</span>
                              <span>{formatExplanation(reason)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}

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

    <SaveSessionDialog
      open={showSaveDialog}
      onOpenChange={setShowSaveDialog}
      mode="quiz"
      collectionName={collectionName}
      onSave={async () => {
        // Session is already saved via auto-save mechanism
        setShowSaveDialog(false);
      }}
      onSkip={() => {}}
    />
    </>
  );
};
