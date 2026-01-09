import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Image as ImageIcon, Copy, Download, BookOpen, Lightbulb, Target, Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { copyToClipboard, exportToTxt, exportToPdf, exportToDocx } from '@/lib/exportUtils';
import { formatNotes } from '@/lib/textFormatting';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentTypeHint } from "@/pages/Study";

const SUPABASE_URL = "https://dsvpodsvrxwgfqnuojcz.supabase.co";

interface NotesViewerProps {
  collectionId: string | null;
  collectionContent: string;
  documentTypeHint: DocumentTypeHint;
  onUsageCheck?: () => Promise<boolean>;
  readOnly?: boolean;
}

export const NotesViewer = ({ collectionId, collectionContent, documentTypeHint, onUsageCheck, readOnly = false }: NotesViewerProps) => {
  const [notes, setNotes] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [noteType, setNoteType] = useState<'clean' | 'keypoints' | 'study-guide'>('clean');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (readOnly) {
      toast.error('Sign in to upload images');
      return;
    }

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsProcessingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('study-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

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
        toast.success('Image text extracted and added!');
      } else {
        toast.error('Could not read text — try a clearer image.');
      }
    } catch (error: any) {
      console.error('Image processing error:', error);
      toast.error('Could not read text — try a clearer image.');
    } finally {
      setIsProcessingImage(false);
      e.target.value = '';
    }
  };

  const generateNotes = async () => {
    if (readOnly) {
      toast.error('Sign in to generate notes');
      return;
    }

    if (!collectionId || collectionContent.length < 300) {
      toast.error('Not enough content to generate notes');
      return;
    }

    if (onUsageCheck) {
      const allowed = await onUsageCheck();
      if (!allowed) return;
    }
    
    setIsGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('You must be logged in');
        return;
      }

      // Different prompts for different note types
      const prompts = {
        'clean': `Create clean, well-organized study notes from my materials. Format with clear headings and sections. Use numbered lists (1., 2., 3.) for key points. You can use bold text for emphasis on important terms. Write in simple, clear language. Make it easy to copy into any note-taking app.`,
        
        'keypoints': `Extract ONLY the 15-20 most critical facts I need to memorize. Format as a simple numbered list (1., 2., 3., etc). Each point should be ONE clear sentence. You can bold key terms. Make it ready to paste into flashcard apps.`,
        
        'study-guide': `Create a comprehensive study guide organized by major topics. For each topic: 
- Write the topic name (you can bold it for emphasis)
- Define key terms in simple language
- Give 1-2 concrete examples
Use clear, readable formatting ready to copy into Notion, OneNote, or GoodNotes.`
      };

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-tutor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: prompts[noteType] }],
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
              // Ignore parse errors
            }
          }
        }
      }

      toast.success('Notes generated!');
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to generate');
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
    if (success) toast.success('Copied! Paste into your note app');
  };

  const handleExport = (format: 'pdf' | 'txt' | 'docx') => {
    if (!notes) {
      toast.error('No content to export');
      return;
    }
    
    try {
      const typeNames = { 'clean': 'notes', 'keypoints': 'key-points', 'study-guide': 'study-guide' };
      const filename = `study-${typeNames[noteType]}`;
      
      switch (format) {
        case 'pdf':
          exportToPdf(notes, 'Study Notes', `${filename}.pdf`);
          toast.success('PDF downloaded!');
          break;
        case 'txt':
          exportToTxt(notes, `${filename}.txt`);
          toast.success('TXT downloaded!');
          break;
        case 'docx':
          exportToDocx(notes, `${filename}.docx`);
          toast.success('DOCX downloaded!');
          break;
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };

  if (!collectionId) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900/50 dark:via-transparent dark:to-indigo-900/10 p-8">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
            <BookOpen className="h-10 w-10 text-white" />
          </div>
          <h3 className="text-2xl font-bold">Generate Study Notes</h3>
          <p className="text-muted-foreground">Select a collection from the sidebar to create comprehensive study notes</p>
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
          <p className="text-muted-foreground">Upload more detailed files to this collection to generate study notes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 via-purple-50/20 to-pink-50/20 dark:from-slate-900 dark:via-slate-900/50 dark:to-slate-950">
      {/* Header with Tabs */}
      <div className="flex flex-col gap-3 px-4 py-4 border-b bg-white/80 dark:bg-slate-900/80 dark:border-slate-700 backdrop-blur">
        <div className="flex justify-between items-center">
          <h2 className="font-semibold text-base">Study Notes</h2>
          
          {/* Export Actions */}
          <div className="flex gap-1.5">
            <Button
              onClick={handleCopy}
              disabled={!notes}
              variant="outline"
              size="sm"
              className="h-8 text-xs"
            >
              <Copy className="mr-1.5 h-3 w-3" />
              Copy All
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button disabled={!notes} variant="outline" size="sm" className="h-8 text-xs">
                  <Download className="mr-1.5 h-3 w-3" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport('txt')}>
                  📄 Plain Text (.txt)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('pdf')}>
                  📋 PDF Document
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('docx')}>
                  📝 Word Doc (.docx)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="text-xs text-muted-foreground">
                  💡 Tip: Use "Copy All" for Notion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Note Type Tabs */}
        <Tabs value={noteType} onValueChange={(v) => setNoteType(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9 bg-slate-900 dark:bg-slate-950">
            <TabsTrigger value="clean" className="text-xs gap-1">
              <BookOpen className="h-3 w-3" />
              Clean Notes
            </TabsTrigger>
            <TabsTrigger value="keypoints" className="text-xs gap-1">
              <Target className="h-3 w-3" />
              Key Points
            </TabsTrigger>
            <TabsTrigger value="study-guide" className="text-xs gap-1">
              <Lightbulb className="h-3 w-3" />
              Study Guide
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Generate Button & Image Upload */}
        <div className="flex gap-2">
          <label htmlFor="image-upload" className="flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={isProcessingImage || readOnly}
              asChild
              className="h-8 text-xs"
            >
              <span className="cursor-pointer">
                {isProcessingImage ? (
                  <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Processing...</>
                ) : (
                  <><ImageIcon className="mr-1.5 h-3 w-3" /> Add Image</>
                )}
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
            disabled={isGenerating || readOnly}
            size="sm"
            className="flex-1 h-8 text-xs bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 dark:from-purple-700 dark:to-pink-700 dark:hover:from-purple-800 dark:hover:to-pink-800"
          >
            {isGenerating ? (
              <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Generating...</>
            ) : (
              noteType === 'keypoints' ? 'Generate Key Points' : 
              noteType === 'study-guide' ? 'Generate Study Guide' : 
              'Generate Notes'
            )}
          </Button>
        </div>

        {/* Info Message */}
        <div className="text-xs text-muted-foreground bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-900/50 rounded p-2">
          💡 <strong>Tip:</strong> {
            noteType === 'clean' ? 'Clean notes are formatted for easy copy/paste into any app' :
            noteType === 'keypoints' ? 'Key points are perfect for quick review and flashcard creation' :
            'Study guide includes definitions, examples, and organized topics'
          }
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {notes ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans text-slate-800 dark:text-slate-100">
                {formatNotes(notes)}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-100 dark:from-purple-900 to-pink-100 dark:to-pink-900 flex items-center justify-center mb-2">
              {noteType === 'clean' && <BookOpen className="h-7 w-7 text-purple-600 dark:text-purple-400" />}
              {noteType === 'keypoints' && <Target className="h-7 w-7 text-purple-600 dark:text-purple-400" />}
              {noteType === 'study-guide' && <Lightbulb className="h-7 w-7 text-purple-600 dark:text-purple-400" />}
            </div>
            <p className="text-base font-medium text-slate-700 dark:text-slate-200">No notes yet</p>
            <p className="text-sm text-muted-foreground dark:text-slate-400 max-w-md">
              {noteType === 'clean' && 'Generate organized notes with clear sections, ready to copy into any app'}
              {noteType === 'keypoints' && 'Extract the most important facts into a numbered list for quick review'}
              {noteType === 'study-guide' && 'Create a comprehensive guide with definitions, examples, and key concepts'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
