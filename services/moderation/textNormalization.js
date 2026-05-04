const ARABIC_DIACRITICS_PATTERN =
  /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;

const LEET_REPLACEMENTS = new Map([
  ['@', 'a'],
  ['0', 'o'],
  ['1', 'i'],
  ['!', 'i'],
  ['3', 'e'],
  ['4', 'a'],
  ['5', 's'],
  ['7', 't'],
  ['$', 's'],
]);

export const removeArabicDiacritics = (text = '') =>
  String(text).replace(ARABIC_DIACRITICS_PATTERN, '').replace(/\u0640/g, '');

export const normalizeLeetSpeak = (text = '') =>
  String(text)
    .split('')
    .map((character) => LEET_REPLACEMENTS.get(character) ?? character)
    .join('');

export const collapseRepeatedLetters = (text = '') =>
  String(text).replace(/([\p{L}\p{N}])\1{2,}/gu, '$1$1');

export const normalizeText = (text = '') =>
  collapseRepeatedLetters(
    normalizeLeetSpeak(removeArabicDiacritics(text))
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s:/.-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );

export const tokenizeText = (text = '') =>
  normalizeText(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
