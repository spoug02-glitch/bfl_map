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


def _alias_substitutions(key: str) -> list[str]:
    """For every alias group with a member substring in `key`, return `key`
    with that member replaced by each other member of the group."""
    variants = []
    for group in ALIAS_GROUPS:
        for member in group:
            if member in key:
                for other in group:
                    if other != member:
                        variants.append(key.replace(member, other))
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
    """True when any expand_query(query) value is a substring of any key.
    Empty/whitespace query matches everything (no filtering)."""
    if not query or not query.strip():
        return True
    return any(q in key for q in expand_query(query) for key in keys)
