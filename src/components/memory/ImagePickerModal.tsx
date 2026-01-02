import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ImageResult } from "@/lib/imageSearch/wikiSearch";

interface ImagePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ImageResult[];
  onSelect: (image: ImageResult) => void;
}

export const ImagePickerModal = ({ open, onOpenChange, images, onSelect }: ImagePickerModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pick a related image</DialogTitle>
          <p className="text-sm text-muted-foreground">Images come from Wikimedia Commons (fallback: Unsplash). Always include source credit.</p>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {images.map((img, idx) => (
              <button
                key={`${img.pageUrl}-${idx}`}
                className="flex flex-col gap-2 rounded-lg border bg-card/60 p-2 text-left transition hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                onClick={() => onSelect(img)}
                type="button"
              >
                <img src={img.thumbnail} alt={img.title} className="w-full rounded-md border" />
                <div>
                  <p className="text-sm font-medium leading-tight line-clamp-2">{img.title}</p>
                  <p className="text-xs text-muted-foreground">Source: {img.source}</p>
                </div>
              </button>
            ))}
          </div>
          {images.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6">No image found — skipping.</div>
          )}
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
