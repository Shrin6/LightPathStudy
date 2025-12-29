import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Folder, FileText, Trash2, Upload, MoveRight, RefreshCw } from "lucide-react";
import { FileUploadDialog } from "./FileUploadDialog";
import { cn } from "@/lib/utils";

interface Collection {
  id: string;
  name: string;
  uploaded_files: any[];
}

interface CollectionsListProps {
  collections: Collection[];
  selectedCollection: string | null;
  setSelectedCollection: (id: string | null) => void;
  onRefresh: () => void;
  loading: boolean;
}

export const CollectionsList = ({
  collections,
  selectedCollection,
  setSelectedCollection,
  onRefresh,
  loading,
}: CollectionsListProps) => {
  const [newCollectionName, setNewCollectionName] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadingTo, setUploadingTo] = useState<string | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ id: string; name: string; currentCollectionId: string } | null>(null);
  const [targetCollectionId, setTargetCollectionId] = useState<string>('');
  const [reparsingFileId, setReparsingFileId] = useState<string | null>(null);

  const handleReparseFile = async (fileId: string, filePath: string, collectionId: string) => {
    setReparsingFileId(fileId);
    try {
      // Set processing flag
      await supabase
        .from('uploaded_files')
        .update({ processing: true })
        .eq('id', fileId);

      // Delete existing chunks for this file
      await supabase
        .from('document_chunks')
        .delete()
        .eq('file_id', fileId);

      // Trigger parse-document function
      const { error } = await supabase.functions.invoke('parse-document', {
        body: { fileId, filePath, collectionId }
      });

      if (error) throw error;

      toast.success('Re-parsing started');
      onRefresh();
    } catch (error: any) {
      console.error('Re-parse error:', error);
      toast.error(error.message || 'Failed to re-parse file');
    } finally {
      setReparsingFileId(null);
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error("Please enter a collection name");
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("collections")
        .insert({ name: newCollectionName.trim(), user_id: user.id });

      if (error) throw error;

      toast.success("Collection created!");
      setNewCollectionName("");
      setCreateDialogOpen(false);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to create collection");
    }
  };

  const handleDeleteCollection = async (id: string) => {
    if (!confirm("Delete this collection and all its files?")) return;

    try {
      const { error } = await supabase
        .from("collections")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Collection deleted");
      if (selectedCollection === id) {
        setSelectedCollection(null);
      }
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete collection");
    }
  };

  const openUploadDialog = (collectionId: string) => {
    setUploadingTo(collectionId);
    setUploadDialogOpen(true);
  };

  const openMoveDialog = (fileId: string, fileName: string, currentCollectionId: string) => {
    setSelectedFile({ id: fileId, name: fileName, currentCollectionId });
    setTargetCollectionId('');
    setMoveDialogOpen(true);
  };

  const handleMoveFile = async () => {
    if (!selectedFile || !targetCollectionId || targetCollectionId === selectedFile.currentCollectionId) {
      toast.error('Please select a different collection');
      return;
    }

    try {
      const { error } = await supabase
        .from('uploaded_files')
        .update({ collection_id: targetCollectionId })
        .eq('id', selectedFile.id);

      if (error) throw error;

      toast.success('File moved successfully!');
      setMoveDialogOpen(false);
      setSelectedFile(null);
      onRefresh();
    } catch (error: any) {
      console.error('Move file error:', error);
      toast.error(error.message || 'Failed to move file');
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading collections...</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-1">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              className="w-full h-7 text-xs gap-1"
            >
              <Plus className="h-3 w-3" />
              New Collection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Collection</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                placeholder="Collection name (e.g., Biology 101)"
                value={newCollectionName}
                onChange={(e) => setNewCollectionName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
              />
              <Button onClick={handleCreateCollection} className="w-full">
                Create Collection
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {collections.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">No collections yet</p>
      ) : (
        <div className="space-y-1">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={cn(
                "p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors",
                selectedCollection === collection.id && "bg-accent border-primary/50"
              )}
              onClick={() => setSelectedCollection(collection.id)}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="font-medium text-xs truncate">{collection.name}</span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      openUploadDialog(collection.id);
                    }}
                    title="Upload files"
                  >
                    <Upload className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(collection.id);
                    }}
                    title="Delete collection"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {collection.uploaded_files && collection.uploaded_files.length > 0 && (
                <div className="mt-1.5 space-y-0.5 pl-5">
                  {collection.uploaded_files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground group">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <FileText className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{file.file_name}</span>
                        {file.processing && (
                          <RefreshCw className="h-2.5 w-2.5 animate-spin text-primary shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4"
                          disabled={reparsingFileId === file.id || file.processing}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReparseFile(file.id, file.file_path, collection.id);
                          }}
                          title="Re-parse file"
                        >
                          <RefreshCw className={`h-2 w-2 ${reparsingFileId === file.id ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4"
                          onClick={(e) => {
                            e.stopPropagation();
                            openMoveDialog(file.id, file.file_name, collection.id);
                          }}
                          title="Move to another collection"
                        >
                          <MoveRight className="h-2 w-2" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <FileUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        collectionId={uploadingTo}
        onUploadComplete={onRefresh}
        collections={collections}
      />

      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move File to Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Move <span className="font-semibold">{selectedFile?.name}</span> to:
            </p>
            <Select value={targetCollectionId} onValueChange={setTargetCollectionId}>
              <SelectTrigger>
                <SelectValue placeholder="Select collection" />
              </SelectTrigger>
              <SelectContent>
                {collections
                  .filter(c => c.id !== selectedFile?.currentCollectionId)
                  .map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button onClick={handleMoveFile} className="w-full">
              Move File
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};