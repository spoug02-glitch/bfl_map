"""행정안전부 지방행정 인허가 Open API crawler (data.go.kr, key required).

Replaces zeropay as the source of *which places exist*. Zeropay stays, but only
to answer "does BeeflPay work here" -> see collect.py.

Two things about this API will bite you:

1. **`localCode` does not exist here.** Pass it and you get silently ignored
   nationwide rows -- the first probe of this endpoint returned Jeju. The region
   field is `OPN_ATMY_GRP_CD`, and filters use `cond[FIELD::OP]=value` syntax.
2. **`numOfRows` caps at 100.** Unlike zeropay (1000/request), a full 3-gu pull
   is ~120 requests, and a data.go.kr *development* key allows ~1,000/day.
   `REQUEST_COUNT` is here so a runaway loop shows up before the quota does.

Endpoint list: 붙임2 of data.go.kr notice NOTICE_0000000004566.
"""
import time
import urllib.parse
from typing import Iterator

import requests

import geo

BASE = "http://apis.data.go.kr/1741000"
SERVICES: dict[str, str] = {
    "general_restaurants": "일반음식점",
    "rest_cafes": "휴게음식점",
}

# 개방자치단체코드 (붙임 "개방자치단체코드" 시트). MVP 범위 3개 구.
DISTRICTS: dict[str, str] = {
    "도봉구": "3090000",
    "노원구": "3100000",
    "강북구": "3080000",
}

STATUS_OPEN = "01"  # 영업/정상
MAX_ROWS_PER_REQUEST = 100  # API hard cap
MAX_RETRIES = 2


class IncompletePermitCrawl(RuntimeError):
    """서버가 알려준 totalCount 보다 적게 받았다. 부분 결과로 파일을 덮으면 안 된다."""

# Bumped on every HTTP call so callers can see the request budget being spent.
REQUEST_COUNT = 0

# 업태구분명 -> the category vocabulary already used by zeropay.py and the web app.
# Source: 붙임4 "지방행정 인허가정보_업종별 업태구분명".
CATEGORY_MAP: dict[str, str] = {
    "한식": "한식 일반 음식점업",
    "식육(숯불구이)": "한식 육류요리 전문점",
    "탕류(보신용)": "한식 일반 음식점업",
    "냉면집": "한식 일반 음식점업",
    "중국식": "중식 음식점업",
    "일식": "일식 음식점업",
    "횟집": "일식 음식점업",
    "복어취급": "일식 음식점업",
    "경양식": "서양식 음식점업",
    "패밀리레스트랑": "서양식 음식점업",
    "외국음식전문점(인도,태국등)": "외국음식 전문점",
    "분식": "김밥 및 기타 간이 음식점업",
    "김밥(도시락)": "김밥 및 기타 간이 음식점업",
    "패스트푸드": "피자, 햄버거, 샌드위치 및 유사 음식점업",
    "통닭(치킨)": "치킨 전문점",
    "호프/통닭": "치킨 전문점",
    "제과점영업": "제과점업",
    "까페": "커피 전문점",
    "커피숍": "커피 전문점",
    "다방": "커피 전문점",
    "전통찻집": "커피 전문점",
    "뷔페식": "뷔페",
    "일반조리판매": "간이음식 포장 판매 전문점",
    "아이스크림": "간이음식 포장 판매 전문점",
    "과자점": "제과점업",
    "떡카페": "제과점업",
    "편의점": "체인화 편의점",
    "기타": "기타",
    "기타 휴게음식점": "기타",
    # 술이 중심이지만 밥도 파는 자리들. 칩으로는 "기타"에 묶인다.
    "감성주점": "기타",
    "정종/대포집/소주방": "기타",
    "라이브카페": "기타",
    # 시설 안에 딸린 매장. 상호로는 음식점이지만 카테고리로는 묶을 데가 없다.
    "백화점": "기타",
    "극장": "기타",
    "철도역구내": "기타",
}

# Not a place you walk into and eat lunch. Deliberately narrow.
#
# This list used to also hold 감성주점, 정종/대포집/소주방, 다방 and 라이브카페 --
# "drink-led, so not lunch". That was wrong, and the DB caught it: '다온' is
# licensed 감성주점 and is registered with 착한가격업소 serving 비빔밥, 김치찌개 and
# 된장찌개 at 8,000원. **The licence records what someone registered, not what they
# serve.** Excluding by 업태 alone re-creates exactly the too-narrow list this
# migration exists to undo, so only two kinds stay out: 유흥 that is unambiguous
# (룸살롱·간이주점), and anything with no fixed address to walk to.
#
# 호프/통닭 was never here either -- 1,007 rows, and the app already ships a
# 치킨 전문점 chip.
NON_LUNCH_BIZ_TYPES: frozenset[str] = frozenset({
    "룸살롱", "간이주점", "키즈카페",
    "이동조리", "출장조리", "푸드트럭",
    "식품소분업", "식품등 수입판매업",
})


