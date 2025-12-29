import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, GripVertical } from "lucide-react";
import type { HomeSection, IndustryPreset } from "@/pages/PageBuilder";

interface SectionEditorProps {
  sections: HomeSection[];
  onChange: (index: number, section: Partial<HomeSection>) => void;
  industry: IndustryPreset;
}

const sectionLabels: Record<string, string> = {
  hero: "Hero Section",
  services_or_menu: "Services / Menu",
  trust_strip: "Trust Badges",
  gallery: "Gallery",
  about: "About",
  contact: "Contact",
  testimonials: "Testimonials",
  cta: "Call to Action",
};

const sectionVariants: Record<string, string[]> = {
  hero: ["image-bg", "call-cta", "professional", "calm", "split", "video"],
  services_or_menu: ["grid", "list", "cards", "icons", "tabs"],
  trust_strip: ["badges", "awards", "certifications", "logos"],
  gallery: ["masonry", "grid", "slider", "lightbox"],
  about: ["side-image", "centered", "team", "providers", "timeline"],
  contact: ["split", "form", "consultation", "booking", "map"],
  testimonials: ["cards", "slider", "quotes", "video"],
  cta: ["banner", "floating", "sticky", "split"],
};

export function SectionEditor({ sections, onChange, industry }: SectionEditorProps) {
  return (
    <div className="space-y-2">
      {sections.map((section, index) => (
        <Collapsible key={`${section.type}-${index}`} defaultOpen={index === 0}>
          <div className="border rounded-md">
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{sectionLabels[section.type] || section.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={section.enabled}
                  onCheckedChange={(enabled) => onChange(index, { enabled })}
                  onClick={(e) => e.stopPropagation()}
                  data-testid={`switch-section-${section.type}`}
                />
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="p-3 pt-0 space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Variant</Label>
                  <Select
                    value={section.variant}
                    onValueChange={(v) => onChange(index, { variant: v })}
                  >
                    <SelectTrigger className="h-8" data-testid={`select-variant-${section.type}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(sectionVariants[section.type] || []).map((variant) => (
                        <SelectItem key={variant} value={variant}>
                          {variant.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {section.type === "hero" && (
                  <>
                    <div className="space-y-2">
                      <Label className="text-xs">Headline</Label>
                      <Input
                        value={section.data.headline || ""}
                        onChange={(e) => onChange(index, { data: { ...section.data, headline: e.target.value } })}
                        placeholder="Your headline"
                        className="h-8"
                        data-testid="input-hero-headline"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Subheadline</Label>
                      <Input
                        value={section.data.subheadline || ""}
                        onChange={(e) => onChange(index, { data: { ...section.data, subheadline: e.target.value } })}
                        placeholder="Your subheadline"
                        className="h-8"
                        data-testid="input-hero-subheadline"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">CTA Button Text</Label>
                      <Input
                        value={section.data.ctaPrimary || ""}
                        onChange={(e) => onChange(index, { data: { ...section.data, ctaPrimary: e.target.value } })}
                        placeholder="Get Started"
                        className="h-8"
                        data-testid="input-hero-cta"
                      />
                    </div>
                  </>
                )}

                {(section.type === "services_or_menu" || section.type === "about" || section.type === "testimonials" || section.type === "contact") && (
                  <div className="space-y-2">
                    <Label className="text-xs">Section Title</Label>
                    <Input
                      value={section.data.title || ""}
                      onChange={(e) => onChange(index, { data: { ...section.data, title: e.target.value } })}
                      placeholder="Section title"
                      className="h-8"
                      data-testid={`input-${section.type}-title`}
                    />
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}
    </div>
  );
}
