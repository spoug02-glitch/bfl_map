# 어드민: 크롤링 실행 이력 조회

2026-08-14

## 왜

`collector/collect.py`는 몇 시간짜리 로컬 배치라 실행 이력이 전혀 남지 않는다 — 터미널
로그가 끝나면 그걸로 끝이고, 언제 몇 곳을 수집했는지, unresolved/out_of_radius가 얼마나
됐는지는 그 순간 터미널을 보고 있던 사람만 안다. 어드민에서 지난 실행들을 조회할 수 있게
한다.

## 범위

- 실행 요약(시각·범위·건수)을 남기고 어드민에서 목록으로 본다.
- 원격 트리거, unresolved/out_of_radius 상세 목록, `brands.py` 설정 편집은 이번 범위 밖.

## 배포 구조상 제약

Vercel 배포는 `Bfl_map/web/` 서브트리만 분리해서 올라간다(`git subtree split
--prefix=Bfl_map/web`). `collector/`는 배포 결과물에 아예 없다 — 그래서 이력 파일은
**`web/` 안**에 있어야 어드민 API가 읽을 수 있다. `collect.py`가 이미
`web/public/restaurants.json`에 쓰는 전례가 있으니 그 패턴을 그대로 쓴다. 단, 지금
막 `restaurants.json`이 완전 공개 정적 파일이라 스크레이핑 문제가 됐던 걸 다뤘으므로,
이력 파일은 `public/`이 아니라 `web/collector-runs.json`(비공개 경로, 서버 코드만
읽음)에 둔다.

## 데이터

`Bfl_map/web/collector-runs.json` — JSON 배열, 실행마다 한 항목을 append. 존재하지
않으면 빈 배열로 취급한다.

```json
[
  {
    "startedAt": "2026-08-14T02:10:00.000Z",
    "finishedAt": "2026-08-14T05:42:11.000Z",
    "districts": ["도봉구", "노원구", "강북구"],
    "codes": ["56191", "56221"],
    "crawled": 6122,
    "matched": 5834,
    "unresolved": 180,
    "outOfRadius": 90,
    "duplicates": 18
  }
]
```

- 이미 `collect.py`가 끝에 출력하는 요약 줄(`[done] crawled=... matched=... unresolved=...
  out_of_radius=... duplicates=...`)과 같은 숫자를 그대로 쓴다 — 새로 계산하지 않는다.
- `--limit`/`--skip-menus` 같은 스모크 테스트 실행도 그대로 한 항목으로 남는다(구분 플래그
  없음) — 실제로는 항상 전체 실행만 하므로 구분할 필요가 없다.
- 파일 쓰기 실패(권한 등)는 실행 자체를 실패시키지 않는다 — 데이터 수집이 이력 기록보다
  중요하다. 실패하면 stderr에 경고만 남기고 계속한다.

## `collect.py` 변경

`main()` 끝, 기존 `[done]` 요약 출력 직후에 이력 항목을 append한다. 실행 시작 시각은
`main()` 진입 시 기록해 둔다. `HISTORY_PATH = Path(__file__).resolve().parent.parent /
"web" / "collector-runs.json"`.

## API

`GET /api/admin/crawl-runs` — `requireAdmin` 가드(운영자 등급 무관, 기존 `/api/admin/stats`와
동일한 접근 정책). `web/collector-runs.json`을 읽어 최신순으로 정렬해 반환. 파일이 없으면
`{ runs: [] }`.

## 화면

기존 `/admin` 대시보드에 새 섹션 "크롤링 이력"을 추가한다(새 페이지 아님 — 목록 하나뿐이라
별도 라우트를 만들 규모가 아니다). DAU/WAU/MAU 카드 아래, 유저 검색 위나 아래에 표 형태로:
실행 시각(시작~종료), 지역, 수집/매칭/미해결/반경밖/중복 건수. 최근 20건만 보여준다(파일이
무한히 커지는 걸 막기 위한 표시 제한이지, 파일 자체를 자르지는 않는다 — 파일 크기 관리는
이번 범위 밖).

## 테스트

- `collector/tests/test_collect.py`: `main()`이 `collector-runs.json`에 올바른 형태의 항목을
  append하는지, 파일이 이미 있을 때 기존 항목을 보존하며 append하는지, 쓰기 실패 시에도
  실행이 죽지 않는지.
- `web/__tests__/admin-crawl-runs-route.test.ts`: 인증 가드, 파일 없을 때 빈 배열, 파일 있을
  때 최신순 정렬.
- 어드민 대시보드 섹션은 기존 Task 15 패턴(fetch + 렌더)이라 별도 자동 테스트 없이 `tsc`/전체
  스위트로 충분하다(기존 계획의 관례를 따름).
