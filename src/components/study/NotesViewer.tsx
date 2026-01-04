import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Image as ImageIcon, Copy, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { copyToClipboard, exportToTxt, exportToPdf, exportToDocx } from '@/lib/exportUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DocumentTypeHint } from "@/pages/Study";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface NotesViewerProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
}

export const NotesViewer = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck }: NotesViewerProps) => {
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsProcessingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Upload image to storage
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('study-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Trigger OCR parsing
      const { data: session } = await supabase.auth.getSession();
      const response = await fetch(`${SUPABASE_URL}/functions/v1/parse-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.session?.access_token}`,
        },
        body: JSON.stringify({
          filePath,
          fileName: file.name,
          fileType: file.type,
          collectionId,
        }),
      });

      if (!response.ok) throw new Error('OCR processing failed');

      const { parsedContent } = await response.json();
      
      if (parsedContent && parsedContent.length > 100) {
        setNotes(prev => prev + '\n\n' + parsedContent);
        toast.success('Image processed and converted to notes!');
      } else {
        toast.error('Could not read text — try a clearer image or PDF.');
      }
    } catch (error: any) {
      console.error('Image processing error:', error);
      toast.error('Could not read text — try a clearer image or PDF.');
    } finally {
      setIsProcessingImage(false);
      e.target.value = ''; // Reset input
    }
  };

  const generateNotes = async () => {
    if (!collectionId || collectionContent.length < 300) {
      toast.error('Not enough content to generate notes');
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
        toast.error('You must be logged in to use the tutor');
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Convert my materials into clean bullet-point notes with only the key facts.' }],
          mode: 'notes',
          collectionId,
          notes: collectionContent,
          document_type_hint: documentTypeHint,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate notes');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let generatedNotes = '';

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
              if (content) {
                generatedNotes += content;
                setNotes(generatedNotes);
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
            }
          }
        }
      }

      toast.success('Notes generated!');
    } catch (error: any) {
      console.error('Error generating notes:', error);
      toast.error(error.message || 'Failed to generate notes');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!notes) {
      toast.error('No notes to copy');
      return;
    }
    const success = await copyToClipboard(notes);
    if (success) toast.success('Copied to clipboard!');
    else toast.error('Failed to copy');
  };

  const handleExport = (format: 'pdf' | 'txt' | 'docx') => {
    if (!notes) {
      toast.error('No notes to export');
      return;
    }
    
    try {
      switch (format) {
        case 'pdf':
          exportToPdf(notes, 'Study Notes', 'study-notes.pdf');
          toast.success('Exported as PDF!');
          break;
        case 'txt':
          exportToTxt(notes, 'study-notes.txt');
          toast.success('Exported as TXT!');
          break;
        case 'docx':
          exportToDocx(notes, 'study-notes.docx');
          toast.success('Exported as DOCX!');
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  if (!collectionId) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-sm text-muted-foreground">Select a collection to view notes</p>
      </div>
    );
  }

  if (!collectionContent || collectionContent.length < 300) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <p className="text-sm text-muted-foreground text-center">Not enough content to generate notes.<br/>Upload more detailed files.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center px-4 py-3 border-b bg-card/50 gap-2 flex-wrap">
        <h2 className="font-medium text-sm">Simple Notes</h2>
        <div className="flex gap-1.5 flex-wrap">
          <label htmlFor="image-upload">
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessingImage || !collectionId}
              asChild
              className="h-7 text-xs"
            >
              <span className="cursor-pointer">
                {isProcessingImage ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <ImageIcon className="mr-1.5 h-3 w-3" />}
                {isProcessingImage ? 'Processing...' : 'Upload Image'}
              </span>
            </Button>
          </label>
          <input
            id="image-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
            disabled={isProcessingImage}
          />
          <Button 
            onClick={generateNotes} 
            disabled={isGenerating || !collectionId || collectionContent.length < 300}
            size="sm"
            className="h-7 text-xs"
          >
            {isGenerating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {isGenerating ? 'Generating...' : 'Generate Notes'}
          </Button>
          <Button
            onClick={handleCopy}
            disabled={!notes}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
          >
            <Copy className="mr-1.5 h-3 w-3" />
            Copy
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button disabled={!notes} variant="outline" size="sm" className="h-7 text-xs">
                <Download className="mr-1.5 h-3 w-3" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('txt')}>
                Export as TXT
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('docx')}>
                Export as DOCX
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {notes ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm">{notes}</div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">Click "Generate Notes" to create bullet-point notes from your materials</p>
        )}
      </div>
    </div>
  );
};
