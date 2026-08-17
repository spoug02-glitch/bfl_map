# Material 3 디자인 시스템 전환

2026-08-16

## 왜

지금 디자인은 Figma 파일(`b9gbWpJfrQxNBV9ikYVo3y`)에서 뽑은 자체 토큰 체계다. 나쁘지
않지만 **어휘가 없다** — `--color-ink`가 주요 액션인지 본문 글자색인지, `--color-accent`와
어떻게 다른지가 이름만으로는 안 드러난다. 새 화면을 만들 때마다 "이 자리엔 어떤 토큰?"을
매번 다시 판단해야 한다.

Material 3는 그 판단을 **역할 이름**으로 고정한다(`primary` / `on-primary` /
`primary-container` / `surface-container-high` / `outline`…). 색 값보다 이 어휘가 도입의
진짜 이유다.

동시에 표면색을 따뜻하게 바꾼다. 지금 표면은 `#f8f9fb`로 **푸른 기가 도는 회색**인데,
음식 사진과 주황 별점 옆에 놓이면 서로 밀어낸다. 밥집 지도의 표면은 따뜻해야 한다.

## 결정 사항

| 항목 | 결정 |
|---|---|
| 팔레트 출처 | 큐레이션 4색(Terracotta/Riviera Blue/Sand Linen)을 앵커로 M3 확장 |
| 폰트 | **Pretendard 유지** + M3 타입 스케일 15단계만 도입 |
| 범위 | 토큰 + 컴포넌트 재설계 (레이아웃 구조는 유지) |
| 다크모드 | **라이트 전용 유지** + 잔재 블록 제거 |
| 이주 방식 | M3 이름을 기존 토큰 옆에 추가 → 파일 단위 이주 → 구 토큰 삭제 |

### 폰트를 M3의 Roboto로 바꾸지 않는 이유

**Roboto에는 한글 글리프가 없다.** 이 앱은 거의 전부 한국어라, Roboto를 그대로 쓰면 한글이
전부 OS 기본 폰트로 떨어져 지금보다 나빠진다. M3 스펙 자체가 타입페이스 교체를 정식 경로로
허용하며, 구조적 부분은 **타입 스케일**(크기·굵기·행간·자간 체계)이다. 그것만 가져온다.

### 다크모드를 만들지 않는 이유

지금 앱은 의도적으로 라이트 전용이고, `color-scheme: light` 선언에는 문서화된 이유가 있다
(반경 슬라이더의 빈 트랙이 어둡게 렌더돼 선택 방향이 거꾸로 읽혔다). M3 다크를 제대로 하려면
카카오 지도 SDK 같은 외부 위젯까지 맞춰야 해서 비용이 급증한다.

**다만 지금 상태는 버그다.** `globals.css`에 create-next-app 잔재인
`@media (prefers-color-scheme: dark)` 블록이 남아 `--background`/`--foreground`만 어두워지고
나머지 토큰은 밝은 채로 있다. 문서 페이지(`/about` `/terms` `/privacy` `/contact`)는
`max-w-2xl` 중앙 정렬이라, **OS 다크모드 데스크톱에서 열면 검은 배경에 흰 칼럼**이 뜬다.
파일 맨 위 주석과도 모순된다. 이 블록을 지운다.

## 색 토큰 (검증 완료)

공식 `@material/material-color-utilities`로 계산했다 — Material Theme Builder가 내부에서
쓰는 바로 그 라이브러리다. `CorePalette.fromColors({primary, secondary, neutral})` +
`Scheme.lightFromCorePalette()`.

**입력 앵커**: primary `#A9501C`(Terracotta) / secondary `#183451`(Riviera Blue) /
neutral `#D4AF83`(Sand Linen)

