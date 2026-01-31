"use client";

import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Config } from "@/types/dashboard";

interface ConfigFormProps {
  config: Config;
  onChange: (config: Config) => void;
  label: string;
}

interface ModelOption {
  value: string;
  label: string;
}

export function ConfigForm({ config, onChange, label }: ConfigFormProps) {
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);

  useEffect(() => {
    fetch("/api/available-models")
      .then((res) => res.json())
      .then((data: { models: ModelOption[] }) => {
        const models = data.models ?? [];
        setModelOptions(models);
        const values = models.map((m) => m.value);
        if (models.length > 0 && config.model && !values.includes(config.model)) {
          onChange({ ...config, model: models[0].value });
        }
      })
      .catch(() => setModelOptions([]));
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {label}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Model</Label>
          <Select
            value={config.model}
            onValueChange={(value) => onChange({ ...config, model: value })}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelOptions.length > 0 ? (
                modelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))
              ) : (
                <>
                  <SelectItem value="gpt-4">GPT-4</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="gemini-1.5-flash">Gemini 1.5 Flash</SelectItem>
                  <SelectItem value="gemini-1.5-pro">Gemini 1.5 Pro</SelectItem>
                  <SelectItem value="manus-1.6">Manus 1.6</SelectItem>
                  <SelectItem value="manus-1.6-lite">Manus 1.6 Lite</SelectItem>
                  <SelectItem value="manus-1.6-max">Manus 1.6 Max</SelectItem>
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Temperature</Label>
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
          <Label className="text-xs shrink-0 w-24">Top-K</Label>
          <Slider
            value={[config.top_k]}
            onValueChange={([v]) => onChange({ ...config, top_k: v })}
            min={1}
            max={100}
            step={1}
            className="flex-1"
          />
          <span className="text-xs font-mono w-8 text-right">
            {config.top_k}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Context Window</Label>
          <Input
            type="number"
            value={config.context_window}
            onChange={(e) =>
              onChange({ ...config, context_window: Number(e.target.value) })
            }
            className="h-7 text-xs flex-1"
            placeholder="tokens"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Chunk Size</Label>
          <Input
            type="number"
            value={config.chunk_size}
            onChange={(e) =>
              onChange({ ...config, chunk_size: Number(e.target.value) })
            }
            className="h-7 text-xs flex-1"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Max Output</Label>
          <Input
            type="number"
            value={config.max_output_tokens}
            onChange={(e) =>
              onChange({ ...config, max_output_tokens: Number(e.target.value) })
            }
            className="h-7 text-xs flex-1"
          />
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Tools</Label>
          <div className="flex-1 flex items-center gap-2">
            <Switch
              checked={config.tools_enabled}
              onCheckedChange={(v) => onChange({ ...config, tools_enabled: v })}
            />
            <span className="text-xs text-muted-foreground">
              {config.tools_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs shrink-0 w-24">Cost/1K</Label>
          <div className="flex-1 flex items-center gap-1">
            <span className="text-xs text-muted-foreground">$</span>
            <Input
              type="number"
              value={config.cost_per_1k_tokens}
              onChange={(e) =>
                onChange({ ...config, cost_per_1k_tokens: Number(e.target.value) })
              }
              className="h-7 text-xs flex-1"
              step={0.001}
            />
            <span className="text-xs text-muted-foreground">/1K</span>
          </div>
        </div>
      </div>
    </div>
  );
}
