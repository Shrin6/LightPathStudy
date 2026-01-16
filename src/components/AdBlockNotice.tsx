import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

// Show a dialog every 30 seconds when a resource appears to be blocked by a client (ad blocker)
// Users can dismiss it temporarily or turn it off permanently
export default function AdBlockNotice() {
  const [open, setOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  // Images to show at bottom of the modal. Add your own images to public/adblock/ and they'll be picked randomly.
  const IMAGES = [
    '/adblock/ad1.jpg',
    '/adblock/ad2.jpg',
    '/adblock/ad3.jpg',
  ];

  useEffect(() => {
    // Check if user has permanently disabled this notice
    if (typeof localStorage !== 'undefined' && localStorage.getItem('adblock_notice_disabled')) {
      setIsDisabled(true);
      return;
    }

    const adIndicators = [
      'ads',
      'doubleclick',
      'googlesyndication',
      'adservice',
      'adsystem',
      'adsbygoogle',
      'adserver',
      'adservices',
      'posthog',
    ];

    const handler = (event: Event | ErrorEvent) => {
      try {
        let detected = false;

        // If the error event includes the net error text
        if ((event as ErrorEvent).message && typeof (event as ErrorEvent).message === 'string') {
          const msg = (event as ErrorEvent).message;
          if (msg.includes('ERR_BLOCKED_BY_CLIENT') || msg.toLowerCase().includes('blocked')) {
            detected = true;
          }
        }

        // Resource element failures (img, script, iframe, link)
        const target = (event as any).target as Element | null;
        if (!detected && target && target.tagName) {
          const tag = target.tagName.toUpperCase();
          if (['IMG', 'SCRIPT', 'IFRAME', 'LINK'].includes(tag)) {
            const src = ((target as any).src || (target as any).href || '') as string;
            const lower = src.toLowerCase();
            if (adIndicators.some(ind => lower.includes(ind))) detected = true;

            // Sometimes ad blockers block fonts, analytics, etc. If the element failed to load and its src contains common third-party domains, treat it as blocked.
            if (!detected && lower && (lower.includes('google-analytics') || lower.includes('fontawesome') || lower.includes('analytics') || lower.includes('gtag') || lower.includes('posthog'))) {
              detected = true;
            }
          }
        }

        // Show popup only when a new error is detected
        if (detected) {
          try {
            const idx = Math.floor(Math.random() * IMAGES.length);
            setSelectedImage(IMAGES[idx]);
          } catch (e) {
            setSelectedImage(null);
          }
          setOpen(true);
        }
      } catch (e) {
        // ignore any errors in detection logic
      }
    };

    window.addEventListener('error', handler, true);

    return () => {
      window.removeEventListener('error', handler, true);
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resource blocked</DialogTitle>
          <DialogDescription>
            No ads — we just need to help the site perform better. A resource was blocked by your browser or an extension which may affect some features.
          </DialogDescription>
        </DialogHeader>

        {/* Optional image placed at the bottom - picks randomly each time modal opens */}
        {selectedImage && (
          <div className="mt-4 flex justify-center">
            <img src={selectedImage} alt="fun" className="max-h-40 object-contain rounded-md shadow-sm" />
          </div>
        )}

        <DialogFooter className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            onClick={() => {
              // Permanently turn off the notice
              if (typeof localStorage !== 'undefined') {
                localStorage.setItem('adblock_notice_disabled', '1');
              }
              setIsDisabled(true);
              setOpen(false);
            }}
          >
            <X className="mr-2 h-4 w-4" />
            Turn Off
          </Button>
          <Button variant="secondary" onClick={() => setOpen(false)}>Dismiss</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
