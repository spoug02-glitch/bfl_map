"""Match a zeropay merchant (name+address) to a Kakao place (id + coords)."""
import difflib
import os
import re
import time
from typing import NamedTuple

import requests
from dotenv import load_dotenv

import brands

load_dotenv()

SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
MAX_RETRIES = 2
_GU_RE = re.compile(r"(\S+구)")
_CORP_RE = re.compile(r"^\((주|유|사)\)\s*")
_BRANCH_PAREN_RE = re.compile(r"\(([^)]{1,10}점)\)")
_TRAILING_PAREN_RE = re.compile(r"\s*\([^)]*\)\s*$")

# Road name (ends in 로/길) + building main number, with an optional '산'
# lot-number prefix and an optional '-sub' number, e.g. "마들로13길 61" or
# "시루봉로 105-2" or "동일로 산36-1". Used by _address_core to extract the
# comparable core of a Korean road address.
_ROAD_CORE_RE = re.compile(r"(?P<road>\S+(?:로|길))\s+(?:산\s*)?(?P<main>\d+)(?:-(?P<sub>\d+))?")

# Zeropay 업종명 -> Kakao category_group_code (FD6=음식점, CE7=카페, CS2=편의점).
# Only categories that map to something other than the FD6 default are listed.
_CATEGORY_GROUP_MAP = {
    "체인화 편의점": "CS2",
    "커피 전문점": "CE7",
    "제과점업": "CE7",
}

# Address-fallback acceptance threshold for the brand/name similarity score
# (difflib SequenceMatcher ratio over brands.normalize()d text, see
# _similarity). Calibrated against real 도봉구 data: the correct match for
# the "순대신록"(zeropay typo)/"순대실록"(kakao) pair scores ~0.75, while the
# same-building false positive "씨드큐브 창동 공영주차장" scores ~0.55.
# 0.65 sits roughly midway, comfortably separating the two.
FALLBACK_THRESHOLD = 0.65

# Address-fallback candidate pool size. Must be >=15: with the default
# size=5, real data showed the top hit for a food-place address query can be
# an unrelated category (e.g. a parking lot) crowding out the real match.
FALLBACK_SIZE = 15

# Minimum brand-token similarity (_similarity(...).token) an address-gated
# candidate must clear to be eligible at all, regardless of its full-name
# score. Multi-tenant buildings routinely share a generic branch/location
# suffix (a subway station, hospital, mall name) across UNRELATED
# businesses, which can inflate `full` well past FALLBACK_THRESHOLD even
# though the actual brand names have nothing in common — e.g. found via the
# live F6 audit: "이마트24 상계백병원점" (Emart24) vs "카페센트 상계백병원점"
# (an unrelated cafe at the same address) scores full=0.667 but token=0.222;
# "치킨마루광운대점" vs "굿킨 광운대점" scores full=0.714 but token=0.2. The
# lowest genuinely-correct fallback match observed in that same audit was
# token=0.462 ("들깨마을 맷돌순두부 수유점" vs its typo'd Kakao listing).
# 0.35 sits roughly midway between the two, comfortably separating them.
TOKEN_FLOOR = 0.35


def _clean_name(name: str) -> str:
    """Normalize zeropay DB names for kakao keyword search.

    '(주)거궁창동점' -> '거궁창동점', '노모어피자(창동점)' -> '노모어피자 창동점'
    """
    cleaned = _CORP_RE.sub("", name.strip())
    cleaned = _BRANCH_PAREN_RE.sub(r" \1", cleaned)
    return " ".join(cleaned.split())


def _search(query: str, size: int = 5, category_group_code: str | None = None) -> list[dict]:
    key = os.environ["KAKAO_REST_API_KEY"]
    params = {"query": query, "size": size}
    if category_group_code:
        params["category_group_code"] = category_group_code
    last_err: Exception | None = None
    for _ in range(MAX_RETRIES + 1):
        try:
            res = requests.get(
                SEARCH_URL,
                params=params,
                headers={"Authorization": f"KakaoAK {key}"},
                timeout=10,
            )
            res.raise_for_status()
            return res.json().get("documents", [])
        except requests.RequestException as e:
            last_err = e
            time.sleep(1)
    raise RuntimeError(f"kakao local search failed: {query}") from last_err


def _gu_of(address: str) -> str | None:
    m = _GU_RE.search(address)
    return m.group(1) if m else None


def _clean_address(address: str) -> str:
    """Strip a trailing '(동, 건물명)' annotation from a zeropay road
    address before using it as a Kakao keyword-search query. Real data
    shows Kakao's keyword search returns near-zero results when that
    annotation is left in (e.g. "...도봉로150마길 34 (방학동, 도봉 롯데캐슬
    골든파크)" -> 0-1 docs), but the address alone up to the paren finds
    the building's tenants reliably.
    """
    return _TRAILING_PAREN_RE.sub("", address).strip()


def _address_core(address: str) -> tuple[str, str] | None:
    """Extract the comparable (road_name, building_number) core from a
    Korean road address for strict equality comparison, e.g.
    "서울특별시 도봉구 마들로13길 61 (창동, 씨드큐브)" -> ("마들로13길", "61").

    Handles the real shapes present in zeropay/Kakao data: an optional
    leading 시/도, a trailing "(동, 건물명)" annotation (ignored — the regex
    only needs to find the road+number span, wherever it sits), a "산"
    lot-number prefix, and main-sub numbers like "84-9". Returns None when
    no road-name+number pattern is found at all (address too irregular to
    verify strictly) — callers must treat that as "cannot verify", not
    "anything goes".
    """
    m = _ROAD_CORE_RE.search(address)
    if not m:
        return None
    road = m.group("road").strip().casefold()
    number = m.group("main")
    if m.group("sub"):
        number = f"{number}-{m.group('sub')}"
    return road, number


