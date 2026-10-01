/**
 * Types for template-based expression generation.
 *
 * A template has typed slots and one source string per language. Placeholders are written
 * `{slotName}` and are only substituted when `slotName` is a declared slot, so literal braces
 * (Typst set notation `{1, 2}`, LaTeX groups `{-1}`) remain usable in templates.
 *
 * Slot values are sampled once and spelled per language (`alpha` in Typst, `\alpha` in LaTeX),
 * so a seed yields the same mathematical sequence in every language.
 */
import type { LanguageId } from '../engines/types';

export type Tier = 'easy' | 'medium' | 'hard';

export type SlotSpec =
  /** Integer in [min, max]; `exclude` removes values such as 0 or 1. */
  | { kind: 'int'; min: number; max: number; exclude?: number[] }
  /** Latin variable letter. */
  | { kind: 'var' }
  /** Greek letter name (`alpha`, `beta`, ...). */
  | { kind: 'greek' }
  /** Elementary function name (`sin`, `ln`, ...). */
  | { kind: 'fn' }
  /** Summation / product index letter. */
  | { kind: 'index' }
  /** Explicit option list. */
  | { kind: 'choice'; options: readonly ChoiceOption[] };

/** A choice spelled the same in every language, or spelled per language. */
export type ChoiceOption = string | Record<LanguageId, string>;

export type SlotValues = Record<string, string>;

export type Template = {
  id: string;
  tier: Tier;
  slots: Record<string, SlotSpec>;
  typst: string;
  /** LaTeX (KaTeX) source; must render the same mathematics as `typst`. */
  latex: string;
  /** Slot names whose values must be pairwise distinct (e.g. two different variables). */
  distinct?: string[];
  /**
   * Extra slots computed from sampled ones (e.g. expanded coefficients), keeps math correct.
   * Receives Typst spellings; derived values are used as-is in every language, so they must be
   * language-neutral (numbers).
   */
  derive?: (values: SlotValues) => SlotValues;
  /** Return false to reject a sample (template-specific degeneracy). Receives Typst spellings. */
  accept?: (values: SlotValues) => boolean;
};

/** A concrete expression produced by the generator. */
export type Expression = {
  /** Position in the run's sequence (0-based); with the seed it identifies the expression. */
  index: number;
  tier: Tier;
  templateId: string;
  source: Record<LanguageId, string>;
};
