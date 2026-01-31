"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Play, FileText, Scale, Code, BookOpen, MessageSquare } from "lucide-react";

const promptFamilies = [
  { id: "long-context", label: "Long Context", icon: FileText },
  { id: "legal-qa", label: "Legal QA", icon: Scale },
  { id: "code-gen", label: "Code Gen", icon: Code },
  { id: "summarization", label: "Summarization", icon: BookOpen },
  { id: "conversation", label: "Conversation", icon: MessageSquare },
];

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
  return (
    <Card className="py-3">
      <CardContent className="p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-3">
          Prompt Suite Selection
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {promptFamilies.map((family) => {
            const Icon = family.icon;
            return (
              <button
                key={family.id}
                type="button"
                onClick={() => onSelect(family.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors border",
                  selected === family.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card hover:bg-secondary border-border text-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                {family.label}
              </button>
            );
          })}
        </div>

        <Button
          onClick={onRunSimulation}
          disabled={isRunning}
          className="w-full bg-emerald hover:bg-emerald/90 text-white"
        >
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {isRunning ? "Running Simulation..." : "Run Simulation"}
        </Button>
      </CardContent>
    </Card>
  );
}
