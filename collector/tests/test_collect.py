import json
import pytest
import brands
import collect


MERCHANTS = [
    {"name": "가까운집", "address": "서울 도봉구 마들로13길 61", "category": "한식 일반 음식점업", "phone": "02-1"},
    {"name": "먼집", "address": "서울 강북구 어딘가 1", "category": "중식 음식점업", "phone": "02-2"},
    {"name": "매칭실패집", "address": "서울 노원구 어딘가 2", "category": "일식 음식점업", "phone": "02-3"},
    {"name": "가까운집", "address": "서울 도봉구 마들로13길 61", "category": "한식 일반 음식점업", "phone": "02-1"},  # dup
    {"name": "GS25 씨드큐브점", "address": "서울 도봉구 마들로13길 61", "category": "체인화 편의점", "phone": "02-4"},
]

COORDS = {
    "가까운집": {"place_id": "1", "lat": 37.6540, "lng": 127.0490, "kakao_url": "http://place.map.kakao.com/1"},
    "먼집": {"place_id": "2", "lat": 37.7500, "lng": 127.2000, "kakao_url": "http://place.map.kakao.com/2"},  # >5km
    "GS25 씨드큐브점": {"place_id": "3", "lat": 37.6546, "lng": 127.0500, "kakao_url": "http://place.map.kakao.com/3"},
}


def fake_matcher(name, address, category=None):
    return COORDS.get(name)



def test_build_dataset_filters_and_dedupes():
    rows, unresolved = collect.build_dataset(MERCHANTS, fake_matcher, delay_sec=0)
    assert len(rows) == 2  # 먼집 >5km 제외, 매칭실패집 unresolved, dup 제거, 편의점 포함
    by_name = {r["name"]: r for r in rows}
    r = by_name["가까운집"]
    assert r["kakao_place_id"] == "1"
    assert 0 < r["distance_km"] < 0.2
    assert [u["name"] for u in unresolved] == ["매칭실패집"]
    assert r["search_keys"] == brands.search_keys("가까운집")
    assert list(r.keys())[:2] == ["name", "search_keys"]


def test_build_dataset_includes_cu_stores():
    merchants = MERCHANTS + [
        {"name": "씨유 씨드큐브점", "address": "서울 도봉구 마들로13길 61", "category": "체인화 편의점", "phone": "02-5"},
    ]
    coords = dict(COORDS, **{
        "씨유 씨드큐브점": {"place_id": "4", "lat": 37.6546, "lng": 127.0500, "kakao_url": "http://place.map.kakao.com/4"},
    })

    def matcher(name, address, category=None):
        return coords.get(name)

    rows, unresolved = collect.build_dataset(merchants, matcher, delay_sec=0)
    names = [r["name"] for r in rows] + [u["name"] for u in unresolved]
    assert "씨유 씨드큐브점" in names  # CU: 비플페이 사용 가능, 제외 금지


def test_build_dataset_passes_category_to_matcher():
    captured = []

    def spy_matcher(name, address, category=None):
        captured.append((name, category))
        return COORDS.get(name)

    collect.build_dataset(MERCHANTS, spy_matcher, delay_sec=0)
    assert ("가까운집", "한식 일반 음식점업") in captured
    assert ("GS25 씨드큐브점", "체인화 편의점") in captured


def test_build_dataset_uses_kakao_display_name_when_it_differs():
    merchants = [
        {"name": "순대신록 씨드큐브 창동점", "address": "서울 도봉구 마들로13길 61",
         "category": "한식 일반 음식점업", "phone": "02-9"},
    ]

    def matcher(name, address, category=None):
        return {"place_id": "9", "lat": 37.6546, "lng": 127.0500,
                "kakao_url": "http://place.map.kakao.com/9", "place_name": "순대실록 창동씨드큐브점"}

    rows, _ = collect.build_dataset(merchants, matcher, delay_sec=0)
    assert len(rows) == 1
    r = rows[0]
    assert r["name"] == "순대실록 창동씨드큐브점"  # kakao's spelling, not zeropay's typo
    assert r["zeropay_name"] == "순대신록 씨드큐브 창동점"
    assert list(r.keys())[:2] == ["name", "search_keys"]
    for key in brands.search_keys("순대실록 창동씨드큐브점"):
        assert key in r["search_keys"]
    for key in brands.search_keys("순대신록 씨드큐브 창동점"):
        assert key in r["search_keys"]
    assert len(r["search_keys"]) == len(set(r["search_keys"]))


def test_build_dataset_omits_zeropay_name_when_names_match():
    rows, _ = collect.build_dataset(MERCHANTS, fake_matcher, delay_sec=0)
    r = next(r for r in rows if r["name"] == "가까운집")
    assert "zeropay_name" not in r


