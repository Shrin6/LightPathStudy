import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { ThemeSettings, BackgroundStyle, FontStyle, ButtonStyle, CardStyle, RadiusSize, SpacingSize } from "@/pages/PageBuilder";

interface ThemeCustomizerProps {
  theme: ThemeSettings;
  onChange: (theme: Partial<ThemeSettings>) => void;
}

export function ThemeCustomizer({ theme, onChange }: ThemeCustomizerProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Background Style</Label>
        <Select value={theme.background_style} onValueChange={(v) => onChange({ background_style: v as BackgroundStyle })}>
          <SelectTrigger data-testid="select-background-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="gradient">Gradient</SelectItem>
            <SelectItem value="image">Image</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Primary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={theme.primary_color}
            onChange={(e) => onChange({ primary_color: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
            data-testid="input-primary-color"
          />
          <Input
            value={theme.primary_color}
            onChange={(e) => onChange({ primary_color: e.target.value })}
            placeholder="#2563EB"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Secondary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={theme.secondary_color}
            onChange={(e) => onChange({ secondary_color: e.target.value })}
            className="w-12 h-9 p-1 cursor-pointer"
            data-testid="input-secondary-color"
          />
          <Input
            value={theme.secondary_color}
            onChange={(e) => onChange({ secondary_color: e.target.value })}
            placeholder="#1E40AF"
            className="flex-1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Font Style</Label>
        <Select value={theme.font_style} onValueChange={(v) => onChange({ font_style: v as FontStyle })}>
          <SelectTrigger data-testid="select-font-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="modern">Modern</SelectItem>
            <SelectItem value="classic">Classic</SelectItem>
            <SelectItem value="elegant">Elegant</SelectItem>
            <SelectItem value="playful">Playful</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Button Style</Label>
        <Select value={theme.button_style} onValueChange={(v) => onChange({ button_style: v as ButtonStyle })}>
          <SelectTrigger data-testid="select-button-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="solid">Solid</SelectItem>
            <SelectItem value="outline">Outline</SelectItem>
            <SelectItem value="pill">Pill</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Card Style</Label>
        <Select value={theme.card_style} onValueChange={(v) => onChange({ card_style: v as CardStyle })}>
          <SelectTrigger data-testid="select-card-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="flat">Flat</SelectItem>
            <SelectItem value="shadow">Shadow</SelectItem>
            <SelectItem value="border">Border</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Border Radius</Label>
        <Select value={theme.radius} onValueChange={(v) => onChange({ radius: v as RadiusSize })}>
          <SelectTrigger data-testid="select-radius">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="md">Medium</SelectItem>
            <SelectItem value="lg">Large</SelectItem>
            <SelectItem value="xl">Extra Large</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Spacing</Label>
        <Select value={theme.spacing} onValueChange={(v) => onChange({ spacing: v as SpacingSize })}>
          <SelectTrigger data-testid="select-spacing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="normal">Normal</SelectItem>
            <SelectItem value="roomy">Roomy</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
