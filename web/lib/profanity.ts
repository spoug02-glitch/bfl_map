import { check } from "korcen";

// korcen@1.0.1 misses these in base form (measured 2026-07-31):
// "씨발 맛없어" / "존나 맛없다" / "졸라 맛없음" / "개씨발 맛없다" all return false.
const SUPPLEMENTARY_WORDS = ["씨발", "개씨발", "존나", "졸라"];

// 초성 abbreviations korcen also handles, kept explicit per spec.
const CHOSUNG_PATTERNS = ["ㅅㅂ", "ㅄ", "ㅈㄹ"];

// Ordinary food-review words that korcen (or our supplementary list) would
// otherwise flag. False positives are worse than misses for this app, so
// these are stripped from the text before either check runs.
const ALLOWLIST_PHRASES = [
  "존맛",
  "존맛탱",
  "개존맛",
  "미친맛집",
  "마약김밥",
  "시발점",
  "시발역",
  "쌍화차",
  // korcen flags bare "새끼" (e.g. "새끼돼지 수육") even though it's an
  // ordinary food term, not an insult.
  "새끼돼지",
];

// Zero-width space/joiners (U+200B-U+200D) and BOM (U+FEFF), built from code
// points rather than literal characters to avoid invisible-character source
// files (see Windows UTF-8 corruption note in project CLAUDE.md).
const ZERO_WIDTH_CODES = [0x200b, 0x200c, 0x200d, 0xfeff];
const ZERO_WIDTH_RE = new RegExp(
  `[${ZERO_WIDTH_CODES.map((code) => String.fromCharCode(code)).join("")}]`,
  "g",
);
const PUNCT_CLASS = "[\\s.,·\\-_~!?\"'`]*";

function normalize(text: string): string {
  return text.normalize("NFC").replace(ZERO_WIDTH_RE, "");
}

// Matches `word`'s characters even when whitespace/punctuation is inserted
// between them (e.g. "존 맛", "존.맛탱"), so allowlisted phrases are still
// recognized when typed with spacing.
function looseWordRegex(word: string): RegExp {
  const chars = [...word].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(chars.join(PUNCT_CLASS), "g");
}

function maskPhrases(text: string, phrases: string[]): string {
  return phrases.reduce((acc, phrase) => acc.replace(looseWordRegex(phrase), ""), text);
}

// Strips whitespace/punctuation and collapses repeated characters
// (e.g. "졸라라라" -> "졸라") for matching against the supplementary lists.
// Known limitation (accepted): inserting a *different* character between
// letters, e.g. "시이이발", still evades this — out of scope per design doc.
function compact(text: string): string {
  const noSpacing = text.toLowerCase().replace(/[\s.,·\-_~!?"'`]/g, "");
  return noSpacing.replace(/(.)\1+/g, "$1");
}

export function containsProfanity(text: string): boolean {
  const masked = maskPhrases(normalize(text), ALLOWLIST_PHRASES);
  if (masked.trim() === "") return false;
  if (check(masked)) return true;
  const compacted = compact(masked);
  return [...SUPPLEMENTARY_WORDS, ...CHOSUNG_PATTERNS].some((word) =>
    compacted.includes(word.toLowerCase()),
  );
}
