import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader2, Download, ChevronLeft, ChevronRight, Check, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { exportWorksheetToPdf } from '@/lib/exportUtils';
import { DocumentTypeHint } from "@/pages/Study";

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

type WorksheetMode = 'onsite' | 'download';

function sanitizeWorksheetResponse(raw: string): WorksheetResponse | null {
  try {
    let text = raw.trim();
    console.log('WorksheetPanel: raw AI output length:', text.length);
    console.log('WorksheetPanel: raw AI output preview:', text.substring(0, 500));
    
    // Remove markdown code fences
    text = text.replace(/^```(?:json)?\s*/gi, '').replace(/\s*```$/gi, '');
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
    text = text.trim();
    
    // Find first { and last }
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      text = text.substring(firstBrace, lastBrace + 1);
    }
    
    // Parse
    const parsed = JSON.parse(text);
    
    // Check for questions array
    if (!parsed.questions || !Array.isArray(parsed.questions)) {
      console.log('WorksheetPanel: No questions array found, checking for alternate structures');
      // Try to salvage from other structures
      if (Array.isArray(parsed)) {
        // It's already an array of questions
        return {
          set_id: crypto.randomUUID(),
          topic_focus: '',
          questions: parsed.filter((q: any) => q.prompt || q.question).map((q: any, i: number) => ({
            id: q.id || `q${i + 1}`,
            type: q.type || 'short',
            prompt: q.prompt || q.question || '',
            choices: q.choices || q.options,
            answer: String(q.answer || ''),
            explanation: q.explanation || '',
            source_ref: q.source_ref
          }))
        };
      }
      return null;
    }
    
    // Filter valid questions (salvage what we can)
    const validQuestions: WorksheetQuestion[] = [];
    for (const q of parsed.questions) {
      const prompt = q.prompt || q.question;
      if (typeof prompt === 'string' && prompt.length > 5) {
        validQuestions.push({
          id: q.id || `q${validQuestions.length + 1}`,
          type: q.type || 'short',
          prompt: prompt,
          choices: Array.isArray(q.choices) ? q.choices : (Array.isArray(q.options) ? q.options : undefined),
          answer: String(q.answer || ''),
          explanation: q.explanation || '',
          source_ref: q.source_ref || undefined
        });
      }
    }
    
    console.log('WorksheetPanel: salvaged', validQuestions.length, 'valid questions');
    
    if (validQuestions.length < 5) {
      console.log('WorksheetPanel: Less than 5 valid questions - salvage count:', validQuestions.length);
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
  const [showResults, setShowResults] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [userTextAnswer, setUserTextAnswer] = useState('');

  const generateWorksheet = async (questionCount: number = 20) => {
    if (!collectionId || collectionContent.length < 100) {
      toast.error('Not enough content to generate worksheet');
      return;
    }

    setIsGenerating(true);
    setWorksheet(null);
    setCurrentQuestionIndex(0);
    setUserAnswers({});
    setCheckedAnswers({});
    setShowResults(false);
    
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
      
      // Parse worksheet response
      const worksheetData = sanitizeWorksheetResponse(generatedText);
      
      if (worksheetData && worksheetData.questions.length >= 5) {
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
      // Format for PDF export
      const sections = worksheet.questions.map((q, i) => ({
        type: `Question ${i + 1} (${q.type.toUpperCase()})`,
        content: q.type === 'mcq' && q.choices 
          ? `${q.prompt}\n\n${q.choices.map((c, j) => `  ${String.fromCharCode(65 + j)}. ${c}`).join('\n')}`
          : q.prompt
      }));
      
      // Add answer key
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
  const totalQuestions = worksheet?.questions.length || 0;

  const handleCheckAnswer = () => {
    if (!currentQuestion) return;
    
    const userAnswer = currentQuestion.type === 'mcq' ? selectedChoice : userTextAnswer;
    if (!userAnswer) {
      toast.error('Please provide an answer first');
      return;
    }
    
    setUserAnswers(prev => ({ ...prev, [currentQuestion.id]: userAnswer }));
    setCheckedAnswers(prev => ({ ...prev, [currentQuestion.id]: true }));
  };

  const isAnswerCorrect = (question: WorksheetQuestion): boolean => {
    const userAnswer = userAnswers[question.id];
    if (!userAnswer) return false;
    
    const correctAnswer = question.answer.toLowerCase().trim();
    const userAnswerNormalized = userAnswer.toLowerCase().trim();
    
    // For MCQ, check if user selected the correct choice
    if (question.type === 'mcq' && question.choices) {
      const correctIndex = question.choices.findIndex(c => 
        c.toLowerCase().trim() === correctAnswer || 
        c.toLowerCase().includes(correctAnswer)
      );
      return userAnswerNormalized === question.choices[correctIndex]?.toLowerCase().trim();
    }
    
    // For other types, check if answer is contained or matches
    return userAnswerNormalized.includes(correctAnswer) || correctAnswer.includes(userAnswerNormalized);
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedChoice(null);
      setUserTextAnswer('');
    } else {
      // Show results
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      // Restore previous answer if exists
      const prevQuestion = worksheet?.questions[currentQuestionIndex - 1];
      if (prevQuestion) {
        const prevAnswer = userAnswers[prevQuestion.id];
        if (prevQuestion.type === 'mcq') {
          setSelectedChoice(prevAnswer || null);
        } else {
          setUserTextAnswer(prevAnswer || '');
        }
      }
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
    setShowResults(false);
    setSelectedChoice(null);
    setUserTextAnswer('');
  };

  const getScore = (): number => {
    if (!worksheet) return 0;
    return worksheet.questions.filter(q => checkedAnswers[q.id] && isAnswerCorrect(q)).length;
  };

  // Early returns for missing content
  if (!collectionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a collection to generate worksheets</p>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 100) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Not enough content to generate worksheet. Upload more files.</p>
      </div>
    );
  }

  // Results view
  if (showResults && worksheet) {
    const score = getScore();
    const percentage = Math.round((score / totalQuestions) * 100);
    
    return (
      <div className="flex flex-col h-full p-4 overflow-auto">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold mb-2">Worksheet Complete!</h2>
          <p className="text-4xl font-bold text-primary mb-2">
            {score} / {totalQuestions}
          </p>
          <p className="text-muted-foreground">{percentage}% correct</p>
        </div>
        
        <div className="flex gap-2 justify-center mb-6">
          <Button onClick={handleRestart} variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" />
            Review Answers
          </Button>
          <Button onClick={handleGenerateMore}>
            Generate 20 More
          </Button>
        </div>
        
        <div className="space-y-4">
          {worksheet.questions.map((q, idx) => {
            const correct = isAnswerCorrect(q);
            const userAnswer = userAnswers[q.id];
            
            return (
              <Card key={q.id} className={correct ? 'border-green-500/50' : 'border-red-500/50'}>
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    {correct ? (
                      <Check className="h-5 w-5 text-green-500 mt-1 shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-red-500 mt-1 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium mb-2">{idx + 1}. {q.prompt}</p>
                      <p className="text-sm">
                        <span className="text-muted-foreground">Your answer:</span>{' '}
                        <span className={correct ? 'text-green-600' : 'text-red-600'}>{userAnswer || '(no answer)'}</span>
                      </p>
                      {!correct && (
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
            onClick={() => generateWorksheet(worksheetMode === 'download' ? 20 : 20)} 
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

  // On-site mode: quiz-like UX
  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">
          Question {currentQuestionIndex + 1} of {totalQuestions}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {Object.keys(checkedAnswers).length} answered
          </span>
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
        <Card className="flex-1 flex flex-col">
          <CardHeader>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary/10 text-primary text-xs px-2 py-1 rounded font-medium">
                {currentQuestion.type.toUpperCase()}
              </span>
            </div>
            <CardTitle className="text-lg leading-relaxed">{currentQuestion.prompt}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
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
                            : isSelected
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
                      {isAnswerChecked && isSelected && !isCorrect && <X className="h-4 w-4 text-red-500" />}
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
            
            {/* Explanation after checking */}
            {isAnswerChecked && currentQuestion.explanation && (
              <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-1">Explanation:</p>
                <p className="text-sm text-muted-foreground">{currentQuestion.explanation}</p>
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
                <Button onClick={handleCheckAnswer}>
                  Check Answer
                </Button>
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