def is_lunch_candidate(biz_type: str) -> bool:
    """False for 유흥·비고정 업태. '기타' passes: it is a real mixed bag."""
    return (biz_type or "").strip() not in NON_LUNCH_BIZ_TYPES


def map_category(biz_type: str) -> str:
    """업태구분명 -> our category. Unknown values pass through unchanged so a
    new 업태 shows up in reports instead of silently becoming '기타'."""
    return CATEGORY_MAP.get((biz_type or "").strip(), (biz_type or "").strip() or "기타")


def fetch_page(service: str, local_code: str, page: int,
               num_rows: int = MAX_ROWS_PER_REQUEST, *,
               api_key: str, status: str = STATUS_OPEN) -> dict:
    global REQUEST_COUNT
    if num_rows > MAX_ROWS_PER_REQUEST:
        raise ValueError(f"numOfRows caps at {MAX_ROWS_PER_REQUEST}, got {num_rows}")
    params = [
        ("serviceKey", api_key),
        ("pageNo", page),
        ("numOfRows", num_rows),
        ("resultType", "json"),
        ("cond[OPN_ATMY_GRP_CD::EQ]", local_code),
        ("cond[SALS_STTS_CD::EQ]", status),
    ]
    url = f"{BASE}/{service}/info?" + urllib.parse.urlencode(params)
    last_err: Exception | None = None
    for _ in range(MAX_RETRIES + 1):
        try:
            REQUEST_COUNT += 1
            res = requests.get(url, timeout=30)
            res.raise_for_status()
            return res.json()["response"]["body"]
        except (requests.RequestException, ValueError, KeyError) as e:
            last_err = e
            time.sleep(1)
    raise RuntimeError(
        f"permit fetch failed: service={service} local={local_code} page={page}"
    ) from last_err


def _items_of(body: dict) -> list[dict]:
    """The API collapses a single result to an object instead of a list."""
    items = (body.get("items") or {}).get("item")
    if items is None:
        return []
    return items if isinstance(items, list) else [items]


def normalize(row: dict) -> dict | None:
    """API row -> our shape. Returns None when the row has no usable coordinate;
    the caller must COUNT those rather than let them vanish."""
    x, y = row.get("CRD_INFO_X"), row.get("CRD_INFO_Y")
    if not x or not y:
        return None
    try:
        lat, lng = geo.epsg5174_to_wgs84(float(x), float(y))
    except (TypeError, ValueError):
        return None
    biz_type = (row.get("BZSTAT_SE_NM") or "").strip()
    return {
        "permit_no": (row.get("MNG_NO") or "").strip(),
        "name": (row.get("BPLC_NM") or "").strip(),
        "address": (row.get("ROAD_NM_ADDR") or row.get("LOTNO_ADDR") or "").strip(),
        "lotno_address": (row.get("LOTNO_ADDR") or "").strip(),
        "category": map_category(biz_type),
        "biz_type": biz_type,
        "phone": (row.get("TELNO") or "").strip(),
        "lat": lat,
        "lng": lng,
        "licensed_on": (row.get("LCPMT_YMD") or "").strip(),
        "updated_at": (row.get("DAT_UPDT_PNT") or "").strip(),
    }


def iter_places(service: str, local_code: str, *, api_key: str,
                delay_sec: float = 0.2) -> Iterator[dict]:
    """Yield every 영업중 place for one (service, district).

    Completeness is judged against the server's `totalCount`, the same contract
    zeropay.py uses. Rows dropped for a bad coordinate are reported, not hidden:
    a silently shrinking map is the failure mode this project has already paid
    for once.
    """
    page = 1
    received = 0
    dropped = 0
    total = 0
    seen: set[str] = set()
    while True:
        body = fetch_page(service, local_code, page, api_key=api_key)
        rows = _items_of(body)
        received += len(rows)
        total = int(body.get("totalCount") or 0)
        for row in rows:
            place = normalize(row)
            if place is None:
                dropped += 1
                continue
            key = place["permit_no"] or f"{place['name']}|{place['address']}"
            if key in seen:
                continue
            seen.add(key)
            yield place
        if not rows or received >= total:
            break
        page += 1
        time.sleep(delay_sec)

    if total and received < total:
        # 경고가 아니라 실패다. 이 API 는 이제 가게 목록의 유일한 출처이고,
        # collect.py 는 결과를 restaurants.json 에 **통째로 덮어쓴다** — 부분 수집을
        # 그냥 통과시키면 배포 산출물이 조용히 줄어든다. 위키가 "--limit 스모크
        # 테스트가 5,834곳을 19곳으로 덮어썼다"고 적어둔 바로 그 사고의 자동화판이다.
        raise IncompletePermitCrawl(
            f"service={service} local={local_code} expected={total} actual={received}")
    if dropped:
        print(f"[warn] {dropped} rows had no usable coordinate: "
              f"service={service} local={local_code}", flush=True)
