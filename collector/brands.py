"""Brand/spelling-tolerant search: single source of truth for name aliasing.

Handles two independent problems in zeropay merchant names:
  1. Formatting noise (spaces, dots, hyphens, parens) that varies per row.
  2. Latin/Korean spelling splits of the same brand (e.g. "CU" vs "씨유").
"""
import re

# Bidirectional alias groups. Every member is interchangeable with every
# other member in the same group. Members are written already normalized
# (lowercase, no spaces/punctuation) since matching happens on normalized text.
ALIAS_GROUPS: tuple[tuple[str, ...], ...] = (
    ("씨유", "cu"),
    ("gs25", "지에스25", "지에스이십오"),
    ("세븐일레븐", "7eleven", "seveneleven"),
    ("이마트24", "emart24", "이마트이십사"),
    ("bhc", "비에이치씨"),
    ("bbq", "비비큐"),
    ("kfc", "케이에프씨"),
    ("맥도날드", "mcdonalds", "맥날"),
    ("스타벅스", "starbucks", "스벅"),
    ("파리바게뜨", "parisbaguette", "파리바게트"),
    ("뚜레쥬르", "touslesjours"),
    ("투썸플레이스", "twosome", "투썸"),
    ("메가커피", "megacoffee", "메가엠지씨커피"),
    ("컴포즈커피", "compose"),
    ("빽다방", "paikdabang"),
    ("이디야", "ediya"),
    ("배스킨라빈스", "baskinrobbins", "배라"),
)

# Characters users vary on: spaces (incl. full-width), dots, middle dot,
# hyphen, underscore, comma, ampersand, slash, and paren/bracket markers
# themselves (the content inside parens is kept).
_STRIP_CHARS_RE = re.compile(r"[ 　.·\-_,&/()\[\]{}]")


def normalize(text: str) -> str:
    """Casefold and strip formatting-noise characters (spaces/dots/parens...)."""
    return _STRIP_CHARS_RE.sub("", text.casefold())


def _strip_paren_content(text: str) -> str:
    """Remove parenthesised/bracketed spans entirely (marker + content)."""
    return re.sub(r"[(\[{][^)\]}]*[)\]}]", "", text)


def _is_hangul_syllable(ch: str) -> bool:
    return bool(ch) and "가" <= ch <= "힣"


def _brand_boundary_ok(text: str, member: str) -> bool:
    """True when `member` occurs at the very START of `text` (a brand name
    is always the leading token of a search key/name, never buried
    mid-word) and, when the member's final character is a Latin LETTER, the
    character immediately following the match is NOT a Latin letter. This
    rejects 'cu' matching as a prefix of 'cupid'/'cucina' or 'bhc'/'bbq'/'kfc'
    inside a longer Latin word. When the member ends in a DIGIT (e.g.
    'gs25'), a following Latin letter is a script transition — a real
    boundary, not a continuation of the same word (e.g. 'gs25' in
    'gs25s노원역점') — so the guard does not apply; digit- or
    Hangul-followed matches like 'gs25' in 'gs25방학본점' or '씨유' in
    '씨유방학점' are unaffected either way."""
    if not text.startswith(member):
        return False
    last = member[-1:]
    if last.isascii() and last.isalpha():
        nxt = text[len(member):len(member) + 1]
        if nxt.isascii() and nxt.isalpha():
            return False
    return True


def _occurs_at_boundary(key: str, q: str, idx: int) -> bool:
    """Boundary check for an occurrence of `q` at position `idx` within
    `key`: rejects the match if it is embedded inside a longer Latin/Hangul
    run on either side (e.g. 'cu' inside 'lovecup')."""
    if idx > 0:
        prev = key[idx - 1]
        if (prev.isascii() and prev.isalpha()) or _is_hangul_syllable(prev):
            return False
    last = q[-1:]
    if last.isascii() and last.isalpha():
        end = idx + len(q)
        nxt = key[end:end + 1]
        if nxt.isascii() and nxt.isalpha():
            return False
    return True


