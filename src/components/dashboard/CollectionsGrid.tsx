import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, BarChart3, Clock, Play } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getTotalTimeSpent, secondsToMinutes } from '@/lib/sessionManager';
import { useNavigate } from 'react-router-dom';

interface Collection {
  id: string;
  name: string;
  icon?: string;
  created_at?: string;
  updated_at?: string;
}

interface CollectionProgress {
  quiz: number;
  worksheet: number;
  flashcards: number;
  overall: number;
  lastStudied?: string;
  timeSpent?: number;
}

interface CollectionCard {
  collection: Collection;
  progress: CollectionProgress;
  onSelect: (collectionId: string) => void;
}

const CollectionProgressCard = ({ collection, progress, onSelect }: CollectionCard) => {
  const navigate = useNavigate();
  const [timeSpentDisplay, setTimeSpentDisplay] = useState('0m');

  useEffect(() => {
    const loadTimeSpent = async () => {
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        const seconds = await getTotalTimeSpent(user.user.id, collection.id);
        setTimeSpentDisplay(secondsToMinutes(seconds));
      }
    };
    loadTimeSpent();
  }, [collection.id]);

  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg line-clamp-2">{collection.name}</CardTitle>
            {progress.lastStudied && (
              <p className="text-xs text-muted-foreground mt-1">
                Last studied: {new Date(progress.lastStudied).toLocaleDateString()}
              </p>
            )}
          </div>
          <Badge variant="outline" className="ml-2 shrink-0">
            {Math.round(progress.overall)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">{Math.round(progress.overall)}%</span>
          </div>
          <Progress value={progress.overall} className="h-2" />
        </div>

        {/* Mode Breakdown */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted p-2 rounded-lg">
            <div className="text-xs font-medium">Quiz</div>
            <div className="text-sm font-bold text-blue-600">{Math.round(progress.quiz)}%</div>
          </div>
          <div className="bg-muted p-2 rounded-lg">
            <div className="text-xs font-medium">Worksheet</div>
            <div className="text-sm font-bold text-green-600">{Math.round(progress.worksheet)}%</div>
          </div>
          <div className="bg-muted p-2 rounded-lg">
            <div className="text-xs font-medium">Flashcards</div>
            <div className="text-sm font-bold text-amber-600">{Math.round(progress.flashcards)}%</div>
          </div>
        </div>

        {/* Time Spent */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Time spent: {timeSpentDisplay}</span>
        </div>

        {/* Action Button */}
        <Button
          onClick={() => {
            onSelect(collection.id);
            navigate(`/study?collection=${collection.id}`);
          }}
          className="w-full"
          size="sm"
        >
          <Play className="h-4 w-4 mr-2" />
          Continue Studying
        </Button>
      </CardContent>
    </Card>
  );
};

interface CollectionsGridProps {
  selectedCollectionId?: string;
  onSelect: (collectionId: string) => void;
}

export const CollectionsGrid = ({ selectedCollectionId, onSelect }: CollectionsGridProps) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [progress, setProgress] = useState<Record<string, CollectionProgress>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCollectionsAndProgress = async () => {
      try {
        setLoading(true);

        // Get user
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.id) return;

        // Fetch collections
        const { data: collectionData, error: collectionsError } = await supabase
          .from('collections')
          .select('*')
          .eq('user_id', userData.user.id)
          .order('updated_at', { ascending: false });

        if (collectionsError || !collectionData) {
          console.error('Error fetching collections:', collectionsError);
          return;
        }

        setCollections(collectionData);

        // Fetch progress for each collection
        const progressMap: Record<string, CollectionProgress> = {};

        for (const collection of collectionData) {
          // Fetch saved sessions for this collection (they have progress tracking)
          const { data: sessions, error: sessionsError } = await supabase
            .from('saved_sessions')
            .select('mode, progress_percentage, created_at, is_completed')
            .eq('user_id', userData.user.id)
            .eq('collection_id', collection.id)
            .order('created_at', { ascending: false });

          if (sessionsError) {
            console.warn('Error fetching sessions:', sessionsError);
          }

          if (sessionsError || !sessions) {
            progressMap[collection.id] = {
              quiz: 0,
              worksheet: 0,
              flashcards: 0,
              overall: 0,
            };
            continue;
          }

          // Calculate progress by mode
          const modeProgress: Record<string, number[]> = {
            quiz: [],
            worksheet: [],
            flashcards: [],
          };

          let lastStudied: string | undefined;

          sessions.forEach((session) => {
            if (session.created_at && !lastStudied) {
              lastStudied = session.created_at;
            }

            const mode = session.mode as keyof typeof modeProgress;
            if (modeProgress[mode]) {
              // Use progress_percentage directly
              const percentage = session.progress_percentage || 0;
              modeProgress[mode].push(percentage);
            }
          });

          // Average last 5 scores per mode
          const getAverageProgress = (scores: number[]) => {
            if (scores.length === 0) return 0;
            const recent = scores.slice(0, 5);
            return recent.reduce((a, b) => a + b, 0) / recent.length;
          };

          const quizProgress = getAverageProgress(modeProgress.quiz);
          const worksheetProgress = getAverageProgress(modeProgress.worksheet);
          const flashcardsProgress = getAverageProgress(modeProgress.flashcards);

          // Weighted overall progress
          const modeCount = [quizProgress, worksheetProgress, flashcardsProgress].filter(
            (p) => p > 0
          ).length;
          const overall =
            modeCount > 0
              ? (quizProgress + worksheetProgress + flashcardsProgress) / 3
              : 0;

          progressMap[collection.id] = {
            quiz: quizProgress,
            worksheet: worksheetProgress,
            flashcards: flashcardsProgress,
            overall: Math.min(100, overall),
            lastStudied,
          };
        }

        setProgress(progressMap);
      } catch (error) {
        console.error('Error loading collections and progress:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCollectionsAndProgress();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="text-center p-8">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No collections yet. Create one to get started!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {collections.map((collection) => (
        <CollectionProgressCard
          key={collection.id}
          collection={collection}
          progress={progress[collection.id] || { quiz: 0, worksheet: 0, flashcards: 0, overall: 0 }}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};