def test_build_dataset_emits_progress_heartbeat(capsys):
    # the match phase is silent for thousands of merchants; a heartbeat is the only
    # way to tell a long run from a hang
    many = [
        {"name": f"가게{i}", "address": "서울 도봉구 마들로13길 61",
         "category": "한식 일반 음식점업", "phone": "02-1"}
        for i in range(5)
    ]
    collect.build_dataset(many, lambda n, a, c=None: None,
                          delay_sec=0, progress_every=2)
    out = capsys.readouterr().out
    assert "[match] 2/5" in out
    assert "unresolved=" in out


def test_build_dataset_silent_without_progress_every(capsys):
    collect.build_dataset(MERCHANTS, fake_matcher, delay_sec=0)
    assert "[match]" not in capsys.readouterr().out


# --- D2: out-of-radius audit trail ----------------------------------------

def test_build_dataset_records_out_of_radius_match_with_distance():
    """A merchant that matches a real Kakao place beyond RADIUS_KM must be
    recorded (not silently dropped), carrying enough to audit a suspected
    wrong match: zeropay name/address, matched kakao place_name/place_id,
    and the computed distance."""
    out_of_radius = []
    rows, unresolved = collect.build_dataset(MERCHANTS, fake_matcher, delay_sec=0,
                                              out_of_radius=out_of_radius)
    assert len(out_of_radius) == 1
    entry = out_of_radius[0]
    assert entry["zeropay_name"] == "먼집"
    assert entry["zeropay_address"] == "서울 강북구 어딘가 1"
    assert entry["kakao_place_id"] == "2"
    assert entry["distance_km"] > collect.RADIUS_KM
    # out-of-radius entries must not silently appear as matched rows
    assert "먼집" not in [r["name"] for r in rows]


def test_build_dataset_reconciliation_arithmetic_balances():
    """Every crawled merchant must land in exactly one of: matched (rows),
    unresolved, out_of_radius, or duplicates — nothing may vanish."""
    out_of_radius = []
    duplicates = []
    rows, unresolved = collect.build_dataset(MERCHANTS, fake_matcher, delay_sec=0,
                                              out_of_radius=out_of_radius, duplicates=duplicates)
    assert len(rows) + len(unresolved) + len(out_of_radius) + len(duplicates) == len(MERCHANTS)
    assert len(duplicates) == 1


def _merchants(n):
    return [
        {"name": f"가게{i}", "address": f"서울 도봉구 마들로13길 {i}",
         "category": "한식 일반 음식점업", "phone": "02-1"}
        for i in range(n)
    ]


def test_checkpoint_resume_matches_uninterrupted_run(tmp_path):
    # a full run costs hours of API calls; an interruption must not restart from zero
    cp = tmp_path / "cp.jsonl"
    ms = _merchants(4)
    coords = {m["name"]: {"place_id": str(i), "lat": 37.6545, "lng": 127.0499,
                          "kakao_url": f"http://place.map.kakao.com/{i}"}
              for i, m in enumerate(ms)}

    calls = []

    def counting_matcher(name, addr, cat=None):
        calls.append(name)
        return coords.get(name)

    # first pass dies after 2 merchants
    with pytest.raises(RuntimeError, match="boom"):
        def dying(name, addr, cat=None):
            if len(calls) >= 2:
                raise ValueError("boom")
            return counting_matcher(name, addr, cat)

        try:
            collect.build_dataset(ms, dying, delay_sec=0, checkpoint_path=cp)
        except ValueError as e:
            raise RuntimeError("boom") from e

    assert len(calls) == 2
    first_pass = len(calls)

    # resume: already-processed merchants must not be re-matched
    calls.clear()
    rows, unresolved = collect.build_dataset(ms, counting_matcher,
                                             delay_sec=0, checkpoint_path=cp)
    assert len(calls) == len(ms) - first_pass  # only the remaining ones cost API calls
    assert len(rows) == len(ms)
    assert sorted(r["name"] for r in rows) == sorted(m["name"] for m in ms)


def test_checkpoint_tolerates_truncated_final_line(tmp_path):
    cp = tmp_path / "cp.jsonl"
    cp.write_text('{"key": ["a", "b"], "status": "unresolved", "value": {"name": "a"}}\n'
                  '{"key": ["c", "d"], "stat',  # killed mid-write
                  encoding="utf-8")
    rows, unresolved, out_of_radius, processed = collect._load_checkpoint(cp)
    assert processed == {("a", "b")}
    assert len(unresolved) == 1


def test_no_checkpoint_path_writes_nothing(tmp_path):
    cp = tmp_path / "cp.jsonl"
    collect.build_dataset(MERCHANTS, fake_matcher, delay_sec=0)
    assert not cp.exists()


