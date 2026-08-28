"""Build web/public/restaurants.json from 인허가 permit data + a zeropay flag.

Usage:
  python collect.py                     # full run (3 districts, 2 services)
  python collect.py --districts 도봉구   # subset
  python collect.py --skip-zeropay      # permit only; every zeropay flag False

What changed, and why the old machinery is gone:

The list used to come from zeropay, which meant every merchant needed a Kakao
lookup to get coordinates. That was hours of API calls, so this file grew a
checkpoint/resume log, an unresolved.json and an out_of_radius.json. The permit
API carries its own coordinates, so a whole run is now about three minutes and
none of that is needed. Kakao is not called here at all any more.

Place identity is the permit 관리번호 (`place_id`), not a Kakao id. Kakao ids
survive as an optional field for map links, restored from legacy-kakao-map.json
for the places we already knew; new places simply have none.

**Zeropay no longer decides who is on the map.** It sets a flag. A place zeropay
has never heard of stays listed with `zeropay: false` instead of disappearing,
which is the entire point of the switch.
"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

import brands
import geo
import permit_data
import zeropay
import zeropay_flag

CENTER_LAT, CENTER_LNG = 37.6545, 127.0499  # 창동씨드큐브
HERE = Path(__file__).resolve().parent
OUT_PATH = HERE.parent / "web" / "public" / "restaurants.json"
LEGACY_KAKAO_PATH = HERE / "legacy-kakao-map.json"
UNFLAGGED_PATH = HERE / "zeropay-unmatched.json"
HISTORY_PATH = HERE.parent / "web" / "collector-runs.json"


def load_legacy_kakao(path: Path = LEGACY_KAKAO_PATH) -> dict[str, dict]:
    """permit 관리번호 -> {kakao_place_id, kakao_url} for places we knew before.

    Purely additive: a missing entry costs a Kakao deep link and nothing else.
    Delete this file, and this function, once nothing needs Kakao ids.
    """
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        print(f"[legacy] ignoring unreadable {path.name}: {e}", flush=True)
        return {}


def build_rows(places, zeropay_ids: set[str], legacy: dict[str, dict]) -> list[dict]:
    """Permit places -> restaurants.json rows, nearest first.

    No radius filter. The old 5km circle around the office was an artefact of
    zeropay being nationwide; the permit pull is already bounded by district,
    and clipping it again produced a map that looked empty rather than one
    that was honest about where our data stops.
    """
    rows: list[dict] = []
    for place in places:
        # 유흥·비고정 업태는 여기서 뺀다. 넓게 담자는 것이 감성주점과 다방까지
        # 점심 지도에 올리자는 뜻은 아니다 → permit_data.NON_LUNCH_BIZ_TYPES
        if not permit_data.is_lunch_candidate(place["biz_type"]):
            continue
        row = {
            "place_id": place["permit_no"],
            "name": place["name"],
            "search_keys": brands.search_keys(place["name"]),
            "address": place["address"],
            "category": place["category"],
            "biz_type": place["biz_type"],
            "phone": place["phone"],
            "lat": place["lat"],
            "lng": place["lng"],
            "distance_km": round(
                geo.haversine_km(CENTER_LAT, CENTER_LNG, place["lat"], place["lng"]), 2
            ),
            "zeropay": place["permit_no"] in zeropay_ids,
        }
        row.update(legacy.get(place["permit_no"], {}))
        rows.append(row)
    rows.sort(key=lambda r: r["distance_km"])
    return rows


def dedupe_by_place_id(rows: list[dict]) -> tuple[list[dict], int]:
    """One physical restaurant, one pin. 관리번호 is unique in the source, so this
    only catches a repeat introduced here. It stays as a guard; it is cheap."""
    seen: set[str] = set()
    out: list[dict] = []
    for r in rows:
        if r["place_id"] in seen:
            continue
        seen.add(r["place_id"])
        out.append(r)
    return out, len(rows) - len(out)


def _append_run_history(path: Path, record: dict) -> None:
    """실행 요약 한 건을 JSON 배열에 append한다.

    데이터 수집이 이력 기록보다 중요하다 — 쓰기 실패(권한 등)로 수집 결과를
    날릴 수는 없으므로 예외를 삼키고 경고만 남긴다.
    """
    try:
        history = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        if not isinstance(history, list):
            history = []
        history.append(record)
        path.write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding="utf-8")
    except (OSError, json.JSONDecodeError) as e:
        print(f"[history] failed to record run history: {e}", flush=True)


def _read_api_key() -> str:
    load_dotenv(HERE / ".env")
    key = os.environ.get("PUBLIC_DATA_API_KEY")
    if not key:
        raise SystemExit(
            "PUBLIC_DATA_API_KEY is not set. Put it in collector/.env — "
            "a worktree does not inherit one, so copy it in."
        )
    return key


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    started_at = datetime.now(timezone.utc).isoformat()
    ap = argparse.ArgumentParser()
    ap.add_argument("--districts", default=",".join(permit_data.DISTRICTS))
    ap.add_argument("--skip-zeropay", action="store_true",
                    help="permit data only. 모든 zeropay 가 False 로 나가므로 "
                         "개발용이지 배포용이 아니다")
    args = ap.parse_args()
    districts = [d.strip() for d in args.districts.split(",") if d.strip()]
    api_key = _read_api_key()

    places: list[dict] = []
    for service, label in permit_data.SERVICES.items():
        for gu in districts:
            try:
                got = list(permit_data.iter_places(
                    service, permit_data.DISTRICTS[gu], api_key=api_key))
            except permit_data.IncompletePermitCrawl as e:
                # 여기서 죽는 것이 restaurants.json 을 줄어든 목록으로 덮는 것보다 낫다.
                # 기존 파일은 손대지 않은 채 남는다.
                raise SystemExit(
                    f"[중단] 인허가 API 가 온전히 응답하지 않았다: {e}\n"
                    "restaurants.json 은 건드리지 않았다. 잠시 뒤 다시 돌릴 것.") from e
            print(f"[permit] {label} / {gu}: {len(got):,}")
            places += got
    print(f"[permit] total: {len(places):,} ({permit_data.REQUEST_COUNT} requests)")

    zeropay_ids: set[str] = set()
    unmatched: list[dict] = []
    if not args.skip_zeropay:
        merchants: list[dict] = []
        codes = {**zeropay.FOOD_CODES, **zeropay.CONVENIENCE_CODES}
        for gu in districts:
            for code in codes:
                try:
                    merchants += list(zeropay.iter_all_merchants(gu, code))
                except zeropay.IncompleteZeropayCrawl as e:
                    # 인허가 쪽과 같은 이유로 여기서 죽는다. 덜 받아온 명부로
                    # 플래그를 매기면 비플페이 되는 집이 "안 된다"고 나간다.
                    raise SystemExit(
                        f"[중단] 제로페이가 온전히 응답하지 않았다: {e}\n"
                        "restaurants.json 은 건드리지 않았다. 잠시 뒤 다시 돌릴 것.\n"
                        "플래그 없이 목록만 갱신할 거면 --skip-zeropay 를 쓸 것 "
                        "(그 경우 모든 zeropay 가 false 로 나가므로 배포하면 안 된다).") from e
        print(f"[zeropay] merchants: {len(merchants):,}")
        zeropay_ids, unmatched = zeropay_flag.flag(places, merchants)
        print(f"[zeropay] flagged {len(zeropay_ids):,} places; "
              f"{len(unmatched):,} merchants could not be placed")

    rows = build_rows(places, zeropay_ids, load_legacy_kakao())
    rows, merged = dedupe_by_place_id(rows)
    if merged:
        print(f"[done] merged {merged} duplicate 관리번호 row(s)", flush=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    UNFLAGGED_PATH.write_text(json.dumps(unmatched, ensure_ascii=False, indent=1),
                              encoding="utf-8")
    flagged = sum(1 for r in rows if r["zeropay"])
    with_kakao = sum(1 for r in rows if r.get("kakao_place_id"))
    print(f"[done] places: {len(rows):,} -> {OUT_PATH}")
    print(f"[done] zeropay flagged: {flagged:,} ({flagged / len(rows) * 100:.1f}%)")
    print(f"[done] with a kakao id: {with_kakao:,}")
    print(f"[done] zeropay merchants not placed: {len(unmatched):,} -> {UNFLAGGED_PATH}")

    _append_run_history(HISTORY_PATH, {
        "startedAt": started_at,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "source": "permit",
        "districts": districts,
        "services": list(permit_data.SERVICES),
        "places": len(rows),
        "zeropayFlagged": flagged,
        "zeropayUnmatched": len(unmatched),
        # 플래그가 실제로 매겨졌는지. --skip-zeropay 로 만든 산출물을 나중에
        # "제로페이 되는 집이 하나도 없네"로 오해하지 않게 이력에 남긴다.
        "zeropayChecked": not args.skip_zeropay,
        "apiRequests": permit_data.REQUEST_COUNT,
    })


if __name__ == "__main__":
    main()
