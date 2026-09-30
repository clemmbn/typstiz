/**
 * Start screen: mode, duration, difficulty, language, optional seed.
 * Enter starts a run from anywhere on the page once the engine is ready.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useGame } from '../game/store';
import type { GameSettings } from '../game/types';
import { docFor } from './docs';

type Option<T> = { value: T; label: string; disabled?: boolean };

export function StartScreen() {
  const settings = useGame((s) => s.settings);
  const engineStatus = useGame((s) => s.engineStatus);
  const engineError = useGame((s) => s.engineError);
  const { updateSettings, startRun, initEngine } = useGame.getState();
  const [starting, setStarting] = useState(false);
  const startRef = useRef<HTMLButtonElement>(null);
  const ready = engineStatus === 'ready';
  // Single doc link for the currently selected language.
  const doc = docFor(settings.language);

  const start = async () => {
    if (!ready || starting) return;
    setStarting(true);
    try {
      await startRun();
    } finally {
      setStarting(false);
    }
  };

  // Keyboard-first: focus Start as soon as the engine is ready, Enter anywhere starts.
  useEffect(() => {
    if (ready) startRef.current?.focus();
  }, [ready]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        void start();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const set = <K extends keyof GameSettings>(key: K) => (value: GameSettings[K]) => updateSettings({ [key]: value });

  return (
    <main className="start">
      <p className="tagline">
        A math expression appears. Type the <strong>Typst</strong> source that renders it. Any source that
        renders identically counts.
      </p>
      {/* Reference links: opened in a new tab so an in-progress setup is not lost. */}
      <p className="refs">
        Need a hint? <a href={doc.url} target="_blank" rel="noopener noreferrer">{doc.label}</a>
      </p>

      <Field label="Mode">
        <Segmented
          value={settings.mode}
          onChange={set('mode')}
          options={[{ value: 'timed', label: 'Timed' }, { value: 'zen', label: 'Zen' }]}
        />
      </Field>

      {settings.mode === 'timed' && (
        <Field label="Duration">
          <Segmented
            value={settings.durationSec}
            onChange={set('durationSec')}
            options={[
              { value: 30, label: '30 s' },
              { value: 60, label: '60 s' },
              { value: 120, label: '120 s' },
              { value: 180, label: '180 s' },
              { value: 300, label: '300 s' },
              { value: 600, label: '600 s' },
            ]}
          />
        </Field>
      )}

      <Field label="Difficulty">
        <Segmented
          value={settings.difficulty}
          onChange={set('difficulty')}
          options={[
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
            { value: 'random', label: 'Random' },
          ]}
        />
      </Field>

      <Field label="Language">
        <Segmented
          value={settings.language}
          onChange={set('language')}
          options={[{ value: 'typst', label: 'Typst' }, { value: 'latex', label: 'KaTeX (soon)', disabled: true }]}
        />
      </Field>

      <Field label="Seed" htmlFor="seed">
        <input
          id="seed"
          className="seed-input"
          value={settings.seed}
          placeholder="random"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => updateSettings({ seed: e.target.value })}
        />
      </Field>

      <div className="start-actions">
        {engineStatus === 'loading' && <p className="status">Loading the Typst compiler…</p>}
        {engineStatus === 'error' && (
          <div className="status error" role="alert">
            <p>The math engine failed to load: {engineError}</p>
            <button type="button" onClick={() => void initEngine()}>Retry</button>
          </div>
        )}
        <button ref={startRef} type="button" className="primary" disabled={!ready || starting} onClick={() => void start()}>
          {ready ? 'Start' : 'Loading…'} <kbd>Enter</kbd>
        </button>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Radio-group styled as segmented buttons. Arrow keys move between options (native radios).
 */
function Segmented<T extends string | number | boolean>({ value, onChange, options }: {
  value: T;
  onChange(v: T): void;
  options: Option<T>[];
}) {
  const name = useId();
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <label key={String(o.value)} className={`seg ${o.value === value ? 'on' : ''} ${o.disabled ? 'disabled' : ''}`}>
          <input
            type="radio"
            name={name}
            checked={o.value === value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  );
}
