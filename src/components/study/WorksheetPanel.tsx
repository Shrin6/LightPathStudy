import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { exportWorksheetToPdf } from '@/lib/exportUtils';
import { DocumentTypeHint } from "@/pages/Study";

interface WorksheetPanelProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
}

interface WorksheetSection {
  type: string;
  content: string;
}

export const WorksheetPanel = ({ collectionId, collectionContent, documentTypeHint }: WorksheetPanelProps) => {
  const [worksheet, setWorksheet] = useState<WorksheetSection[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateWorksheet = async () => {
    if (!collectionId || collectionContent.length < 300) {
      toast.error('Not enough content to generate worksheet');
      return;
    }

    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('You must be logged in');
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ 
            role: 'user', 
            content: 'Create a practice worksheet with: 1) Fill-in-the-blank (5 items), 2) Matching terms (5 pairs), 3) Short answer questions (3 items). Return JSON: [{"type":"Fill in the Blank","content":"1. ___ 2. ___"},{"type":"Matching","content":"A.___ 1.___"}]' 
          }],
          mode: 'worksheet',
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate worksheet');

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

      // Sanitize and parse worksheet from response
      let cleanedText = generatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          const parsedSections: WorksheetSection[] = JSON.parse(jsonMatch[0]);
          if (parsedSections && parsedSections.length > 0) {
            setWorksheet(parsedSections);
            toast.success('Worksheet generated!');
          } else {
            throw new Error('Empty worksheet');
          }
        } catch (parseError) {
          toast.error('Worksheet could not be generated because the source material was too complex or formatted incorrectly.');
          console.error('Parse error:', parseError);
        }
      } else {
        toast.error('Not enough clean structured content found to generate worksheet. Try summarization first or regenerate.');
      }
    } catch (error: any) {
      console.error('Error generating worksheet:', error);
      toast.error(error.message || 'Failed to generate worksheet');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (worksheet.length === 0) {
      toast.error('No worksheet to download');
      return;
    }

    try {
      exportWorksheetToPdf('Study Worksheet', worksheet, 'study-worksheet.pdf');
      toast.success('Worksheet downloaded!');
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed');
    }
  };

  if (!collectionId) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Select a collection to generate worksheets</p>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 300) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Not enough content to generate worksheet. Upload more detailed files.</p>
      </div>
    );
  }

  if (worksheet.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No worksheet yet</p>
          <Button onClick={generateWorksheet} disabled={isGenerating}>
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isGenerating ? 'Generating...' : 'Generate Worksheet'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Practice Worksheet</h2>
        <div className="flex gap-2">
          <Button onClick={handleDownload} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button onClick={generateWorksheet} disabled={isGenerating} size="sm">
            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Regenerate
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-6">
        {worksheet.map((section, idx) => (
          <Card key={idx}>
            <CardHeader>
              <CardTitle className="text-lg">{section.type}</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="whitespace-pre-wrap font-sans">{section.content}</pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
