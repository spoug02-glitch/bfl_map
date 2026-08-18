"""Build web/public/restaurants.json from zeropay + kakao data.

Usage:
  python collect.py                        # full run (3 districts x 13 codes)
  python collect.py --codes 56221 --districts 도봉구 --limit 20  # smoke
"""
import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import brands
import geo
import kakao_local
import zeropay

CENTER_LAT, CENTER_LNG = 37.6545, 127.0499  # 창동씨드큐브
RADIUS_KM = 5.0
OUT_PATH = Path(__file__).resolve().parent.parent / "web" / "public" / "restaurants.json"
UNRESOLVED_PATH = Path(__file__).resolve().parent / "unresolved.json"
OUT_OF_RADIUS_PATH = Path(__file__).resolve().parent / "out_of_radius.json"
CHECKPOINT_PATH = Path(__file__).resolve().parent / ".checkpoint.jsonl"
DISTRICTS = ["도봉구", "노원구", "강북구"]
# Vercel 배포는 web/ 서브트리만 분리해서 올라간다(collector/는 배포 결과물에
# 없음) — 그래서 어드민이 읽을 이력은 web/ 안에 둔다. public/은 아니다: 정적
# 파일은 인증 없이 그대로 노출된다(restaurants.json이 겪은 문제와 같다).
HISTORY_PATH = Path(__file__).resolve().parent.parent / "web" / "collector-runs.json"


def _load_checkpoint(path: Path) -> tuple[list, list, list, set]:
    """Replay a checkpoint into (rows, unresolved, out_of_radius, processed keys).

    A full run takes hours; without this, any interruption throws away every
    Kakao call made so far. Corrupt trailing lines (killed mid-write) are
    skipped rather than aborting the resume.
    """
    rows: list = []
    unresolved: list = []
    out_of_radius: list = []
    processed: set[tuple[str, str]] = set()
    if not path.exists():
        return rows, unresolved, out_of_radius, processed
    buckets = {"matched": rows, "unresolved": unresolved, "out_of_radius": out_of_radius}
    skipped = 0
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        try:
            rec = json.loads(line)
        except json.JSONDecodeError:
            skipped += 1  # partial final line from a hard kill
            continue
        # A record must be fully well-formed to be trusted: a half-written or
        # buggy entry must be re-done, never replayed as if it were a result.
        key = rec.get("key") if isinstance(rec, dict) else None
        bucket = buckets.get(rec.get("status")) if isinstance(rec, dict) else None
        if (not isinstance(key, list) or len(key) != 2
                or not all(isinstance(part, str) for part in key)
                or bucket is None or rec.get("value") is None):
            skipped += 1
            continue
        processed.add((key[0], key[1]))
        bucket.append(rec["value"])
    if skipped:
        print(f"[resume] skipped {skipped} unusable checkpoint record(s); "
              "those merchants will be processed again", flush=True)
    return rows, unresolved, out_of_radius, processed


def dedupe_by_place_id(rows: list[dict]) -> tuple[list[dict], int]:
    """Collapse rows that point at the same Kakao place, keeping the first.

    One physical restaurant must produce exactly one pin. Two different zeropay
    listings legitimately resolve to one Kakao place (e.g. '씨유 L도봉지사4층점'
    and '…8층점' are two floors of one store), and a resumed run can also replay
    a row it then recomputes. Both would otherwise stack pins on the map.
    Rows are distance-sorted before this runs, so the kept row is the nearest.
    """
    seen: set[str] = set()
    out: list[dict] = []
    for r in rows:
        pid = r.get("kakao_place_id")
        if pid in seen:
            continue
        seen.add(pid)
        out.append(r)
    return out, len(rows) - len(out)


def _append_checkpoint(path: Path, key: tuple[str, str], status: str, value) -> None:
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"key": list(key), "status": status, "value": value},
                           ensure_ascii=False) + "\n")
        f.flush()