```
primary                    #9b4511      on-primary                 #ffffff
primary-container          #ffdbcb      on-primary-container       #341100
secondary                  #0661a4      on-secondary               #ffffff
secondary-container        #d2e4ff      on-secondary-container     #001d36
tertiary                   #655f31      on-tertiary                #ffffff
tertiary-container         #ece4aa      on-tertiary-container      #1f1c00
error                      #ba1a1a      on-error                   #ffffff
error-container            #ffdad6      on-error-container         #410002

surface                    #fff8f4      on-surface                 #25190a
surface-variant            #fcdebc      on-surface-variant         #57432b
surface-dim                #edd6be      surface-bright             #fff8f4
surface-container-lowest   #ffffff
surface-container-low      #fff1e5
surface-container          #ffebd6
surface-container-high     #fce4cc
surface-container-highest  #f6dfc6

outline                    #8b7357      outline-variant            #dec2a2
inverse-surface            #3c2e1d      inverse-on-surface         #ffeede
inverse-primary            #ffb692      scrim / shadow             #000000
```

### 중립 채도를 M3 기본값에서 올린 것 (의도적 이탈)

M3 표준 중립 팔레트는 **채도 4**로 거의 무채색이다. 그대로 쓰면 Sand Linen(채도 22)의
따뜻함이 사라지고 표면이 `#f6ece4`·`#ebe1d9` 같은 **차가운 회색**으로 나온다 — 이 팔레트를
고른 이유가 통째로 없어진다.

그래서 중립을 **채도 12**, 중립 변형을 **채도 16**으로 올려 Sand Linen의 색조(hue 72)를
유지했다. M3의 구조·톤 체계는 그대로다. 표면이 전부 고톤이라 대비는 안전하다(아래 검증).

### 커스텀 확장 컬러 (M3 스킴 밖)

| 토큰 | 값 | 비고 |
|---|---|---|
| `star` | **`#c85300`** | 기존 `#fe6b00`에서 변경 — 아래 참조 |
| `price` | `#a04100` | 유지 |
| `brand-kakao` | `#fee500` / 글자 `#000000` | **브랜드 자산, 변경 금지** |

**별점 색을 바꾼 이유**: 기존 `#fe6b00`은 따뜻해진 표면 위에서 대비가 **2.73**으로,
의미 있는 그래픽 요소의 기준(WCAG 1.4.11, 3:1)에 미달했다. 같은 색조에서 톤만 50으로 내린
`#c85300`이 **모든 표면 단계에서 3:1을 넘는 가장 밝은 값**이다(최대 표면 `#f6dfc6` 위 3.47).
톤 45(`#b44a00`)는 더 안전하지만 가격색 `#a04100`과 구분이 안 된다.

이건 **눈에 보이는 제품 변경**이다 — 별이 지금보다 조금 진해진다.

### 대비 검증 결과

| 쌍 | 대비 | 기준 |
|---|---|---|
| on-primary / primary | 6.46 | 4.5:1 ✓ |
| on-secondary / secondary | 6.45 | 4.5:1 ✓ |
| on-surface / surface | 16.35 | 4.5:1 ✓ |
| on-surface / surface-container-highest | 13.33 | 4.5:1 ✓ |
| on-surface-variant / surface | 8.91 | 4.5:1 ✓ |
| on-primary-container / primary-container | 13.25 | 4.5:1 ✓ |
| outline / surface | 4.26 | 3:1 ✓ (비텍스트) |
| star `#c85300` / surface-container-highest | 3.47 | 3:1 ✓ |
| price `#a04100` / surface | 6.15 | 3:1 ✓ |

## 토큰 구조

`app/globals.css` 안에 3층:

```
--md-ref-palette-*    톤 팔레트 (0~100)
      ↓
--md-sys-color-*      역할 토큰 (위 표)
      ↓
@theme inline         Tailwind가 bg-primary / text-on-surface-variant /
                      bg-surface-container-high / border-outline 생성
```

색 외 M3 축도 함께 도입한다:
- **타입 스케일** 15단계 — display/headline/title/body/label × Large·Medium·Small
- **셰이프** 스케일 — none / xs(4) / sm(8) / md(12) / lg(16) / xl(28) / full
- **엘리베이션** 5단계 — M3는 그림자에 surface tint를 섞는다
- **스테이트 레이어** — hover 8% / focus·pressed 10% / dragged 16%

## 컴포넌트 매핑

