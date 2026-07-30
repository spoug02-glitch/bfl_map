"""Fetch menu items (name/price) from Kakao place panel3 endpoint.

Unofficial endpoint — requires `pf: web` header + browser UA.
Any failure degrades to an empty list (map still works without menus).
"""
import requests

PANEL3_URL = "https://place-api.map.kakao.com/places/panel3/{place_id}"
HEADERS = {
    "pf": "web",
    "accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Referer": "https://place.map.kakao.com/",
    "Origin": "https://place.map.kakao.com",
}
TOP_N = 5


def fetch_menu(place_id: str) -> list[dict]:
    try:
        res = requests.get(PANEL3_URL.format(place_id=place_id), headers=HEADERS, timeout=10)
        res.raise_for_status()
        items = (res.json().get("menu") or {}).get("menus", {}).get("items") or []
        out = []
        for it in items[:TOP_N]:
            if not isinstance(it, dict):
                continue
            name = (it.get("name") or "").strip()
            if not name:
                continue
            out.append({"name": name, "price": str(it.get("price") or "").strip()})
        return out
    except Exception:
        return []
