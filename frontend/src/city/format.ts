/** `today`, `4d ago`, or `3mo ago` for 60 days and more. */
export function formatAge(days: number): string {
  if (days === 0) return 'today';
  if (days < 60) return days + 'd ago';
  return Math.round(days / 30) + 'mo ago';
}

export function shortLanguage(language: string): string {
  return language === 'Jupyter Notebook' ? 'Jupyter' : language;
}

/** Whole days between a push and `nowMs`, never negative. */
export function daysSince(pushedAt: string, nowMs: number): number {
  return Math.max(0, Math.floor((nowMs - Date.parse(pushedAt)) / 86400000));
}
