"use client";

import { useId, useState } from "react";
import { getGlossaryTerm } from "@/lib/glossary";

export function InlineTerm({ termId, label }: { termId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const definitionId = useId();
  const item = getGlossaryTerm(termId);
  if (!item) return null;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={definitionId}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/[0.10] bg-white/[0.035] px-3 text-sm font-semibold text-text hover:border-accent/40 hover:bg-accent/[0.08]"
      >
        {label ?? item.term}
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full border border-accent/30 text-xs text-accent-cyan"
          aria-hidden="true"
        >
          ?
        </span>
      </button>
      {open ? (
        <div
          id={definitionId}
          role="status"
          className="mt-2 rounded-[14px] border border-accent/20 bg-accent/[0.08] p-3 text-sm leading-5 text-muted"
        >
          <span className="font-semibold text-text">{item.term} : </span>
          {item.shortDefinition}
        </div>
      ) : null}
    </div>
  );
}
