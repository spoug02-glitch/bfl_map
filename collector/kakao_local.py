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

# Name-agreement threshold, used by BOTH Step B and Step C (see _classify)
# as a fallback acceptance path when a candidate's address does NOT match
# the merchant's own address core: accept purely on a strong full-name
# match (SimilarityScore.full -- never .token/.best, since two DIFFERENT
# branches of one chain score .token == 1.0, which is exactly the defect
# this threshold exists to close).
#
# Calibrated against real 도봉구 data (live audit, see the fix report for
# the full numbers):
#   - reject anchor: the reported defect pair "GS25 신창동점"/"GS25
#     도봉로120점" (different branches of one chain, different buildings)
#     scores full=0.526.
#   - reject anchor: a false positive actually present in the live 125-
#     merchant sample before this fix, "우동집"/"마쯔무라돈까스 본점" (an
#     unrelated restaurant that merely shares the merchant's 구), scores
#     full=0.0.
#   - accept anchor: a genuine live match, "씨유 창동현대점"/"CU 창동현대점"
#     (alias-spelled branch label), scores full=0.714.
# Most genuine matches are carried by address agreement instead (see
# _address_agrees) regardless of this threshold, since Kakao's returned
# listing is almost always at the merchant's real address; this threshold
# only decides the rarer case where the address string itself doesn't
# line up (e.g. zeropay stores a lot address, Kakao a road address) or
# can't be parsed at all. 0.70 sits above both reject anchors with margin
# while still admitting the accept anchor.
NAME_AGREEMENT_THRESHOLD = 0.70

# Address-fallback candidate pool size. Must be >=15: with the default
# size=5, real data showed the top hit for a food-place address query can be
# an unrelated category (e.g. a parking lot) crowding out the real match.
FALLBACK_SIZE = 15


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


