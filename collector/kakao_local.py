"""Match a zeropay merchant (name+address) to a Kakao place (id + coords)."""
import os
import re
import time

import requests
from dotenv import load_dotenv

load_dotenv()

SEARCH_URL = "https://dapi.kakao.com/v2/local/search/keyword.json"
MAX_RETRIES = 2
_GU_RE = re.compile(r"(\S+구)")
_CORP_RE = re.compile(r"^\((주|유|사)\)\s*")
_BRANCH_PAREN_RE = re.compile(r"\(([^)]{1,10}점)\)")


def _clean_name(name: str) -> str:
    """Normalize zeropay DB names for kakao keyword search.

    '(주)거궁창동점' -> '거궁창동점', '노모어피자(창동점)' -> '노모어피자 창동점'
    """
    cleaned = _CORP_RE.sub("", name.strip())
    cleaned = _BRANCH_PAREN_RE.sub(r" \1", cleaned)
    return " ".join(cleaned.split())


def _search(query: str) -> list[dict]:
    key = os.environ["KAKAO_REST_API_KEY"]
    last_err: Exception | None = None
    for _ in range(MAX_RETRIES + 1):
        try:
            res = requests.get(
                SEARCH_URL,
                params={"query": query, "size": 5},
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


def match_place(name: str, address: str) -> dict | None:
    """Search '이름 구' and take the first result in the same 구 (gu)."""
    gu = _gu_of(address)
    name = _clean_name(name)
    query = f"{name} {gu}" if gu else name
    for doc in _search(query):
        doc_addr = doc.get("road_address_name") or doc.get("address_name") or ""
        if gu and gu not in doc_addr:
            continue
        try:
            return {
                "place_id": str(doc["id"]),
                "lat": float(doc["y"]),
                "lng": float(doc["x"]),
                "kakao_url": doc.get("place_url") or f"http://place.map.kakao.com/{doc['id']}",
            }
        except (KeyError, ValueError):
            continue
    return None