def _accept(doc: dict, gu: str | None) -> dict | None:
    """Build the match_place() result dict from a Kakao doc, or None if the
    doc is missing required fields or falls outside the target 구."""
    doc_addr = doc.get("road_address_name") or doc.get("address_name") or ""
    if gu and gu not in doc_addr:
        return None
    try:
        return {
            "place_id": str(doc["id"]),
            "lat": float(doc["y"]),
            "lng": float(doc["x"]),
            "kakao_url": doc.get("place_url") or f"http://place.map.kakao.com/{doc['id']}",
            "place_name": doc.get("place_name") or "",
        }
    except (KeyError, ValueError):
        return None


def _category_group_code(category: str | None) -> str | None:
    """None (category unknown) -> no filter. Otherwise map the zeropay
    업종명 to a Kakao category_group_code, defaulting to FD6 (음식점)."""
    if category is None:
        return None
    return _CATEGORY_GROUP_MAP.get(category, "FD6")


def _brand_token(name: str) -> str:
    """Leading token (text before the first space), or the whole name when
    there is no space."""
    name = name.strip()
    head, sep, _ = name.partition(" ")
    return head if sep else name


class SimilarityScore(NamedTuple):
    """Both component scores plus the combined max, so a caller can tell
    "identical brand, different branch" (token≈1.0, full noticeably lower)
    from a real typo match (both scores close together) — token similarity
    alone must never be the sole basis of an acceptance decision."""
    full: float
    token: float
    best: float


def _similarity(zeropay_name: str, candidate_name: str) -> SimilarityScore:
    """max(brand-token similarity, full-name similarity) over
    brands.normalize()d text. Scoring the leading token catches typo'd
    brand/store names buried in branch-noise ("순대신록" vs "순대실록"
    inside longer strings); scoring the full name catches space-less names
    where there is no separate token ("88켄터키창동점"). NOTE: two
    different branches of the same chain (e.g. "GS25 신창동점" vs "GS25
    도봉로120점") score token=1.0 here — this is expected and safe only
    because callers gate acceptance on an exact address match first (see
    _address_fallback) and use this score purely as a tiebreaker among
    address-verified candidates."""
    full = difflib.SequenceMatcher(
        None, brands.normalize(zeropay_name), brands.normalize(candidate_name)
    ).ratio()
    token_a = brands.normalize(_brand_token(zeropay_name))
    token_b = brands.normalize(_brand_token(candidate_name))
    token = difflib.SequenceMatcher(None, token_a, token_b).ratio() if token_a and token_b else 0.0
    return SimilarityScore(full=full, token=token, best=max(full, token))


def _address_fallback(
    zeropay_name: str, address: str, gu: str | None, category_group_code: str | None
) -> dict | None:
    """Search the merchant's own address (optionally category-filtered).

    Address is the authoritative signal here, name similarity only a
    tiebreaker: a candidate is eligible only when its road name + building
    number exactly match the merchant's (_address_core) — this is checked
    unconditionally, independent of gu, so it holds even when _gu_of
    couldn't extract a district (F5). The 구 substring check is kept as an
    additional guard on top, not the only one (F1/F2). Address-eligible
    candidates are further required to clear TOKEN_FLOOR on brand-token
    similarity before they're even considered for ranking — this rejects
    an unrelated tenant at the same multi-tenant building whose full-name
    score is inflated by a shared generic branch suffix (e.g. a subway
    station or hospital name) despite an entirely different brand. Among
    the remaining candidates, accept the highest-similarity one only if it
    clears FALLBACK_THRESHOLD; if the merchant's own address can't be
    parsed into a road+number core at all, we cannot verify anything, so
    return None rather than guessing.
    """
    query = _clean_address(address)
    merchant_core = _address_core(query)
    if merchant_core is None:
        return None
    best_doc, best_score = None, None
    for doc in _search(query, size=FALLBACK_SIZE, category_group_code=category_group_code):
        doc_addr = doc.get("road_address_name") or doc.get("address_name") or ""
        if gu and gu not in doc_addr:
            continue
        if _address_core(doc_addr) != merchant_core:
            continue
        score = _similarity(zeropay_name, doc.get("place_name") or "")
        if score.token < TOKEN_FLOOR:
            continue
        if best_score is None or score.best > best_score.best:
            best_doc, best_score = doc, score
    if best_doc is not None and best_score.best >= FALLBACK_THRESHOLD:
        return _accept(best_doc, gu)
    return None


def match_place(name: str, address: str, category: str | None = None) -> dict | None:
    """Resolve a zeropay merchant to a Kakao place.

    Step B: try the cleaned name, then every alias-substituted variant
    (e.g. "씨유 ..." -> "cu ..."), each scoped to the merchant's 구.
    Step C (only if Step B found nothing): search the merchant's address
    with a category filter derived from `category`, score candidates by
    name similarity, and accept the best one above FALLBACK_THRESHOLD; if
    that yields nothing, retry once without the category filter.
    """
    gu = _gu_of(address)
    cleaned = _clean_name(name)

    for variant in brands.name_variants(cleaned):
        query = f"{variant} {gu}" if gu else variant
        for doc in _search(query):
            accepted = _accept(doc, gu)
            if accepted:
                return accepted

    group_code = _category_group_code(category)
    result = _address_fallback(name, address, gu, group_code)
    if result:
        return result
    if group_code is not None:
        result = _address_fallback(name, address, gu, None)
        if result:
            return result
    return None
