import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, Loader2 } from "lucide-react";

interface Collection {
  id: string;
  name: string;
}

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collectionId: string | null;
  onUploadComplete: () => void;
  collections: Collection[];
}

export const FileUploadDialog = ({
  open,
  onOpenChange,
  collectionId,
  onUploadComplete,
  collections,
}: FileUploadDialogProps) => {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [showCollectionSelector, setShowCollectionSelector] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileCollectionMap, setFileCollectionMap] = useState<Record<string, string>>({});
  const [newCollectionName, setNewCollectionName] = useState('');
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateFile, setDuplicateFile] = useState<{ file: File; existingRecord: any } | null>(null);

  const initiateFileSelection = (files: FileList) => {
    const filesArray = Array.from(files);
    setSelectedFiles(filesArray);
    
    // Initialize collection map with default collectionId
    const initialMap: Record<string, string> = {};
    filesArray.forEach((file) => {
      initialMap[file.name] = collectionId || '';
    });
    setFileCollectionMap(initialMap);
    setShowCollectionSelector(true);
  };

  const handleCreateNewCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error('Collection name cannot be empty');
      return;
    }

    setCreatingCollection(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('collections')
        .insert({ name: newCollectionName.trim(), user_id: user.id })
        .select()
        .single();

      if (error) throw error;

      toast.success(`Collection "${newCollectionName}" created`);
      setNewCollectionName('');
      
      // Update all unmapped files to use new collection
      const updatedMap = { ...fileCollectionMap };
      Object.keys(updatedMap).forEach((fileName) => {
        if (updatedMap[fileName] === 'new') {
          updatedMap[fileName] = data.id;
        }
      });
      setFileCollectionMap(updatedMap);
      
      onUploadComplete(); // Refresh collections list
    } catch (error: any) {
      console.error('Error creating collection:', error);
      toast.error(error.message || 'Failed to create collection');
    } finally {
      setCreatingCollection(false);
    }
  };

  const handleConfirmCollections = async () => {
    // Check if any files are assigned to 'new' but collection not created
    const hasUnresolvedNew = Object.values(fileCollectionMap).some(id => id === 'new');
    if (hasUnresolvedNew) {
      toast.error('Please create the new collection first');
      return;
    }

    setShowCollectionSelector(false);
    await checkForDuplicatesAndProcess();
  };

  const checkForDuplicatesAndProcess = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check each file for duplicates
      for (const file of selectedFiles) {
        const { data: existingFiles } = await supabase
          .from('uploaded_files')
          .select('*')
          .eq('user_id', user.id)
          .eq('file_name', file.name)
          .eq('file_size', file.size)
          .limit(1);

        if (existingFiles && existingFiles.length > 0) {
          // Found duplicate - show confirmation modal
          setDuplicateFile({ file, existingRecord: existingFiles[0] });
          setShowDuplicateModal(true);
          return; // Pause here until user decides
        }
      }

      // No duplicates found, proceed with upload
      await processFileUploads();
    } catch (error: any) {
      console.error("Duplicate check error:", error);
      toast.error(error.message || "Failed to check for duplicates");
    }
  };

  const handleReuseDuplicate = async () => {
    if (!duplicateFile) return;

    setShowDuplicateModal(false);
    toast.success(`Reusing existing content for ${duplicateFile.file.name} (no credits used)`);
    
    // Remove this file from processing queue and continue with remaining files
    setSelectedFiles(prev => prev.filter(f => f.name !== duplicateFile.file.name));
    setDuplicateFile(null);
    
    // Continue checking remaining files
    await checkForDuplicatesAndProcess();
  };

  const handleReprocessDuplicate = async () => {
    if (!duplicateFile) return;

    setShowDuplicateModal(false);
    toast.info(`Reprocessing ${duplicateFile.file.name} with OCR & embeddings (uses credits)`);
    
    // Delete old record and proceed with upload
    await supabase.from('uploaded_files').delete().eq('id', duplicateFile.existingRecord.id);
    setDuplicateFile(null);
    
    // Continue with normal upload process
    await processFileUploads();
  };

  const processFileUploads = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const targetCollectionId = fileCollectionMap[file.name];

        if (!targetCollectionId) {
          toast.error(`No collection selected for ${file.name}`);
          continue;
        }

        // Validate file size (800MB max)
        const maxSize = 800 * 1024 * 1024;
        if (file.size > maxSize) {
          toast.error(`${file.name} exceeds 800MB limit`);
          continue;
        }

        // Validate file type
        const validTypes = [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "text/plain",
          "image/jpeg",
          "image/png",
        ];

        if (!validTypes.includes(file.type)) {
          toast.error(`${file.name} is not a supported file type`);
          continue;
        }

        // Sanitize filename to remove special characters that Supabase Storage doesn't allow
        const sanitizedFileName = file.name.replace(/[^\w\s.-]/g, '_');
        
        // Upload to storage
        const filePath = `${user.id}/${Date.now()}-${sanitizedFileName}`;
        const { error: uploadError } = await supabase.storage
          .from("study-files")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Save to database
        const { data: fileRecord, error: dbError } = await supabase
          .from("uploaded_files")
          .insert({
            collection_id: targetCollectionId,
            user_id: user.id,
            file_name: sanitizedFileName,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
          })
          .select()
          .single();

        if (dbError) throw dbError;

        // Get session access token for authenticated function call
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error("Session expired - please sign in again");
          continue;
        }

        // Show parsing toast
        toast.info(`Parsing ${sanitizedFileName}...`);

        // Trigger parsing with authentication
        const parseResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-document`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ fileId: fileRecord.id }),
          }
        );

        if (!parseResponse.ok) {
          const errorText = await parseResponse.text();
          console.error("Parse error:", parseResponse.status, errorText);
          toast.error(`${sanitizedFileName} parsing failed`);
        } else {
          const parseData = await parseResponse.json();
          const parsedContent = parseData?.parsedContent || '';
          
          if (parsedContent.includes('no readable text') || parsedContent.includes('image-only PDF')) {
            toast.error(`${sanitizedFileName}: ${parsedContent}`);
          } else if (file.type === 'application/pdf' && parsedContent.length > 300) {
            toast.success(`${sanitizedFileName} processed with OCR successfully!`);
          } else {
            toast.success(`${sanitizedFileName} parsed successfully!`);
          }
        }
      }

      toast.success('Files uploaded successfully!');
      setSelectedFiles([]);
      setFileCollectionMap({});
      onUploadComplete();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload file");
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      initiateFileSelection(e.dataTransfer.files);
    }
  };

  return (
    <>
      <Dialog open={open && !showCollectionSelector} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Study Materials</DialogTitle>
          </DialogHeader>

          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${dragActive ? "border-primary bg-primary/5" : "border-border"}
              ${uploading ? "opacity-50 pointer-events-none" : ""}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Uploading and parsing...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">Drag & drop files here</p>
                  <p className="text-sm text-muted-foreground mt-1">or click to browse</p>
                </div>
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  multiple
                  accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => e.target.files && initiateFileSelection(e.target.files)}
                />
                <Button
                  variant="outline"
                  onClick={() => document.getElementById("file-upload")?.click()}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>Supported: PDF, DOCX, PPTX, TXT, JPG, PNG</p>
                  <p>Max size: 800MB per file</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCollectionSelector} onOpenChange={(open) => !uploading && setShowCollectionSelector(open)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Where should these files be stored?</DialogTitle>
            <DialogDescription>
              Choose a collection for each file or create a new one
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {selectedFiles.map((file) => (
              <div key={file.name} className="space-y-2">
                <Label className="text-sm font-medium truncate block">{file.name}</Label>
                <Select
                  value={fileCollectionMap[file.name]}
                  onValueChange={(value) => setFileCollectionMap(prev => ({ ...prev, [file.name]: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select collection" />
                  </SelectTrigger>
                  <SelectContent>
                    {collections.map((col) => (
                      <SelectItem key={col.id} value={col.id}>
                        {col.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="new">+ Create New Collection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}

            {Object.values(fileCollectionMap).some(id => id === 'new') && (
              <div className="space-y-2 pt-2 border-t">
                <Label htmlFor="new-collection-name">New Collection Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="new-collection-name"
                    placeholder="Enter collection name"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    disabled={creatingCollection}
                  />
                  <Button
                    onClick={handleCreateNewCollection}
                    disabled={creatingCollection || !newCollectionName.trim()}
                    size="sm"
                  >
                    {creatingCollection ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setShowCollectionSelector(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleConfirmCollections} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {uploading ? 'Uploading...' : 'Confirm & Upload'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File Already Exists</DialogTitle>
            <DialogDescription>
              This file has already been processed. Reusing previous results is free. Reprocessing with OCR & embeddings will use credits.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium">{duplicateFile?.file.name}</p>
              <p className="text-muted-foreground">Size: {((duplicateFile?.file.size || 0) / 1024).toFixed(2)} KB</p>
            </div>
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleReuseDuplicate}>
                Reuse Existing Content (Free)
              </Button>
              <Button onClick={handleReprocessDuplicate}>
                Reprocess with OCR (Uses Credits)
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
