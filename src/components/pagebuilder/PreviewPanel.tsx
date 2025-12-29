import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Phone, MapPin, Clock, Mail, ChevronRight, Star, Shield, Check, Upload, Menu } from "lucide-react";
import type { PageData, ThemeSettings, HomeSection, IndustryPreset } from "@/pages/PageBuilder";

interface PreviewPanelProps {
  pageData: PageData;
}

function getThemeClasses(theme: ThemeSettings, industry: IndustryPreset) {
  const bgClasses = {
    light: "bg-white text-gray-900",
    dark: "bg-gray-900 text-white",
    gradient: industry === "lawyers" ? "bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white" :
              industry === "health" ? "bg-gradient-to-br from-emerald-50 to-teal-50 text-gray-900" :
              industry === "restaurant" ? "bg-gradient-to-br from-amber-50 to-orange-50 text-gray-900" :
              "bg-gradient-to-br from-blue-50 to-indigo-50 text-gray-900",
    image: "bg-gray-100 text-gray-900",
  };

  const fontClasses = {
    modern: "font-sans",
    classic: "font-serif",
    elegant: "font-serif tracking-wide",
    playful: "font-sans",
  };

  const radiusClasses = {
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-xl",
  };

  return {
    bg: bgClasses[theme.background_style],
    font: fontClasses[theme.font_style],
    radius: radiusClasses[theme.radius],
  };
}

function getButtonClasses(theme: ThemeSettings) {
  const base = "px-6 py-3 font-semibold transition-all";
  const styles = {
    solid: `${base} text-white`,
    outline: `${base} bg-transparent border-2`,
    pill: `${base} text-white rounded-full`,
  };
  return styles[theme.button_style];
}

