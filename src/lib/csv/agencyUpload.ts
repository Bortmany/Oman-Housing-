// The pure rules for an agency's market-data upload (Align Step 3, Build B).
// No I/O, no `@/` imports (the tsx test runner cannot resolve them). The
// server action at src/app/[locale]/(agency)/agency/data/actions.ts calls these
// and does the database work. Tested in agencyUpload.test.ts (runs in `npm test`).
//
// Honesty rules kept here, in one place:
//  - an agency figure is ALWAYS saved as USER_SUBMITTED at the fixed agency
//    confidence — never OFFICIAL_STAT or VERIFIED, whatever the file says;
//  - it NEVER replaces an existing figure (conflict mode "skip");
//  - its source note always carries the agency's English name.

import { AGENCY_CONFIDENCE, type ImportGroup } from "./marketStatsImport";

export const AGENCY_PROVENANCE = "USER_SUBMITTED" as const;
export const AGENCY_CONFLICT_MODE = "skip" as const;
/** How many not-yet-approved agency figures one agency may have waiting. */
export const MAX_UNAPPROVED_PER_AGENCY = 200;

export const AGENCY_NOTE_PREFIX = "Submitted by agency: ";
const NOTE_SEPARATOR = " - ";
const MAX_NOTE = 1000;

/** "Submitted by agency: {English name}" + " - {file note}" when the file gave one. */
export function agencySourceNote(agencyNameEn: string, fileNote: string): string {
  const name = agencyNameEn.trim();
  const note = fileNote.trim();
  const full = `${AGENCY_NOTE_PREFIX}${name}${note ? NOTE_SEPARATOR + note : ""}`;
  return full.slice(0, MAX_NOTE);
}

/** True when a stored source note was written by an agency upload. */
export function isAgencyUploadNote(sourceNote: string | null | undefined): boolean {
  return !!sourceNote && sourceNote.startsWith(AGENCY_NOTE_PREFIX);
}

/** The two exact note shapes an agency's own rows can have (used to count its queue). */
export function agencyNoteMatch(agencyNameEn: string): { exact: string; startsWith: string } {
  const base = `${AGENCY_NOTE_PREFIX}${agencyNameEn.trim()}`;
  return { exact: base, startsWith: base + NOTE_SEPARATOR };
}

/** What one parsed group is saved as. Provenance, confidence and conflict mode
 *  are fixed HERE — nothing from the file can change them. */
export function agencyWriteFor(group: ImportGroup, agencyNameEn: string) {
  return {
    provenance: AGENCY_PROVENANCE,
    confidence: AGENCY_CONFIDENCE,
    sourceNote: agencySourceNote(agencyNameEn, group.sourceNote),
    sourceUrl: group.sourceUrl,
    onConflict: AGENCY_CONFLICT_MODE,
  };
}

/** Would sending `incoming` more rows overflow the agency's waiting queue? */
export function queueHasRoom(waiting: number, incoming: number): boolean {
  return waiting < MAX_UNAPPROVED_PER_AGENCY && waiting + incoming <= MAX_UNAPPROVED_PER_AGENCY;
}
