import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Folder, FileText, Trash2, Upload, MoveRight } from "lucide-react";
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
        <h3 className="font-medium text-xs">Collections</h3>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              size="sm" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm h-6 text-xs px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              New
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
        <p className="text-xs text-muted-foreground">No collections yet. Create one to get started!</p>
      ) : (
        <div className="space-y-1.5">
          {collections.map((collection) => (
            <div
              key={collection.id}
              className={cn(
                "p-1.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors",
                selectedCollection === collection.id && "bg-accent border-primary"
              )}
              onClick={() => setSelectedCollection(collection.id)}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  <Folder className="h-3 w-3 text-primary flex-shrink-0" />
                  <span className="font-medium text-xs truncate flex-1">{collection.name}</span>
                </div>
                <div className="flex items-center gap-0.5 pl-4">
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-4 w-4 border-border hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      openUploadDialog(collection.id);
                    }}
                    title="Upload files"
                  >
                    <Upload className="h-2.5 w-2.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-4 w-4 border-destructive/50 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCollection(collection.id);
                    }}
                    title="Delete collection"
                  >
                    <Trash2 className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>

              {collection.uploaded_files && collection.uploaded_files.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {collection.uploaded_files.map((file: any) => (
                    <div key={file.id} className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground pl-5 pr-1 group">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <FileText className="h-2.5 w-2.5 flex-shrink-0" />
                        <span className="truncate">{file.file_name}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          openMoveDialog(file.id, file.file_name, collection.id);
                        }}
                        title="Move to another collection"
                      >
                        <MoveRight className="h-2 w-2" />
                      </Button>
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