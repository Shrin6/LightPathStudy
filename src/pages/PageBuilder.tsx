import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Globe, Palette, Layout, Settings, Eye, Upload, Phone, MapPin, Clock, ChevronRight, Star, Shield, Users, Utensils, Wrench, Scale, Heart } from "lucide-react";
import { toast } from "sonner";
import { PreviewPanel } from "@/components/pagebuilder/PreviewPanel";
import { ThemeCustomizer } from "@/components/pagebuilder/ThemeCustomizer";
import { SectionEditor } from "@/components/pagebuilder/SectionEditor";

export type IndustryPreset = "restaurant" | "plumbing" | "lawyers" | "health";
export type BackgroundStyle = "light" | "dark" | "gradient" | "image";
export type FontStyle = "modern" | "classic" | "elegant" | "playful";
export type ButtonStyle = "solid" | "outline" | "pill";
export type CardStyle = "flat" | "shadow" | "border";
export type RadiusSize = "md" | "lg" | "xl";
export type SpacingSize = "normal" | "roomy";

export interface ThemeSettings {
  background_style: BackgroundStyle;
  primary_color: string;
  secondary_color: string;
  font_style: FontStyle;
  button_style: ButtonStyle;
  card_style: CardStyle;
  radius: RadiusSize;
  spacing: SpacingSize;
}

export interface BusinessInfo {
  name: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
  about: string;
  services: string[];
  tagline: string;
}

export interface HomeSection {
  type: "hero" | "services_or_menu" | "trust_strip" | "gallery" | "about" | "contact" | "testimonials" | "cta";
  variant: string;
  enabled: boolean;
  data: Record<string, any>;
}

export interface PageData {
  industry_preset: IndustryPreset;
  theme: ThemeSettings;
  layout_variant: string;
  business: BusinessInfo;
  sections: HomeSection[];
}

const industryDefaults: Record<IndustryPreset, { theme: ThemeSettings; layout: string; sections: HomeSection[] }> = {
  restaurant: {
    theme: {
      background_style: "light",
      primary_color: "#D97706",
      secondary_color: "#92400E",
      font_style: "elegant",
      button_style: "solid",
      card_style: "shadow",
      radius: "lg",
      spacing: "roomy",
    },
    layout: "menu-first",
    sections: [
      { type: "hero", variant: "image-bg", enabled: true, data: { headline: "Welcome to Our Restaurant", subheadline: "Fresh ingredients, unforgettable flavors", ctaPrimary: "View Menu" } },
      { type: "services_or_menu", variant: "grid", enabled: true, data: { title: "Our Menu", items: [] } },
      { type: "gallery", variant: "masonry", enabled: true, data: { title: "Gallery" } },
      { type: "about", variant: "side-image", enabled: true, data: { title: "Our Story" } },
      { type: "testimonials", variant: "cards", enabled: true, data: { title: "What Our Guests Say" } },
      { type: "contact", variant: "split", enabled: true, data: { title: "Visit Us" } },
    ],
  },
  plumbing: {
    theme: {
      background_style: "light",
      primary_color: "#2563EB",
      secondary_color: "#1E40AF",
      font_style: "modern",
      button_style: "solid",
      card_style: "border",
      radius: "md",
      spacing: "normal",
    },
    layout: "service-first",
    sections: [
      { type: "hero", variant: "call-cta", enabled: true, data: { headline: "24/7 Emergency Plumbing", subheadline: "Fast, Reliable Service You Can Trust", ctaPrimary: "Call Now" } },
      { type: "trust_strip", variant: "badges", enabled: true, data: { items: ["Licensed & Insured", "24/7 Service", "Free Estimates", "Satisfaction Guaranteed"] } },
      { type: "services_or_menu", variant: "list", enabled: true, data: { title: "Our Services", items: [] } },
      { type: "about", variant: "centered", enabled: true, data: { title: "Why Choose Us" } },
      { type: "testimonials", variant: "slider", enabled: true, data: { title: "Customer Reviews" } },
      { type: "cta", variant: "banner", enabled: true, data: { headline: "Need Help Now?", ctaPrimary: "Call Now" } },
      { type: "contact", variant: "form", enabled: true, data: { title: "Get a Free Quote" } },
    ],
  },
  lawyers: {
    theme: {
      background_style: "dark",
      primary_color: "#7C3AED",
      secondary_color: "#4C1D95",
      font_style: "classic",
      button_style: "outline",
      card_style: "border",
      radius: "md",
      spacing: "roomy",
    },
    layout: "credibility-first",
    sections: [
      { type: "hero", variant: "professional", enabled: true, data: { headline: "Experienced Legal Representation", subheadline: "Fighting for Your Rights Since 1995", ctaPrimary: "Free Consultation" } },
      { type: "trust_strip", variant: "awards", enabled: true, data: { items: ["Top Rated Attorney", "1000+ Cases Won", "No Fee Unless We Win"] } },
      { type: "services_or_menu", variant: "cards", enabled: true, data: { title: "Practice Areas", items: [] } },
      { type: "about", variant: "team", enabled: true, data: { title: "Meet Our Attorneys" } },
      { type: "testimonials", variant: "quotes", enabled: true, data: { title: "Client Testimonials" } },
      { type: "contact", variant: "consultation", enabled: true, data: { title: "Schedule Your Free Consultation" } },
    ],
  },
  health: {
    theme: {
      background_style: "light",
      primary_color: "#10B981",
      secondary_color: "#047857",
      font_style: "modern",
      button_style: "pill",
      card_style: "shadow",
      radius: "xl",
      spacing: "roomy",
    },
    layout: "trust-first",
    sections: [
      { type: "hero", variant: "calm", enabled: true, data: { headline: "Your Health, Our Priority", subheadline: "Compassionate Care for the Whole Family", ctaPrimary: "Book Appointment" } },
      { type: "trust_strip", variant: "certifications", enabled: true, data: { items: ["Board Certified", "Accepting New Patients", "Same-Day Appointments"] } },
      { type: "services_or_menu", variant: "icons", enabled: true, data: { title: "Our Services", items: [] } },
      { type: "about", variant: "providers", enabled: true, data: { title: "Meet Our Providers" } },
      { type: "testimonials", variant: "cards", enabled: true, data: { title: "Patient Stories" } },
      { type: "contact", variant: "booking", enabled: true, data: { title: "Book Your Visit" } },
    ],
  },
};