def _contains_at_boundary(key: str, q: str) -> bool:
    """Substring containment for `q` in `key`, requiring at least one
    occurrence that isn't embedded inside a longer word (see
    _occurs_at_boundary). Plain (non-alias) queries almost always match at
    index 0 of some key, where the boundary check is trivially satisfied."""
    if not q:
        return False
    start = 0
    while True:
        idx = key.find(q, start)
        if idx == -1:
            return False
        if _occurs_at_boundary(key, q, idx):
            return True
        start = idx + 1


def _alias_substitutions(key: str) -> list[str]:
    """For every alias group whose member matches `key` at a brand boundary
    (see _brand_boundary_ok), return `key` with the leading occurrence of
    that member replaced by each other member of the group."""
    variants = []
    for group in ALIAS_GROUPS:
        for member in group:
            if _brand_boundary_ok(key, member):
                for other in group:
                    if other != member:
                        variants.append(other + key[len(member):])
    return variants


def search_keys(name: str) -> list[str]:
    """De-duplicated, order-stable list of normalized strings a row is
    findable by: the normalized name, its paren-content-removed variant,
    and alias substitutions of both."""
    base_keys = [normalize(name), normalize(_strip_paren_content(name))]

    all_keys: list[str] = []
    for key in base_keys:
        all_keys.append(key)
        all_keys.extend(_alias_substitutions(key))

    seen: set[str] = set()
    result: list[str] = []
    for key in all_keys:
        if key and key not in seen:
            seen.add(key)
            result.append(key)
    return result


def _name_variant_boundary_ok(text: str, member: str) -> bool:
    """Stricter than _brand_boundary_ok: name_variants operates on raw,
    unnormalized display text, where a real brand name is followed by a
    space or other separator before the branch suffix ("씨유 방학점"), not
    run directly into another Hangul/Latin word with no separator at all
    ("맥날레스토랑" is NOT "맥날" + a branch name). Requires the brand
    boundary check to pass AND the character right after the match (if
    any) to not itself be a word character (Hangul syllable or Latin
    letter/digit)."""
    if not _brand_boundary_ok(text, member):
        return False
    nxt = text[len(member):len(member) + 1]
    if not nxt:
        return True
    if nxt.isascii() and nxt.isalnum():
        return False
    if _is_hangul_syllable(nxt):
        return False
    return True


def name_variants(name: str) -> list[str]:
    """De-duplicated outbound-query variants of `name`: the original text
    plus alias-substituted copies. Unlike search_keys/expand_query, this
    operates on the raw (unnormalized) text and preserves everything outside
    the substituted span, so "씨유 방학롯데캐슬점" yields "cu 방학롯데캐슬점"
    as a variant suitable for sending to the Kakao keyword search API. Only
    substitutes a member found at the very start of `name` (see
    _name_variant_boundary_ok) — a brand name is always the leading token,
    never buried mid-word."""
    variants = [name]
    lower = name.casefold()
    for group in ALIAS_GROUPS:
        for member in group:
            if not _name_variant_boundary_ok(lower, member):
                continue
            for other in group:
                if other == member:
                    continue
                variants.append(other + name[len(member):])

    seen: set[str] = set()
    result: list[str] = []
    for v in variants:
        if v not in seen:
            seen.add(v)
            result.append(v)
    return result


def expand_query(q: str) -> list[str]:
    """normalize(q) plus alias substitutions for consumers searching a plain
    name string (rather than a precomputed search_keys list)."""
    base = normalize(q)
    variants = [base] + _alias_substitutions(base)

    seen: set[str] = set()
    result: list[str] = []
    for v in variants:
        if v and v not in seen:
            seen.add(v)
            result.append(v)
    return result


def matches(query: str, keys: list[str]) -> bool:
    """True when any expand_query(query) value occurs in any key at a
    brand boundary (see _contains_at_boundary) — plain substring semantics
    for ordinary queries, but rejects a short alias term (e.g. 'cu') found
    only embedded inside a longer unrelated word (e.g. 'lovecup').
    Empty/whitespace query matches everything (no filtering)."""
    if not query or not query.strip():
        return True
    return any(_contains_at_boundary(key, q) for q in expand_query(query) for key in keys)
