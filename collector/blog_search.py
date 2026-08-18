"""네이버 블로그 검색으로 가게별 후기 링크를 모은다 -> web/public/blog_links.json

    python blog_search.py                      # 전체
    python blog_search.py --limit 30           # 맛보기
    python blog_search.py --resume             # 중단 지점부터

카카오 메뉴 수집을 접은 뒤 5,783곳에 아무 정보도 안 남았다. 여기서 모으는 건
**링크뿐이다** — 제목과 주소만 저장하고 본문은 가져오지도 저장하지도 않는다.
메뉴와 가격은 출처가 분명한 것만 menu_items 에 들어간다.

만든 이가 직접 쓴 후기는 obanaeodzb_blog_links.json 에 따로 있다. 그건 손으로
관리하는 파일이라 이 스크립트가 건드리지 않는다.

## 왜 필터가 필요한가

가게 이름으로 그냥 검색하면 상위 결과 상당수가 후기가 아니라 **가맹점 명단을
통째로 덤프한 SEO 스팸**이다. "화성시 지역화폐 가맹점 알아보기", "전국 로또
판매점 주소록" 같은 글에 가게 이름이 목록의 한 줄로 들어 있어서 걸린다.

**제목에 가게 이름이 있을 것** 하나로 대부분 걸러진다. 창동 600m 밥집 20곳
표본에서 20곳 모두 결과가 있었지만, 이 조건을 통과한 건 14곳(70%)이었고
탈락한 6곳은 전부 위와 같은 명단 글이었다.

그 위에 두 가지를 더 본다(looks_like_same_shop). 제목이 다른 지역만 가리키면
동명의 다른 가게이고, 짧은 상호는 흔한 낱말과 겹친다. 수집된 783건에 적용해
17건이 빠졌는데 전수 확인 결과 17건 모두 오탐이었다.

## 실측 (2026-08-17, 5,109곳 전체)

- 링크가 붙은 곳 530곳(10%). 회사 300m 안으로 좁히면 50/94곳(53%)이다 —
  멀어질수록 후기 자체가 없다.
- 링크 766건, 파일 136KB.

## 남는 오차

- **미탐**: 제목에 상호 대신 메뉴를 쓴 글. "[마장동 숯불구이] 창동역 앞 안창살…"
  은 맞는 글인데 상호가 제목에 없어 탈락한다.
- **오탐**: 우리 권역 안의 동명 다른 지점. 지역 조건으로는 못 가른다.

잘못된 링크 하나가 없는 링크보다 나쁘므로 좁게 잡았다.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://openapi.naver.com/v1/search/blog.json"
OUT_PATH = Path(__file__).resolve().parent.parent / "web" / "public" / "blog_links.json"
PLACES_PATH = Path(__file__).resolve().parent.parent / "web" / "public" / "restaurants.json"
CHECKPOINT = Path(__file__).resolve().parent / "blog_search_checkpoint.jsonl"

# 한 가게에 몇 개까지. 이 파일은 인증 없이 통째로 내려가므로 늘리면 그대로 용량이 된다.
KEEP_PER_PLACE = 2
# 검색어에 붙이는 지역. 상호만으로 검색하면 전국의 동명 가게가 섞인다.
AREA = "창동"

# 우리 권역. 제목에 이게 있으면 같은 가게일 가능성이 크게 올라간다.
LOCAL = ("창동", "도봉", "노원", "쌍문", "방학", "상계", "월계", "녹천",
         "수유", "미아", "공릉", "중계", "하계", "씨드큐브", "마들")

# 우리 권역이 아닌 지명. 제목이 이쪽만 가리키면 동명의 다른 가게다.
OTHER = ("창원", "마산", "부산", "대구", "광주", "대전", "울산", "제주", "인천",
         "수원", "성남", "용인", "전주", "청주", "강남", "홍대", "건대", "신촌",
         "이태원", "성수", "연남", "외대앞", "잠실", "송파", "분당", "일산", "판교")

# 이 길이 이하의 상호는 흔한 낱말과 겹친다("미자", "행운", "주장"). 지역이 받쳐줘야 받는다.
SHORT_NAME_LEN = 2


def strip_tags(s: str) -> str:
    """네이버는 검색어와 일치하는 부분을 <b>로 감싸 준다. 엔티티도 함께 푼다."""
    s = re.sub(r"<[^>]+>", "", s)
    for a, b in (("&amp;", "&"), ("&quot;", '"'), ("&lt;", "<"), ("&gt;", ">"), ("&#39;", "'")):
        s = s.replace(a, b)
    return s.strip()


def normalize(s: str) -> str:
    return re.sub(r"[\s()]", "", s)


def title_mentions(shop_name: str, title: str) -> bool:
    """제목에 상호가 있는가. 스팸 명단 글을 걸러내는 1차 관문이다."""
    return normalize(shop_name) in normalize(title)


def looks_like_same_shop(shop_name: str, title: str) -> bool:
    """상호가 제목에 있는 글이 정말 이 가게인가. 두 가지를 더 본다.

    실측(2026-08-17, 수집된 783건 기준)으로 정한 규칙이다. 이 둘을 적용하면
    17건이 빠지는데 전수 확인 결과 17건 모두 오탐이었다 — 손실 없이 정확도만 오른다.

    1. 제목이 **다른 지역만** 가리키면 동명의 다른 가게다. "창원 마산 …
       미스테이크", "대전 송촌동 … 포대포", "성남 금광동 치킨 맛집 맥켄치킨".
    2. **짧은 상호**는 흔한 낱말과 겹친다. 지역이 받쳐주지 않으면 버린다 —
       "미자"가 "오지산행후기 … 미자사냥"을, "주장"이 "주장하는 글쓰기"를,
       "행운"이 "토스행운의 퀴즈"를 물었다.

    길이만으로 자르면 안 된다. 2자 상호 78건 중 대부분이 "창동역 … 긱",
    "쌍문역 카페 소녹"처럼 정확한 글이었다 — 지역 조건이 그걸 살린다.
    """
    has_local = any(t in title for t in LOCAL)
    if any(t in title for t in OTHER) and not has_local:
        return False
    if len(normalize(shop_name)) <= SHORT_NAME_LEN and not has_local:
        return False
    return True


def search(name: str, headers: dict, display: int = 5) -> list[dict]:
    q = urllib.parse.quote(f"{AREA} {name}")
    req = urllib.request.Request(f"{API}?query={q}&display={display}&sort=sim", headers=headers)
    with urllib.request.urlopen(req, timeout=10) as res:
        return json.load(res).get("items") or []


def pick(name: str, items: list[dict]) -> list[dict]:
    out = []
    for it in items:
        title = strip_tags(it.get("title", ""))
        if not title_mentions(name, title) or not looks_like_same_shop(name, title):
            continue
        out.append({"url": it.get("link", ""), "title": title})
        if len(out) >= KEEP_PER_PLACE:
            break
    return out


def load_credentials() -> dict:
    cid = os.environ.get("NAVER_SEARCH_CLIENT_ID")
    csec = os.environ.get("NAVER_SEARCH_CLIENT_SECRET")
    if not (cid and csec):
        sys.exit(
            "NAVER_SEARCH_CLIENT_ID / NAVER_SEARCH_CLIENT_SECRET 이 필요합니다.\n"
            "데이터랩용 키(NAVER_CLIENT_ID)와 다른 값입니다 — 검색 API 키를 쓰세요."
        )
    return {"X-Naver-Client-Id": cid, "X-Naver-Client-Secret": csec}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="앞에서 N곳만")
    ap.add_argument("--resume", action="store_true", help="체크포인트부터 이어서")
    ap.add_argument("--delay", type=float, default=0.12, help="호출 간 간격(초)")
    args = ap.parse_args()

    headers = load_credentials()
    places = json.loads(PLACES_PATH.read_text(encoding="utf-8"))
    # 편의점은 후기를 찾을 대상이 아니다 — 메뉴 수집에서 뺐던 것과 같은 이유다.
    targets = [p for p in places if p["category"] != "체인화 편의점"]
    if args.limit:
        targets = targets[: args.limit]

    done: dict[str, list] = {}
    if args.resume and CHECKPOINT.exists():
        for line in CHECKPOINT.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            rec = json.loads(line)
            done[rec["id"]] = rec["links"]
        print(f"[resume] {len(done)}곳 건너뜀", flush=True)

    found = 0
    with CHECKPOINT.open("a", encoding="utf-8") as cp:
        for i, p in enumerate(targets, 1):
            pid = p["kakao_place_id"]
            if pid in done:
                continue
            try:
                links = pick(p["name"], search(p["name"], headers))
            except Exception as e:
                # 한 건 실패로 전체를 버리지 않는다. 재실행하면 이 가게만 다시 시도한다.
                print(f"  ! {p['name']}: {e}", flush=True)
                time.sleep(1.0)
                continue
            done[pid] = links
            if links:
                found += 1
            cp.write(json.dumps({"id": pid, "links": links}, ensure_ascii=False) + "\n")
            cp.flush()
            if i % 100 == 0:
                print(f"[{i}/{len(targets)}] 링크 있는 곳 {found}", flush=True)
            time.sleep(args.delay)

    out = {
        "_comment": (
            "네이버 블로그 검색으로 모은 제3자 후기 링크. collector/blog_search.py 가 만든다. "
            "제목·주소만 담고 본문은 저장하지 않는다. 제목에 상호가 든 글만 남긴다 — "
            "그 조건이 없으면 가맹점 명단을 덤프한 스팸 글이 대부분을 차지한다. "
            "만든 이가 직접 쓴 후기는 obanaeodzb_blog_links.json 에 따로 있다."
        )
    }
    out.update({k: v for k, v in done.items() if v})
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    kept = len(out) - 1
    print(f"[done] {kept}곳 / {len(targets)}곳 에 링크 -> {OUT_PATH}")
    print(f"       파일 크기 {OUT_PATH.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
