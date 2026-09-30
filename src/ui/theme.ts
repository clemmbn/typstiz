/**
 * Theme handling: follows `prefers-color-scheme` by default; a manual choice is stored per
 * browser and applied as `data-theme` on <html>, which the CSS tokens key off.
 */
export type Theme = 'light' | 'dark';
const KEY = 'typstiz.theme';

/** @returns the explicitly chosen theme, or null when following the system */
function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch {
    return null;
  }
}

/** @returns the theme currently in effect */
export function currentTheme(): Theme {
  return storedTheme() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

/** Apply the stored theme (if any) at startup. */
export function initTheme(): void {
  const t = storedTheme();
  if (t) document.documentElement.dataset.theme = t;
}

/**
 * Switch to the other theme and remember the choice.
 * @returns the new theme
 */
export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Not persisted; still applied for this session.
  }
  return next;
}