const PageBuilder = () => {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("scrape");

  const [pageData, setPageData] = useState<PageData>({
    industry_preset: "restaurant",
    theme: industryDefaults.restaurant.theme,
    layout_variant: industryDefaults.restaurant.layout,
    business: {
      name: "",
      phone: "",
      email: "",
      address: "",
      hours: "",
      about: "",
      services: [],
      tagline: "",
    },
    sections: industryDefaults.restaurant.sections,
  });

  const handleIndustryChange = (industry: IndustryPreset) => {
    const defaults = industryDefaults[industry];
    setPageData({
      ...pageData,
      industry_preset: industry,
      theme: defaults.theme,
      layout_variant: defaults.layout,
      sections: defaults.sections,
    });
  };

  const handleThemeChange = (theme: Partial<ThemeSettings>) => {
    setPageData({
      ...pageData,
      theme: { ...pageData.theme, ...theme },
    });
  };

  const handleBusinessChange = (business: Partial<BusinessInfo>) => {
    setPageData({
      ...pageData,
      business: { ...pageData.business, ...business },
    });
  };

  const handleSectionChange = (index: number, section: Partial<HomeSection>) => {
    const newSections = [...pageData.sections];
    newSections[index] = { ...newSections[index], ...section };
    setPageData({ ...pageData, sections: newSections });
  };

  const handleScrape = async () => {
    if (!websiteUrl) {
      toast.error("Please enter a website URL");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/scrape-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: websiteUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to scrape");
      }

      const scrapedData = result.data;
      const hasData = scrapedData.name || scrapedData.phone || scrapedData.about;

      if (hasData) {
        handleBusinessChange(scrapedData);
        toast.success("Website scraped successfully!");
        setActiveTab("customize");
      } else {
        toast.info("Limited data found. Try manual mode for better results.");
        setManualMode(true);
      }
    } catch (error) {
      console.error("Scrape error:", error);
      toast.error("Failed to scrape website. Try manual mode.");
      setManualMode(true);
    } finally {
      setLoading(false);
    }
  };

  const industryIcons: Record<IndustryPreset, any> = {
    restaurant: Utensils,
    plumbing: Wrench,
    lawyers: Scale,
    health: Heart,
  };

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-80 border-r bg-sidebar flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-primary" />
            <h1 className="text-lg font-semibold">Page Builder</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Generate website previews</p>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Industry Preset</Label>
              <Select value={pageData.industry_preset} onValueChange={(v) => handleIndustryChange(v as IndustryPreset)}>
                <SelectTrigger data-testid="select-industry">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">
                    <div className="flex items-center gap-2">
                      <Utensils className="w-4 h-4" />
                      Restaurant / Food
                    </div>
                  </SelectItem>
                  <SelectItem value="plumbing">
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Plumbing / Home Services
                    </div>
                  </SelectItem>
                  <SelectItem value="lawyers">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Lawyers / Law Firm
                    </div>
                  </SelectItem>
                  <SelectItem value="health">
                    <div className="flex items-center gap-2">
                      <Heart className="w-4 h-4" />
                      Health / Clinic
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full">
                <TabsTrigger value="scrape" className="flex-1" data-testid="tab-scrape">
                  <Globe className="w-4 h-4 mr-1" />
                  Scrape
                </TabsTrigger>
                <TabsTrigger value="customize" className="flex-1" data-testid="tab-customize">
                  <Palette className="w-4 h-4 mr-1" />
                  Theme
                </TabsTrigger>
                <TabsTrigger value="sections" className="flex-1" data-testid="tab-sections">
                  <Layout className="w-4 h-4 mr-1" />
                  Sections
                </TabsTrigger>
              </TabsList>

              <TabsContent value="scrape" className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="website-url">Website URL</Label>
                  <Input
                    id="website-url"
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    data-testid="input-website-url"
                  />
                </div>
                <Button onClick={handleScrape} disabled={loading} className="w-full" data-testid="button-scrape">
                  {loading ? "Scraping..." : "Scrape Website"}
                </Button>

                <div className="flex items-center justify-between">
                  <Label htmlFor="manual-mode" className="text-sm">Manual Mode</Label>
                  <Switch
                    id="manual-mode"
                    checked={manualMode}
                    onCheckedChange={setManualMode}
                    data-testid="switch-manual-mode"
                  />
                </div>

                {manualMode && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="business-name">Business Name</Label>
                      <Input
                        id="business-name"
                        value={pageData.business.name}
                        onChange={(e) => handleBusinessChange({ name: e.target.value })}
                        placeholder="Your Business Name"
                        data-testid="input-business-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-phone">Phone</Label>
                      <Input
                        id="business-phone"
                        value={pageData.business.phone}
                        onChange={(e) => handleBusinessChange({ phone: e.target.value })}
                        placeholder="(555) 123-4567"
                        data-testid="input-business-phone"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-address">Address</Label>
                      <Input
                        id="business-address"
                        value={pageData.business.address}
                        onChange={(e) => handleBusinessChange({ address: e.target.value })}
                        placeholder="123 Main St, City, ST"
                        data-testid="input-business-address"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-hours">Hours</Label>
                      <Input
                        id="business-hours"
                        value={pageData.business.hours}
                        onChange={(e) => handleBusinessChange({ hours: e.target.value })}
                        placeholder="Mon-Fri: 9am-5pm"
                        data-testid="input-business-hours"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-tagline">Tagline</Label>
                      <Input
                        id="business-tagline"
                        value={pageData.business.tagline}
                        onChange={(e) => handleBusinessChange({ tagline: e.target.value })}
                        placeholder="Your catchy tagline"
                        data-testid="input-business-tagline"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="business-about">About</Label>
                      <Textarea
                        id="business-about"
                        value={pageData.business.about}
                        onChange={(e) => handleBusinessChange({ about: e.target.value })}
                        placeholder="Tell your story..."
                        rows={3}
                        data-testid="input-business-about"
                      />
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="customize" className="mt-4">
                <ThemeCustomizer theme={pageData.theme} onChange={handleThemeChange} />
              </TabsContent>

              <TabsContent value="sections" className="mt-4">
                <SectionEditor
                  sections={pageData.sections}
                  onChange={handleSectionChange}
                  industry={pageData.industry_preset}
                />
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        <div className="p-4 border-t space-y-2">
          <Button className="w-full" data-testid="button-save-preview">
            Save Preview
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <PreviewPanel pageData={pageData} />
      </main>
    </div>
  );
};

export default PageBuilder;
