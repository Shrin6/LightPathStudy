import { FolderOpen, Upload, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface CollectionHeaderProps {
  collectionName: string | null;
  onManageUploads?: () => void;
  showBack?: boolean;
}

export function CollectionHeader({ 
  collectionName, 
  onManageUploads,
  showBack = true 
}: CollectionHeaderProps) {
  const navigate = useNavigate();

  if (!collectionName) return null;

  return (
    <div 
      className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/30 border-b"
      data-testid="collection-header"
    >
      <div className="flex items-center gap-2 min-w-0">
        {showBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-1 h-7 px-2 text-muted-foreground hover:text-foreground shrink-0"
            data-testid="button-back-dashboard"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="text-xs hidden sm:inline">Dashboard</span>
          </Button>
        )}
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderOpen className="h-4 w-4 text-primary shrink-0" />
          <span 
            className="text-sm font-medium truncate max-w-[200px]"
            data-testid="text-collection-name"
          >
            {collectionName}
          </span>
        </div>
      </div>
      
      {onManageUploads && (
        <Button
          variant="outline"
          size="sm"
          onClick={onManageUploads}
          className="gap-1 h-7 text-xs shrink-0"
          data-testid="button-manage-uploads"
        >
          <Upload className="h-3 w-3" />
          <span className="hidden sm:inline">Manage Files</span>
        </Button>
      )}
    </div>
  );
}
