"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, FileText } from "lucide-react";

interface PromptSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
  onRunSimulation: () => void;
  isRunning: boolean;
}

export function PromptSelector({
  selected,
  onSelect,
  onRunSimulation,
  isRunning,
}: PromptSelectorProps) {
  const [promptFamilies, setPromptFamilies] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPromptFamilies() {
      try {
        const response = await fetch('/api/prompts');
        const data = await response.json();
        setPromptFamilies(data.families || []);
        
        // Auto-select first family if none selected
        if (!selected && data.families && data.families.length > 0) {
          onSelect(data.families[0]);
        }
      } catch (error) {
        console.error('Failed to fetch prompt families:', error);
        // Fallback to default families
        setPromptFamilies(['short_plain', 'long_context', 'tool_heavy', 'doc_grounded']);
      } finally {
        setLoading(false);
      }
    }

    fetchPromptFamilies();
  }, [selected, onSelect]);

  // Format family name for display
  const formatFamilyName = (family: string): string => {
    return family
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <Card className="py-3 glass-card">
      <CardContent className="p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Prompt Suite Selection
        </div>

        {loading ? (
          <div className="text-xs text-muted-foreground mb-4">Loading prompt families...</div>
        ) : (
          <div className="flex flex-wrap gap-2 mb-4">
            {promptFamilies.length === 0 ? (
              <div className="text-xs text-muted-foreground">No prompt families available</div>
            ) : (
              promptFamilies.map((family) => (
                <button
                  key={family}
                  type="button"
                  onClick={() => onSelect(family)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border",
                    selected === family
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card hover:bg-secondary border-border text-foreground"
                  )}
                >
                  <FileText className="h-3 w-3" />
                  {formatFamilyName(family)}
                </button>
              ))
            )}
          </div>
        )}

        <Button
          onClick={onRunSimulation}
          disabled={isRunning || loading}
          className="w-full bg-[#25924d] hover:bg-[#25924d]/90 text-white"
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {isRunning ? "Running Simulation..." : "Run Simulation"}
        </Button>
      </CardContent>
    </Card>
  );
}
