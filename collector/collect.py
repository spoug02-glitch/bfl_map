"""Build web/public/restaurants.json from zeropay + kakao data.

Usage:
  python collect.py                        # full run (3 districts x 13 codes)
  python collect.py --codes 56221 --districts 도봉구 --limit 20 --skip-menus  # smoke
"""
import argparse
import json
import sys
import time
from pathlib import Path

import brands
import geo
import kakao_local
import menu as menu_mod
import zeropay

CENTER_LAT, CENTER_LNG = 37.6545, 127.0499  # 창동씨드큐브
RADIUS_KM = 5.0
OUT_PATH = Path(__file__).resolve().parent.parent / "web" / "public" / "restaurants.json"
UNRESOLVED_PATH = Path(__file__).resolve().parent / "unresolved.json"
OUT_OF_RADIUS_PATH = Path(__file__).resolve().parent / "out_of_radius.json"
DISTRICTS = ["도봉구", "노원구", "강북구"]


def build_dataset(merchants, matcher, menu_fetcher, delay_sec: float = 0.3,
                  progress_every: int = 0, out_of_radius: list | None = None,
                  duplicates: list | None = None):
    """Match merchants to Kakao places and attach menus.

    This is the slowest phase by far (a few API calls plus a delay per merchant),
    so pass progress_every=N to print a heartbeat every N merchants — without it a
    multi-thousand-row run looks indistinguishable from a hang.

    out_of_radius and duplicates are optional audit-trail out-params: when
    provided, every merchant dropped for being beyond RADIUS_KM (resp. a
    repeat (name, address) row) is appended to the given list instead of
    silently vanishing. Passing None (the default) keeps behavior and the
    (rows, unresolved) return contract identical to before — every existing
    caller is unaffected.
    """
    rows, unresolved = [], []
    seen: set[tuple[str, str]] = set()
    total = len(merchants) if hasattr(merchants, "__len__") else 0
    for idx, m in enumerate(merchants, 1):
        if progress_every and idx % progress_every == 0:
            print(f"[match] {idx}/{total} | matched={len(rows)} unresolved={len(unresolved)}",
                  flush=True)
        key = (m["name"], m["address"])
        if key in seen:
            if duplicates is not None:
                duplicates.append(m)
            continue
        seen.add(key)
        try:
            matched = matcher(m["name"], m["address"], m["category"])
        except RuntimeError:
            # Kakao API outage: log merchant to unresolved and continue
            unresolved.append(m)
            continue
        if matched is None:
            unresolved.append(m)
            continue
        dist = geo.haversine_km(CENTER_LAT, CENTER_LNG, matched["lat"], matched["lng"])
        if dist > RADIUS_KM:
            if out_of_radius is not None:
                out_of_radius.append({
                    "zeropay_name": m["name"],
                    "zeropay_address": m["address"],
                    "kakao_place_name": matched.get("place_name") or m["name"],
                    "kakao_place_id": matched["place_id"],
                    "distance_km": round(dist, 2),
                })
            continue
        # menus are meaningless for convenience stores — skip the panel3 call
        if m["category"] == "체인화 편의점":
            menus = []
        else:
            menus = menu_fetcher(matched["place_id"])
        display_name = matched.get("place_name") or m["name"]
        search_keys = brands.search_keys(display_name)
        if display_name != m["name"]:
            for key in brands.search_keys(m["name"]):
                if key not in search_keys:
                    search_keys.append(key)
        row = {"name": display_name, "search_keys": search_keys}
        if display_name != m["name"]:
            row["zeropay_name"] = m["name"]
        row.update({
            "address": m["address"],
            "category": m["category"],
            "phone": m["phone"],
            "lat": matched["lat"],
            "lng": matched["lng"],
            "distance_km": round(dist, 2),
            "kakao_place_id": matched["place_id"],
            "kakao_url": matched["kakao_url"],
            "menus": menus,
        })
        rows.append(row)
        time.sleep(delay_sec)
    rows.sort(key=lambda r: r["distance_km"])
    return rows, unresolved


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    ap = argparse.ArgumentParser()
    all_codes = {**zeropay.FOOD_CODES, **zeropay.CONVENIENCE_CODES}
    ap.add_argument("--districts", default=",".join(DISTRICTS))
    ap.add_argument("--codes", default=",".join(all_codes))
    ap.add_argument("--limit", type=int, default=0, help="stop after N merchants (smoke test)")
    ap.add_argument("--skip-menus", action="store_true")
    args = ap.parse_args()

    merchants = []
    for gu in args.districts.split(","):
        for code in args.codes.split(","):
            label = all_codes.get(code, code)
            print(f"[crawl] {gu} / {label}")
            for m in zeropay.iter_all_merchants(gu, code):
                merchants.append(m)
                if args.limit and len(merchants) >= args.limit:
                    break
            if args.limit and len(merchants) >= args.limit:
                break
        if args.limit and len(merchants) >= args.limit:
            break
    print(f"[crawl] merchants: {len(merchants)}")

    menu_fetcher = (lambda _pid: []) if args.skip_menus else menu_mod.fetch_menu
    out_of_radius: list = []
    duplicates: list = []
    rows, unresolved = build_dataset(merchants, kakao_local.match_place, menu_fetcher,
                                     progress_every=50, out_of_radius=out_of_radius,
                                     duplicates=duplicates)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    UNRESOLVED_PATH.write_text(json.dumps(unresolved, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_OF_RADIUS_PATH.write_text(json.dumps(out_of_radius, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[done] restaurants: {len(rows)} -> {OUT_PATH}")
    print(f"[done] unresolved: {len(unresolved)} -> {UNRESOLVED_PATH}")
    print(f"[done] out_of_radius: {len(out_of_radius)} -> {OUT_OF_RADIUS_PATH}")
    a, b, c, d, n = len(rows), len(unresolved), len(out_of_radius), len(duplicates), len(merchants)
    print(f"[done] crawled={n} matched={a} unresolved={b} out_of_radius={c} duplicates={d} "
          f"({a}+{b}+{c}+{d} == {n}: {a + b + c + d == n})")


if __name__ == "__main__":
    main()
