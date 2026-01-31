"use client";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConfigFormProps {
  config: {
    temperature: number;
    topK: number;
    contextWindow: number;
    chunkSize: number;
    maxOutputTokens: number;
    toolsEnabled: boolean;
    budgetCost: number;
  };
  onChange: (config: ConfigFormProps["config"]) => void;
  label: string;
}

export function ConfigForm({ config, onChange, label }: ConfigFormProps) {
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {label}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Temperature</Label>
          <Slider
            value={[config.temperature]}
            onValueChange={([v]) => onChange({ ...config, temperature: v })}
            min={0}
            max={2}
            step={0.1}
            className="flex-1"
          />
          <span className="text-xs font-mono w-8 text-right">
            {config.temperature.toFixed(1)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Top-K</Label>
          <Slider
            value={[config.topK]}
            onValueChange={([v]) => onChange({ ...config, topK: v })}
            min={1}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs font-mono w-8 text-right">
            {config.topK}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Context</Label>
          <Input
            type="number"
            value={config.contextWindow}
            onChange={(e) =>
              onChange({ ...config, contextWindow: Number(e.target.value) })
            }
            className="h-7 text-xs flex-1"
            placeholder="tokens"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Chunk Size</Label>
          <Input
            type="number"
            value={config.chunkSize}
            onChange={(e) =>
              onChange({ ...config, chunkSize: Number(e.target.value) })
            }
            className="h-7 text-xs flex-1"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Max Output</Label>
          <Input
            type="number"
            value={config.maxOutputTokens}
            onChange={(e) =>
              onChange({ ...config, maxOutputTokens: Number(e.target.value) })
            }
            className="h-7 text-xs flex-1"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Tools</Label>
          <div className="flex-1 flex items-center gap-2">
            <Switch
              checked={config.toolsEnabled}
              onCheckedChange={(v) => onChange({ ...config, toolsEnabled: v })}
            />
            <span className="text-xs text-muted-foreground">
              {config.toolsEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-20">Budget</Label>
          <div className="flex-1 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={config.budgetCost}
              onChange={(e) =>
                onChange({ ...config, budgetCost: Number(e.target.value) })
              }
              className="h-7 text-xs flex-1"
              step={0.01}
            />
            <span className="text-xs text-muted-foreground">/1M</span>
          </div>
        </div>
      </div>
    </div>
  );
}
