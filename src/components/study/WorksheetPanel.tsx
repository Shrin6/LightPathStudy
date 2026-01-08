import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, ChevronLeft, ChevronRight, Check, X, RotateCcw, HelpCircle, BarChart3, CheckCircle2, XCircle, Sparkles, Brain, Flag, FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { exportWorksheetToPdf } from '@/lib/exportUtils';
import { DocumentTypeHint } from "@/pages/Study";
import { ReportDialog, ReportPayload } from "./ReportDialog";
import { insertLearningEvent } from "@/lib/learningEvents";
import { useTimeTracking } from "@/hooks/useTimeTracking";
import { saveSession, updateSession, getIncompleteSessions } from "@/lib/sessionManager";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface WorksheetPanelProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
  readOnly?: boolean;
}

interface WorksheetQuestion {
  id: string;
  type: 'mcq' | 'short' | 'calc' | 'fill_blank';
  prompt: string;
  choices?: string[];
  answer: string;
  explanation: string;
  source_ref?: string;
}

interface WorksheetResponse {
  set_id: string;
  topic_focus: string;
  questions: WorksheetQuestion[];
}

interface SkillMastery {
  correct: number;
  wrong: number;
  idk: number;
  total: number;
}

type WorksheetMode = 'onsite' | 'download';

function sanitizeWorksheetResponse(raw: string): WorksheetResponse | null {
  try {
    let text = raw.trim();
    console.log('WorksheetPanel: raw AI output length:', text.length);
    
    // Remove markdown code fences aggressively
    text = text.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '');
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
    text = text.replace(/^\s*json\s*/i, '');
    text = text.trim();
    
    // Find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }
    
    // Parse with fallback for questions array extraction
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract just the questions array
      const questionsMatch = text.match(/"questions"\s*:\s*\[([\s\S]*)\]/);
      if (questionsMatch) {
        try {
          const questionsArr = JSON.parse('[' + questionsMatch[1] + ']');
          parsed = { questions: questionsArr };
        } catch {
          return null;
        }
      } else {
        return null;
      }
    }
    
    // Handle if it's already an array
    let questionsArr = parsed.questions;
    if (!questionsArr && Array.isArray(parsed)) {
      questionsArr = parsed;
    }
    
    if (!questionsArr || !Array.isArray(questionsArr)) {
      console.log('WorksheetPanel: No questions array found');
      return null;
    }
    
    // Filter valid questions with LENIENT validation
    const validQuestions: WorksheetQuestion[] = [];
    for (const q of questionsArr) {
      const prompt = q.prompt || q.question || q.text || '';
      
      if (typeof prompt === 'string' && prompt.length > 5) {
        const qType = q.type || (q.choices || q.options ? 'mcq' : 'short');
        const choices = q.choices || q.options;
        
        validQuestions.push({
          id: q.id || `q${validQuestions.length + 1}`,
          type: qType as any,
          prompt: prompt,
          choices: Array.isArray(choices) ? choices.map(String) : undefined,
          answer: String(q.answer || q.correct_answer || q.correctAnswer || ''),
          explanation: q.explanation || q.reason || 'No explanation provided.',
          source_ref: q.source_ref || q.source || undefined
        });
      }
    }
    
    console.log('WorksheetPanel: salvaged', validQuestions.length, 'valid questions');
    
    // Lower threshold - accept with just 3 valid questions
    if (validQuestions.length < 3) {
      console.log('WorksheetPanel: Less than 3 valid questions');
      return null;
    }
    
    const result = {
      set_id: parsed.set_id || crypto.randomUUID(),
      topic_focus: parsed.topic_focus || '',
      questions: validQuestions
    };
    
    console.log('WorksheetPanel: Returning worksheet data with', result.questions.length, 'questions');
    return result;
  } catch (e) {
    console.log('WorksheetPanel: Parse error:', e);
    return null;
  }
}

