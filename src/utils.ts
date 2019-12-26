export function normalize(token: string): string {
  return token
    .toLowerCase()
    .replace(/\/|"|’|\.|\,|\?|\(|\)|!|:|;|\.{2,5}/g, '')

    // Accents, diacritics
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
export function getRandom(min: number, max: number): number {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
