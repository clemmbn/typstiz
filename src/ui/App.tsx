/**
 * App shell: header (title, stats link, theme toggle) and the current screen.
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
          <button
            type="button"
            className="link"
            tabIndex={inRun ? -1 : 0}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            onClick={() => setTheme(toggleTheme())}
          >
            {theme === 'dark' ? 'light' : 'dark'}
          </button>
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