def build_dataset(merchants, matcher, delay_sec: float = 0.3,
                  progress_every: int = 0, out_of_radius: list | None = None,
                  duplicates: list | None = None, checkpoint_path: Path | None = None):
    """Match merchants to Kakao places.

    This is the slowest phase by far (a few API calls plus a delay per merchant),
    so pass progress_every=N to print a heartbeat every N merchants — without it a
    multi-thousand-row run looks indistinguishable from a hang.

    out_of_radius and duplicates are optional audit-trail out-params: when
    provided, every merchant dropped for being beyond RADIUS_KM (resp. a
    repeat (name, address) row) is appended to the given list instead of
    silently vanishing. Passing None (the default) keeps behavior and the
    (rows, unresolved) return contract identical to before — every existing
    caller is unaffected.

    checkpoint_path makes a run resumable: every decision is appended to a
    JSONL file as it is made, and a restart replays that file and skips the
    merchants already processed. A full run costs hours of API calls, so an
    interrupted run must not start from zero.
    """
    rows, unresolved = [], []
    seen: set[tuple[str, str]] = set()
    if checkpoint_path is not None:
        rows, unresolved, done_radius, seen = _load_checkpoint(checkpoint_path)
        if out_of_radius is not None:
            out_of_radius.extend(done_radius)
        if seen:
            print(f"[resume] {len(seen)} merchants already processed "
                  f"(matched={len(rows)} unresolved={len(unresolved)})", flush=True)
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
            if checkpoint_path is not None:
                _append_checkpoint(checkpoint_path, key, "unresolved", m)
            continue
        if matched is None:
            unresolved.append(m)
            if checkpoint_path is not None:
                _append_checkpoint(checkpoint_path, key, "unresolved", m)
            continue
        dist = geo.haversine_km(CENTER_LAT, CENTER_LNG, matched["lat"], matched["lng"])
        if dist > RADIUS_KM:
            dropped = {
                "zeropay_name": m["name"],
                "zeropay_address": m["address"],
                "kakao_place_name": matched.get("place_name") or m["name"],
                "kakao_place_id": matched["place_id"],
                "distance_km": round(dist, 2),
            }
            if out_of_radius is not None:
                out_of_radius.append(dropped)
            if checkpoint_path is not None:
                _append_checkpoint(checkpoint_path, key, "out_of_radius", dropped)
            continue
        display_name = matched.get("place_name") or m["name"]
        search_keys = brands.search_keys(display_name)
        if display_name != m["name"]:
            # NOTE: do not name this `key` — it would shadow the (name, address)
            # tuple this iteration still needs for the checkpoint record.
            for extra in brands.search_keys(m["name"]):
                if extra not in search_keys:
                    search_keys.append(extra)
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
        })
        rows.append(row)
        if checkpoint_path is not None:
            _append_checkpoint(checkpoint_path, key, "matched", row)
        time.sleep(delay_sec)
    rows.sort(key=lambda r: r["distance_km"])
    return rows, unresolved


def _append_run_history(path: Path, record: dict) -> None:
    """실행 요약 한 건을 JSON 배열에 append한다.

    데이터 수집이 이력 기록보다 중요하다 — 쓰기 실패(권한 등)로 몇 시간짜리
    크롤링 결과를 날릴 수는 없으므로 예외를 삼키고 경고만 남긴다.
    """
    try:
        history = json.loads(path.read_text(encoding="utf-8")) if path.exists() else []
        if not isinstance(history, list):
            history = []
        history.append(record)
        path.write_text(json.dumps(history, ensure_ascii=False, indent=1), encoding="utf-8")
    except (OSError, json.JSONDecodeError) as e:
        print(f"[history] failed to record run history: {e}", flush=True)


def main() -> None:
    sys.stdout.reconfigure(encoding="utf-8")
    started_at = datetime.now(timezone.utc).isoformat()
    ap = argparse.ArgumentParser()
    all_codes = {**zeropay.FOOD_CODES, **zeropay.CONVENIENCE_CODES}
    ap.add_argument("--districts", default=",".join(DISTRICTS))
    ap.add_argument("--codes", default=",".join(all_codes))
    ap.add_argument("--limit", type=int, default=0, help="stop after N merchants (smoke test)")
    ap.add_argument("--fresh", action="store_true",
                    help="discard any checkpoint and start the match phase from scratch")
    args = ap.parse_args()

    if args.fresh and CHECKPOINT_PATH.exists():
        CHECKPOINT_PATH.unlink()

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

    out_of_radius: list = []
    duplicates: list = []
    rows, unresolved = build_dataset(merchants, kakao_local.match_place,
                                     progress_every=50, out_of_radius=out_of_radius,
                                     duplicates=duplicates, checkpoint_path=CHECKPOINT_PATH)

    rows, merged = dedupe_by_place_id(rows)
    if merged:
        print(f"[done] merged {merged} row(s) pointing at an already-listed Kakao place", flush=True)

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    UNRESOLVED_PATH.write_text(json.dumps(unresolved, ensure_ascii=False, indent=1), encoding="utf-8")
    OUT_OF_RADIUS_PATH.write_text(json.dumps(out_of_radius, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[done] restaurants: {len(rows)} -> {OUT_PATH}")
    print(f"[done] unresolved: {len(unresolved)} -> {UNRESOLVED_PATH}")
    print(f"[done] out_of_radius: {len(out_of_radius)} -> {OUT_OF_RADIUS_PATH}")
    a, b, c, d, n = (len(rows) + merged, len(unresolved), len(out_of_radius),
                     len(duplicates), len(merchants))
    print(f"[done] crawled={n} matched={a} unresolved={b} out_of_radius={c} duplicates={d} "
          f"({a}+{b}+{c}+{d} == {n}: {a + b + c + d == n})")
    if a + b + c + d != n:
        # A resumed run counts merchants restored from the checkpoint as repeats,
        # so this only balances on an uninterrupted run. Say so instead of
        # printing a bare False that reads like data loss.
        print("[done] note: totals only balance on an uninterrupted run — a resume "
              "re-encounters already-processed merchants and counts them as duplicates",
              flush=True)
    # the run finished, so the resume log has served its purpose
    CHECKPOINT_PATH.unlink(missing_ok=True)
    _append_run_history(HISTORY_PATH, {
        "startedAt": started_at,
        "finishedAt": datetime.now(timezone.utc).isoformat(),
        "districts": args.districts.split(","),
        "codes": args.codes.split(","),
        "crawled": n,
        "matched": a,
        "unresolved": b,
        "outOfRadius": c,
        "duplicates": d,
    })


if __name__ == "__main__":
    main()
