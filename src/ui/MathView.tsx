/**
 * Displays a rendered math expression at a fixed scale.
 *
 * Target and preview use the same component and scale so they can be compared visually
 * (spec §9). Two render formats:
 * - `svg` (Typst): the SVG's intrinsic size (in pt-like user units) is multiplied by `scale`;
 *   CSS `max-width: 100%` keeps very wide expressions on screen, preserving aspect ratio.
 * - `html` (KaTeX): sized through the font size, chosen so glyphs match the Typst ones at the
 *   same `scale`, and shrunk to fit when the expression is wider than the stage.
 */
import { useLayoutEffect, useRef } from 'react';
import type { RenderResult } from '../engines/types';

/**
 * Container font size in px per unit of `scale` for HTML renders. Typst sets math at 11pt and one
 * SVG unit is one pt, so Typst glyphs are `11 × scale` px; `.katex` renders at 1.21em of its
 * container, hence `11 / 1.21` for the same glyph size.
 */
const HTML_PX_PER_SCALE = 11 / 1.21;

type Props = {
  /** Render to show; null shows an empty placeholder of the same height. */
  render: RenderResult | null;
  /** Multiplier applied to the render's intrinsic size. */
  scale: number;
  /** Accessible label (never the source: that would give the answer away). */
  label: string;
  className?: string;
};

export function MathView({ render, scale, label, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const format = render?.format ?? 'svg';

  // Size the injected SVG after each render; width drives height through the viewBox.
  useLayoutEffect(() => {
    if (format !== 'svg') return;
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const width = parseFloat(svg.getAttribute('width') ?? '0');
    svg.removeAttribute('height');
    svg.style.width = `${width * scale}px`;
    svg.style.height = 'auto';
  }, [render, scale, format]);

  // HTML renders: set the font size, then shrink it if the expression is wider than the stage
  // (the SVG equivalent of `max-width: 100%`). Re-run when the stage width changes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (format !== 'html' || !el) return;
    const fit = () => {
      el.style.fontSize = `${scale * HTML_PX_PER_SCALE}px`;
      if (el.scrollWidth > el.clientWidth) {
        el.style.fontSize = `${(scale * HTML_PX_PER_SCALE * el.clientWidth) / el.scrollWidth}px`;
      }
    };
    fit();
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      // Font size changes only alter the height; refit on width changes alone.
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      fit();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      el.style.fontSize = '';
    };
  }, [render, scale, format]);

  return (
    <div
      ref={ref}
      className={`math math-${format} ${className}`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: render?.markup ?? '' }}
    />
  );
}
