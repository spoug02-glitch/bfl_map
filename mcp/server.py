"""MCP server exposing the Seedcube zeropay restaurant dataset.

Register:  claude mcp add bfl-map -- python C:/Users/notebook/Desktop/Apps/Bfl_map/mcp/server.py
"""
import json
import sys
from pathlib import Path

from fastmcp import FastMCP

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "web" / "public" / "restaurants.json"
sys.path.insert(0, str(ROOT / "collector"))  # reuse the panel3 client and the alias table
import brands  # noqa: E402

mcp = FastMCP("bfl-map")
LIMIT = 30


def _load() -> list[dict]:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def filter_restaurants(
    data: list[dict],
    keyword: str | None = None,
    category: str | None = None,
    max_distance_km: float | None = None,
) -> list[dict]:
    out = []
    for r in data:
        # brands.matches handles spelling variants ("cu" finds 씨유, "지에스25" finds GS25)
        if keyword and not brands.matches(keyword, r.get("search_keys") or [r["name"]]):
            continue
        if category and category not in r["category"]:
            continue
        if max_distance_km is not None and r["distance_km"] > max_distance_km:
            continue
        out.append(r)
    return out


def _strip_search_keys(rows: list[dict]) -> list[dict]:
    """search_keys is machine plumbing — drop it from tool output so it does not
    waste the caller's context window."""
    return [{k: v for k, v in r.items() if k != "search_keys"} for r in rows]


@mcp.tool()
def search_restaurants(keyword: str = "", category: str = "", max_distance_km: float = 0) -> list[dict]:
    """창동씨드큐브 반경 5km 제로페이(비플페이) 음식점/카페 검색.

    keyword: 가게 이름 부분일치, 표기 차이 허용('CU'로 씨유, '지에스25'로 GS25 검색 가능).
    category: 업종 부분일치(예: '커피', '한식'). max_distance_km: 0이면 제한 없음.
    결과에 메뉴·가격 포함. 30건을 초과하면 잘라내고, 마지막 원소로 실제 총 건수를 알려주며
    keyword/category/max_distance_km로 범위를 좁혀달라고 안내하는 note 객체를 추가한다.
    """
    hits = filter_restaurants(
        _load(),
        keyword=keyword or None,
        category=category or None,
        max_distance_km=max_distance_km or None,
    )
    rows = _strip_search_keys(hits[:LIMIT])
    if len(hits) > LIMIT:
        # never truncate silently — the caller must know results were dropped
        rows.append({"note": f"{len(hits)}건 중 가까운 {LIMIT}건만 표시했습니다. "
                             "keyword/category/max_distance_km로 범위를 좁혀주세요."})
    return rows


# get_menu 툴은 삭제했다. 하는 일이 카카오 비공식 엔드포인트 실시간 조회 하나였고,
# 저작권 문제로 그 수집을 중단하면서 근거가 사라졌다(collector/menu.py 도 함께 삭제).
# 메뉴는 이제 출처가 분명한 것만 웹앱의 menu_items 에 있고, 이 서버는 다루지 않는다.


if __name__ == "__main__":
    mcp.run()
