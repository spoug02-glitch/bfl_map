"""restaurants.json 이 아직 제로페이 가맹점인지 대조한다.

Usage:
  python verify_zeropay.py                  # dry-run. 이탈·신규만 보고한다
  python verify_zeropay.py --prune          # 이탈분을 restaurants.json 에서 뺀다
  python verify_zeropay.py --districts 도봉구 --codes 56111   # 부분 확인

collect.py 와 달리 **카카오를 부르지 않는다.** 제로페이만 다시 받아 대조하므로
전량 재수집(수 시간)과 달리 몇 분이면 끝나고, 주기적으로 돌릴 수 있다.

왜 필요한가 (2026-08-21):
"뚝섬오징어가 비플페이 안 되는데 지도에 있다"는 제보를 쫓다가, 성격이 다른 오염이
따로 있다는 걸 알았다. 그 가게는 지금도 제로페이 가맹점으로 등재돼 있어 코드로는
탐지할 수 없다(그건 /report 의 zeropay_fail 제보가 받는다). 반면 **제로페이 목록에서
이미 빠졌는데 우리 파일에만 남은 가게**가 5,834곳 중 51곳(0.87%) 있었다. 이쪽은
기계적으로 잡힌다. 이 스크립트가 그 일을 한다.

**--prune 은 모든 (구, 코드) 조합이 완전하게 받아졌을 때만 지운다.** 제로페이는
일시적으로 행을 누락한 적이 있고(zeropay.py 의 TOTAL_CNT 주석), 그 순간 자동 삭제하면
멀쩡한 가게가 날아간다. 하나라도 부족하면 아무것도 지우지 않고 리포트만 낸다.
"""
import argparse
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import brands
import kakao_local
import zeropay

OUT_PATH = Path(__file__).resolve().parent.parent / "web" / "public" / "restaurants.json"
REPORT_PATH = Path(__file__).resolve().parent / "zeropay-verify-report.json"
DISTRICTS = ["도봉구", "노원구", "강북구"]


@dataclass(frozen=True)
class Fetch:
    """한 (구, 업종코드) 요청의 완결성. received 를 기준으로 판단한다 — 원본에 완전
    중복 등록이 있어 unique 로 재면 그런 조합은 영원히 불완전으로 찍힌다."""
    gu: str
    code: str
    received: int
    total: int

    @property
    def complete(self) -> bool:
        return self.total == 0 or self.received >= self.total


@dataclass
class Diff:
    departed: list[dict] = field(default_factory=list)
    arrived: list[dict] = field(default_factory=list)
    unverifiable: int = 0


def key_of(name: str, address: str) -> tuple[str, str, str] | None:
    """대조용 키. 상호는 표기 노이즈를 걷고, 주소는 도로명+건물번호만 쓴다.

    출처마다 "맑 음 이 네" / "맑음이네", "노해로69길 21-11" / "노해로 69길21-11"
    처럼 갈리므로 문자열 완전일치로는 멀쩡한 가게가 이탈로 잡힌다.

    도로명을 못 읽으면 None 이다. **"확인 불가"를 "아무거나 통과"로 바꾸지 않는다** —
    호출부가 이걸 이탈로 세면 지번·건물명 주소를 쓰는 가게가 통째로 지워진다.
    """
    core = kakao_local._address_core(address)
    if core is None:
        return None
    road, number = core
    return brands.normalize(name), road, number


def key_of_row(row: dict) -> tuple[str, str, str] | None:
    """restaurants.json 한 행의 대조 키.

    `name` 은 **카카오 표기**다. 제로페이 상호와 다르면 collect.py 가 원래 이름을
    `zeropay_name` 에 남겨두므로 그쪽을 우선한다. 이 구분을 놓치면 이름이 다르게
    적힌 2,541곳이 전부 이탈로 잡힌다 — 2026-08-21 에 1,749곳으로 한 번 겪었다.
    `address` 는 처음부터 제로페이 것이라 그대로 쓴다.
    """
    return key_of(row.get("zeropay_name") or row["name"], row["address"])


def diff(ours: list[dict], live: list[dict]) -> Diff:
    """우리 파일과 제로페이 라이브 목록을 양방향으로 대조한다."""
    live_keys = {k for m in live if (k := key_of(m["name"], m["address"])) is not None}
    out = Diff()
    ours_keys: set[tuple[str, str, str]] = set()

    for row in ours:
        k = key_of_row(row)
        if k is None:
            out.unverifiable += 1
            continue
        ours_keys.add(k)
        if k not in live_keys:
            out.departed.append(row)

    for m in live:
        k = key_of(m["name"], m["address"])
        if k is not None and k not in ours_keys:
            out.arrived.append(m)
    return out


def prune_allowed(fetches: list[Fetch]) -> tuple[bool, str]:
    """제로페이를 온전히 다 받아왔을 때만 삭제를 허락한다."""
    if not fetches:
        return False, "제로페이에서 한 건도 받지 못했다"
    short = [f for f in fetches if not f.complete]
    if short:
        detail = ", ".join(f"{f.gu}/{f.code} {f.received}/{f.total}" for f in short[:5])
        return False, f"불완전한 조합 {len(short)}개: {detail}"
    return True, ""


