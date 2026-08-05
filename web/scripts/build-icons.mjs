// 로고 SVG 하나에서 PNG 아이콘들을 뽑는다.
//
// 앱 아이콘과 OG 카드는 PNG여야 한다 — PWA manifest와 iOS는 SVG를 신뢰할 수
// 없고, 슬랙·카톡 미리보기도 PNG를 기대한다. 파비콘만 SVG(app/icon.svg)로 둔다.
//
// OG 카드에는 글자를 넣지 않는다. 넣으려면 한글 폰트를 번들에 실어야 하는데,
// 카드의 제목·설명은 이미 OG 태그가 텍스트로 전달하므로 그림에 다시 쓸 이유가 없다.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const web = join(dirname(fileURLToPath(import.meta.url)), "..");
const INK = "#041627";
const STEAM = "#fe6b00";

/** 잉크 배경 위 흰 마크. 라운드 사각형은 iOS가 알아서 깎으므로 꽉 채운다. */
const appIcon = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${INK}"/>
  <g transform="translate(32 33) scale(0.78) translate(-32 -33)">
    <path d="M13 24h38c0 11-8.5 20-19 20s-19-9-19-20z" fill="#ffffff"/>
    <path d="M23 44h18l-9 13z" fill="#ffffff"/>
    <g stroke="${STEAM}" stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d="M26 17c0-3 3-3 3-6"/><path d="M35 17c0-3 3-3 3-6"/>
    </g>
  </g>
</svg>`;

/**
 * 1200x630 공유 카드. 글자는 넣지 않는다 — 슬랙도 카톡도 제목과 설명을 이미지
 * 옆에 텍스트로 따로 그리므로, 그림에 또 쓰면 같은 말을 두 번 하는 셈이다.
 *
 * 대신 뒤에 반경 링과 점을 깐다. 마크만 두면 검은 화면에 뜬 도형처럼 보이는데,
 * 이 앱 화면의 5km 원을 흐리게 깔아주면 '지도 위의 밥집'이라는 맥락이 붙는다.
 * 카톡은 2:1로 잘라 쓰므로 가운데 여백을 넉넉히 둔다.
 */
const ogCard = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  <g fill="none" stroke="#ffffff">
    <circle cx="600" cy="315" r="286" stroke-width="2" opacity="0.06"/>
    <circle cx="600" cy="315" r="212" stroke-width="2" opacity="0.09"/>
    <circle cx="600" cy="315" r="140" stroke-width="2" opacity="0.13"/>
  </g>
  <g fill="#ffffff" opacity="0.34">
    <circle cx="812" cy="196" r="7"/>
    <circle cx="374" cy="253" r="7"/>
    <circle cx="452" cy="470" r="7"/>
    <circle cx="782" cy="452" r="7"/>
    <circle cx="600" cy="60" r="7"/>
  </g>
  <circle cx="884" cy="330" r="9" fill="${STEAM}" opacity="0.75"/>
  <g transform="translate(600 318) scale(3.7) translate(-32 -34)">
    <path d="M13 24h38c0 11-8.5 20-19 20s-19-9-19-20z" fill="#ffffff"/>
    <path d="M23 44h18l-9 13z" fill="#ffffff"/>
    <g stroke="${STEAM}" stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d="M26 17c0-3 3-3 3-6"/><path d="M35 17c0-3 3-3 3-6"/>
    </g>
  </g>
</svg>`;

/** 32px 파비콘. SVG 파비콘을 못 읽는 구형 브라우저용 래스터 대체본이다.
 *  김 대신 점 하나 — 이 크기에서 김은 뭉갠다. */
const faviconPng = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${INK}"/>
  <g transform="translate(32 34) scale(0.74) translate(-32 -34)">
    <path d="M13 22h38c0 11-8.5 20-19 20s-19-9-19-20z" fill="#ffffff"/>
    <path d="M23 42h18l-9 13z" fill="#ffffff"/>
    <circle cx="32" cy="11" r="4.4" fill="${STEAM}"/>
  </g>
</svg>`;

const targets = [
  { file: "app/icon.png", svg: faviconPng, w: 32, h: 32 },
  { file: "app/apple-icon.png", svg: appIcon(180), w: 180, h: 180 },
  { file: "public/icon-192.png", svg: appIcon(192), w: 192, h: 192 },
  { file: "public/icon-512.png", svg: appIcon(512), w: 512, h: 512 },
  { file: "public/og-card.png", svg: ogCard, w: 1200, h: 630 },
];

for (const t of targets) {
  const out = join(web, t.file);
  mkdirSync(dirname(out), { recursive: true });
  const png = await sharp(Buffer.from(t.svg)).resize(t.w, t.h).png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(out, png);
  console.log(`  ${t.file}  ${t.w}x${t.h}  ${(png.length / 1024).toFixed(1)}KB`);
}
