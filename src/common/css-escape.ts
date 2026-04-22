export function escapeCssIdentifier(value: string): string {
  const cssEscape = globalThis.CSS?.escape;
  if (typeof cssEscape === 'function') return cssEscape(value);

  const chars = Array.from(value);
  return chars
    .map((char, index) => {
      const codePoint = char.codePointAt(0);
      if (codePoint === undefined) return '';
      if (codePoint === 0) return '\uFFFD';
      if (
        (codePoint >= 1 && codePoint <= 31) ||
        codePoint === 127 ||
        (index === 0 && codePoint >= 48 && codePoint <= 57) ||
        (index === 1 && chars[0] === '-' && codePoint >= 48 && codePoint <= 57)
      ) {
        return `\\${codePoint.toString(16)} `;
      }
      if (index === 0 && char === '-' && chars.length === 1) return '\\-';
      if (codePoint >= 128 || /[A-Za-z0-9_-]/.test(char)) return char;
      return `\\${char}`;
    })
    .join('');
}
