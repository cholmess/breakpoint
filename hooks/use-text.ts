"use client";

import { useCallback } from "react";
import {
  TEXT_DICTIONARY,
  type TextKey,
  getFailureModeLabel,
  getFailureModeDescription,
} from "@/lib/text-dictionary";
import { usePlainLanguage } from "@/lib/plain-language-context";

export type { TextKey };

/**
 * Hook that returns text based on plain-language mode.
 * Usage: const t = useText(); t("label_context_window") → "Context Window" or "Memory Limit"
 * For placeholders: t("confidence_bayesian", { name: "Config A" })
 */
export function useText() {
  const { isPlainLanguage } = usePlainLanguage();

  const t = useCallback(
    (key: TextKey, params?: Record<string, string | number>): string => {
      const entry = TEXT_DICTIONARY[key];
      if (!entry) return String(key);
      let str: string = isPlainLanguage ? entry.plain : entry.technical;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [isPlainLanguage]
  );

  return {
    t,
    isPlainLanguage,
    getFailureModeLabel: useCallback(
      (mode: string) => getFailureModeLabel(mode, isPlainLanguage),
      [isPlainLanguage]
    ),
    getFailureModeDescription: useCallback(
      (mode: string, count: number, proportion: number) =>
        getFailureModeDescription(mode, count, proportion, isPlainLanguage),
      [isPlainLanguage]
    ),
  };
}
