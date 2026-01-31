"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles } from "lucide-react";
import type { Config } from "@/types/dashboard";

interface ConfigPresetsProps {
  onConfigAChange: (config: Config) => void;
  onConfigBChange: (config: Config) => void;
}

const presets: Record<string, { name: string; configA: Config; configB: Config }> = {
  "gpt-4-default": {
    name: "GPT-4 Default",
    configA: {
      id: "config-a",
      model: "gpt-4",
      context_window: 8192,
      top_k: 10,
      chunk_size: 512,
      max_output_tokens: 2048,
      tools_enabled: true,
      temperature: 0.7,
      cost_per_1k_tokens: 0.03,
    },
    configB: {
      id: "config-b",
      model: "gpt-4",
      context_window: 16384,
      top_k: 4,
      chunk_size: 1024,
      max_output_tokens: 4096,
      tools_enabled: false,
      temperature: 0.5,
      cost_per_1k_tokens: 0.03,
    },
  },
  "gpt-4-large-context": {
    name: "GPT-4 Large Context",
    configA: {
      id: "config-a",
      model: "gpt-4",
      context_window: 8192,
      top_k: 10,
      chunk_size: 512,
      max_output_tokens: 2048,
      tools_enabled: true,
      temperature: 0.7,
      cost_per_1k_tokens: 0.03,
    },
    configB: {
      id: "config-b",
      model: "gpt-4",
      context_window: 32768,
      top_k: 10,
      chunk_size: 1024,
      max_output_tokens: 8192,
      tools_enabled: true,
      temperature: 0.7,
      cost_per_1k_tokens: 0.03,
    },
  },
  "gemini-1.5-flash": {
    name: "Gemini 1.5 Flash",
    configA: {
      id: "config-a",
      model: "gemini-1.5-flash",
      context_window: 8192,
      top_k: 10,
      chunk_size: 512,
      max_output_tokens: 2048,
      tools_enabled: false,
      temperature: 0.7,
      cost_per_1k_tokens: 0.00015,
    },
    configB: {
      id: "config-b",
      model: "gemini-1.5-flash",
      context_window: 32768,
      top_k: 10,
      chunk_size: 1024,
      max_output_tokens: 4096,
      tools_enabled: false,
      temperature: 0.5,
      cost_per_1k_tokens: 0.00015,
    },
  },
  "gemini-1.5-pro": {
    name: "Gemini 1.5 Pro",
    configA: {
      id: "config-a",
      model: "gemini-1.5-pro",
      context_window: 8192,
      top_k: 10,
      chunk_size: 512,
      max_output_tokens: 2048,
      tools_enabled: false,
      temperature: 0.7,
      cost_per_1k_tokens: 0.00125,
    },
    configB: {
      id: "config-b",
      model: "gemini-1.5-pro",
      context_window: 128000,
      top_k: 10,
      chunk_size: 1024,
      max_output_tokens: 4096,
      tools_enabled: false,
      temperature: 0.5,
      cost_per_1k_tokens: 0.00125,
    },
  },
  "tools-comparison": {
    name: "Tools Comparison",
    configA: {
      id: "config-a",
      model: "gpt-4",
      context_window: 8192,
      top_k: 10,
      chunk_size: 512,
      max_output_tokens: 2048,
      tools_enabled: false,
      temperature: 0.7,
      cost_per_1k_tokens: 0.03,
    },
    configB: {
      id: "config-b",
      model: "gpt-4",
      context_window: 8192,
      top_k: 10,
      chunk_size: 512,
      max_output_tokens: 2048,
      tools_enabled: true,
      temperature: 0.7,
      cost_per_1k_tokens: 0.03,
    },
  },
};

export function ConfigPresets({ onConfigAChange, onConfigBChange }: ConfigPresetsProps) {
  const handlePresetChange = (presetKey: string) => {
    const preset = presets[presetKey];
    if (preset) {
      onConfigAChange(preset.configA);
      onConfigBChange(preset.configB);
    }
  };

  return (
    <Card className="py-3 glass-card">
      <CardContent className="p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          Config Presets
        </div>
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select a preset..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(presets).map(([key, preset]) => (
              <SelectItem key={key} value={key}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="mt-3 text-xs text-muted-foreground">
          Quick-select common configuration combinations for testing.
        </div>
      </CardContent>
    </Card>
  );
}

