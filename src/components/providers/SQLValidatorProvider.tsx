'use client';

import type { ReactNode } from 'react';
import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { linter as cmLinter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';


// AIDEV-NOTE: Minimal shared shapes to unblock wiring. Will be expanded alongside worker implementation.
export type ValidationMode = 'syntax' | 'schema';

export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  message: string;
  severity: DiagnosticSeverity;
  line?: number;
  column?: number;
  length?: number;
}

type ValidatorContext = {
  // Returns a CodeMirror linter extension that validates the current document when provided.
  getLinter: (opts?: { mode?: ValidationMode }) => ReturnType<typeof cmLinter>;
};

const Ctx = createContext<ValidatorContext | null>(null);

function SQLValidatorProvider({ children }: { children: ReactNode }) {
  const workerRef = useRef<Worker | null>(null);
  const pendingMapRef = useRef<Map<string, (payload: any) => void>>(new Map());
  const seqRef = useRef<number>(0);
  const latestBySourceRef = useRef<Map<string, string>>(new Map());
  const debounceTimersRef = useRef<Map<string, number>>(new Map());
  const debounceMs = 350;

  useEffect(() => {
    // No-op: PGlite removed; keep effect to mirror previous lifecycle cleanup.
    return () => {
      if (workerRef.current) workerRef.current.terminate();
      workerRef.current = null;
      pendingMapRef.current.clear();
    };
  }, []);

  const getLinter = useMemo(() => (
    opts?: { mode?: ValidationMode; sourceId?: string }
  ) => cmLinter(async (view): Promise<CmDiagnostic[]> => {
    const text = view.state.doc.toString();
    if (!text.trim()) return [];

    const sourceId = opts?.sourceId || 'default';
    const requestId = String(++seqRef.current);
    latestBySourceRef.current.set(sourceId, requestId);

    // Debounce: schedule the postMessage after debounceMs
    await new Promise<void>((resolve) => {
      const prev = debounceTimersRef.current.get(sourceId);
      if (prev) clearTimeout(prev);
      const timer = window.setTimeout(() => resolve(), debounceMs);
      debounceTimersRef.current.set(sourceId, timer);
    });

    // If a newer request superseded this one, drop it early
    if (latestBySourceRef.current.get(sourceId) !== requestId) return [];

    // PGlite removed: return no diagnostics for now (no-op linter placeholder).
    const diags: Array<{ message: string; line?: number; column?: number; length?: number; severity: 'error' | 'warning' | 'info' }> = [];
    const out: CmDiagnostic[] = diags.map((d: any) => {
      // Map 1-based line/column to offsets if provided; fallback to doc start.
      let from = 0;
      let to = 0;
      if (typeof d.line === 'number' && typeof d.column === 'number') {
        const lineHandle = view.state.doc.line(Math.max(1, d.line));
        from = Math.max(lineHandle.from + (d.column - 1), lineHandle.from);
        const len = typeof d.length === 'number' && d.length > 0 ? d.length : 1;
        to = Math.min(from + len, lineHandle.to);
      }
      return {
        from,
        to: to || from,
        message: String(d.message || 'SQL validation issue'),
        severity: (d.severity === 'warning' || d.severity === 'info') ? d.severity : 'error'
      } as CmDiagnostic;
    });

    return out;
  }), []);

  const value: ValidatorContext = useMemo(() => ({ getLinter }), [getLinter]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function useSQLValidator(): ValidatorContext {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useSQLValidator must be used within SQLValidatorProvider');
  return ctx;
}


export { SQLValidatorProvider, useSQLValidator };