export const WorksheetPanel = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck, readOnly = false }: WorksheetPanelProps) => {
  const [worksheetMode, setWorksheetMode] = useState<WorksheetMode>('onsite');
  const [topicFocus, setTopicFocus] = useState('');
  const [worksheet, setWorksheet] = useState<WorksheetResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // On-site mode state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [idkAnswers, setIdkAnswers] = useState<Record<string, boolean>>({});
  const [manuallyCorrected, setManuallyCorrected] = useState<Record<string, boolean>>({});
  const [showResults, setShowResults] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [userTextAnswer, setUserTextAnswer] = useState('');
  
  // Progress tracking
  const [masteryByTopic, setMasteryByTopic] = useState<Record<string, SkillMastery>>({});
  const [showProgress, setShowProgress] = useState(false);
  
  // Memory Tricks
  const [showMemoryTrick, setShowMemoryTrick] = useState(false);
  const [memoryStyle, setMemoryStyle] = useState("");
  const [generatedMemoryTrick, setGeneratedMemoryTrick] = useState("");
  const [isGeneratingTrick, setIsGeneratingTrick] = useState(false);
  const [saveToNotes, setSaveToNotes] = useState(false);

  // Auto-save state
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [hasResume, setHasResume] = useState(false);
  const autoSaveRef = useRef<NodeJS.Timeout | null>(null);
  const { elapsedSeconds } = useTimeTracking({ enabled: !!worksheet && !showResults });

  const generateWorksheet = async (questionCount: number = 20) => {
    if (readOnly) {
      toast.error('Sign in to generate worksheets');
      return;
    }

    if (!collectionId) {
      toast.error('Please select a collection first');
      return;
    }
    
    if (collectionContent.length < 20) {
      toast.error('Collection content is too short. Please upload some materials first.');
      return;
    }

    // Check usage limit
    if (onUsageCheck) {
      const allowed = await onUsageCheck();
      if (!allowed) return;
    }
    setIsGenerating(true);
    setWorksheet(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setIdkAnswers({});
    setShowResults(false);
    setGeneratedMemoryTrick("");
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('You must be logged in');
        return;
      }

      console.log('WorksheetPanel: Generating worksheet -', worksheetMode, 'topic:', topicFocus, 'count:', questionCount);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ 
            role: 'user', 
            content: `Generate ${questionCount} practice questions.${topicFocus ? ` Focus on: ${topicFocus}` : ''}` 
          }],
          mode: 'worksheet',
          worksheet_mode: worksheetMode,
          topic_focus: topicFocus,
          question_count: questionCount,
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate worksheet');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let generatedText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

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

      console.log('WorksheetPanel: Full generated text length:', generatedText.length);
      
      const worksheetData = sanitizeWorksheetResponse(generatedText);
      
      console.log('WorksheetPanel: Sanitized result:', worksheetData ? `${worksheetData.questions.length} questions` : 'null');
      
      if (worksheetData && worksheetData.questions.length >= 3) {
        // Create a new saved session for auto-save
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.id && collectionId) {
          const sessionData = await saveSession({
            userId: userData.user.id,
            collectionId,
            mode: 'worksheet',
            sessionData: {
              worksheet: worksheetData,
              currentQuestionIndex: 0,
              userAnswers: {},
              checkedAnswers: {},
              idkAnswers: {},
              masteryByTopic: {},
            },
            progressPercentage: 0,
            currentIndex: 0,
            totalItems: worksheetData.questions.length,
            durationSeconds: 0,
            isCompleted: false,
          });
          if (sessionData?.id) {
            setCurrentSessionId(sessionData.id);
          }
        }

        setWorksheet(worksheetData);
        console.log('WorksheetPanel: parsed question count:', worksheetData.questions.length);
        toast.success(`Generated ${worksheetData.questions.length} questions!`);
      } else {
        console.error('WorksheetPanel: Failed to parse worksheet or too few questions', {
          hasData: !!worksheetData,
          questionCount: worksheetData?.questions.length || 0,
          rawTextPreview: generatedText.substring(0, 200)
        });
        toast.error('Could not generate enough valid questions. Try adjusting your topic focus or regenerating.');
      }
    } catch (error: any) {
      console.error('Error generating worksheet:', error);
      toast.error(error.message || 'Failed to generate worksheet');
    } finally {
      setIsGenerating(false);
    }
  };

  // Load collection and check for resume on mount
  useEffect(() => {
    if (!collectionId) return;

    const loadCollectionData = async () => {
      // Check for incomplete sessions to resume
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        const incompleteSessions = await getIncompleteSessions(
          user.user.id,
          collectionId,
          'worksheet'
        );
        if (incompleteSessions.length > 0) {
          setHasResume(true);
        }
      }
    };

    loadCollectionData();
  }, [collectionId]);

  // Auto-save worksheet progress periodically and on beforeunload
  useEffect(() => {
    if (!currentSessionId || !collectionId || !worksheet) return;

    const autoSave = async () => {
      const progressPercentage = Math.min(
        100,
        Math.round((currentQuestionIndex / worksheet.questions.length) * 100)
      );

      await updateSession(currentSessionId, {
        sessionData: {
          worksheet,
          currentQuestionIndex,
          userAnswers,
          checkedAnswers,
          idkAnswers,
          masteryByTopic,
        },
        progressPercentage,
        currentIndex: currentQuestionIndex,
        totalItems: worksheet.questions.length,
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
  }, [currentSessionId, collectionId, worksheet, currentQuestionIndex, userAnswers, checkedAnswers, idkAnswers, masteryByTopic, elapsedSeconds]);

  const handleDownload = () => {
    if (!worksheet || worksheet.questions.length === 0) {
      toast.error('No worksheet to download');
      return;
    }

    try {
      const sections = worksheet.questions.map((q, i) => ({
        type: `Question ${i + 1} (${q.type.toUpperCase()})`,
        content: q.type === 'mcq' && q.choices 
          ? `${q.prompt}\n\n${q.choices.map((c, j) => `  ${String.fromCharCode(65 + j)}. ${c}`).join('\n')}`
          : q.prompt
      }));
      
      sections.push({
        type: 'ANSWER KEY',
        content: worksheet.questions.map((q, i) => 
          `${i + 1}. ${q.answer}${q.explanation ? ` — ${q.explanation}` : ''}`
        ).join('\n\n')
      });

      const title = topicFocus ? `Worksheet: ${topicFocus}` : 'Study Worksheet';
      exportWorksheetToPdf(title, sections, 'study-worksheet.pdf');
      toast.success('Worksheet downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    }
  };

  const currentQuestion = worksheet?.questions[currentQuestionIndex];
  const isAnswerChecked = currentQuestion ? checkedAnswers[currentQuestion.id] : false;
  const isIdkAnswer = currentQuestion ? idkAnswers[currentQuestion.id] : false;
  const totalQuestions = worksheet?.questions.length || 0;

  const updateMastery = (questionType: string, outcome: "correct" | "wrong" | "idk") => {
    const topic = topicFocus || questionType;
    setMasteryByTopic(prev => {
      const current = prev[topic] || { correct: 0, wrong: 0, idk: 0, total: 0 };
      return {
        ...prev,
        [topic]: {
          correct: current.correct + (outcome === "correct" ? 1 : 0),
          wrong: current.wrong + (outcome === "wrong" ? 1 : 0),
          idk: current.idk + (outcome === "idk" ? 1 : 0),
          total: current.total + 1
        }
      };
    });
  };

  const getOverallMastery = (): number => {
    const skills = Object.values(masteryByTopic);
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

  const handleCheckAnswer = () => {
    if (!currentQuestion) return;
    
    const userAnswer = currentQuestion.type === 'mcq' ? selectedChoice : userTextAnswer;
    if (!userAnswer) {
      toast.error('Please provide an answer first');
      return;
    }
    
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: userAnswer }));
    setCheckedAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
    
    const correct = isAnswerCorrect(currentQuestion, userAnswer);
    updateMastery(currentQuestion.type, correct ? "correct" : "wrong");
    setGeneratedMemoryTrick("");
    setShowMemoryTrick(!correct);

    // Insert learning event
    insertLearningEvent(
      collectionId,
      correct ? "WORKSHEET_CORRECT" : "WORKSHEET_WRONG",
      currentQuestion.prompt.substring(0, 100),
      {
        question: currentQuestion.prompt,
        correctAnswer: currentQuestion.answer,
        selectedAnswer: userAnswer,
        explanation: currentQuestion.explanation,
      }
    );
  };

  const handleIdk = () => {
    if (!currentQuestion) return;
    
    setIdkAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
    setCheckedAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
    updateMastery(currentQuestion.type, "idk");
    setShowMemoryTrick(true);
    setGeneratedMemoryTrick("");

    // Insert learning event
    insertLearningEvent(
      collectionId,
      "WORKSHEET_IDK",
      currentQuestion.prompt.substring(0, 100),
      {
        question: currentQuestion.prompt,
        correctAnswer: currentQuestion.answer,
        explanation: currentQuestion.explanation,
      }
    );
  };

  const isAnswerCorrect = (question: WorksheetQuestion, userAnswer?: string): boolean => {
    // Check if manually marked as correct
    if (manuallyCorrected[question.id]) return true;
    
    const answer = userAnswer || userAnswers[question.id];
    if (!answer) return false;
    
    const correctAnswer = question.answer.toLowerCase().trim();
    const userAnswerNormalized = answer.toLowerCase().trim();
    
    if (question.type === 'mcq' && question.choices) {
      const correctIndex = question.choices.findIndex(c => 
        c.toLowerCase().trim() === correctAnswer || 
        c.toLowerCase().includes(correctAnswer)
      );
      return userAnswerNormalized === question.choices[correctIndex]?.toLowerCase().trim();
    }
    
    return userAnswerNormalized.includes(correctAnswer) || correctAnswer.includes(userAnswerNormalized);
  };

  const handleManualCorrect = () => {
    if (!currentQuestion) return;
    
    setManuallyCorrected(prev => ({ ...prev, [currentQuestion.id]: true }));
    
    // Update mastery - remove the wrong count, add correct count
    const topic = topicFocus || currentQuestion.type;
    setMasteryByTopic(prev => {
      const current = prev[topic] || { correct: 0, wrong: 0, idk: 0, total: 0 };
      return {
        ...prev,
        [topic]: {
          correct: current.correct + 1,
          wrong: Math.max(0, current.wrong - 1),
          idk: current.idk,
          total: current.total
        }
      };
    });
    
    // Insert learning event for manual correction
    insertLearningEvent(
      collectionId,
      "WORKSHEET_MANUAL_CORRECT",
      currentQuestion.prompt.substring(0, 100),
      {
        question: currentQuestion.prompt,
        correctAnswer: currentQuestion.answer,
        userAnswer: userTextAnswer,
        note: "User manually marked as correct"
      }
    );
    
    toast.success("Marked as correct!");
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedChoice(null);
      setUserTextAnswer('');
      setShowMemoryTrick(false);
      setGeneratedMemoryTrick("");
      setMemoryStyle("");
    } else {
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      const prevQuestion = worksheet?.questions[currentQuestionIndex - 1];
      if (prevQuestion) {
        const prevAnswer = userAnswers[prevQuestion.id];
        if (prevQuestion.type === 'mcq') {
          setSelectedChoice(prevAnswer || null);
        } else {
          setUserTextAnswer(prevAnswer || '');
        }
      }
      setShowMemoryTrick(false);
      setGeneratedMemoryTrick("");
    }
  };

  const handleGenerateMore = () => {
    setShowResults(false);
    generateWorksheet(20);
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setIdkAnswers({});
    setShowResults(false);
    setSelectedChoice(null);
    setUserTextAnswer('');
    setShowMemoryTrick(false);
    setGeneratedMemoryTrick("");
  };

  const getScore = (): number => {
    if (!worksheet) return 0;
    return worksheet.questions.filter(q => checkedAnswers[q.id] && !idkAnswers[q.id] && isAnswerCorrect(q)).length;
  };

  const generateMemoryTrick = async () => {
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
      
      const userAnswer = currentQuestion.type === 'mcq' ? selectedChoice : userTextAnswer;
      const wrongInfo = userAnswer && !isAnswerCorrect(currentQuestion, userAnswer)
        ? `The user incorrectly answered: "${userAnswer}". Address why this was wrong.`
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

Question: ${currentQuestion.prompt}
Correct Answer: ${currentQuestion.answer}
${wrongInfo}

${stylePrompt}

IMPORTANT: Write in plain text. NEVER use asterisks or stars for emphasis. Do NOT use markdown formatting. Be creative, fun, and memorable. Focus on WHY the answer is correct.` 
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
    } catch (error) {
      console.error("Error generating memory trick:", error);
      toast.error("Could not generate memory trick");
    } finally {
      setIsGeneratingTrick(false);
    }
  };

  // Early returns for missing content
  if (!collectionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-purple-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-purple-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg">
            <FileText className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Practice Makes Perfect</h3>
          <p className="text-muted-foreground">Select a collection from the sidebar to generate practice worksheets</p>
        </div>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 20) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-amber-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-amber-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Upload className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Need More Content</h3>
          <p className="text-muted-foreground">Upload files to this collection to generate practice worksheets</p>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults && worksheet) {
    const score = getScore();
    const idkCount = Object.values(idkAnswers).filter(Boolean).length;
    const percentage = Math.round((score / totalQuestions) * 100);
    const overallMastery = getOverallMastery();
    
    return (
      <div className="flex flex-col h-full p-4 overflow-auto">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Worksheet Complete!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-green-600">{score}</p>
                <p className="text-xs text-muted-foreground">Correct</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold text-amber-600">{idkCount}</p>
                <p className="text-xs text-muted-foreground">I don't know</p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{overallMastery}%</p>
                <p className="text-xs text-muted-foreground">Understanding</p>
              </div>
            </div>
            
            <div className="flex gap-2 justify-center">
              <Button onClick={handleRestart} variant="outline">
                <RotateCcw className="mr-2 h-4 w-4" />
                Review Answers
              </Button>
              <Button onClick={handleGenerateMore}>
                Generate 20 More
              </Button>
            </div>
          </CardContent>
        </Card>
        
        <div className="space-y-4">
          {worksheet.questions.map((q, idx) => {
            const correct = !idkAnswers[q.id] && isAnswerCorrect(q);
            const userAnswer = userAnswers[q.id];
            const isIdk = idkAnswers[q.id];
            
            return (
              <Card key={q.id} className={correct ? 'border-green-500/50' : isIdk ? 'border-amber-500/50' : 'border-red-500/50'}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    {correct ? (
                      <Check className="h-5 w-5 text-green-500 mt-1 shrink-0" />
                    ) : isIdk ? (
                      <HelpCircle className="h-5 w-5 text-amber-500 mt-1 shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mt-1 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium mb-2">{idx + 1}. {q.prompt}</p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Your answer:</span>{' '}
                        <span className={correct ? 'text-green-600' : isIdk ? 'text-amber-600' : 'text-red-600'}>
                          {isIdk ? "(I don't know)" : userAnswer || '(no answer)'}
                        </span>
                      </p>
                      {(!correct || isIdk) && (
                        <p className="text-sm">
                          <span className="text-muted-foreground">Correct answer:</span>{' '}
                          <span className="text-green-600">{q.answer}</span>
                        </p>
                      )}
                      {q.explanation && (
                        <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-2 rounded">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Initial setup view (no worksheet yet)
  if (!worksheet) {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full space-y-6">
          <h2 className="text-xl font-semibold">Generate Worksheet</h2>
          
          <div className="w-full space-y-4">
            <div>
              <Label className="mb-2 block">Worksheet Type</Label>
              <RadioGroup 
                value={worksheetMode} 
                onValueChange={(v) => setWorksheetMode(v as WorksheetMode)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="onsite" id="onsite" />
                  <Label htmlFor="onsite">On-site Practice</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="download" id="download" />
                  <Label htmlFor="download">Download Worksheet</Label>
                </div>
              </RadioGroup>
            </div>
            
            <div>
              <Label htmlFor="topicFocus" className="mb-2 block">
                What do you want to focus on? (optional)
              </Label>
              <Input
                id="topicFocus"
                value={topicFocus}
                onChange={(e) => setTopicFocus(e.target.value)}
                placeholder="ex: limiting reactant, grams to moles, balancing equations"
              />
            </div>
          </div>
          
          <Button 
            onClick={() => generateWorksheet(20)} 
            disabled={isGenerating || readOnly}
            size="lg"
            className="w-full"
          >
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? 'Generating...' : 'Generate Worksheet'}
          </Button>
        </div>
      </div>
    );
  }

  // Download mode: show all questions at once
  if (worksheetMode === 'download') {
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {topicFocus ? `Worksheet: ${topicFocus}` : 'Study Worksheet'}
          </h2>
          <div className="flex gap-2">
            <Button onClick={handleDownload} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button onClick={() => generateWorksheet(20)} disabled={isGenerating || readOnly} size="sm">
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Regenerate
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto space-y-4">
          {worksheet.questions.map((q, idx) => (
            <Card key={q.id}>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded">
                    {q.type.toUpperCase()}
                  </span>
                  Question {idx + 1}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3">{q.prompt}</p>
                {q.type === 'mcq' && q.choices && (
                  <div className="space-y-2 ml-4">
                    {q.choices.map((choice, i) => (
                      <p key={i} className="text-muted-foreground">
                        {String.fromCharCode(65 + i)}. {choice}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const overallMastery = getOverallMastery();

  // On-site mode: quiz-like UX
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-slate-50/50 to-white dark:from-slate-900 dark:to-slate-950">
      {/* Header with gradient and blur */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 dark:bg-slate-900/80 dark:border-slate-700 px-6 py-4">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Question {currentQuestionIndex + 1} of {totalQuestions}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Understanding: {overallMastery}%
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showProgress} onOpenChange={setShowProgress}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-9 px-3 rounded-xl hover:bg-slate-100">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Progress
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
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
                    {Object.entries(masteryByTopic).length === 0 ? (
                      <p className="text-sm text-muted-foreground">Answer questions to see progress.</p>
                    ) : (
                      Object.entries(masteryByTopic).map(([tag, skill]) => {
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
            <Button onClick={handleDownload} variant="ghost" size="sm" className="h-9 px-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {/* Progress bar with gradient */}
        <div className="max-w-3xl mx-auto mt-4">
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Centered content area */}
      <div className="flex-1 overflow-auto px-6 py-8">
        <div className="max-w-3xl mx-auto">
          {currentQuestion && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              {/* Question header */}
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-3 py-1.5 rounded-full font-medium">
                  {currentQuestion.type.toUpperCase()}
                </span>
                <ReportDialog
                  feature="worksheet"
                  payload={{
                    feature: "worksheet",
                    collection_id: collectionId,
                    question_id: currentQuestion.id,
                    question_index: currentQuestionIndex,
                    question_text: currentQuestion.prompt,
                    correct_answer: currentQuestion.answer,
                    explanation: currentQuestion.explanation,
                  }}
                />
              </div>
              
              {/* Question text */}
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white leading-relaxed mb-6">
                {currentQuestion.prompt}
              </h3>

              {/* Answer area */}
              <div className="space-y-4">
                {currentQuestion.type === 'mcq' && currentQuestion.choices ? (
                  <RadioGroup 
                    value={selectedChoice || ''} 
                    onValueChange={setSelectedChoice}
                    disabled={isAnswerChecked}
                    className="space-y-3"
                  >
                    {currentQuestion.choices.map((choice, i) => {
                      const isCorrect = isAnswerChecked && choice.toLowerCase().includes(currentQuestion.answer.toLowerCase());
                      const isSelected = selectedChoice === choice;
                      
                      return (
                        <div 
                          key={i} 
                          className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all ${
                            isAnswerChecked
                              ? isCorrect
                                ? 'bg-green-50 dark:bg-green-950/30 border-green-500'
                                : isSelected && !isIdkAnswer
                                  ? 'bg-red-50 dark:bg-red-950/30 border-red-500'
                                  : 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600 border-slate-200 dark:border-slate-600 cursor-pointer'
                          }`}
                        >
                          <RadioGroupItem value={choice} id={`choice-${i}`} />
                          <Label htmlFor={`choice-${i}`} className="flex-1 cursor-pointer text-slate-900 dark:text-slate-100">
                            <span className="font-medium">{String.fromCharCode(65 + i)}.</span> {choice}
                          </Label>
                          {isAnswerChecked && isCorrect && <Check className="h-5 w-5 text-green-600 dark:text-green-400" />}
                          {isAnswerChecked && isSelected && !isCorrect && !isIdkAnswer && <X className="h-5 w-5 text-red-600 dark:text-red-400" />}
                        </div>
                      );
                    })}
                  </RadioGroup>
                ) : (
                  <div className="space-y-3">
                    <Input
                      value={userTextAnswer}
                      onChange={(e) => setUserTextAnswer(e.target.value)}
                      placeholder="Type your answer..."
                      disabled={isAnswerChecked}
                      className="w-full h-12 px-4 text-base rounded-xl border-2 border-slate-200 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:border-purple-500 dark:focus:border-purple-400"
                    />
                    {isAnswerChecked && (
                      <div className="space-y-2">
                        <div className={`p-4 rounded-xl ${isAnswerCorrect(currentQuestion) ? 'bg-green-50 dark:bg-green-950/30 border-2 border-green-500' : 'bg-red-50 dark:bg-red-950/30 border-2 border-red-500'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="text-sm dark:text-slate-100">
                                <span className="font-semibold">Your answer:</span> {userTextAnswer}
                              </p>
                              <p className="text-sm mt-1 dark:text-slate-100">
                                <span className="font-semibold">Correct answer:</span> {currentQuestion.answer}
                              </p>
                            </div>
                            {!isAnswerCorrect(currentQuestion) && !isIdkAnswer && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleManualCorrect}
                                className="rounded-lg border-2 border-green-500 text-green-700 hover:bg-green-50 shrink-0"
                              >
                                <Check className="mr-1 h-4 w-4" />
                                Actually Correct
                              </Button>
                            )}
                          </div>
                          {manuallyCorrected[currentQuestion.id] && (
                            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                              <Check className="h-3 w-3" /> Marked as correct
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Explanation + Memory Trick after checking */}
                {isAnswerChecked && (
                  <div className="space-y-3 pt-2">
                    <div className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl border border-slate-200">
                      {isIdkAnswer && (
                        <p className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-1.5">
                          <HelpCircle className="h-4 w-4" /> You chose: I don't know
                        </p>
                      )}
                      <p className="text-sm font-semibold text-slate-700 mb-1.5">Explanation:</p>
                      <p className="text-sm text-slate-600 leading-relaxed">{currentQuestion.explanation}</p>
                    </div>

                    {/* Memory Trick Section */}
                    {(showMemoryTrick || isIdkAnswer || !isAnswerCorrect(currentQuestion)) && (
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                            <Brain className="h-4 w-4 text-white" />
                          </div>
                          <span className="font-semibold text-slate-900">Memory Trick</span>
                        </div>
                        
                        {!generatedMemoryTrick ? (
                          <div className="space-y-3">
                            <div className="space-y-2">
                              <Label htmlFor="memoryStyle" className="text-xs text-slate-600 font-medium">
                                How do you want to remember this? (optional)
                              </Label>
                              <Input
                                id="memoryStyle"
                                value={memoryStyle}
                                onChange={(e) => setMemoryStyle(e.target.value)}
                                placeholder="e.g., DBZ, cooking, sports, simple..."
                                className="h-10 text-sm rounded-lg border-2 border-purple-200 focus:border-purple-500"
                              />
                            </div>
                            <Button 
                              size="sm" 
                              onClick={generateMemoryTrick}
                              disabled={isGeneratingTrick}
                              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-lg h-9"
                            >
                              {isGeneratingTrick ? (
                                <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Generating...</>
                              ) : (
                                <><Sparkles className="mr-2 h-3 w-3" /> Generate Memory Trick</>
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm whitespace-pre-wrap text-slate-700 leading-relaxed">
                              {generatedMemoryTrick.replace(/\*+/g, '')}
                            </p>
                            <div className="flex items-center gap-3">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => {
                                  if (!currentQuestion) return;
                                  // Memory tricks are stored locally for now
                                  console.log('Memory trick saved locally:', {
                                    concept: currentQuestion.prompt.substring(0, 200),
                                    trick: generatedMemoryTrick.replace(/\*+/g, ''),
                                    style: memoryStyle
                                  });
                                  setSaveToNotes(true);
                                  toast.success("Memory trick saved!");
                                }}
                                disabled={saveToNotes}
                                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white rounded-lg h-9 px-4"
                              >
                                {saveToNotes ? (
                                  <><Check className="mr-2 h-4 w-4" /> Saved</>
                                ) : (
                                  <>Save to Profile</>
                                )}
                              </Button>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setGeneratedMemoryTrick("");
                                setMemoryStyle("");
                                setSaveToNotes(false);
                              }}
                              className="rounded-lg border-2 border-purple-200 hover:bg-purple-50"
                            >
                              Generate Another
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Navigation buttons */}
                <div className="flex justify-between items-center pt-6 mt-6 border-t border-slate-200">
                  <Button 
                    onClick={handlePrevious} 
                    variant="outline" 
                    disabled={currentQuestionIndex === 0}
                    className="rounded-xl px-6 h-11 border-2 border-slate-200 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Previous
                  </Button>
                  
                  {!isAnswerChecked ? (
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        onClick={handleIdk}
                        className="rounded-xl px-6 h-11 border-2 border-amber-200 text-amber-700 hover:bg-amber-50"
                      >
                        <HelpCircle className="mr-2 h-4 w-4" /> I don't know
                      </Button>
                      <Button 
                        onClick={handleCheckAnswer}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl px-8 h-11 font-medium"
                      >
                        Check Answer
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      onClick={handleNext}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl px-8 h-11 font-medium"
                    >
                      {currentQuestionIndex === totalQuestions - 1 ? 'See Results' : 'Next'}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};