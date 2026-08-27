"""Decide which permit places accept BeeflPay, by matching zeropay's merchant
list onto them.

This is what zeropay is *for* now. It used to produce the place list; after the
permit switch it only answers one yes/no question per place, and a place that
zeropay has never heard of stays on the map with the flag off instead of
vanishing from it.

Matching cannot use coordinates: zeropay gives a name and a road address and
nothing else. So the key is the (road, building number) core that
kakao_local already knows how to extract, narrowed by name -- one building
holds many restaurants, and flagging the wrong tenant tells someone the QR
works when it does not.
"""
import collections
import re
from typing import Iterable

import kakao_local
import match_legacy


def address_key(address: str) -> tuple[str, str] | None:
    """('마들로13길', '61') for a road address, None when too irregular to trust.

    None means "cannot verify", not "anything goes" -- callers must not fall
    back to a looser match, or a whole street ends up sharing one flag.
    """
    return kakao_local._address_core(address or "")


# "쌍문동 74-4" / "창동 산12". Zeropay falls back to a lot address for roughly
# one merchant in twenty, and those have no road name to key on at all.
_LOT_RE = re.compile(r"([가-힣]+(?:동|리|가))\s+(산?\d+(?:-\d+)?)")


def lot_key(address: str) -> tuple[str, str] | None:
    m = _LOT_RE.search(address or "")
    return (m.group(1), m.group(2)) if m else None


# Same building, same first N characters, different tail. Real pairs this catches:
# '순대실록 씨드큐브창동점' / '순대실록 창동씨드큐브점' (branch words reordered),
# '쭈꾸네 꿀삽겹' / '쭈꾸네 꿀삼겹' and '원조의정부부대찌개' / '원조의정부부대찌게'
# (typos on one side). Four, not three: at three '장모님사철탕' starts matching
# '장모님집', and a wrong flag tells someone the QR works when it does not.
NAME_PREFIX_MIN = 4


def _common_prefix_len(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def build_permit_index(places: Iterable[dict]) -> dict[tuple[str, str], list[dict]]:
    index: dict[tuple[str, str], list[dict]] = collections.defaultdict(list)
    for place in places:
        for key in (address_key(place.get("address", "")),
                    lot_key(place.get("lotno_address", ""))):
            if key is not None:
                index[key].append(place)
    return index


def match_merchant(merchant: dict, index) -> dict | None:
    """The permit place this zeropay merchant refers to, or None."""
    best: tuple[int, dict] | None = None
    for key in (address_key(merchant.get("address", "")),
                lot_key(merchant.get("address", ""))):
        if key is None:
            continue
        for place in index.get(key, []):
            score = match_legacy.name_score(place["name"], merchant.get("name"))
            if score == match_legacy.NO_MATCH:
                shared = _common_prefix_len(match_legacy.base_name(place["name"]),
                                            match_legacy.base_name(merchant.get("name") or ""))
                if shared < NAME_PREFIX_MIN:
                    continue
                score = match_legacy.PARTIAL
            if best is None or score < best[0]:
                best = (score, place)
    return best[1] if best else None


def flag(places: Iterable[dict], merchants: Iterable[dict]) -> tuple[set[str], list[dict]]:
    """Returns (permit numbers that accept BeeflPay, merchants we could not place).

    The leftovers matter: they are places zeropay lists that the permit data
    does not, which is either a closed shop zeropay has not dropped yet or a
    licence category we are not pulling. Reporting the count is how that stays
    visible instead of quietly shrinking the flag coverage.
    """
    index = build_permit_index(places)
    flagged: set[str] = set()
    unmatched: list[dict] = []
    for merchant in merchants:
        place = match_merchant(merchant, index)
        if place is None:
            unmatched.append(merchant)
            continue
        flagged.add(place["permit_no"])
    return flagged, unmatched
