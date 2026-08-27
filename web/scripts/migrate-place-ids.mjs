/**
 * 사용자 데이터의 place_id 를 카카오 id 에서 인허가 관리번호로 옮긴다.
 *
 *   node scripts/migrate-place-ids.mjs            # dry-run
 *   node scripts/migrate-place-ids.mjs --commit   # 실제 반영
 *
 * **한 번만 도는 스크립트다.** 다 옮기고 나면 이 파일과
 * collector/legacy-kakao-map.json 은 지워도 된다.
 *
 * > [!warning] 배포와 같은 순서로 돌아야 한다
 * > DB 를 먼저 바꾸면 아직 카카오 id 로 된 restaurants.json 과 어긋나 메뉴·리뷰가
 * > 화면에서 사라진다. 반대로 배포만 먼저 하면 새 id 로 조회했는데 DB 에는 옛
 * > id 로 있어 역시 안 보인다. **restaurants.json 이 새 id 로 나간 배포와 같은
 * > 창에서** 돌릴 것.
 *
 * 매핑은 collector/legacy-kakao-map.json 을 뒤집어 쓴다(관리번호 -> 카카오 id 로
 * 저장돼 있다). collector/match_legacy.py 가 좌표와 상호로 만든 것이고, 어떻게
 * 맞췄는지는 그쪽 docstring 에 있다.
 *
 * 옮기지 못한 행은 **지우지 않고 그대로 둔다.** 화면에서 안 보일 뿐이고, 지우면
 * 사람이 쓴 리뷰가 사라진다. 몇 건인지는 세어서 보고한다.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");

/** place_id 를 들고 있는 테이블 전부. 하나라도 빠지면 그 테이블만 고아가 된다. */
export const TABLES = ["menu_items", "reviews", "lunch_specials", "saved_places", "reports"];

/** 관리번호 -> 카카오 id 로 저장된 파일을 카카오 id -> 관리번호 로 뒤집는다. */
export function invertLegacyMap(legacy) {
  const out = new Map();
  for (const [permitNo, entry] of Object.entries(legacy)) {
    const kakaoId = entry?.kakao_place_id;
    if (typeof kakaoId === "string" && kakaoId && !out.has(kakaoId)) {
      out.set(kakaoId, permitNo);
    }
  }
  return out;
}

/** 옮길 것과 못 옮길 것을 가른다. 이미 관리번호인 값은 건드리지 않는다(재실행 안전). */
export function planMoves(placeIds, mapping) {
  const moves = [];
  const unmapped = [];
  for (const id of placeIds) {
    if (mapping.has(id)) moves.push({ from: id, to: mapping.get(id) });
    else unmapped.push(id);
  }
  return { moves, unmapped };
}

async function main() {
  config({ path: join(web, ".env.local") });
  const commit = process.argv.includes("--commit");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL 이 없다. web/.env.local 을 확인할 것.");
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);

  const legacyPath = join(web, "..", "collector", "legacy-kakao-map.json");
  const mapping = invertLegacyMap(JSON.parse(readFileSync(legacyPath, "utf8")));
  console.log(`매핑 ${mapping.size.toLocaleString()}건 (${legacyPath})`);
  console.log(commit ? "\n== 실제 반영 ==\n" : "\n== dry-run (반영하려면 --commit) ==\n");

  let movedTotal = 0;
  let strandedTotal = 0;
  for (const table of TABLES) {
    const rows = await sql`SELECT DISTINCT place_id FROM ${sql.unsafe(table)} WHERE place_id IS NOT NULL`;
    const ids = rows.map(r => r.place_id);
    const { moves, unmapped } = planMoves(ids, mapping);
    // 이미 옮긴 값은 매핑에 없으니 unmapped 로 잡힌다. 관리번호 모양인지 보고 가른다.
    const alreadyDone = unmapped.filter(id => /^\d{7}-\d{3}-\d{4}-\d{5}$/.test(id));
    const stranded = unmapped.filter(id => !alreadyDone.includes(id));

    console.log(`${table.padEnd(15)} 가게 ${String(ids.length).padStart(4)} ` +
      `→ 옮김 ${String(moves.length).padStart(4)} / 이미완료 ${alreadyDone.length} / 못옮김 ${stranded.length}`);
    for (const id of stranded.slice(0, 5)) console.log(`      못옮김: ${id}`);

    if (commit) {
      for (const { from, to } of moves) {
        await sql`UPDATE ${sql.unsafe(table)} SET place_id = ${to} WHERE place_id = ${from}`;
      }
    }
    movedTotal += moves.length;
    strandedTotal += stranded.length;
  }

  console.log(`\n합계: 옮김 ${movedTotal} / 못옮김 ${strandedTotal}`);
  if (strandedTotal) {
    console.log("못 옮긴 행은 지우지 않았다 — 화면에서 안 보일 뿐이고, 지우면 사람이 쓴 글이 사라진다.");
  }
  if (!commit) console.log("\n아무것도 바꾸지 않았다. --commit 을 붙일 것.");
}

if (process.argv[1] && process.argv[1].endsWith("migrate-place-ids.mjs")) {
  main().catch(e => { console.error(e); process.exit(1); });
}
