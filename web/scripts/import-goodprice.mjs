/**
 * 착한가격업소 공공데이터를 menu_items 로 넣는다.
 *
 *   node scripts/import-goodprice.mjs <csv경로> --as-of 2026-07-27            # dry-run
 *   node scripts/import-goodprice.mjs <csv경로> --as-of 2026-07-27 --commit   # 실제 반영
 *
 * 출처: 행정안전부_착한가격업소 현황 (data.go.kr/data/3045247)
 *   - 이용허락범위 제한 없음, 분기 1회 갱신, 전국 12,645행
 *   - 필드: 시도 시군 업종 업소명 연락처 주소 메뉴1~4 가격1~4
 *
 * 분기에 한 번 손으로 내려받아 돌리는 스크립트다. 자동화하지 않은 이유는 파일
 * 내려받기에 포털 로그인이 필요하고, 갱신이 분기라 자동화 이득이 거의 없기 때문이다.
 *
 * 매칭은 카카오 API 를 부르지 않는다. public/restaurants.json 에 이미 우리가 쓰는
 * 5,834곳이 search_keys 와 함께 있어서, 그것과 대조하면 API 호출도 없고 "우리 지도에
 * 없는 가게"가 딸려 들어올 일도 없다.
 *
 * 재실행은 안전하다. public_data 행을 통째로 지우고 다시 넣는다 — 착한가격업소에서
 * 빠진 가게가 우리 DB 에만 남는 일을 막으려면 갱신이 아니라 교체여야 한다.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

// ---------------------------------------------------------------- 순수 ----

/**
 * 아주 작은 CSV 파서. 따옴표 안의 쉼표와 "" 이스케이프만 다룬다 — 이 데이터셋에
 * 줄바꿈이 든 셀은 없다. 의존성을 하나 더 들이는 것보다 이 30줄이 낫다.
 */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(cell); cell = ""; continue; }
    if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
    if (c === "\r") continue;
    cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  if (rows.length === 0) return [];
  const header = rows[0].map(h => h.trim().replace(/^﻿/, ""));
  return rows.slice(1)
    .filter(r => r.some(v => v.trim() !== ""))
    .map(r => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? "").trim()])));
}

/**
 * 이름 대조용 정규화. 공백·괄호·따옴표를 걷어낸다.
 * 지점명은 남긴다 — "홍두깨손칼국수"가 도봉구에만 세 곳이라, 지점을 지우면 서로 섞인다.
 */