| 현재 | M3 |
|---|---|
| 카카오 로그인, 리뷰 남기기 | Filled button |
| 저장 ☆/★ | Icon button (toggle) |
| 공유 | Tonal button |
| FilterBar 업종 선택 | **Filter chip** (선택 시 체크마크) |
| 반경·가격 슬라이더 | M3 Slider |
| PlaceList 항목 | List item |
| PlacePanel | **Bottom sheet**(모바일) / Side sheet(데스크톱) |
| NicknameModal | Dialog |
| 룰렛 패널 | Full-screen dialog |
| Toast | **Snackbar** |

## 절대 바뀌지 않는 것

- **카카오 노랑 `#fee500`** 과 그 글자색 — 브랜드 자산
- **Pretendard** 폰트 스택 (CDN 로드 방식 포함)
- **44px 터치 타깃** (`h-11`, 데스크톱 `md:h-9`)
- `prefers-reduced-motion` 처리 전부 — 사다리·룰렛·토스트 각각의 개별 대응
- `color-scheme: light` 선언과 그 주석의 이유
- 레이아웃 구조 — `h-dvh` 앱 셸, 필터바 접힘 동작, 포인터 타입 분기

## 이주 순서

각 단계가 **독립적으로 배포 가능한 상태**를 유지한다. 이 앱은 이미 운영 중이다.

1. **M3 토큰 층 추가** (기존 토큰과 공존) — 이 시점엔 화면이 안 바뀐다
2. **타입 스케일 적용**
3. **컴포넌트 이주** — 버튼 → 칩 → 리스트/카드 → 시트 → 다이얼로그 → 스낵바
4. **구 토큰 + 다크모드 잔재 삭제**

## 알려진 이탈과 한계

- **secondary가 깊은 네이비가 아니다.** 입력한 Riviera Blue `#183451`은 M3가 톤 40 + 표준
  채도로 정규화해 `#0661a4`(밝은 파랑)가 됐다. secondary는 노출이 적은 보조 역할이라
  수용했다. 깊은 네이비가 꼭 필요한 자리가 생기면 그때 확장 컬러로 추가한다.

  **다만 파랑을 화면에 되살리지는 않는다 (2026-08-17 확정).** 구 팔레트의 남색 버튼
  (`--color-ink`)과 파란 링크(`--color-accent` `#2563eb`)는 전환 후 전부 primary
  테라코타 하나로 합쳐졌다. 이주 직후 "링크만 secondary 파랑으로 되돌릴까"를 시안으로
  비교해 물었고, **파랑이 완전히 사라지는 쪽을 택했다.** 그러니 `text-primary`로 칠해진
  링크·거리 표시를 파란색으로 되돌리는 변경은 관례 복원이 아니라 이 결정을 뒤집는 것이다.
  뒤집으려면 다시 물을 것. 대가는 알고 받아들였다 — 색이 하나로 줄어 "누를 수 있는 것"과
  "그냥 강조"의 구분이 색만으로는 약해지므로, 그 구분은 밑줄·굵기·자리로 낸다.
- **중립 채도 상향은 M3 표준에서 벗어난 값**이다. 공식 생성기 출력과 다르므로, 나중에
  Theme Builder로 재생성하면 표면색이 달라진다. 재생성할 일이 있으면 이 문서의 채도
  12/16을 다시 적용해야 한다.
- **엘리베이션의 surface tint**는 M3에서 primary 색조를 그림자에 섞는데, 지금 코드의
  `shadow-xs` 등 Tailwind 기본 그림자와 어떻게 합칠지는 컴포넌트 이주 단계에서 정한다.

## 테스트

색 토큰은 순수 CSS라 단위 테스트 대상이 아니다. 검증은 이렇게 한다:
- 각 이주 단계마다 `tsc` + 전체 스위트 + `lint` 통과 (기존 관례)
- 컴포넌트 이주 후 해당 화면을 브라우저로 육안 확인
- 대비는 위 표가 근거 — 새 색 조합을 추가할 때마다 같은 방식으로 계산해 기록한다
