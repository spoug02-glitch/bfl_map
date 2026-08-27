"""Map the zeropay-era kakao_place_id onto the permit MNG_NO, once.

Only needed because `menu_items`, `reviews` and `lunch_specials` store a
place_id that was a Kakao id. After the switch the identity is MNG_NO, so those
rows have to be carried across. This is a migration aid, not part of collection
-- delete it once the switch has happened and the mapping file is committed.

Matching is coordinate-first because both sides now carry real coordinates and
the conversion is accurate to ~5m (see geo.epsg5174_to_wgs84). Names only break
ties: 2,541 of our rows already carry a Kakao spelling that differs from the
zeropay one, so name equality alone was never going to be enough.
"""
import collections
import re
from typing import Iterable

import geo

# 80m, not 20m: our Kakao coordinate is the building centroid and the permit
# coordinate is the licensed unit, so a large building separates them legitimately.
MAX_MATCH_M = 80.0

# Grid cell for the coordinate index. 0.001 degrees is ~111m north-south, so a
# 3x3 neighbourhood always covers MAX_MATCH_M.
_CELL = 0.001

# A name that occurs exactly once in the whole 3-gu set can be trusted further
# out: the risk MAX_MATCH_M guards against is a different shop in the same
# building, and a unique name has no such twin to be confused with.
UNIQUE_NAME_MAX_M = 500.0

EXACT, PARTIAL, NO_MATCH = 0, 1, 2


def normalize_name(name: str) -> str:
    """Drop bracketed asides, spaces and punctuation. '세친구곱창(수유인수점)' -> '세친구곱창'."""
    without_brackets = re.sub(r"\([^)]*\)", "", name or "")
    return re.sub(r"[\s\-_,.·]", "", without_brackets).lower()


def base_name(name: str) -> str:
    """normalize_name plus the branch suffix. '이조모밀 상계점' -> '이조모밀'."""
    return re.sub(r"(본|직영)?점$", "", normalize_name(name))


def name_score(permit_name: str, *candidates: str | None) -> int:
    """EXACT / PARTIAL / NO_MATCH against any of our spellings for the place."""
    permit = base_name(permit_name)
    if not permit:
        return NO_MATCH
    best = NO_MATCH
    for candidate in candidates:
        ours = base_name(candidate or "")
        if not ours:
            continue
        if permit == ours:
            return EXACT
        if len(permit) >= 2 and len(ours) >= 2 and (permit in ours or ours in permit):
            best = PARTIAL
    return best


def build_index(places: Iterable[dict]) -> dict[tuple[float, float], list[dict]]:
    index: dict[tuple[float, float], list[dict]] = collections.defaultdict(list)
    for place in places:
        index[(round(place["lat"], 3), round(place["lng"], 3))].append(place)
    return index


def _neighbourhood(index, lat: float, lng: float) -> list[dict]:
    out: list[dict] = []
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cell = (round(round(lat, 3) + dy * _CELL, 3), round(round(lng, 3) + dx * _CELL, 3))
            out += index.get(cell, [])
    return out


def match_one(row: dict, index) -> tuple[dict | None, int, float]:
    """Best permit place for one restaurants.json row.

    Returns (place | None, score, metres). A name that matches nothing is not a
    match at any distance -- two different restaurants in one building would
    otherwise swap identities, and that silently moves someone's menu.
    """
    best: tuple[int, float, dict] | None = None
    for place in _neighbourhood(index, row["lat"], row["lng"]):
        metres = geo.haversine_km(row["lat"], row["lng"], place["lat"], place["lng"]) * 1000
        if metres > MAX_MATCH_M:
            continue
        score = name_score(place["name"], row.get("name"), row.get("zeropay_name"))
        if score == NO_MATCH:
            continue
        if best is None or (score, metres) < (best[0], best[1]):
            best = (score, metres, place)
    if best is None:
        return None, NO_MATCH, 0.0
    return best[2], best[0], best[1]


def build_mapping(rows: Iterable[dict], places: Iterable[dict]) -> tuple[dict[str, str], collections.Counter]:
    """kakao_place_id -> permit MNG_NO, plus a tally of how each row landed."""
    places = list(places)
    index = build_index(places)
    name_index = build_name_index(places)
    mapping: dict[str, str] = {}
    tally: collections.Counter = collections.Counter()
    for row in rows:
        place, score, _ = match_one(row, index)
        if place is not None:
            tally["exact" if score == EXACT else "partial"] += 1
            mapping[row["kakao_place_id"]] = place["permit_no"]
            continue
        place = match_unique_name(row, name_index)
        if place is None:
            tally["none"] += 1
            continue
        tally["unique_name"] += 1
        mapping[row["kakao_place_id"]] = place["permit_no"]
    return mapping, tally


def build_name_index(places: Iterable[dict]) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = collections.defaultdict(list)
    for place in places:
        key = base_name(place["name"])
        if key:
            index[key].append(place)
    return index


def match_unique_name(row: dict, name_index) -> dict | None:
    """Second pass for rows the coordinate match missed.

    Only fires when our spelling resolves to exactly one place in the entire
    set. '박은선닭꼬치' sits 154m from where Kakao put it -- past MAX_MATCH_M,
    but there is only one of it in three districts, so it is that one.
    '락궁' has seven and stays unmatched, which is the right answer.
    """
    for candidate in (row.get("name"), row.get("zeropay_name")):
        key = base_name(candidate or "")
        if not key:
            continue
        places = name_index.get(key, [])
        if len(places) != 1:
            continue
        place = places[0]
        metres = geo.haversine_km(row["lat"], row["lng"], place["lat"], place["lng"]) * 1000
        if metres <= UNIQUE_NAME_MAX_M:
            return place
    return None
