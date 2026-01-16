import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileUploadDialog } from "@/components/study/FileUploadDialog";
import { supabase } from "@/integrations/supabase/client";
import { extractSyllabusItems, syllabusToItems, ParsedSyllabus } from "@/lib/syllabusExtractor";
import { ExtractedSyllabusItem, parseICS, detectSchedulingPatterns } from "@/lib/icsUtils";
import { generateICS, downloadICS, suggestStudyBlocks } from "@/lib/icsGenerator";
import { toast } from "sonner";

const CalendarConverter = () => {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Record<string, boolean>>({});
  const [extracting, setExtracting] = useState(false);
  const [items, setItems] = useState<ExtractedSyllabusItem[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  // Modal for warnings when items missing end dates or bad times
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningItems, setWarningItems] = useState<ExtractedSyllabusItem[]>([]);

  useEffect(() => {
    fetchCollections();

    // Check auth status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (selectedCollection) {
      fetchFiles(selectedCollection);
    }
  }, [selectedCollection]);

  async function fetchCollections() {
    const { data } = await supabase
      .from("collections")
      .select("id, name")
      .order("created_at", { ascending: false });

    setCollections(data || []);
    if (data && data.length > 0 && !selectedCollection) {
      setSelectedCollection(data[0].id);
    }
  }

  async function fetchFiles(collectionId: string) {
    const { data } = await supabase
      .from("uploaded_files")
      .select("id, file_name, file_size, file_type, parsed_content, processing")
      .eq("collection_id", collectionId)
      .order("created_at", { ascending: false });

    setFiles(data || []);
    const map: Record<string, boolean> = {};
    (data || []).forEach((f: any) => { map[f.id] = false; });
    setSelectedFileIds(map);
  }

  async function handleExtractSelected() {
    if (!isAuthenticated) {
      toast.error('Please sign in to extract files');
      return;
    }

    const ids = Object.keys(selectedFileIds).filter((id) => selectedFileIds[id]);
    if (ids.length === 0) {
      toast.error("Select at least one file to extract");
      return;
    }

    setExtracting(true);
    const newItems: ExtractedSyllabusItem[] = [];

    for (const id of ids) {
      const file = files.find((f) => f.id === id);
      if (!file) continue;
      try {
        // Handle calendar (.ics) files separately
        if ((file.file_type === 'text/calendar') || file.file_name.toLowerCase().endsWith('.ics')) {
          const parsedContent = file.parsed_content;
          let text = parsedContent;

          // If parsed_content not set (older uploads), download file from storage
          if (!text) {
            try {
              const { data } = await supabase.storage.from('study-files').download(file.file_path);
              const blob = await data!.arrayBuffer();
              text = new TextDecoder().decode(new Uint8Array(blob));
            } catch (err) {
              console.error('Failed to download ICS file:', err);
              toast.error(`Failed to read ${file.file_name}`);
              continue;
            }
          }

          if (text) {
            const events = parseICS(text);
            // Convert ICS events to ExtractedSyllabusItems
            for (const ev of events) {
              newItems.push({
                id: ev.uid || `${file.id}-${Math.random().toString(36).slice(2,8)}`,
                courseId: file.id,
                courseName: `Imported: ${file.file_name}`,
                type: ev.rrule ? 'class' : 'assignment',
                title: ev.summary,
                description: ev.description,
                startDate: ev.dtstart,
                endDate: ev.dtend,
                location: ev.location,
                priority: 'medium',
                confidenceScore: 90,
                recurring: !!ev.rrule,
                recurrencePattern: ev.rrule,
                needsReview: false,
              });
            }

            // Detect scheduling patterns
            const patterns = detectSchedulingPatterns(events);
            if (patterns.busyTimes && patterns.busyTimes.length > 0) {
              toast.success(`Detected ${patterns.busyTimes.length} busy time ranges from ${file.file_name}`);
              // Suggest study blocks
              const suggestions = suggestStudyBlocks(patterns.busyTimes);
              newItems.push(...suggestions);
            }

            continue;
          }
        }

        const parsed: ParsedSyllabus | null = await extractSyllabusItems(id, file.file_name);
        if (parsed) {
          const converted = syllabusToItems(parsed).map(it => {
            if (it.recurring && parsed.suggestedEndDate) {
              return {
                ...it,
                suggestedEndDate: parsed.suggestedEndDate ? new Date(parsed.suggestedEndDate) : undefined,
                suggestedEndDateConfidence: parsed.suggestedEndDateConfidence || null,
                recurrenceEndDate: null,
              } as any;
            }
            return { ...it, recurrenceEndDate: null } as any;
          });
          if (converted.length === 0) {
            toast.warning(`No extractable items found in ${file.file_name}. Please review the file.`);
          }
          newItems.push(...converted);
        } else {
          toast.error(`Failed to parse ${file.file_name}`);
        }
      } catch (err: any) {
        console.error("Extraction error:", err);
        toast.error(err?.message || "Extraction failed");
      }
    }

    setItems((prev) => [...prev, ...newItems]);
    setExtracting(false);
  }

  function handleToggleFile(id: string) {
    setSelectedFileIds((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function formatTimeInput(d?: Date | string | null): string {
    if (!d) return '';
    const date = typeof d === 'string' ? new Date(d) : d;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function handleTimeChange(idx: number, which: 'start' | 'end', value: string) {
    // value is 'HH:MM'
    setItems(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      const newP = { ...p } as any;
      const dateRef = new Date(p.startDate);
      const [hh, mm] = value.split(':').map(Number);
      const newDate = new Date(dateRef);
      newDate.setHours(hh, mm, 0, 0);
      if (which === 'start') {
        newP.startDate = newDate;
        // keep endDate adjusted if earlier than start
        if (newP.endDate && new Date(newP.endDate) <= newDate) {
          const end = new Date(newDate);
          end.setHours(end.getHours() + 1);
          newP.endDate = end;
        }
      } else {
        newP.endDate = newDate;
      }
      return newP;
    }));
  }

  function handleGenerateICS() {
    if (!isAuthenticated) {
      toast.error('Please sign in to generate calendars');
      return;
    }

    if (items.length === 0) {
      toast.error("No items to generate. Extract syllabi first.");
      return;
    }

    // Auto-apply suggested end dates for moderate-confidence detections (threshold 60%)
    const AUTO_APPLY_THRESHOLD = 60;
    const autoAppliedItems = items.map(it => {
      if (it.recurring && !it.recurrenceEndDate && it.suggestedEndDate && (it.suggestedEndDateConfidence || 0) >= AUTO_APPLY_THRESHOLD) {
        return { ...it, recurrenceEndDate: it.suggestedEndDate };
      }
      return it;
    });

    // Validate: all recurring items must have recurrenceEndDate and valid times
    const missing = autoAppliedItems.filter(it => it.recurring && !it.recurrenceEndDate);
    const badTimes = autoAppliedItems.filter(it => {
      if (!it.recurring) return false;
      const start = it.startDate ? new Date(it.startDate) : null;
      const end = it.endDate ? new Date(it.endDate) : null;
      if (start && end) return end <= start;
      return false;
    });

    if (missing.length > 0 || badTimes.length > 0) {
      // Open modal to warn and allow proceed anyway
      setWarningItems(autoAppliedItems.filter(it => (it.recurring && (!it.recurrenceEndDate || (it.endDate && (new Date(it.endDate) <= new Date(it.startDate)))))));
      setItems(autoAppliedItems);
      setWarningModalOpen(true);
      return;
    }

    setItems(autoAppliedItems);

    const ics = generateICS(autoAppliedItems, { filename: "Academic Calendar", calendarName: "Combined Schedule" });
    downloadICS(ics, "Combined_Calendar.ics");
  }

  function applyFallbackEndDate(item: ExtractedSyllabusItem): ExtractedSyllabusItem {
    // Use suggested if present, otherwise fallback to a 16-week semester end after startDate
    if (item.suggestedEndDate) return { ...item, recurrenceEndDate: item.suggestedEndDate };
    const start = new Date(item.startDate);
    const fallback = new Date(start);
    fallback.setDate(fallback.getDate() + 112); // ~16 weeks
    return { ...item, recurrenceEndDate: fallback };
  }

  async function proceedAnywayAndGenerate() {
    // Auto-fix bad times (end <= start) by extending end 1 hour, and apply fallback end dates
    const fixed = items.map(it => {
      let p = { ...it } as any;
      if (p.recurring && p.endDate && p.startDate) {
        const s = new Date(p.startDate);
        const e = new Date(p.endDate);
        if (e <= s) {
          const newEnd = new Date(s);
          newEnd.setHours(newEnd.getHours() + 1);
          p.endDate = newEnd;
        }
      }
      if (p.recurring && !p.recurrenceEndDate) {
        p = applyFallbackEndDate(p);
      }
      return p;
    });

    setItems(fixed);
    setWarningModalOpen(false);

    const ics = generateICS(fixed, { filename: "Academic Calendar", calendarName: "Combined Schedule" });
    downloadICS(ics, "Combined_Calendar.ics");
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Multi-Syllabus → Calendar Converter</h1>
          <div className="flex items-center gap-2">
            <Button onClick={() => setUploadOpen(true)} disabled={!isAuthenticated}>
              Upload Syllabi / ICS
            </Button>
            <Button variant="outline" onClick={() => handleGenerateICS()} disabled={!isAuthenticated}>
              Generate ICS
            </Button>
            {!isAuthenticated && (
              <div className="text-sm text-muted-foreground">Sign in to upload files and generate calendars. <Button variant="link" onClick={() => window.location.href = '/auth'}>Sign in</Button></div>
            )}
          </div>
        </div>

        <Card className="p-4 mb-4">
          <div className="mb-3">
            <label className="block text-sm font-medium mb-2">Select Collection</label>
            <select value={selectedCollection || ""} onChange={(e) => setSelectedCollection(e.target.value)} className="w-full p-2 border rounded">
              {collections.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Uploaded Files</h3>
            {files.length === 0 && <div className="text-muted-foreground">No files in this collection.</div>}
            <ul className="space-y-2">
              {files.map((f: any) => (
                <li key={f.id} className="flex items-center justify-between p-2 border rounded">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={!!selectedFileIds[f.id]} onChange={() => handleToggleFile(f.id)} />
                    <div>
                      <div className="font-medium">{f.file_name}</div>
                      <div className="text-sm text-muted-foreground">{f.file_type} • {f.file_size} bytes {f.processing ? '• Processing...' : ''}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4">
              <Button onClick={handleExtractSelected} disabled={extracting}>{extracting ? 'Extracting...' : 'Extract Selected'}</Button>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Extracted Items</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => {
                // Apply suggested end dates to all recurring items where available
                setItems(prev => prev.map(it => it.recurring && it.suggestedEndDate ? { ...it, recurrenceEndDate: it.suggestedEndDate } : it));
                toast.success('Applied suggested end dates to applicable recurring items');
              }}>Apply suggested end dates</Button>
              <Button size="sm" onClick={() => {
                // Bulk apply fallback semester-end for recurring items without a suggestion
                setItems(prev => prev.map(it => it.recurring && !it.recurrenceEndDate ? applyFallbackEndDate(it) : it));
                toast.success('Applied semester fallback end dates to applicable recurring items');
              }}>Apply semester fallback</Button>
            </div>
          </div>

          {items.length === 0 && <div className="text-muted-foreground">No items extracted yet.</div>}
          <ul className="space-y-2">
            {items.map((it, idx) => (
              <li key={it.id} className="p-2 border rounded">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-medium">{it.title}</div>
                    <div className="text-sm text-muted-foreground">{it.courseName} • {it.type} • {new Date(it.startDate).toLocaleString()}</div>
                    {it.recurring && (
                      <div className="mt-2 text-sm">
                        <div>Suggested end date: <strong>{it.suggestedEndDate ? new Date(it.suggestedEndDate).toLocaleDateString() : '—'}</strong> {it.suggestedEndDateConfidence ? `(confidence ${it.suggestedEndDateConfidence}%)` : ''}</div>

                        <div className="flex items-center gap-2 mt-1">
                          <input type="date" value={it.recurrenceEndDate ? new Date(it.recurrenceEndDate).toISOString().slice(0,10) : ''} onChange={(e) => {
                            const val = e.target.value ? new Date(e.target.value + 'T00:00:00') : null;
                            setItems(prev => prev.map((p, i) => i === idx ? { ...p, recurrenceEndDate: val } : p));
                          }} className="p-1 border rounded" />
                          <Button size="sm" onClick={() => setItems(prev => prev.map((p, i) => i === idx ? { ...p, recurrenceEndDate: p.suggestedEndDate || null } : p))}>Use suggested</Button>
                        </div>

                        {/* Time inputs to edit exact class times */}
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs">Start</label>
                          <input type="time" value={formatTimeInput(it.startDate)} onChange={(e) => handleTimeChange(idx, 'start', e.target.value)} className="p-1 border rounded" />
                          <label className="text-xs">End</label>
                          <input type="time" value={formatTimeInput(it.endDate || it.startDate)} onChange={(e) => handleTimeChange(idx, 'end', e.target.value)} className="p-1 border rounded" />
                        </div>

                        <div className="text-xs text-muted-foreground mt-1">Edit times (e.g., 09:30) to set precise class start/end times.</div>
                      </div>
                    )}
                  </div>

                  <div className="text-sm">Priority: <strong>{it.priority}</strong></div>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Dialog open={warningModalOpen} onOpenChange={setWarningModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Missing end dates or invalid times</DialogTitle>
              <DialogDescription>
                Some recurring items are missing a recurrence end date or have an end time that is not later than the start time. You can apply a semester fallback, fix them manually, or proceed anyway (we'll auto-fix bad times and apply sensible fallbacks).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 my-2">
              {warningItems.map((it) => (
                <div key={it.id} className="p-2 border rounded">
                  <div className="font-medium">{it.title} — {it.courseName}</div>
                  <div className="text-sm text-muted-foreground">
                    {it.recurring && !it.recurrenceEndDate && <div>Missing recurrence end date</div>}
                    {it.recurring && it.startDate && it.endDate && new Date(it.endDate) <= new Date(it.startDate) && <div>End time is earlier than start time</div>}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="flex gap-2">
              <Button variant="secondary" onClick={() => setWarningModalOpen(false)}>Cancel</Button>
              <Button size="sm" onClick={() => {
                setItems(prev => prev.map(it => it.recurring && !it.recurrenceEndDate ? applyFallbackEndDate(it) : it));
                setWarningModalOpen(false);
                toast.success('Applied semester fallback end dates');
              }}>Apply fallback</Button>
              <Button size="sm" onClick={() => proceedAnywayAndGenerate()}>Proceed anyway</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <FileUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} collectionId={selectedCollection} onUploadComplete={() => { fetchCollections(); if (selectedCollection) fetchFiles(selectedCollection); }} collections={collections} />
      </div>
    </div>
  );
};

export default CalendarConverter;