def prune(path: Path, place_ids: set[str]) -> int:
    """restaurants.json 에서 주어진 place_id 행만 뺀다. 지울 게 없으면 파일을
    아예 건드리지 않는다 — 재작성하면 줄바꿈·인코딩이 조용히 바뀔 수 있다."""
    if not place_ids:
        return 0
    rows = json.loads(path.read_text(encoding="utf-8"))
    left = [r for r in rows if r.get("kakao_place_id") not in place_ids]
    removed = len(rows) - len(left)
    path.write_text(json.dumps(left, ensure_ascii=False, indent=1), encoding="utf-8")
    return removed


def fetch_live(districts: list[str], codes: dict[str, str],
               delay_sec: float) -> tuple[list[dict], list[Fetch]]:
    live: list[dict] = []
    fetches: list[Fetch] = []
    for gu in districts:
        for code in codes:
            rows, received, total = zeropay._fetch_all_pages(gu, code, delay_sec, 1000)
            live.extend(rows)
            fetches.append(Fetch(gu, code, received, total))
            print(f"  {gu} {code} {codes[code]}: {received}/{total}", flush=True)
    return live, fetches


def main() -> None:
    all_codes = {**zeropay.FOOD_CODES, **zeropay.CONVENIENCE_CODES}
    ap = argparse.ArgumentParser()
    ap.add_argument("--districts", default=",".join(DISTRICTS))
    ap.add_argument("--codes", default=",".join(all_codes))
    ap.add_argument("--delay", type=float, default=0.3)
    ap.add_argument("--prune", action="store_true",
                    help="이탈분을 restaurants.json 에서 제거한다 (기본은 보고만)")
    args = ap.parse_args()

    districts = [d for d in args.districts.split(",") if d]
    codes = {c: all_codes.get(c, c) for c in args.codes.split(",") if c}

    print(f"제로페이 조회: {len(districts)}개 구 x {len(codes)}개 코드")
    live, fetches = fetch_live(districts, codes, args.delay)

    ours = json.loads(OUT_PATH.read_text(encoding="utf-8"))
    d = diff(ours, live)

    print(f"\n우리 파일 {len(ours)}곳 / 제로페이 라이브 {len(live)}곳")
    print(f"이탈(제로페이에 없음): {len(d.departed)}곳")
    # 이 숫자는 상한이고, 실제로 들어오는 건 그중 아주 일부다.
    #
    # 2026-08-21 실측: 상한 1,592 곳으로 재수집을 돌렸더니 순증은 44 곳이었다.
    # 차이의 대부분은 반경이 아니라 **카카오 매칭 실패**다 —
    # 매칭 실패 1,469 / 반경 밖 67. 제로페이 상호·주소로 카카오에서 같은 가게를
    # 찾지 못하면 좌표가 없어 지도에 올릴 수가 없다.
    # (반경이 주된 이유일 거라고 처음엔 적어뒀는데, 재수집이 그걸 반증했다.)
    print(f"신규 후보(우리 파일에 없음): {len(d.arrived)}곳 "
          f"— 상한이다. 실제 순증은 훨씬 적다(2026-08-21: 1,592 → 순증 44)")
    if d.unverifiable:
        print(f"주소를 못 읽어 대조 못 함: {d.unverifiable}곳 (이탈로 세지 않았다)")

    for r in d.departed[:20]:
        print(f"  - {r['name']} ({r['address']})")
    if len(d.departed) > 20:
        print(f"  ... 외 {len(d.departed) - 20}곳")

    REPORT_PATH.write_text(json.dumps({
        "checked_at": datetime.now(timezone.utc).isoformat(),
        "districts": districts,
        "codes": list(codes),
        "ours": len(ours),
        "live": len(live),
        "unverifiable": d.unverifiable,
        "departed": [{"name": r["name"], "address": r["address"],
                      "kakao_place_id": r["kakao_place_id"]} for r in d.departed],
        # 상한이다 — 5km 반경 밖이 섞여 있다. 위 print 의 주석 참고.
        "arrived_upper_bound": [{"name": m["name"], "address": m["address"]} for m in d.arrived],
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n리포트: {REPORT_PATH}")

    if not args.prune:
        # 신규는 이 스크립트가 못 들여온다. 좌표·place_id 가 필요해 카카오를 불러야 하고,
        # 그건 collect.py 의 일이다. 여기서는 재수집이 값어치가 있는지만 재 준다.
        if d.arrived:
            print(f"신규 후보를 실제로 들이려면 collect.py 로 재수집해야 한다 "
                  f"(카카오로 좌표를 붙이고 반경 밖을 걸러낸다).")
        print("삭제하려면 --prune 을 붙일 것.")
        return

    ok, reason = prune_allowed(fetches)
    if not ok:
        print(f"\n[중단] 제로페이를 온전히 받지 못해 삭제하지 않는다: {reason}")
        print("일시적 누락일 수 있다. 다시 돌려볼 것.")
        raise SystemExit(2)

    removed = prune(OUT_PATH, {r["kakao_place_id"] for r in d.departed})
    print(f"\n{removed}곳을 restaurants.json 에서 뺐다.")


if __name__ == "__main__":
    main()
