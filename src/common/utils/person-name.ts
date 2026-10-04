export function normalizePersonName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('es')
    .replace(
      /(^|[\s'-])(\p{L})/gu,
      (_match, separator: string, letter: string) =>
        `${separator}${letter.toLocaleUpperCase('es')}`,
    );
}
