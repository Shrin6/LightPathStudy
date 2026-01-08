import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, Loader2, Shuffle, Check, X, Flag, Plus, Trash2, Upload, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateCollectionContent, filterMeaningfulCards } from "@/lib/relevanceCheck";
import { DocumentTypeHint } from "@/pages/Study";
import { ReportDialog } from "./ReportDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface FlashcardsViewerProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
  readOnly?: boolean;
}

interface Flashcard {
  id?: string;
  front: string;
  back: string;
  is_custom?: boolean;
  mastery_level?: number;
  last_reviewed?: string;
  front_color?: string;
  back_color?: string;
}

export const FlashcardsViewer = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck, readOnly = false }: FlashcardsViewerProps) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<number>>(new Set());
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customFront, setCustomFront] = useState("");
  const [customBack, setCustomBack] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [frontColor, setFrontColor] = useState("#ffffff");
  const [backColor, setBackColor] = useState("#ffffff");

  const colorOptions = [
    { name: "White", value: "#ffffff" },
    { name: "Yellow", value: "#fbbf24" },
    { name: "Blue", value: "#60a5fa" },
    { name: "Green", value: "#4ade80" },
    { name: "Pink", value: "#f472b6" },
    { name: "Purple", value: "#c084fc" },
    { name: "Orange", value: "#fb923c" },
    { name: "Red", value: "#f87171" },
  ];

  useEffect(() => {
    loadFlashcards();
  }, [collectionId]);

  const loadFlashcards = async () => {
    if (!collectionId) {
      setFlashcards([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('flashcards')
        .select('*')
        .eq('collection_id', collectionId);

      if (error) throw error;
      setFlashcards(data || []);
      setKnownCards(new Set());
      setUnknownCards(new Set());
    } catch (error) {
      console.error('Error loading flashcards:', error);
      setFlashcards([]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFlashcards = async () => {
    if (readOnly) {
      toast.error('Sign in to generate flashcards');
      return;
    }

    if (!collectionId) {
      toast.error('Please select a collection first');
      return;
    }

    // Check usage limit
    if (onUsageCheck) {
      const allowed = await onUsageCheck();
      if (!allowed) return;
    }
    // RELEVANCE CHECK: Validate content is academic
    const validation = validateCollectionContent(collectionContent);
    if (!validation.isValid) {
      toast.error(validation.reason || 'Content not suitable for flashcards');
      return;
    }
    
    if (validation.reason) {
      // Show warning but continue
      toast.warning(validation.reason);
    }
    
    console.log('Content validation passed, academic score:', validation.academicScore);

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('You must be logged in');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ 
            role: 'user', 
            content: 'Generate flashcards from my study notes.' 
          }],
          mode: 'flashcards',
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate flashcards');

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

      // Sanitize and parse flashcards from response
      let cleanedText = generatedText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      
      console.log('After markdown cleanup, length:', cleanedText.length);
      
      // Fix malformed JSON starts
      if (/^"?cards"\s*:/i.test(cleanedText)) {
        cleanedText = '{' + (!cleanedText.startsWith('"') ? '"' : '') + cleanedText;
      }
      
      let parsedCards: Flashcard[] = [];
      
      // Method 1: Try direct JSON parse first (cleanest case)
      try {
        const directParse = JSON.parse(cleanedText);
        if (Array.isArray(directParse)) {
          parsedCards = directParse;
        } else if (directParse.cards && Array.isArray(directParse.cards)) {
          parsedCards = directParse.cards;
        }
        console.log('Direct parse succeeded, cards:', parsedCards.length);
      } catch (e) {
        console.log('Direct parse failed, trying regex extraction');
      }
      
      // Method 2: Extract individual card objects using regex (handles truncated JSON!)
      if (parsedCards.length === 0) {
        // Match complete card objects: {"front": "...", "back": "..."}
        const cardRegex = /\{\s*"front"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*,\s*"back"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"\s*\}/g;
        let match;
        while ((match = cardRegex.exec(cleanedText)) !== null) {
          parsedCards.push({
            front: match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
            back: match[2].replace(/\\"/g, '"').replace(/\\n/g, '\n')
          });
        }
        if (parsedCards.length > 0) {
          console.log('Regex extraction succeeded, cards:', parsedCards.length);
        }
      }
      
      // Method 3: Try relaxed extraction if regex missed some
      if (parsedCards.length === 0) {
        // Find all front/back pairs even with different formatting
        const frontMatches = [...cleanedText.matchAll(/"front"\s*:\s*"([^"]+)"/g)];
        const backMatches = [...cleanedText.matchAll(/"back"\s*:\s*"([^"]+)"/g)];
        const pairCount = Math.min(frontMatches.length, backMatches.length);
        for (let i = 0; i < pairCount; i++) {
          parsedCards.push({
            front: frontMatches[i][1],
            back: backMatches[i][1]
          });
        }
        if (parsedCards.length > 0) {
          console.log('Relaxed extraction succeeded, cards:', parsedCards.length);
        }
      }

      // RELEVANCE CHECK: Filter out non-meaningful cards
      const meaningfulCards = filterMeaningfulCards(parsedCards);
      
      if (meaningfulCards.length < parsedCards.length) {
        console.log(`Filtered out ${parsedCards.length - meaningfulCards.length} non-meaningful cards`);
      }
      
      parsedCards = meaningfulCards;

      if (parsedCards.length === 0) {
        console.error('No meaningful flashcards could be extracted. Raw text sample:', cleanedText.substring(0, 500));
        toast.error('Could not generate meaningful flashcards. Try uploading more detailed academic content.');
        return;
      }
      
      // Save to database
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const cardsToInsert = parsedCards.map(card => ({
        front: card.front,
        back: card.back,
        collection_id: collectionId,
        user_id: user.id,
      }));

      const { error } = await supabase
        .from('flashcards')
        .insert(cardsToInsert);

      if (error) throw error;

      await loadFlashcards();
      toast.success('Flashcards generated and saved!');
    } catch (error: any) {
      console.error('Error generating flashcards:', error);
      toast.error(error.message || 'Failed to generate flashcards');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setFlipped(false);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setFlipped(false);
    }
  };

  const handleKnowIt = () => {
    setKnownCards(prev => new Set(prev).add(currentIndex));
    setUnknownCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentIndex);
      return newSet;
    });
    // Update mastery level in database
    updateMasteryLevel(currentIndex, 100);
    handleNext();
  };

  const handleDontKnowIt = () => {
    setUnknownCards(prev => new Set(prev).add(currentIndex));
    setKnownCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentIndex);
      return newSet;
    });
    // Update mastery level in database
    updateMasteryLevel(currentIndex, 0);
    handleNext();
  };

  const updateMasteryLevel = async (cardIndex: number, masteryLevel: number) => {
    try {
      const card = flashcards[cardIndex];
      if (!card.id) return;

      const { error } = await supabase
        .from('flashcards')
        .update({
          mastery_level: masteryLevel,
          last_reviewed: new Date().toISOString(),
        })
        .eq('id', card.id);

      if (error) {
        console.error('Error updating mastery level:', error);
      }
    } catch (error) {
      console.error('Error updating mastery level:', error);
    }
  };

  const addCustomFlashcard = async () => {
    if (!customFront.trim() || !customBack.trim()) {
      toast.error('Please fill in both question and answer');
      return;
    }

    if (!collectionId) {
      toast.error('Please select a collection first');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('flashcards')
        .insert({
          front: customFront,
          back: customBack,
          collection_id: collectionId,
          user_id: user.id,
          is_custom: true,
        });

      if (error) throw error;

      setCustomFront("");
      setCustomBack("");
      setShowAddCustom(false);
      await loadFlashcards();
      toast.success('Custom flashcard added!');
    } catch (error: any) {
      console.error('Error adding custom flashcard:', error);
      toast.error(error.message || 'Failed to add custom flashcard');
    }
  };

  const deleteFlashcard = async (cardId: string) => {
    try {
      const { error } = await supabase
        .from('flashcards')
        .delete()
        .eq('id', cardId);

      if (error) throw error;

      await loadFlashcards();
      toast.success('Flashcard deleted!');
    } catch (error: any) {
      console.error('Error deleting flashcard:', error);
      toast.error('Failed to delete flashcard');
    }
  };

  const updateCardColors = async (cardId: string, frontCol: string, backCol: string) => {
    try {
      const { error } = await supabase
        .from('flashcards')
        .update({
          front_color: frontCol,
          back_color: backCol,
        })
        .eq('id', cardId);

      if (error) throw error;

      // Update local state
      const updatedCards = flashcards.map(card => 
        card.id === cardId 
          ? { ...card, front_color: frontCol, back_color: backCol }
          : card
      );
      setFlashcards(updatedCards);
      toast.success('Card colors updated!');
    } catch (error: any) {
      console.error('Error updating card colors:', error);
      toast.error('Failed to update colors');
    }
  };

  const shuffleCards = () => {
    const shuffled = [...flashcards].sort(() => Math.random() - 0.5);
    setFlashcards(shuffled);
    setCurrentIndex(0);
    setFlipped(false);
    setKnownCards(new Set());
    setUnknownCards(new Set());
    toast.success('Cards shuffled!');
  };

  const exportToAnki = () => {
    const ankiFormat = flashcards
      .map((card) => `${card.front}\t${card.back}`)
      .join("\n");

    const blob = new Blob([ankiFormat], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "flashcards.txt";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Flashcards exported!");
  };

  if (!collectionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-blue-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-blue-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
            <StickyNote className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Ready to Study?</h3>
          <p className="text-muted-foreground">Select a collection from the sidebar to view and practice with flashcards</p>
        </div>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 300) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-amber-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-amber-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
            <Upload className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Need More Content</h3>
          <p className="text-muted-foreground">Upload more detailed files to this collection to generate flashcards</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">No flashcards yet</p>
          <Button onClick={generateFlashcards} disabled={isGenerating || readOnly} size="sm">
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? 'Generating...' : 'Generate Flashcards'}
          </Button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((knownCards.size + unknownCards.size) / flashcards.length) * 100;

  if (!currentCard) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">Loading flashcard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gradient-to-br from-slate-900/50 via-transparent to-purple-900/20 p-6 overflow-y-auto">
      {/* Top Stats Bar */}
      <div className="w-full max-w-7xl mb-8">
        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4 text-center hover:bg-white/10 transition-colors">
            <div className="text-xs text-muted-foreground mb-2">Total Cards</div>
            <div className="text-3xl font-bold text-white">{flashcards.length}</div>
          </div>
          <div className="bg-success/10 backdrop-blur border border-success/20 rounded-xl p-4 text-center hover:bg-success/20 transition-colors">
            <div className="text-xs text-success/80 mb-2">Mastered</div>
            <div className="text-3xl font-bold text-success">{knownCards.size}</div>
          </div>
          <div className="bg-amber-500/10 backdrop-blur border border-amber-500/20 rounded-xl p-4 text-center hover:bg-amber-500/20 transition-colors">
            <div className="text-xs text-amber-600/80 mb-2">Learning</div>
            <div className="text-3xl font-bold text-amber-500">{flashcards.length - knownCards.size - unknownCards.size}</div>
          </div>
          <div className="bg-destructive/10 backdrop-blur border border-destructive/20 rounded-xl p-4 text-center hover:bg-destructive/20 transition-colors hidden md:block">
            <div className="text-xs text-destructive/80 mb-2">To Review</div>
            <div className="text-3xl font-bold text-destructive">{unknownCards.size}</div>
          </div>
          <div className="bg-primary/10 backdrop-blur border border-primary/20 rounded-xl p-4 text-center hover:bg-primary/20 transition-colors hidden md:block">
            <div className="text-xs text-primary/80 mb-2">Progress</div>
            <div className="text-3xl font-bold text-primary">{Math.round(progress)}%</div>
          </div>
        </div>
      </div>

      {/* Main Flashcard Section */}
      <div className="w-full max-w-7xl mb-8">
        {/* Card Counter */}
        <div className="flex justify-between items-center mb-6 px-2">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Card {currentIndex + 1} of {flashcards.length}
            </h2>
            {currentCard.is_custom && (
              <span className="text-sm text-purple-300">✨ Your custom card</span>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">
              {currentCard.mastery_level ? `Mastery: ${currentCard.mastery_level}%` : 'Not reviewed yet'}
            </div>
            <div className="text-xs text-muted-foreground/70 mt-1">
              Custom: {flashcards.filter(c => c.is_custom).length}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden mb-8 backdrop-blur">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500 transition-all duration-300 shadow-lg shadow-purple-500/50" 
            style={{ width: `${progress}%` }} 
          />
        </div>

        {/* Large Flashcard */}
        <div 
          className="w-full min-h-[500px] md:min-h-[600px] perspective-1000 cursor-pointer mb-8 group"
          onClick={() => setFlipped(!flipped)}
        >
          <div 
            className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d`}
            style={{ 
              transformStyle: 'preserve-3d',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              minHeight: '500px',
            }}
          >
            {/* Front face */}
            <div 
              className="absolute inset-0 backface-hidden border-0 shadow-2xl hover:shadow-3xl transition-all overflow-hidden group-hover:scale-[1.02] origin-center rounded-2xl flex flex-col items-center justify-center p-8 md:p-16"
              style={{ backfaceVisibility: 'hidden', background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' }}
            >
              <div className="absolute top-6 right-6 opacity-50 hover:opacity-100 transition-opacity">
                <ReportDialog
                  feature="flashcards"
                  payload={{
                    feature: "flashcards",
                    collection_id: collectionId,
                    question_text: currentCard.front,
                    correct_answer: currentCard.back,
                  }}
                />
              </div>
              <div className="text-sm font-semibold mb-8 uppercase tracking-widest opacity-90 text-white">
                {currentCard.is_custom ? '✨ Your Card' : 'Question'}
              </div>
              <p 
                className="text-4xl md:text-6xl text-center font-bold leading-tight mb-auto break-words max-w-4xl"
                style={{ color: currentCard.front_color || '#ffffff' }}
              >
                {currentCard.front}
              </p>
              <p className="text-sm text-white/80 mt-12">Click to reveal answer</p>
            </div>
            
            {/* Back face */}
            <div 
              className="absolute inset-0 backface-hidden border-0 shadow-2xl hover:shadow-3xl transition-all overflow-hidden group-hover:scale-[1.02] origin-center rounded-2xl flex flex-col items-center justify-center p-8 md:p-16"
              style={{ 
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)'
              }}
            >
              <div className="text-sm font-semibold mb-8 uppercase tracking-widest opacity-90 text-white">
                Answer
              </div>
              <p 
                className="text-3xl md:text-5xl text-center font-bold leading-tight break-words max-w-4xl"
                style={{ color: currentCard.back_color || '#ffffff' }}
              >
                {currentCard.back}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons - Large */}
        <div className="flex gap-4 justify-center mb-8">
          <Button
            onClick={handleDontKnowIt}
            className="bg-destructive/90 hover:bg-destructive text-white px-8 py-7 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold"
            size="lg"
          >
            <X className="h-5 w-5 mr-2" />
            Need More Time
          </Button>
          <Button
            onClick={handleKnowIt}
            className="bg-success/90 hover:bg-success text-white px-8 py-7 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all font-semibold"
            size="lg"
          >
            <Check className="h-5 w-5 mr-2" />
            Mastered
          </Button>
        </div>
      </div>

      {/* Navigation Controls Section */}
      <div className="w-full max-w-7xl">
        {/* Primary Controls */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            size="lg"
            className="gap-2 font-semibold hover:bg-white/10"
          >
            <ChevronLeft className="h-5 w-5" />
            Previous
          </Button>
          
          <Button 
            variant="outline" 
            size="lg"
            className="gap-2 font-semibold hover:bg-white/10"
            onClick={shuffleCards}
          >
            <Shuffle className="h-5 w-5" />
            Shuffle
          </Button>

          <Button 
            variant="outline" 
            size="lg" 
            className="gap-2 font-semibold hover:bg-white/10"
            onClick={() => setShowColorPicker(!showColorPicker)}
          >
            🎨 Colors
          </Button>

          <Button 
            variant="outline" 
            size="lg"
            className="gap-2 font-semibold hover:bg-white/10"
            onClick={exportToAnki}
          >
            <Download className="h-5 w-5" />
            Export
          </Button>

          <Button 
            onClick={() => setShowAddCustom(!showAddCustom)} 
            variant="outline" 
            size="lg"
            className="gap-2 border-primary/50 text-primary hover:bg-primary/10 font-semibold"
          >
            <Plus className="h-5 w-5" />
            Add Custom
          </Button>

          <Button
            variant="outline"
            onClick={handleNext}
            disabled={currentIndex === flashcards.length - 1}
            size="lg"
            className="gap-2 font-semibold hover:bg-white/10"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Secondary Controls */}
        <div className="flex justify-center gap-3">
          <Button onClick={generateFlashcards} disabled={isGenerating || readOnly} variant="outline" size="lg" className="gap-2 font-semibold hover:bg-white/10">
            {isGenerating && <Loader2 className="h-5 w-5 animate-spin" />}
            {isGenerating ? 'Regenerating...' : 'Regenerate Cards'}
          </Button>
          <Button 
            onClick={() => deleteFlashcard(currentCard.id!)} 
            variant="outline" 
            size="lg"
            className="gap-2 text-destructive hover:bg-destructive/10 font-semibold"
          >
            <Trash2 className="h-5 w-5" />
            Delete Card
          </Button>
        </div>
      </div>

      {/* Add Custom Flashcard Form */}
      {showAddCustom && (
        <Card className="w-full max-w-lg p-4 border-primary/30 bg-primary/5">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Create Custom Flashcard</h3>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Question</label>
              <Input
                placeholder="Enter the question..."
                value={customFront}
                onChange={(e) => setCustomFront(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Answer</label>
              <Textarea
                placeholder="Enter the answer..."
                value={customBack}
                onChange={(e) => setCustomBack(e.target.value)}
                className="text-sm min-h-24"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={addCustomFlashcard} 
                size="sm" 
                className="flex-1 bg-primary hover:bg-primary/90"
              >
                Add Card
              </Button>
              <Button 
                onClick={() => setShowAddCustom(false)} 
                variant="outline" 
                size="sm"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Color Picker for Current Card */}
      {showColorPicker && flashcards.length > 0 && (
        <Card className="w-full max-w-lg p-4 border-purple-300/30 bg-purple-50/10">
          <div className="space-y-4">
            <div className="bg-blue-50/50 border border-blue-200/50 rounded-lg p-3">
              <p className="text-xs text-blue-900 leading-relaxed">
                <strong>💡 Why Colors Matter:</strong> Research shows that using different colors for text helps your brain create stronger visual memories. When you see the same color during your exam, it triggers recall of the information you studied. This "color-coding effect" can boost memory retention by up to 20-25%.
              </p>
            </div>

            <h3 className="font-semibold text-sm">Customize Text Colors</h3>
            
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Question Text Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setFrontColor(color.value)}
                      className={`h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                        frontColor === color.value 
                          ? 'border-primary scale-110' 
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Answer Text Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setBackColor(color.value)}
                      className={`h-10 rounded-lg border-2 transition-all hover:scale-110 ${
                        backColor === color.value 
                          ? 'border-primary scale-110' 
                          : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-amber-50/50 border border-amber-200/50 rounded-lg p-2.5 text-xs text-amber-900">
                <strong>💪 Pro Tip:</strong> Use contrasting colors for related cards (e.g., yellow for vocabulary, blue for definitions) to strengthen associations in your memory.
              </div>

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={() => updateCardColors(currentCard.id!, frontColor, backColor)} 
                  size="sm" 
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  Apply Colors
                </Button>
                <Button 
                  onClick={() => setShowColorPicker(false)} 
                  variant="outline" 
                  size="sm"
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
