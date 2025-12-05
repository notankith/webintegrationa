"use client"

import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { type CaptionTemplate } from "@/components/templates/types"

interface StyleEditorProps {
  template: CaptionTemplate
  onChange: (updates: Partial<CaptionTemplate>) => void
}

export function StyleEditor({ template, onChange }: StyleEditorProps) {
  if (!template) return null
  
  return (
    <div className="space-y-6 p-1">
      <div className="space-y-2">
        <Label>Font Size ({template.fontSize || 0}px)</Label>
        <Slider
          min={10}
          max={200}
          step={1}
          value={[template.fontSize || 40]}
          onValueChange={([val]) => onChange({ fontSize: val })}
        />
      </div>

      <div className="space-y-2">
        <Label>Primary Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={template.primaryColor || "#ffffff"}
            onChange={(e) => onChange({ primaryColor: e.target.value })}
            className="w-12 h-12 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={template.primaryColor || "#ffffff"}
            onChange={(e) => onChange({ primaryColor: e.target.value })}
            className="flex-1 font-mono"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Outline Color</Label>
        <div className="flex gap-2">
          <Input
            type="color"
            value={template.outlineColor || "#000000"}
            onChange={(e) => onChange({ outlineColor: e.target.value })}
            className="w-12 h-12 p-1 cursor-pointer"
          />
          <Input
            type="text"
            value={template.outlineColor || "#000000"}
            onChange={(e) => onChange({ outlineColor: e.target.value })}
            className="flex-1 font-mono"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Vertical Margin ({template.marginV || 0}px)</Label>
        <Slider
          min={0}
          max={500}
          step={5}
          value={[template.marginV || 0]}
          onValueChange={([val]) => onChange({ marginV: val })}
        />
      </div>
    </div>
  )
}
