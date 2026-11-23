// HEIST STREAK: consecutive wins, kept across games in localStorage.
// Pure state + storage helpers. No DOM, no rules — the rules engine calls in,
// the renderer reads the record, and the shots stage a fixed one for the frame.
// In Node (rules test, dossier) there is no localStorage: every call falls back
// to a blank record, so the streak bonus is +0 and the rules never change.
export const STREAK_STORAGE_KEY = 'vaultbreakers-heist-streak-v1';
export const STREAK_BONUS_PER_LEVEL = 2;
export const STREAK_BONUS_CAP = 10;

/** A fresh record: no wins banked yet. */
export function blankStreakRecord() {
  return { streak: 0, best: 0 };
}

/** Read the saved record, or a blank one when nothing is stored (or storage is gone). */
export function loadStreakRecord() {
  try {
    if (typeof localStorage === 'undefined') return blankStreakRecord();
    const raw = localStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return blankStreakRecord();
    const parsed = JSON.parse(raw);
    const streak = Number.isInteger(parsed.streak) && parsed.streak >= 0 ? parsed.streak : 0;
    const best = Number.isInteger(parsed.best) && parsed.best >= 0 ? parsed.best : 0;
    return { streak, best: Math.max(best, streak) };
  } catch {
    return blankStreakRecord();
  }
}

/** Persist the record. Silently ignored when storage is unavailable. */
export function saveStreakRecord(record) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Private mode, full quota, blocked storage — the streak just does not persist.
  }
}

/** Starting-gold bonus for the streak: +2 per win in a row, capped at +10. */
export function streakStartBonus(streak) {
  const level = Number.isInteger(streak) && streak > 0 ? streak : 0;
  return Math.min(STREAK_BONUS_CAP, level * STREAK_BONUS_PER_LEVEL);
}

/** A win banks one more in a row and may set a new best. Returns the new record. */
export function applyStreakWin(record) {
  const next = { streak: record.streak + 1, best: Math.max(record.best, record.streak + 1) };
  saveStreakRecord(next);
  return next;
}

/** A loss breaks the run. The best stands. Returns the new record. */
export function applyStreakLoss(record) {
  const next = { streak: 0, best: record.best };
  saveStreakRecord(next);
  return next;
}

/** The one-line streak readout for the title and end screens. */
export function streakLine(record) {
  return `🔥 HEIST STREAK ${record.streak} · BEST ${record.best}`;
}

/** The bonus line under the readout: what the streak buys this heist. */
export function streakBonusLine(record) {
  const bonus = streakStartBonus(record.streak);
  if (bonus > 0) return `Streak bonus: +${bonus} gold to start this heist.`;
  return 'Win heists in a row to earn a starting-gold streak bonus.';
}
