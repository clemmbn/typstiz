/**
 * App shell: header (title, stats link, theme toggle, GitHub link) and the current screen.
 * Screen switching is a store field; there is no router (four screens, no deep links needed).
 */
import { useState } from 'react';
import { useGame } from '../game/store';
import { Countdown } from './Countdown';
import { GameScreen } from './GameScreen';
import { ResultsScreen } from './ResultsScreen';
import { StartScreen } from './StartScreen';
import { StatsScreen } from './StatsScreen';
import { currentTheme, toggleTheme } from './theme';

const REPO_URL = 'https://github.com/clemmbn/typstiz';

/** Shared props for the 18px stroke/fill icons; they inherit the button's text colour. */
const iconProps = { width: 18, height: 18, viewBox: '0 0 24 24', 'aria-hidden': true } as const;

/** Sun glyph, shown in dark mode (click = go light). */
function SunIcon() {
  return (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

/** Moon glyph, shown in light mode (click = go dark). */
function MoonIcon() {
  return (
    <svg {...iconProps} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

/** GitHub mark (octocat silhouette). */
function GithubIcon() {
  return (
    <svg {...iconProps} fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

export function App() {
  const screen = useGame((s) => s.screen);
  const { goTo } = useGame.getState();
  const [theme, setTheme] = useState(currentTheme);
  const inRun = screen === 'game' || screen === 'countdown';

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">
          <button type="button" className="link" onClick={() => !inRun && goTo('start')} tabIndex={inRun ? -1 : 0}>
            typstiz
          </button>
        </h1>
        <nav className="nav">
          {!inRun && (
            <button type="button" className="link" onClick={() => goTo('stats')}>stats</button>
          )}
          {/* Divider separates page navigation (stats) from utilities (theme, repo). */}
          <span className="nav-sep" aria-hidden="true" />
          <button
            type="button"
            className="link icon-btn"
            tabIndex={inRun ? -1 : 0}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => {
              const next = toggleTheme();
              console.info('[theme] switched to', next);
              setTheme(next);
            }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
          {/* External link: new tab so an in-progress run/setup is never lost. */}
          <a
            className="link icon-btn"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={inRun ? -1 : 0}
            title="View source on GitHub"
            aria-label="View source on GitHub"
          >
            <GithubIcon />
          </a>
        </nav>
      </header>
      {screen === 'start' && <StartScreen />}
      {screen === 'countdown' && <Countdown />}
      {screen === 'game' && <GameScreen />}
      {screen === 'results' && <ResultsScreen />}
      {screen === 'stats' && <StatsScreen />}
    </div>
  );
}
