/**
 * Source input. A plain monospace textarea for v1, isolated behind this component so it can be
 * swapped for CodeMirror later (spec §9).
 *
 * - Paste and drop are blocked (it's a typing race).
 * - Autocorrect, autocapitalize and spellcheck are off.
 * - Grows with the number of lines (multi-line expressions such as aligned equations).
 */
import { forwardRef, type KeyboardEvent } from 'react';

type Props = {
  value: string;
  /**
   * Called on every input event.
   * @param prev - value before the event
   * @param next - value after the event
   * @param timeStamp - event time (performance.now() clock)
   */
  onEdit(prev: string, next: string, timeStamp: number): void;
  onKeyDown?(e: KeyboardEvent<HTMLTextAreaElement>): void;
  invalid?: boolean;
  disabled?: boolean;
};

export const InputField = forwardRef<HTMLTextAreaElement, Props>(function InputField(
  { value, onEdit, onKeyDown, invalid = false, disabled = false },
  ref,
) {
  const rows = Math.max(1, value.split('\n').length);
  const block = (e: { preventDefault(): void }) => {
    console.info('[input] paste/drop blocked');
    e.preventDefault();
  };
  return (
    <textarea
      ref={ref}
      className={`source-input ${invalid ? 'invalid' : ''}`}
      aria-label="Your Typst source"
      aria-invalid={invalid}
      value={value}
      rows={rows}
      disabled={disabled}
      placeholder="type the Typst source…"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onChange={(e) => onEdit(value, e.target.value, e.timeStamp)}
      onKeyDown={onKeyDown}
      onPaste={block}
      onDrop={block}
      onDragOver={block}
    />
  );
});