def _accept(doc: dict) -> dict | None:
    """Build the match_place() result dict from a Kakao doc, or None if the
    doc is missing required fields (id/x/y). Eligibility (gu/address/name
    agreement) is decided upstream by _classify/_best_candidate; this
    function only shapes the output."""
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
    도봉로120점") score token=1.0 here -- .token/.best must never by
    themselves decide acceptance; kept on SimilarityScore for callers that
    want them (e.g. tests), but _classify's acceptance rule only ever
    reads .full."""
    full = difflib.SequenceMatcher(
        None, brands.normalize(zeropay_name), brands.normalize(candidate_name)
    ).ratio()
    token_a = brands.normalize(_brand_token(zeropay_name))
    token_b = brands.normalize(_brand_token(candidate_name))
    token = difflib.SequenceMatcher(None, token_a, token_b).ratio() if token_a and token_b else 0.0
    return SimilarityScore(full=full, token=token, best=max(full, token))


def _address_agrees(doc_addr: str, merchant_core: tuple[str, str] | None) -> bool:
    """True when the candidate's road name + building main number exactly
    equal the merchant's (_address_core). merchant_core is None whenever
    the merchant's own address didn't parse into a comparable core, in
    which case address agreement can never be established."""
    return merchant_core is not None and _address_core(doc_addr) == merchant_core


def _brand_family(normalized_name: str) -> str | None:
    """Alias-canonical brand identity for a brands.normalize()d name: the
    matching ALIAS_GROUPS group's first member, if `normalized_name`
    starts with any group member at a brand boundary (reusing
    brands._brand_boundary_ok, the same check brands.name_variants() uses
    for query generation), else None. Lets two spellings of the SAME brand
    across scripts (e.g. "씨유..." and "cu...", which share zero
    characters) be recognized as equal."""
    for group in brands.ALIAS_GROUPS:
        for member in group:
            if brands._brand_boundary_ok(normalized_name, member):
                return group[0]
    return None


def _brand_agrees(zeropay_name: str, candidate_name: str) -> bool:
    """Brand-identity check for an address-agreeing candidate (F6): True
    when either (a) one brands.normalize()d name fully CONTAINS the other
    as a substring — e.g. "썬더치킨" is a straight prefix of "썬더치킨
    서울쌍문점" once normalized (no branch suffix on the zeropay side at
    all), or "ueru" is embedded in "유이알유(ueru)" — or (b) both names
    resolve to the SAME known brands.ALIAS_GROUPS family (see
    _brand_family), e.g. "CU" and "씨유" (zero characters in common, so
    (a) can't recognize them as one brand either).

    Deliberately does NOT fall back to raw brand-token (leading-token)
    similarity above a floor for names outside any known alias group: a
    live false positive confirmed this is unsafe -- "커피앤드힐" vs "우지커피
    도봉법원점" (unrelated cafes at the same building) share nothing but the
    generic word "커피" ("coffee") in the middle of both names (so NEITHER
    contains the other) yet still scored a brand-token ratio of 0.444,
    nearly indistinguishable from the lowest genuinely-correct token score
    (~0.462) ever observed for this codebase (see the fix report) -- a
    floor on that score cannot separate the two. Full containment is a
    much narrower, explainable condition that both known-good pairs
    satisfy and the false positive does not. _classify separately falls
    back to a strong FULL-name match (NAME_AGREEMENT_THRESHOLD) for
    address-agreeing candidates that clear neither check here (e.g.
    "메가엠지씨커피" vs "메가MGC커피", which don't contain one another and
    aren't one curated alias family, but are still a 0.79 full match)."""
    z_norm = brands.normalize(zeropay_name)
    c_norm = brands.normalize(candidate_name)
    if z_norm and c_norm and (z_norm in c_norm or c_norm in z_norm):
        return True
    z_family = _brand_family(z_norm)
    c_family = _brand_family(c_norm)
    if z_family is None and c_family is None:
        return False
    return z_family == c_family


def _classify(
    doc: dict, gu: str | None, zeropay_name: str, merchant_core: tuple[str, str] | None
) -> tuple[str, float] | None:
    """Shared acceptance rule for BOTH Step B and Step C (F7): classify one
    Kakao doc against the merchant, returning (tier, full_score) if
    eligible, else None.

    A candidate is eligible only if both hold:
      1. It's in the merchant's 구 (gu is a substring of its address) —
         skipped when gu couldn't be determined, EXCEPT that in that case
         address agreement then becomes mandatory (F5): an unparseable
         merchant district must never let name-similarity alone decide.
      2. Its road name + building number exactly match the merchant's
         (_address_core -> tier "address"), OR — only when gu is known —
         its full name is a strong match to the merchant's (_similarity
         .full, never .token/.best -> tier "name").

    An "address" candidate additionally has to clear _brand_agrees OR a
    strong full-name match: an exact building match alone isn't enough
    evidence in a multi-tenant building (F6, e.g. a parking lot sharing
    the merchant's building), but _brand_agrees itself can miss a genuine
    same-store spelling variant that isn't literally an ALIAS_GROUPS
    member (live example: zeropay's "메가엠지씨커피" vs Kakao's "메가MGC커피"
    for the SAME store, or zeropay recording the registered corporate name
    instead of the storefront brand) — a strong full-name match recovers
    those without reopening the parking-lot/unrelated-tenant hole, since
    those score well under NAME_AGREEMENT_THRESHOLD (see its comment).
    A candidate whose address does NOT agree is only eligible via the
    (gu-gated) full-name-match path -- there is no address-based tier to
    fall into."""
    doc_addr = doc.get("road_address_name") or doc.get("address_name") or ""
    if gu and gu not in doc_addr:
        return None
    candidate_name = doc.get("place_name") or ""
    full = _similarity(zeropay_name, candidate_name).full
    if _address_agrees(doc_addr, merchant_core):
        if _brand_agrees(zeropay_name, candidate_name) or full >= NAME_AGREEMENT_THRESHOLD:
            return "address", full
        return None
    if gu is None:
        return None
    if full >= NAME_AGREEMENT_THRESHOLD:
        return "name", full
    return None


def _best_candidate(
    docs: list[dict], gu: str | None, zeropay_name: str, merchant_core: tuple[str, str] | None
) -> dict | None:
    """Pick the best-eligible doc from a single _search() result list (see
    _classify), preferring an address-verified match over a name-only
    match so an exact-name candidate at the WRONG building never beats the
    correct building (F1/F2). Within a tier, ties are broken by the
    highest full-name score; a malformed top pick (_accept returns None)
    falls through to the next-best candidate rather than giving up."""
    address_hits: list[tuple[float, dict]] = []
    name_hits: list[tuple[float, dict]] = []
    for doc in docs:
        classified = _classify(doc, gu, zeropay_name, merchant_core)
        if classified is None:
            continue
        tier, score = classified
        (address_hits if tier == "address" else name_hits).append((score, doc))
    for pool in (address_hits, name_hits):
        for _, doc in sorted(pool, key=lambda p: p[0], reverse=True):
            accepted = _accept(doc)
            if accepted:
                return accepted
    return None


def _address_fallback(
    zeropay_name: str,
    address: str,
    gu: str | None,
    merchant_core: tuple[str, str] | None,
    category_group_code: str | None,
) -> dict | None:
    """Search the merchant's own address (optionally category-filtered)
    and hand the results to the shared _best_candidate acceptance rule
    (see match_place's docstring)."""
    query = _clean_address(address)
    docs = _search(query, size=FALLBACK_SIZE, category_group_code=category_group_code)
    return _best_candidate(docs, gu, zeropay_name, merchant_core)


def match_place(name: str, address: str, category: str | None = None) -> dict | None:
    """Resolve a zeropay merchant to a Kakao place.

    Step B (name-query search) and Step C (address-query fallback) share
    ONE acceptance rule, applied per-candidate via _classify/_best_candidate:
    a candidate is eligible only if it's in the merchant's 구 (or, when the
    구 couldn't be determined, only if its address exactly matches the
    merchant's — F5), AND either its road name + building number exactly
    match the merchant's (brand-gated against an unrelated tenant at the
    same building — F6), or — when address agreement isn't established —
    its full name is a strong match to the merchant's (F7). Within one
    search call's results, an address-verified candidate always wins over
    a name-only one, so an exact-name match at the WRONG building can
    never beat the correct building (F1/F2).

    Step B: try the cleaned name, then every alias-substituted variant
    (e.g. "씨유 ..." -> "cu ..."), each scoped to the merchant's 구.
    Step C (only if Step B found nothing): search the merchant's address
    with a category filter derived from `category`; if that yields
    nothing, retry once without the category filter.
    """
    gu = _gu_of(address)
    merchant_core = _address_core(address)
    cleaned = _clean_name(name)

    for variant in brands.name_variants(cleaned):
        query = f"{variant} {gu}" if gu else variant
        best = _best_candidate(_search(query), gu, name, merchant_core)
        if best:
            return best

    group_code = _category_group_code(category)
    result = _address_fallback(name, address, gu, merchant_core, group_code)
    if result:
        return result
    if group_code is not None:
        result = _address_fallback(name, address, gu, merchant_core, None)
        if result:
            return result
    return None
