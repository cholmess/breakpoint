"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "breakpoint-plain-language";

interface PlainLanguageContextValue {
  isPlainLanguage: boolean;
  setPlainLanguage: (value: boolean) => void;
}

const PlainLanguageContext = createContext<PlainLanguageContextValue | null>(null);

function getStored(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "true";
  } catch {
    return false;
  }
}

function setStored(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
  } catch {
    // ignore
  }
}

export function PlainLanguageProvider({ children }: { children: React.ReactNode }) {
  const [isPlainLanguage, setState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setState(getStored());
    setHydrated(true);
  }, []);

  const setPlainLanguage = useCallback((value: boolean) => {
    setState(value);
    setStored(value);
  }, []);

  const value: PlainLanguageContextValue = {
    isPlainLanguage: hydrated ? isPlainLanguage : false,
    setPlainLanguage,
  };

  return (
    <PlainLanguageContext.Provider value={value}>
      {children}
    </PlainLanguageContext.Provider>
  );
}

export function usePlainLanguage(): PlainLanguageContextValue {
  const ctx = useContext(PlainLanguageContext);
  if (!ctx) {
    throw new Error("usePlainLanguage must be used within PlainLanguageProvider");
  }
  return ctx;
}
