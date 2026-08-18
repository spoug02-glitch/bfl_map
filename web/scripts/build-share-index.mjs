// restaurants.json(4MB, 5,834건)에서 링크 미리보기에 필요한 필드만 뽑는다.
// 통째로 import하면 그 4MB가 서버리스 함수 번들에 그대로 들어가고, fetch로
// 가져오면 Next의 데이터 캐시 상한(2MB)을 넘어 매 요청마다 다시 받는다.
//
// prebuild로 자동 실행된다. 결과 파일은 커밋되어 있지만 매 빌드마다 다시 쓰이므로
// restaurants.json과 어긋날 수 없다.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, "..");

const restaurants = JSON.parse(readFileSync(join(web, "public/restaurants.json"), "utf8"));

const index = {};
for (const r of restaurants) {
  index[r.kakao_place_id] = {
    name: r.name,
    category: r.category,
    distance_km: r.distance_km,
    // 메뉴는 담지 않는다. 카카오 메뉴 수집을 접은 뒤 restaurants.json 에는 menus 가
    // 아예 없고, 여기서 r.menus.length 를 읽으면 다음 수집분에서 그대로 터진다.
  };
}

const out = join(web, "lib/share-index.json");
writeFileSync(out, JSON.stringify(index), "utf8");

const kb = (readFileSync(out).length / 1024).toFixed(0);
console.log(`share index: ${Object.keys(index).length} places, ${kb}KB -> lib/share-index.json`);