function ImagePlaceholder({ label, className = "" }: { label: string; className?: string }) {
  return (
    <div className={`bg-gray-200 flex flex-col items-center justify-center text-gray-400 ${className}`}>
      <Upload className="w-8 h-8 mb-2" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

function HeroSection({ section, theme, business }: { section: HomeSection; theme: ThemeSettings; business: PageData["business"] }) {
  const buttonClass = getButtonClasses(theme);
  const isDark = theme.background_style === "dark" || section.variant === "professional";

  return (
    <section className={`relative min-h-[500px] flex items-center ${isDark ? "bg-gray-900 text-white" : ""}`}>
      {section.variant === "image-bg" && (
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-black/30">
          <ImagePlaceholder label="Hero Image" className="w-full h-full opacity-50" />
        </div>
      )}
      <div className="relative z-10 max-w-6xl mx-auto px-8 py-20 w-full">
        <div className="max-w-2xl">
          <h1 className={`text-4xl md:text-5xl lg:text-6xl font-bold mb-6 ${isDark || section.variant === "image-bg" ? "text-white" : ""}`}>
            {section.data.headline || business.name || "Welcome to Our Business"}
          </h1>
          <p className={`text-xl mb-8 ${isDark || section.variant === "image-bg" ? "text-gray-200" : "text-gray-600"}`}>
            {section.data.subheadline || business.tagline || "Quality service you can trust"}
          </p>
          <div className="flex flex-wrap gap-4">
            <button
              className={buttonClass}
              style={{ backgroundColor: theme.primary_color, borderColor: theme.primary_color }}
            >
              {section.data.ctaPrimary || "Get Started"}
            </button>
            {section.variant === "call-cta" && business.phone && (
              <a
                href={`tel:${business.phone}`}
                className={`${buttonClass} flex items-center gap-2`}
                style={{ backgroundColor: "transparent", borderColor: isDark ? "white" : theme.primary_color, color: isDark ? "white" : theme.primary_color }}
              >
                <Phone className="w-5 h-5" />
                {business.phone}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStripSection({ section, theme }: { section: HomeSection; theme: ThemeSettings }) {
  const items = section.data.items || ["Trusted", "Professional", "Reliable"];

  return (
    <section className="py-6 border-y" style={{ borderColor: `${theme.primary_color}20` }}>
      <div className="max-w-6xl mx-auto px-8">
        <div className="flex flex-wrap justify-center gap-8">
          {items.map((item: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm font-medium">
              {section.variant === "badges" && <Shield className="w-5 h-5" style={{ color: theme.primary_color }} />}
              {section.variant === "awards" && <Star className="w-5 h-5" style={{ color: theme.primary_color }} />}
              {section.variant === "certifications" && <Check className="w-5 h-5" style={{ color: theme.primary_color }} />}
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ServicesSection({ section, theme }: { section: HomeSection; theme: ThemeSettings }) {
  const items = section.data.items?.length > 0 ? section.data.items : [
    { name: "Service One", description: "Description of service one" },
    { name: "Service Two", description: "Description of service two" },
    { name: "Service Three", description: "Description of service three" },
  ];

  const cardClass = theme.card_style === "shadow" ? "shadow-lg" :
                    theme.card_style === "border" ? "border" : "";

  return (
    <section className={`py-16 ${theme.spacing === "roomy" ? "py-24" : ""}`}>
      <div className="max-w-6xl mx-auto px-8">
        <h2 className="text-3xl font-bold text-center mb-12">{section.data.title || "Our Services"}</h2>
        <div className={`grid gap-6 ${section.variant === "list" ? "grid-cols-1 max-w-2xl mx-auto" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
          {items.map((item: any, i: number) => (
            <div
              key={i}
              className={`p-6 ${cardClass} ${theme.radius === "xl" ? "rounded-xl" : theme.radius === "lg" ? "rounded-lg" : "rounded-md"}`}
              style={{ backgroundColor: theme.background_style === "dark" ? "#1f2937" : "#f9fafb" }}
            >
              {section.variant === "icons" && (
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${theme.primary_color}20` }}
                >
                  <Check className="w-6 h-6" style={{ color: theme.primary_color }} />
                </div>
              )}
              <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
              <p className="text-sm text-gray-600">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GallerySection({ section, theme }: { section: HomeSection; theme: ThemeSettings }) {
  return (
    <section className={`py-16 ${theme.spacing === "roomy" ? "py-24" : ""} bg-gray-50`}>
      <div className="max-w-6xl mx-auto px-8">
        <h2 className="text-3xl font-bold text-center mb-12">{section.data.title || "Gallery"}</h2>
        <div className={`grid gap-4 ${section.variant === "masonry" ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4"}`}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ImagePlaceholder
              key={i}
              label={`Image ${i}`}
              className={`aspect-square ${theme.radius === "xl" ? "rounded-xl" : theme.radius === "lg" ? "rounded-lg" : "rounded-md"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSection({ section, theme, business }: { section: HomeSection; theme: ThemeSettings; business: PageData["business"] }) {
  return (
    <section className={`py-16 ${theme.spacing === "roomy" ? "py-24" : ""}`}>
      <div className="max-w-6xl mx-auto px-8">
        <div className={`grid gap-12 items-center ${section.variant === "side-image" ? "md:grid-cols-2" : ""}`}>
          {section.variant === "side-image" && (
            <ImagePlaceholder label="About Image" className="aspect-video rounded-xl" />
          )}
          <div className={section.variant === "centered" ? "text-center max-w-2xl mx-auto" : ""}>
            <h2 className="text-3xl font-bold mb-6">{section.data.title || "About Us"}</h2>
            <p className="text-gray-600 leading-relaxed">
              {business.about || "We are dedicated to providing exceptional service to our customers. With years of experience and a commitment to excellence, we strive to exceed your expectations in everything we do."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection({ section, theme }: { section: HomeSection; theme: ThemeSettings }) {
  const testimonials = [
    { name: "John D.", text: "Excellent service! Highly recommended." },
    { name: "Sarah M.", text: "Professional and reliable. Will use again." },
    { name: "Mike R.", text: "Best experience I've had. Five stars!" },
  ];

  const cardClass = theme.card_style === "shadow" ? "shadow-lg" :
                    theme.card_style === "border" ? "border" : "";

  return (
    <section className={`py-16 ${theme.spacing === "roomy" ? "py-24" : ""} bg-gray-50`}>
      <div className="max-w-6xl mx-auto px-8">
        <h2 className="text-3xl font-bold text-center mb-12">{section.data.title || "What Our Customers Say"}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className={`p-6 bg-white ${cardClass} ${theme.radius === "xl" ? "rounded-xl" : theme.radius === "lg" ? "rounded-lg" : "rounded-md"}`}
            >
              <div className="flex gap-1 mb-4">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <p className="text-gray-600 mb-4">"{t.text}"</p>
              <p className="font-semibold">{t.name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection({ section, theme, business }: { section: HomeSection; theme: ThemeSettings; business: PageData["business"] }) {
  const buttonClass = getButtonClasses(theme);

  return (
    <section
      className="py-16"
      style={{ background: `linear-gradient(135deg, ${theme.primary_color}, ${theme.secondary_color})` }}
    >
      <div className="max-w-4xl mx-auto px-8 text-center text-white">
        <h2 className="text-3xl font-bold mb-4">{section.data.headline || "Ready to Get Started?"}</h2>
        <p className="text-xl mb-8 opacity-90">Contact us today for a free consultation</p>
        <div className="flex flex-wrap justify-center gap-4">
          <button className={`${buttonClass} bg-white`} style={{ color: theme.primary_color }}>
            {section.data.ctaPrimary || "Contact Us"}
          </button>
          {business.phone && (
            <a href={`tel:${business.phone}`} className={`${buttonClass} flex items-center gap-2 border-white border-2 bg-transparent`}>
              <Phone className="w-5 h-5" />
              {business.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactSection({ section, theme, business }: { section: HomeSection; theme: ThemeSettings; business: PageData["business"] }) {
  const buttonClass = getButtonClasses(theme);

  return (
    <section className={`py-16 ${theme.spacing === "roomy" ? "py-24" : ""}`}>
      <div className="max-w-6xl mx-auto px-8">
        <h2 className="text-3xl font-bold text-center mb-12">{section.data.title || "Contact Us"}</h2>
        <div className="grid gap-12 md:grid-cols-2">
          <div className="space-y-6">
            {business.address && (
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 mt-1" style={{ color: theme.primary_color }} />
                <div>
                  <h3 className="font-semibold mb-1">Address</h3>
                  <p className="text-gray-600">{business.address}</p>
                </div>
              </div>
            )}
            {business.phone && (
              <div className="flex items-start gap-4">
                <Phone className="w-6 h-6 mt-1" style={{ color: theme.primary_color }} />
                <div>
                  <h3 className="font-semibold mb-1">Phone</h3>
                  <p className="text-gray-600">{business.phone}</p>
                </div>
              </div>
            )}
            {business.hours && (
              <div className="flex items-start gap-4">
                <Clock className="w-6 h-6 mt-1" style={{ color: theme.primary_color }} />
                <div>
                  <h3 className="font-semibold mb-1">Hours</h3>
                  <p className="text-gray-600">{business.hours}</p>
                </div>
              </div>
            )}
            {business.email && (
              <div className="flex items-start gap-4">
                <Mail className="w-6 h-6 mt-1" style={{ color: theme.primary_color }} />
                <div>
                  <h3 className="font-semibold mb-1">Email</h3>
                  <p className="text-gray-600">{business.email}</p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gray-100 rounded-xl p-8">
            <h3 className="font-semibold mb-4">Send us a message</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Your Name" className="w-full px-4 py-2 rounded-lg border" />
              <input type="email" placeholder="Your Email" className="w-full px-4 py-2 rounded-lg border" />
              <textarea placeholder="Your Message" rows={4} className="w-full px-4 py-2 rounded-lg border" />
              <button className={buttonClass} style={{ backgroundColor: theme.primary_color }}>
                Send Message
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewNavbar({ theme, business }: { theme: ThemeSettings; business: PageData["business"] }) {
  const isDark = theme.background_style === "dark";

  return (
    <nav className={`sticky top-0 z-50 ${isDark ? "bg-gray-900/95 text-white" : "bg-white/95 text-gray-900"} backdrop-blur border-b`}>
      <div className="max-w-6xl mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: theme.primary_color }}
          >
            {(business.name || "B").charAt(0)}
          </div>
          <span className="font-semibold text-lg">{business.name || "Business Name"}</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#" className="hover:opacity-70">Home</a>
          <a href="#" className="hover:opacity-70">Services</a>
          <a href="#" className="hover:opacity-70">About</a>
          <a href="#" className="hover:opacity-70">Contact</a>
        </div>
        <div className="flex items-center gap-4">
          {business.phone && (
            <a href={`tel:${business.phone}`} className="hidden sm:flex items-center gap-2 text-sm" style={{ color: theme.primary_color }}>
              <Phone className="w-4 h-4" />
              {business.phone}
            </a>
          )}
          <Button size="icon" variant="ghost" className="md:hidden">
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </nav>
  );
}

function PreviewFooter({ theme, business }: { theme: ThemeSettings; business: PageData["business"] }) {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-6xl mx-auto px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: theme.primary_color }}
              >
                {(business.name || "B").charAt(0)}
              </div>
              <span className="font-semibold">{business.name || "Business Name"}</span>
            </div>
            <p className="text-gray-400 text-sm">{business.tagline || "Quality service you can trust"}</p>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              <li><a href="#" className="hover:text-white">Home</a></li>
              <li><a href="#" className="hover:text-white">Services</a></li>
              <li><a href="#" className="hover:text-white">About</a></li>
              <li><a href="#" className="hover:text-white">Contact</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Contact</h4>
            <ul className="space-y-2 text-gray-400 text-sm">
              {business.phone && <li>{business.phone}</li>}
              {business.email && <li>{business.email}</li>}
              {business.address && <li>{business.address}</li>}
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4">Hours</h4>
            <p className="text-gray-400 text-sm">{business.hours || "Mon-Fri: 9am-5pm"}</p>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 text-sm">
          <p>&copy; {new Date().getFullYear()} {business.name || "Business Name"}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export function PreviewPanel({ pageData }: PreviewPanelProps) {
  const { theme, sections, business, industry_preset } = pageData;
  const themeClasses = getThemeClasses(theme, industry_preset);

  const renderSection = (section: HomeSection, index: number) => {
    if (!section.enabled) return null;

    switch (section.type) {
      case "hero":
        return <HeroSection key={index} section={section} theme={theme} business={business} />;
      case "trust_strip":
        return <TrustStripSection key={index} section={section} theme={theme} />;
      case "services_or_menu":
        return <ServicesSection key={index} section={section} theme={theme} />;
      case "gallery":
        return <GallerySection key={index} section={section} theme={theme} />;
      case "about":
        return <AboutSection key={index} section={section} theme={theme} business={business} />;
      case "testimonials":
        return <TestimonialsSection key={index} section={section} theme={theme} />;
      case "cta":
        return <CtaSection key={index} section={section} theme={theme} business={business} />;
      case "contact":
        return <ContactSection key={index} section={section} theme={theme} business={business} />;
      default:
        return null;
    }
  };

  return (
    <ScrollArea className="h-screen">
      <div className={`min-h-screen ${themeClasses.bg} ${themeClasses.font}`}>
        <PreviewNavbar theme={theme} business={business} />
        {sections.map((section, index) => renderSection(section, index))}
        <PreviewFooter theme={theme} business={business} />
      </div>
    </ScrollArea>
  );
}
