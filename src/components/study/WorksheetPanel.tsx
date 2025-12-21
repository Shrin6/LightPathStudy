import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Download, ChevronLeft, ChevronRight, Check, X, RotateCcw, HelpCircle, BarChart3, CheckCircle2, XCircle, Sparkles, Brain, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { exportWorksheetToPdf } from '@/lib/exportUtils';
import { DocumentTypeHint } from "@/pages/Study";
import { ReportDialog, ReportPayload } from "./ReportDialog";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface WorksheetPanelProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
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
    
    return {
      set_id: parsed.set_id || crypto.randomUUID(),
      topic_focus: parsed.topic_focus || '',
      questions: validQuestions
    };
  } catch (e) {
    console.log('WorksheetPanel: Parse error:', e);
    return null;
  }
}

export const WorksheetPanel = ({ collectionId, collectionContent, documentTypeHint }: WorksheetPanelProps) => {
  const [worksheetMode, setWorksheetMode] = useState<WorksheetMode>('onsite');
  const [topicFocus, setTopicFocus] = useState('');
  const [worksheet, setWorksheet] = useState<WorksheetResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // On-site mode state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [checkedAnswers, setCheckedAnswers] = useState<Record<string, boolean>>({});
  const [idkAnswers, setIdkAnswers] = useState<Record<string, boolean>>({});
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

  const generateWorksheet = async (questionCount: number = 20) => {
    if (!collectionId) {
      toast.error('Please select a collection first');
      return;
    }
    
    if (collectionContent.length < 20) {
      toast.error('Collection content is too short. Please upload some materials first.');
      return;
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
      
      if (worksheetData && worksheetData.questions.length >= 3) {
        setWorksheet(worksheetData);
        console.log('WorksheetPanel: parsed question count:', worksheetData.questions.length);
        toast.success(`Generated ${worksheetData.questions.length} questions!`);
      } else {
        console.error('WorksheetPanel: Failed to parse worksheet or too few questions');
        toast.error('Could not generate enough valid questions. Try adjusting your topic focus or regenerating.');
      }
    } catch (error: any) {
      console.error('Error generating worksheet:', error);
      toast.error(error.message || 'Failed to generate worksheet');
    } finally {
      setIsGenerating(false);
    }
  };

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
  };

  const handleIdk = () => {
    if (!currentQuestion) return;
    
    setIdkAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
    setCheckedAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
    updateMastery(currentQuestion.type, "idk");
    setShowMemoryTrick(true);
    setGeneratedMemoryTrick("");
  };

  const isAnswerCorrect = (question: WorksheetQuestion, userAnswer?: string): boolean => {
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
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a collection to generate worksheets</p>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 20) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Not enough content to generate worksheet. Upload some files first.</p>
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
            disabled={isGenerating}
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
            <Button onClick={() => generateWorksheet(20)} disabled={isGenerating} size="sm">
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
    <div className="flex flex-col h-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Understanding: {overallMastery}%
          </span>
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
          <Button onClick={handleDownload} variant="ghost" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-2 mb-4">
        <div 
          className="bg-primary h-2 rounded-full transition-all"
          style={{ width: `${((currentQuestionIndex + 1) / totalQuestions) * 100}%` }}
        />
      </div>

      {currentQuestion && (
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded font-medium">
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
            <CardTitle className="text-lg leading-relaxed">{currentQuestion.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col overflow-auto">
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
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-colors ${
                        isAnswerChecked
                          ? isCorrect
                            ? 'bg-green-500/10 border-green-500'
                            : isSelected && !isIdkAnswer
                              ? 'bg-red-500/10 border-red-500'
                              : 'border-border'
                          : 'hover:bg-muted/50 border-border'
                      }`}
                    >
                      <RadioGroupItem value={choice} id={`choice-${i}`} />
                      <Label htmlFor={`choice-${i}`} className="flex-1 cursor-pointer">
                        {String.fromCharCode(65 + i)}. {choice}
                      </Label>
                      {isAnswerChecked && isCorrect && <Check className="h-4 w-4 text-green-500" />}
                      {isAnswerChecked && isSelected && !isCorrect && !isIdkAnswer && <X className="h-4 w-4 text-red-500" />}
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
                  className="w-full"
                />
                {isAnswerChecked && (
                  <div className={`p-3 rounded-lg ${isAnswerCorrect(currentQuestion) ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    <p className="text-sm">
                      <span className="font-medium">Correct answer:</span> {currentQuestion.answer}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Explanation + Memory Trick after checking */}
            {isAnswerChecked && (
              <div className="mt-4 space-y-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  {isIdkAnswer && (
                    <p className="text-sm font-medium text-amber-600 mb-2 flex items-center gap-1">
                      <HelpCircle className="h-4 w-4" /> You chose: I don't know
                    </p>
                  )}
                  <p className="text-sm font-medium mb-1">Explanation:</p>
                  <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
                </div>

                {/* Memory Trick Section */}
                {(showMemoryTrick || isIdkAnswer || !isAnswerCorrect(currentQuestion)) && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-3">
                      <Brain className="h-4 w-4 text-primary" />
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
                        <Button 
                          size="sm" 
                          onClick={generateMemoryTrick}
                          disabled={isGeneratingTrick}
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
                        <p className="text-sm whitespace-pre-wrap">{generatedMemoryTrick}</p>
                        <div className="flex items-center gap-2">
                          <Checkbox 
                            id="saveToNotes" 
                            checked={saveToNotes}
                            onCheckedChange={(checked) => {
                              setSaveToNotes(!!checked);
                              if (checked && currentQuestion) {
                                // Save to localStorage
                                const existing = localStorage.getItem("savedMemoryTricks");
                                const tricks = existing ? JSON.parse(existing) : [];
                                tricks.push({
                                  concept: currentQuestion.prompt.substring(0, 100),
                                  trick: generatedMemoryTrick,
                                  date: new Date().toLocaleDateString()
                                });
                                localStorage.setItem("savedMemoryTricks", JSON.stringify(tricks));
                                toast.success("Memory trick saved!");
                              }
                            }}
                          />
                          <Label htmlFor="saveToNotes" className="text-xs cursor-pointer">
                            Save to Simple Notes
                          </Label>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setGeneratedMemoryTrick("");
                            setMemoryStyle("");
                            setSaveToNotes(false);
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
            
            <div className="flex-1" />
            
            {/* Navigation buttons */}
            <div className="flex justify-between items-center pt-4 border-t mt-4">
              <Button 
                onClick={handlePrevious} 
                variant="outline" 
                disabled={currentQuestionIndex === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              
              {!isAnswerChecked ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleIdk}>
                    <HelpCircle className="mr-1 h-4 w-4" /> I don't know
                  </Button>
                  <Button onClick={handleCheckAnswer}>
                    Check Answer
                  </Button>
                </div>
              ) : (
                <Button onClick={handleNext}>
                  {currentQuestionIndex === totalQuestions - 1 ? 'See Results' : 'Next'}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};