/**
 * Category colours. Each focus sector gets a fixed colour by its position in
 * Settings (education = 1, skill development = 2, …); the palette is defined
 * per theme in globals.css as --s1 … --s6.
 */
export const SECTOR_PALETTE_SIZE = 6;

export function sectorColour(index: number): string {
  return index < 0 ? "var(--low)" : `var(--s${(index % SECTOR_PALETTE_SIZE) + 1})`;
}

/** A soft background tint of any colour, blended with the surface colour. */
export function tint(colour: string, percent = 10): string {
  return `color-mix(in oklab, ${colour} ${percent}%, var(--surface))`;
}

/** The opportunity's main sector: its first sector that is one of the configured focus sectors. */
export function primarySectorIndex(oppSectors: string[], sectorKeys: string[]): number {
  for (const k of oppSectors) {
    const i = sectorKeys.indexOf(k);
    if (i >= 0) return i;
  }
  return -1;
}
