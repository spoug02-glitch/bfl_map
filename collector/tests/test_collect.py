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


def fake_menu(place_id):
    return [{"name": "김치찌개", "price": "9000"}] if place_id == "1" else []


def test_build_dataset_filters_and_dedupes():
    rows, unresolved = collect.build_dataset(MERCHANTS, fake_matcher, fake_menu, delay_sec=0)
    assert len(rows) == 2  # 먼집 >5km 제외, 매칭실패집 unresolved, dup 제거, 편의점 포함
    by_name = {r["name"]: r for r in rows}
    r = by_name["가까운집"]
    assert r["kakao_place_id"] == "1"
    assert r["menus"] == [{"name": "김치찌개", "price": "9000"}]
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

    rows, unresolved = collect.build_dataset(merchants, matcher, fake_menu, delay_sec=0)
    names = [r["name"] for r in rows] + [u["name"] for u in unresolved]
    assert "씨유 씨드큐브점" in names  # CU: 비플페이 사용 가능, 제외 금지


def test_build_dataset_skips_menu_for_convenience_stores():
    calls = []

    def spy_menu(place_id):
        calls.append(place_id)
        return []

    rows, _ = collect.build_dataset(MERCHANTS, fake_matcher, spy_menu, delay_sec=0)
    assert "3" not in calls  # GS25 (체인화 편의점) must not trigger a panel3 call
    gs = next(r for r in rows if r["name"] == "GS25 씨드큐브점")
    assert gs["menus"] == []


def test_build_dataset_passes_category_to_matcher():
    captured = []

    def spy_matcher(name, address, category=None):
        captured.append((name, category))
        return COORDS.get(name)

    collect.build_dataset(MERCHANTS, spy_matcher, fake_menu, delay_sec=0)
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

    rows, _ = collect.build_dataset(merchants, matcher, fake_menu, delay_sec=0)
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
    rows, _ = collect.build_dataset(MERCHANTS, fake_matcher, fake_menu, delay_sec=0)
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
    collect.build_dataset(many, lambda n, a, c=None: None, fake_menu,
                          delay_sec=0, progress_every=2)
    out = capsys.readouterr().out
    assert "[match] 2/5" in out
    assert "unresolved=" in out


def test_build_dataset_silent_without_progress_every(capsys):
    collect.build_dataset(MERCHANTS, fake_matcher, fake_menu, delay_sec=0)
    assert "[match]" not in capsys.readouterr().out


# --- D2: out-of-radius audit trail ----------------------------------------

def test_build_dataset_records_out_of_radius_match_with_distance():
    """A merchant that matches a real Kakao place beyond RADIUS_KM must be
    recorded (not silently dropped), carrying enough to audit a suspected
    wrong match: zeropay name/address, matched kakao place_name/place_id,
    and the computed distance."""
    out_of_radius = []
    rows, unresolved = collect.build_dataset(MERCHANTS, fake_matcher, fake_menu, delay_sec=0,
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
    rows, unresolved = collect.build_dataset(MERCHANTS, fake_matcher, fake_menu, delay_sec=0,
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
            collect.build_dataset(ms, dying, fake_menu, delay_sec=0, checkpoint_path=cp)
        except ValueError as e:
            raise RuntimeError("boom") from e

    assert len(calls) == 2
    first_pass = len(calls)

    # resume: already-processed merchants must not be re-matched
    calls.clear()
    rows, unresolved = collect.build_dataset(ms, counting_matcher, fake_menu,
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
    collect.build_dataset(MERCHANTS, fake_matcher, fake_menu, delay_sec=0)
    assert not cp.exists()
