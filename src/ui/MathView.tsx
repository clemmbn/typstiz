/**
 * Displays a rendered math SVG at a fixed scale.
 *
 * Target and preview use the same component and scale so they can be compared visually
 * (spec §9). The SVG's intrinsic size (in pt-like user units) is multiplied by `scale`;
 * CSS `max-width: 100%` keeps very wide expressions on screen, preserving aspect ratio.
 */
import { useLayoutEffect, useRef } from 'react';
import type { RenderResult } from '../engines/types';

type Props = {
  /** Render to show; null shows an empty placeholder of the same height. */
  render: RenderResult | null;
  /** Multiplier applied to the SVG's intrinsic width. */
  scale: number;
  /** Accessible label (never the source: that would give the answer away). */
  label: string;
  className?: string;
};

export function MathView({ render, scale, label, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  // Size the injected SVG after each render; width drives height through the viewBox.
  useLayoutEffect(() => {
    const svg = ref.current?.querySelector('svg');
    if (!svg) return;
    const width = parseFloat(svg.getAttribute('width') ?? '0');
    svg.removeAttribute('height');
    svg.style.width = `${width * scale}px`;
    svg.style.height = 'auto';
  }, [render, scale]);

  return (
    <div
      ref={ref}
      className={`math ${className}`}
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: render?.svg ?? '' }}
    />
  );
}
