"""zeropay.or.kr merchant search crawler (public .jct endpoint, no auth)."""
import json
import time
import urllib.parse
from typing import Iterator

import requests

ENDPOINT = "https://www.zeropay.or.kr/UI_HP_009_03.jct"
HEADERS = {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    "Referer": "https://www.zeropay.or.kr/UI_HP_009_03.act",
}

# Category codes VERIFIED against the zeropay DB via UI_HP_003_01_02_getBizType.jct.
# WARNING: the site's dropdown shows 56191/56192/56193/56194 for bakery/pizza/chicken/kimbap
# but those return 0 rows — the DB actually uses 56150/56161/56162/56191. Do not "fix" back.
FOOD_CODES: dict[str, str] = {
    "56111": "한식 일반 음식점업",
    "56113": "한식 육류요리 전문점",
    "56121": "중식 음식점업",
    "56122": "일식 음식점업",
    "56123": "서양식 음식점업",
    "56150": "제과점업",
    "56161": "피자, 햄버거, 샌드위치 및 유사 음식점업",
    "56162": "치킨 전문점",
    "56191": "김밥 및 기타 간이 음식점업",
    "56199": "간이음식 포장 판매 전문점",
    "56213": "생맥주 전문점",
    "56219": "기타 주점업",
    "56221": "커피 전문점",
}

# Included in the map as a separate chip; menu fetch is skipped for these.
CONVENIENCE_CODES: dict[str, str] = {
    "47122": "체인화 편의점",
}

MAX_RETRIES = 2


def _build_body(gu: str, biz_type_cd: str, page: int, page_size: int) -> str:
    payload = {
        "AFLT_ADDR_CITY": "서울특별시",
        "AFLT_ADDR_CITY_SIMPLE": "서울",
        "AFLT_ADDR_GU": gu,
        "AFLT_NM": "",
        "AFLT_ROAD_ADDR": "",
        "BIZ_TYPE_CD": biz_type_cd,
        "PAGE_NUM": str(page),
        "PAGE_SIZE": str(page_size),
        "TRX_TP": "01",
    }
    # server expects the JSON double URL-encoded
    once = urllib.parse.quote(json.dumps(payload, ensure_ascii=False), safe="")
    twice = urllib.parse.quote(once, safe="")
    return f"_JSON_={twice}"


def fetch_merchants(gu: str, biz_type_cd: str, page: int, page_size: int = 100) -> dict:
    body = _build_body(gu, biz_type_cd, page, page_size)
    last_err: Exception | None = None
    for _ in range(MAX_RETRIES + 1):
        try:
            res = requests.post(ENDPOINT, data=body.encode(), headers=HEADERS, timeout=15)
            res.raise_for_status()
            return res.json()
        except (requests.RequestException, ValueError) as e:
            last_err = e
            time.sleep(1)
    raise RuntimeError(f"zeropay fetch failed: gu={gu} code={biz_type_cd} page={page}") from last_err


def iter_all_merchants(gu: str, biz_type_cd: str, delay_sec: float = 0.3, page_size: int = 100) -> Iterator[dict]:
    page = 1
    seen = 0
    while True:
        data = fetch_merchants(gu, biz_type_cd, page, page_size)
        rows = data.get("LIST2") or []
        for r in rows:
            yield {
                "name": (r.get("AFLT_NM") or "").strip(),
                "address": (r.get("AFLT_ROAD_ADDR") or "").strip(),
                "category": (r.get("BIZ_TYPE") or "").strip(),
                "phone": (r.get("SHOP_TEL_NO") or "").strip(),
            }
        seen += len(rows)
        total = int(data.get("TOTAL_CNT") or 0)
        if not rows or seen >= total:
            break
        page += 1
        time.sleep(delay_sec)
