import { readJson, writeJson } from '../storage/demo-store';
import {
  emptyModerationState,
  normalizeModerationState,
  type ModerationState,
  type ReportDecision,
  type StoryDecision,
  type VerificationDecision,
} from './moderation-rules';

/**
 * Persistence for moderation decisions (fixture/demo mode).
 *
 * Abuse reports themselves stay in the S2 store / Supabase; this file only
 * holds the owner's *decisions* about them, plus showroom verification and
 * story approvals. Listing visibility overrides (mark sold, pause, remove) live
 * in the listing store and are merged on read, so the seeded catalog stays
 * immutable while the owner's actions survive a reload.
 *
 * On Workers there is no filesystem: the demo store keeps the same key in
 * isolate memory, which is the documented limit of a fixture deployment.
 */
const FILE = 'moderation.json';

export function readModerationState(): ModerationState {
  return normalizeModerationState(readJson<Partial<ModerationState>>(FILE, emptyModerationState));
}

export function writeModerationState(state: ModerationState): void {
  writeJson(FILE, state);
}

export function moderationOverlay(): {
  hidden: ReadonlySet<string>;
  verifiedSellers: ReadonlySet<string>;
} {
  const state = readModerationState();
  return {
    hidden: new Set(state.hidden),
    verifiedSellers: new Set(
      Object.entries(state.verifications)
        .filter(([, decision]) => decision === 'approved')
        .map(([id]) => id),
    ),
  };
}

export function setReportDecision(id: string, decision: ReportDecision): ModerationState {
  const state = readModerationState();
  state.reports[id] = decision;
  writeModerationState(state);
  return state;
}

export function setVerificationDecision(id: string, decision: VerificationDecision): ModerationState {
  const state = readModerationState();
  state.verifications[id] = decision;
  writeModerationState(state);
  return state;
}

export function setStoryDecision(slug: string, decision: StoryDecision): ModerationState {
  const state = readModerationState();
  state.stories[slug] = decision;
  writeModerationState(state);
  return state;
}

export function hideListing(id: string): ModerationState {
  const state = readModerationState();
  if (!state.hidden.includes(id)) state.hidden.push(id);
  writeModerationState(state);
  return state;
}

export function unhideListing(id: string): ModerationState {
  const state = readModerationState();
  state.hidden = state.hidden.filter((entry) => entry !== id);
  writeModerationState(state);
  return state;
}
