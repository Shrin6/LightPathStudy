import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Download, Loader2, Shuffle, Check, X, Flag, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { validateCollectionContent, filterMeaningfulCards } from "@/lib/relevanceCheck";
import { DocumentTypeHint } from "@/pages/Study";
import { ReportDialog } from "./ReportDialog";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface FlashcardsViewerProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
}

interface Flashcard {
  id?: string;
  front: string;
  back: string;
}

export const FlashcardsViewer = ({ collectionId, collectionContent, documentTypeHint }: FlashcardsViewerProps) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [knownCards, setKnownCards] = useState<Set<number>>(new Set());
  const [unknownCards, setUnknownCards] = useState<Set<number>>(new Set());

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
    if (!collectionId) {
      toast.error('Please select a collection first');
      return;
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
    handleNext();
  };

  const handleDontKnowIt = () => {
    setUnknownCards(prev => new Set(prev).add(currentIndex));
    setKnownCards(prev => {
      const newSet = new Set(prev);
      newSet.delete(currentIndex);
      return newSet;
    });
    handleNext();
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

  const FlashcardsHeader = ({ subtitle = "Review with spaced repetition" }: { subtitle?: string }) => (
    <div className="border-b px-4 py-3 bg-card shrink-0">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
          <StickyNote className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm">Flashcards</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );

  if (!collectionId) {
    return (
      <div className="flex flex-col h-full">
        <FlashcardsHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm">Select a collection to view flashcards</p>
        </div>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 300) {
    return (
      <div className="flex flex-col h-full">
        <FlashcardsHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-sm text-center px-4">
            Not enough content to generate flashcards.<br />Upload more detailed files.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <FlashcardsHeader />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (flashcards.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <FlashcardsHeader />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <StickyNote className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-medium">No flashcards yet</p>
              <p className="text-sm text-muted-foreground mt-1">Generate cards from your study materials</p>
            </div>
            <Button onClick={generateFlashcards} disabled={isGenerating} data-testid="button-generate-flashcards">
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isGenerating ? 'Generating...' : 'Generate Flashcards'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];
  const progress = ((knownCards.size + unknownCards.size) / flashcards.length) * 100;

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-4 py-3 bg-card shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
              <StickyNote className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">Card {currentIndex + 1} of {flashcards.length}</h2>
              <p className="text-xs text-muted-foreground flex gap-3">
                <span className="text-green-600">{knownCards.size} known</span>
                <span className="text-red-600">{unknownCards.size} reviewing</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 space-y-6 overflow-auto">
        <div className="w-full max-w-2xl space-y-2">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300" 
              style={{ width: `${progress}%` }} 
            />
          </div>
        </div>

      {/* Flashcard with flip animation */}
      <div 
        className="w-full max-w-2xl h-64 md:h-80 perspective-1000 cursor-pointer"
        onClick={() => setFlipped(!flipped)}
      >
        <div 
          className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${
            flipped ? 'rotate-y-180' : ''
          }`}
          style={{ 
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}
        >
          {/* Front face */}
          <Card 
            className="absolute inset-0 backface-hidden shadow-lg border-2"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <CardContent className="flex flex-col items-center justify-center h-full p-6 md:p-8">
              <div className="absolute top-2 right-2">
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
              <div className="text-xs font-semibold text-primary mb-4 uppercase tracking-wide">
                Question
              </div>
              <p className="text-lg md:text-xl text-center font-medium">
                {currentCard.front}
              </p>
              <p className="text-xs text-muted-foreground mt-6">
                Tap to reveal answer
              </p>
            </CardContent>
          </Card>
          
          {/* Back face */}
          <Card 
            className="absolute inset-0 backface-hidden shadow-lg border-2 border-primary/30 bg-primary/5"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <CardContent className="flex flex-col items-center justify-center h-full p-6 md:p-8">
              <div className="text-xs font-semibold text-primary mb-4 uppercase tracking-wide">
                Answer
              </div>
              <p className="text-lg md:text-xl text-center">
                {currentCard.back}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Know it / Don't know it buttons */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={handleDontKnowIt}
          className="border-red-500/50 text-red-500 hover:bg-red-500/10"
          size="lg"
        >
          <X className="h-5 w-5 mr-2" />
          Don't Know
        </Button>
        <Button
          variant="outline"
          onClick={handleKnowIt}
          className="border-green-500/50 text-green-500 hover:bg-green-500/10"
          size="lg"
        >
          <Check className="h-5 w-5 mr-2" />
          Know It
        </Button>
      </div>

      {/* Navigation and actions */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Button
          variant="ghost"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          size="sm"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Prev
        </Button>
        <Button
          variant="ghost"
          onClick={handleNext}
          disabled={currentIndex === flashcards.length - 1}
          size="sm"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
        <Button variant="ghost" onClick={shuffleCards} size="sm">
          <Shuffle className="h-4 w-4 mr-1" />
          Shuffle
        </Button>
        <Button variant="ghost" onClick={exportToAnki} size="sm">
          <Download className="h-4 w-4 mr-1" />
          Export
        </Button>
        <Button onClick={generateFlashcards} disabled={isGenerating} variant="outline" size="sm">
          {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Regenerate
        </Button>
      </div>
      </div>
    </div>
  );
};