def test_checkpoint_skips_malformed_records(tmp_path, capsys):
    # a half-written or buggy record must be re-done, never replayed as a result
    cp = tmp_path / "cp.jsonl"
    cp.write_text(
        '{"key": ["good", "addr"], "status": "unresolved", "value": {"name": "good"}}\n'
        '{"key": ["편"], "status": "matched", "value": {"name": "화로구이편"}}\n'  # shadowed-key bug
        '{"key": ["a", "b", "c"], "status": "matched", "value": {"name": "x"}}\n'
        '{"key": "notalist", "status": "matched", "value": {"name": "y"}}\n'
        '{"key": ["a", "b"], "status": "bogus", "value": {"name": "z"}}\n'
        '{"key": ["a", "b"], "status": "matched"}\n',
        encoding="utf-8")
    rows, unresolved, out_of_radius, processed = collect._load_checkpoint(cp)
    assert processed == {("good", "addr")}
    assert len(unresolved) == 1 and not rows and not out_of_radius
    assert "skipped 5" in capsys.readouterr().out


def test_checkpoint_key_survives_name_correction(tmp_path):
    # regression: an inner loop once rebound `key`, writing list("편") == ["편"]
    cp = tmp_path / "cp.jsonl"
    merchants = [{"name": "긱(GIG)", "address": "서울 도봉구 노해로 384",
                  "category": "커피 전문점", "phone": "02-1"}]

    def renaming_matcher(name, addr, cat=None):
        return {"place_id": "9", "lat": 37.6545, "lng": 127.0499,
                "kakao_url": "http://place.map.kakao.com/9", "place_name": "긱"}

    collect.build_dataset(merchants, renaming_matcher, delay_sec=0, checkpoint_path=cp)
    rec = json.loads(cp.read_text(encoding="utf-8").splitlines()[0])
    assert rec["key"] == ["긱(GIG)", "서울 도봉구 노해로 384"]
    assert rec["value"]["zeropay_name"] == "긱(GIG)"


def test_dedupe_by_place_id_keeps_first():
    # one physical restaurant must produce exactly one pin
    rows = [
        {"name": "가까운집", "kakao_place_id": "1", "distance_km": 0.1},
        {"name": "먼 중복", "kakao_place_id": "1", "distance_km": 0.9},
        {"name": "다른집", "kakao_place_id": "2", "distance_km": 0.5},
    ]
    out, merged = collect.dedupe_by_place_id(rows)
    assert merged == 1
    assert [r["kakao_place_id"] for r in out] == ["1", "2"]
    assert out[0]["name"] == "가까운집"  # rows arrive distance-sorted, so nearest wins


def test_dedupe_by_place_id_noop_when_unique():
    rows = [{"kakao_place_id": str(i)} for i in range(3)]
    out, merged = collect.dedupe_by_place_id(rows)
    assert merged == 0 and len(out) == 3


# --- run history --------------------------------------------------------

def test_append_run_history_creates_file_with_one_record(tmp_path):
    path = tmp_path / "collector-runs.json"
    record = {"startedAt": "2026-08-14T00:00:00Z", "finishedAt": "2026-08-14T00:01:00Z",
               "districts": ["도봉구"], "codes": ["56191"],
               "crawled": 3, "matched": 2, "unresolved": 1, "outOfRadius": 0, "duplicates": 0}
    collect._append_run_history(path, record)
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved == [record]


def test_append_run_history_appends_to_existing_records(tmp_path):
    path = tmp_path / "collector-runs.json"
    first = {"startedAt": "2026-08-13T00:00:00Z", "finishedAt": "2026-08-13T00:01:00Z",
              "districts": ["노원구"], "codes": ["56191"],
              "crawled": 1, "matched": 1, "unresolved": 0, "outOfRadius": 0, "duplicates": 0}
    path.write_text(json.dumps([first], ensure_ascii=False), encoding="utf-8")
    second = {"startedAt": "2026-08-14T00:00:00Z", "finishedAt": "2026-08-14T00:01:00Z",
               "districts": ["강북구"], "codes": ["56221"],
               "crawled": 5, "matched": 4, "unresolved": 1, "outOfRadius": 0, "duplicates": 0}
    collect._append_run_history(path, second)
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved == [first, second]


def test_append_run_history_does_not_raise_on_write_failure(tmp_path, capsys):
    # path is a directory, not a file -- write_text must fail, but the crawl
    # itself must not be aborted over a history-logging problem
    directory_as_path = tmp_path
    record = {"startedAt": "x", "finishedAt": "y", "districts": [], "codes": [],
               "crawled": 0, "matched": 0, "unresolved": 0, "outOfRadius": 0, "duplicates": 0}
    collect._append_run_history(directory_as_path, record)  # must not raise
    assert "[history]" in capsys.readouterr().out
