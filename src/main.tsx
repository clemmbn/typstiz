/**
 * App entry: mounts React and starts loading the math engine immediately, so WASM and fonts
 * download in parallel with the start screen (spec §11).
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from './ui/App'
import { useGame } from './game/store'
import { initTheme } from './ui/theme'

initTheme()
void useGame.getState().initEngine()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
