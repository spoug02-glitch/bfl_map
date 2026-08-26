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

/** 좌표는 소수점 6자리(약 11cm)면 충분하다. 원본의 15자리를 그대로 실으면
 *  없는 정밀도를 주장하면서 색인 파일만 100KB 가까이 키운다. */
const coord = (n) => Number(n.toFixed(6));

// 주소·좌표·전화는 가게 페이지의 JSON-LD가 쓴다. 본문이 전부 같은 지도 셸이라
// 구조화 데이터 말고는 5,826개 페이지를 서로 구별할 수단이 없다.
//
// 필드를 하나 늘릴 때마다 이 파일이 수백 KB씩 자라고 그대로 서버 번들에 실린다.
// 화면에서만 쓰는 값은 여기 넣지 말 것 — restaurants.json이 담당한다.
// kakao_url도 넣지 않는다: place_id로 만들 수 있는 주소다.
const index = {};
for (const r of restaurants) {
  index[r.kakao_place_id] = {
    name: r.name,
    category: r.category,
    distance_km: r.distance_km,
    address: r.address,
    lat: coord(r.lat),
    lng: coord(r.lng),
    phone: r.phone,
    // 메뉴는 담지 않는다. 카카오 메뉴 수집을 접은 뒤 restaurants.json 에는 menus 가
    // 아예 없고, 여기서 r.menus.length 를 읽으면 다음 수집분에서 그대로 터진다.
  };
}

const out = join(web, "lib/share-index.json");
writeFileSync(out, JSON.stringify(index), "utf8");

const kb = (readFileSync(out).length / 1024).toFixed(0);
console.log(`share index: ${Object.keys(index).length} places, ${kb}KB -> lib/share-index.json`);
