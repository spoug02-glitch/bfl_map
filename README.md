# 직장인 맛창고

창동씨드큐브 반경 5km 안에서 **비플페이(제로페이 가맹점)로 결제 가능한** 음식점·카페·편의점
6,122곳을 지도로 보여주고, 짧은 리뷰를 남길 수 있는 웹앱.

## 구조

```
collector/   데이터 수집 (Python). 재실행하면 전체 갱신
web/         Next.js 앱 (Vercel 배포)
mcp/         Claude용 MCP 서버 (로컬)
design/      Stitch/Figma 디자인 프롬프트
```

세 컴포넌트는 `web/public/restaurants.json` 하나로만 결합한다. 수집기는 웹앱을 모르고,
웹앱과 MCP는 수집기를 모른다.

## 데이터 갱신

```bash
cd collector && python collect.py        # 전체 (수 시간)
```

- 중간에 끊겨도 `.checkpoint.jsonl`에서 이어서 재개된다. 처음부터 다시 하려면 `--fresh`
- 끝나면 `crawled = matched + unresolved + out_of_radius + duplicates` 정합성 줄이 출력된다
  (재개 실행에서는 복원분을 중복으로 세므로 균형이 맞지 않는다 — 출력에 그 사실이 표시된다)
- `web/public/restaurants.json` 변경을 커밋 → push → Vercel 자동 재배포

## 로컬 실행

```bash
cd web && npm install && npm run dev     # http://localhost:3000
```

`web/.env.local`이 필요하다. `web/.env.example` 참조.

## 환경변수

| 이름 | 용도 |
|---|---|
| `NEXT_PUBLIC_KAKAO_JS_KEY` | 지도 렌더링 + 카톡 공유. **REST 키가 아니라 JavaScript 키** |
| `KAKAO_REST_API_KEY` | 카카오 로그인. 카카오는 REST API 키를 `client_id`로 쓴다 |
| `KAKAO_CLIENT_SECRET` | 카카오 앱에서 클라이언트 시크릿을 켠 경우에만. 켜 두고 안 넣으면 토큰 교환이 401 |
| `SESSION_SECRET` | 세션 JWT 서명. 32자 이상 |
| `DATABASE_URL` | Neon Postgres. 리뷰와 방문 집계 저장 |
| `NEXT_PUBLIC_BASE_URL` | 배포 도메인. OAuth 리다이렉트와 공유 링크에 쓰인다 |
| `ADMIN_USER_ID` | (선택) `/api/stats`를 읽을 수 있는 계정의 네임스페이스 id (`kakao:5678`). 비어 있으면 그 엔드포인트는 404 |

`collector/.env`에는 `KAKAO_REST_API_KEY`만 둔다.

## 콘솔 설정 체크리스트

**카카오** — 로그인 수단은 카카오 하나뿐이다. 구글 로그인은 제거했다: 한 사람이 계정을 두 개
갖게 되면 같은 가게에 리뷰를 두 번 남겨 평점을 밀 수 있기 때문이다.

설정이 세 군데로 나뉘어 있고 서로 다른 목록이다. 하나만 채우면 다른 쪽이 조용히 실패한다.

- **[앱] > [플랫폼 키] > [JavaScript 키] > [JS SDK 도메인]** — 지도와 카톡 공유가 이걸 본다.
  키를 발급한 앱과 도메인을 등록한 앱이 다르면 `domain mismatched` 401이 난다.
- **[앱] > [플랫폼 키] > [REST API 키] > [카카오 로그인 리다이렉트 URI]** — 로그인이 이걸 본다.
  `{도메인}/api/auth/kakao/callback` 을 **경로까지** 넣어야 한다. 도메인만 넣으면 `KOE006`.
  리다이렉트 URI는 **플랫폼 키마다 따로** 등록된다 — JavaScript 키 쪽에 넣어도 서버 로그인에는
  적용되지 않는다.
- **[앱] > [플랫폼 키] > [REST API 키] > [클라이언트 시크릿]** — 켜 두었다면
  `KAKAO_CLIENT_SECRET`을 반드시 채운다. 안 넣으면 동의 화면까지 간 뒤 토큰 교환이 `KOE010`으로
  실패한다.
- **[카카오 로그인] > [일반]** 의 활성화 토글이 ON이어야 한다.

REST API 키와 JavaScript 키는 비밀이 아니다 — 각각 authorize URL과 페이지 소스에 그대로
드러나며 도메인 화이트리스트로 보호한다. 노출을 걱정할 값은 클라이언트 시크릿과 어드민 키뿐이다.

**Vercel** — 프로젝트 루트를 `Bfl_map/web`으로 지정. 프리뷰 배포는 브랜치마다 도메인이
바뀌어 카카오에 등록할 수 없으므로, 지도와 공유 검증은 운영 도메인에서 한다.

## DAU/MAU

외부 분석 도구를 쓰지 않는다. 브라우저가 만든 랜덤 토큰을 `visits(visitor_id, day)`에
하루 한 줄 기록할 뿐이고, IP·유저에이전트·계정 정보는 저장하지 않는다. 사용자가 브라우저
데이터를 지우면 초기화된다.

집계는 `ADMIN_USER_ID`로 로그인한 뒤 `/api/stats`에서 본다. 미설정이면 404다.

## 알아둘 것

- **제로페이 가맹점 ≈ 비플페이 사용처**이며 100% 보장은 아니다. 매장에서 확인이 필요하다
- **편의점**은 회사 식권 정책에 따라 결제가 막힐 수 있다. 진입 토스트와 푸터로 안내한다
- **사진을 일절 다루지 않는다.** 출처를 표기할 수 없어 수집·표시 모두 하지 않으며,
  리뷰에도 사진 업로드가 없다. 메뉴는 이름과 가격 텍스트만 남긴다
- 검색은 표기 차이를 흡수한다: `CU`로 씨유가, `지에스25`로 GS25가, `bhc`로 비에이치씨가 잡힌다
  (`collector/brands.py`가 별칭 테이블의 단일 소유자이고, 수집 시 각 행에 `search_keys`를 넣어둔다)
- 메뉴는 카카오의 비공식 엔드포인트에서 온다. 막히면 메뉴만 사라지고 지도는 정상 동작한다

## 테스트

```bash
cd collector && python -m pytest tests/ -v    # 87
cd web && npx vitest run                      # 44
cd mcp && python -m pytest tests/ -v          # 8
```