export function normalizeName(s) {
  return String(s ?? "")
    .replace(/\(주\)|\(유\)|\(사\)/g, "")
    .replace(/[\s'"`()[\]]/g, "")
    .toLowerCase();
}

/**
 * "7,000원" "7000" "7,000" -> 7000. 숫자를 못 뽑으면 null 이다.
 *
 * 범위 표기("5,000~7,000")는 낮은 쪽을 쓴다. 점심값 상한 필터에 쓰이는 값이라
 * 낮은 쪽이 "이 가격부터 먹을 수 있다"는 뜻이 되고, 높은 쪽을 쓰면 필터가 실제보다
 * 비싸게 판단해 가게를 빼버린다.
 */
export function parsePrice(raw) {
  const s = String(raw ?? "").replace(/,/g, "");
  const nums = s.match(/\d+/g);
  if (!nums) return null;
  const n = Math.min(...nums.map(Number));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** 헤더에서 메뉴N/가격N 쌍을 찾아 [{menuName, price}] 로. 빈 메뉴는 버린다. */
export function menuPricePairs(row) {
  const out = [];
  for (const key of Object.keys(row)) {
    const m = key.match(/^메뉴\s*(\d+)$/);
    if (!m) continue;
    const name = String(row[key] ?? "").trim();
    if (!name) continue;
    const priceKey = Object.keys(row).find(k => k.match(new RegExp(`^가격\\s*${m[1]}$`)));
    out.push({ menuName: name, price: priceKey ? parsePrice(row[priceKey]) : null });
  }
  return out;
}

/**
 * restaurants.json 으로 이름 색인을 만든다. 한 이름에 여러 가게가 걸리면 후보를
 * 모두 담는다 — 주소로 가를 수 있는 경우가 많아서, 이름 중복만으로 버리면 실제
 * 데이터에서 12건 중 9건을 놓친다.
 */
export function buildNameIndex(places) {
  const index = new Map();
  const add = (key, place) => {
    const k = normalizeName(key);
    if (!k) return;
    if (!index.has(k)) index.set(k, new Set());
    index.get(k).add(place);
  };
  for (const p of places) {
    add(p.name, p);
    if (p.zeropay_name) add(p.zeropay_name, p);
    for (const k of p.search_keys ?? []) add(k, p);
  }
  return index;
}

/**
 * 주소의 도로명 + 건물번호. 동명이인을 가르는 데 쓴다.
 *
 * 도로명이 숫자를 품는 게 함정이다 — "동일로217길 58"에서 도로명은 "동일로217길"이고
 * 번호는 58인데, CSV 는 같은 주소를 "동일로 217길58"로 띄어 쓴다. 앞에서부터 로/길을
 * 찾으면 "동일로"+"217"이 잡혀 같은 주소가 다른 값이 된다. 실제 데이터에서 거절된
 * 10건 중 5건이 이 실수였다.
 *
 * 그래서 공백을 먼저 다 지우고 **마지막** 로/길을 기준으로 자른다. 괄호 안 법정동과
 * 쉼표 뒤 층수는 건물번호가 아니므로 그 앞에서 끊는다.
 */
export function addressCore(addr) {
  // 시/도/구/군 토큰을 먼저 떼야 한다. 공백부터 지우면 도로명이 어디서 시작하는지
  // 알 수 없어져 "서울특별시도봉구노해로69길"이 통째로 도로명이 된다.
  const head = String(addr ?? "").split(/[,(]/)[0];
  // 층·호·동은 건물번호가 아니다. "석계로 13길 25-1 1층"의 "1층"을 남기면
  // 번호가 25-11층이 되어 매칭이 통째로 어긋난다.
  const rest = head
    .split(/\s+/)
    .filter(t => t && !/(시|도|구|군)$/.test(t) && !/^\d+(층|호|동)$/.test(t))
    .join("");
  const m = rest.match(/^(.*(?:로|길))(\d+)(?:-(\d+))?$/);
  return m ? `${m[1]}${m[2]}${m[3] ? "-" + m[3] : ""}` : null;
}

/** 주소에서 자치구(구/군) 하나. 주소 형식이 달라도 이건 거의 항상 읽힌다. */
export function districtOf(addr) {
  const m = String(addr ?? "").match(/(\S+?[구군])(?:\s|$)/);
  return m ? m[1] : null;
}

/**
 * 공공데이터 한 행을 우리 가게에 붙인다. 붙지 않으면 null.
 *
 * 후보가 하나면 주소가 둘 다 읽히는데 서로 다를 때만 거절한다(한쪽이 안 읽히면
 * 이름만 믿는다). 후보가 여럿이면 주소가 정확히 하나와 맞을 때만 붙인다 — 같은
 * 상호의 다른 지점에 메뉴를 붙이는 게 이 작업에서 제일 조용하고 제일 나쁜 실패다.
 */
export function matchPlace(row, index) {
  const cands = [...(index.get(normalizeName(row["업소명"])) ?? [])];
  if (cands.length === 0) return null;

  // 자치구부터 본다. 도로명이 안 읽히는 주소가 65건 중 19건이나 되는데(지번 주소,
  // "보람상가" 같은 건물명), 그때 이름만 믿으면 성북구 "소풍가는날"의 100,000원
  // 제육볶음이 노원구 동명 가게에 붙는다. 실제로 그렇게 붙었다.
  const gu = districtOf(row["주소"]);
  const sameGu = gu ? cands.filter(p => districtOf(p.address) === gu) : cands;
  if (sameGu.length === 0) return null;

  const a = addressCore(row["주소"]);
  if (sameGu.length === 1) {
    const b = addressCore(sameGu[0].address);
    return a && b && a !== b ? null : sameGu[0];
  }
  if (!a) return null;
  const exact = sameGu.filter(p => addressCore(p.address) === a);
  return exact.length === 1 ? exact[0] : null;
}

/** 매칭된 행들을 menu_items 삽입 레코드로. asOf 는 데이터셋 기준일(YYYY-MM-DD). */
export function toMenuItems(rows, index, asOf) {
  const items = [];
  const unmatched = [];
  for (const row of rows) {
    const place = matchPlace(row, index);
    if (!place) { unmatched.push(row["업소명"]); continue; }
    for (const { menuName, price } of menuPricePairs(row)) {
      items.push({
        placeId: place.kakao_place_id,
        menuName,
        price,
        sourceType: "public_data",
        // 어느 행에서 왔는지 되짚을 수 있어야 한다. 나중에 틀린 값이 나오면
        // 원본을 찾아가는 유일한 단서다.
        sourceRef: `행안부 착한가격업소 ${asOf} | ${row["업소명"]} | ${row["주소"]}`,
        verifiedAt: asOf,
      });
    }
  }
  return { items, unmatched };
}

// -------------------------------------------------------------- 실행부 ----

function parseArgs(argv) {
  const csvPath = argv.find(a => !a.startsWith("--"));
  const at = argv.indexOf("--as-of");
  return {
    csvPath,
    asOf: at >= 0 ? argv[at + 1] : null,
    commit: argv.includes("--commit"),
    encoding: argv.includes("--utf8") ? "utf-8" : "euc-kr",
  };
}

async function main() {
  config({ path: ".env.local" });
  const { csvPath, asOf, commit, encoding } = parseArgs(process.argv.slice(2));

  if (!csvPath || !asOf) {
    console.error("usage: node scripts/import-goodprice.mjs <csv> --as-of YYYY-MM-DD [--commit] [--utf8]");
    process.exit(1);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf)) {
    console.error(`--as-of 는 YYYY-MM-DD 여야 합니다: ${asOf}`);
    process.exit(1);
  }

  // data.go.kr 의 CSV 는 대개 EUC-KR 이다. UTF-8 로 읽으면 업소명이 통째로 깨져
  // 매칭이 0건이 되는데, 에러는 안 나서 "겹치는 가게가 없다"로 오해하기 쉽다.
  const text = new TextDecoder(encoding).decode(readFileSync(csvPath));
  const all = parseCsv(text);
  if (all.length && !("업소명" in all[0])) {
    console.error(`업소명 열을 찾지 못했습니다. 인코딩이 틀렸을 수 있습니다(현재 ${encoding}).`);
    console.error(`읽어낸 헤더: ${Object.keys(all[0]).join(", ")}`);
    process.exit(1);
  }

  const places = JSON.parse(readFileSync("public/restaurants.json", "utf-8"));
  const index = buildNameIndex(places);
  const { items, unmatched } = toMenuItems(all, index, asOf);

  const placeCount = new Set(items.map(i => i.placeId)).size;
  const priced = items.filter(i => i.price !== null).length;
  console.log(`CSV 행           ${all.length.toLocaleString()}`);
  console.log(`우리 가게와 매칭  ${(all.length - unmatched.length).toLocaleString()}`);
  console.log(`메뉴 항목        ${items.length.toLocaleString()}  (가격 있음 ${priced.toLocaleString()})`);
  console.log(`대상 가게        ${placeCount.toLocaleString()}곳`);

  if (!commit) {
    console.log("\n--commit 이 없어 아무것도 쓰지 않았습니다. 상위 10건 미리보기:");
    for (const i of items.slice(0, 10)) {
      console.log(`  ${i.placeId}  ${i.menuName}  ${i.price ?? "가격없음"}`);
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL 이 없습니다.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  // 갱신이 아니라 교체다. 착한가격업소에서 빠진 가게의 메뉴가 우리 DB 에만
  // 남아 "공공데이터 출처"를 달고 돌아다니면 안 된다.
  //
  // 삭제와 삽입은 반드시 한 트랜잭션이어야 한다. 나눠서 보내면 삭제가 끝난 뒤
  // 삽입 도중에 끊겼을 때 공공데이터 가격이 통째로 또는 일부만 사라진 상태로 남는다.
  // neon-http 의 transaction() 은 배열을 한 번의 요청으로 보내므로 왕복도 1회다.
  const statements = [
    sql`DELETE FROM menu_items WHERE source_type = 'public_data'`,
    ...items.map(i => sql`
      INSERT INTO menu_items
        (place_id, menu_name, price, source_type, source_ref, verified_at, status)
      VALUES
        (${i.placeId}, ${i.menuName}, ${i.price}, 'public_data', ${i.sourceRef},
         ${i.verifiedAt}, 'published')`),
  ];
  await sql.transaction(statements);
  console.log(`
교체 완료: ${items.length}건 (삭제와 삽입이 한 트랜잭션)`);
}

// 테스트가 이 파일을 import 할 때는 main 이 돌면 안 된다.
if (process.argv[1] && process.argv[1].endsWith("import-goodprice.mjs")) {
  main().catch(e => { console.error(e); process.exit(1); });
}
