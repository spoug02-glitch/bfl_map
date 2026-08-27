import json

import collect


def place(permit_no, name, lat, lng, category="한식 일반 음식점업", biz_type="한식"):
    return {
        "permit_no": permit_no,
        "name": name,
        "address": "서울특별시 도봉구 마들로11길 57",
        "lotno_address": "서울특별시 도봉구 창동 1-1",
        "category": category,
        "biz_type": biz_type,
        "phone": "023456789",
        "lat": lat,
        "lng": lng,
        "licensed_on": "2023-05-02",
        "updated_at": "2026-08-26 22:47:50",
    }


SEEDCUBE = (collect.CENTER_LAT, collect.CENTER_LNG)


def test_build_rows_carries_permit_identity():
    rows = collect.build_rows([place("P-1", "역전우동", *SEEDCUBE)], set(), {})
    assert rows[0]["place_id"] == "P-1"
    assert rows[0]["name"] == "역전우동"
    assert rows[0]["biz_type"] == "한식"
    assert rows[0]["category"] == "한식 일반 음식점업"


def test_build_rows_sets_zeropay_flag_both_ways():
    places = [place("P-1", "가게하나", *SEEDCUBE), place("P-2", "가게둘", *SEEDCUBE)]
    rows = {r["place_id"]: r for r in collect.build_rows(places, {"P-1"}, {})}
    assert rows["P-1"]["zeropay"] is True
    assert rows["P-2"]["zeropay"] is False


def test_place_unknown_to_zeropay_still_appears():
    """전환의 핵심. 예전에는 제로페이에 없으면 지도에서 아예 사라졌다."""
    rows = collect.build_rows([place("P-9", "제로페이모르는집", *SEEDCUBE)], set(), {})
    assert [r["place_id"] for r in rows] == ["P-9"]


def test_build_rows_has_no_radius_filter():
    """예전 5km 원은 제로페이가 전국이라서 필요했던 것이다. 구 단위로 받는 지금은
    한 번 더 자르면 '데이터가 없는 곳'과 '가게가 없는 곳'을 구별할 수 없게 된다."""
    far = place("P-far", "멀리있는집", 37.7100, 127.0300)  # 씨드큐브에서 6km 넘음
    rows = collect.build_rows([far], set(), {})
    assert len(rows) == 1
    assert rows[0]["distance_km"] > 5.0


def test_build_rows_sorts_nearest_first():
    places = [
        place("P-far", "먼집", 37.7000, 127.0300),
        place("P-near", "가까운집", *SEEDCUBE),
    ]
    assert [r["place_id"] for r in collect.build_rows(places, set(), {})] == ["P-near", "P-far"]


def test_build_rows_merges_legacy_kakao_ids_when_present():
    legacy = {"P-1": {"kakao_place_id": "524535584", "kakao_url": "http://example.test/1"}}
    rows = collect.build_rows([place("P-1", "오스시", *SEEDCUBE)], set(), legacy)
    assert rows[0]["kakao_place_id"] == "524535584"


def test_build_rows_omits_kakao_fields_for_unknown_places():
    """새로 들어온 가게는 카카오 id 가 없다. 없는 채로 나가야지 빈 문자열이 되면
    '있는데 비었다'로 읽힌다."""
    rows = collect.build_rows([place("P-new", "새로생긴집", *SEEDCUBE)], set(), {})
    assert "kakao_place_id" not in rows[0]
    assert "kakao_url" not in rows[0]


def test_build_rows_generates_search_keys():
    rows = collect.build_rows([place("P-1", "CU 창동씨드큐브점", *SEEDCUBE)], set(), {})
    assert rows[0]["search_keys"], "brands.search_keys 결과가 비면 검색이 죽는다"


def test_dedupe_by_place_id_keeps_first():
    rows = [
        {"place_id": "P-1", "name": "첫번째"},
        {"place_id": "P-1", "name": "두번째"},
        {"place_id": "P-2", "name": "다른집"},
    ]
    out, merged = collect.dedupe_by_place_id(rows)
    assert [r["name"] for r in out] == ["첫번째", "다른집"]
    assert merged == 1


def test_dedupe_by_place_id_noop_when_unique():
    rows = [{"place_id": "P-1"}, {"place_id": "P-2"}]
    out, merged = collect.dedupe_by_place_id(rows)
    assert out == rows and merged == 0


def test_load_legacy_kakao_missing_file_is_not_an_error(tmp_path):
    assert collect.load_legacy_kakao(tmp_path / "nope.json") == {}


def test_load_legacy_kakao_survives_a_corrupt_file(tmp_path):
    """카카오 id 는 부가 정보다. 파일이 깨졌다고 수집 전체가 죽으면 안 된다."""
    path = tmp_path / "legacy.json"
    path.write_text("{ this is not json", encoding="utf-8")
    assert collect.load_legacy_kakao(path) == {}


def test_load_legacy_kakao_reads_a_real_file(tmp_path):
    path = tmp_path / "legacy.json"
    path.write_text(json.dumps({"P-1": {"kakao_place_id": "1"}}), encoding="utf-8")
    assert collect.load_legacy_kakao(path) == {"P-1": {"kakao_place_id": "1"}}


def test_build_rows_drops_비고정_and_명백한_유흥():
    """Phase 4 에서 permit_data 에 필터를 만들어놓고 여기서 안 불렀다.
    걸어가서 먹을 수 없는 자리만 뺀다 → permit_data.NON_LUNCH_BIZ_TYPES"""
    places = [
        place("P-ok", "밥집", *SEEDCUBE),
        place("P-truck", "푸드트럭집", *SEEDCUBE, biz_type="푸드트럭"),
        place("P-room", "룸살롱집", *SEEDCUBE, biz_type="룸살롱"),
        place("P-kids", "키즈카페집", *SEEDCUBE, biz_type="키즈카페"),
    ]
    assert [r["place_id"] for r in collect.build_rows(places, set(), {})] == ["P-ok"]


def test_build_rows_keeps_감성주점():
    """'다온' 은 업태가 감성주점인데 착한가격업소로 비빔밥 8,000원이 등록돼 있다.
    업태만 보고 빼면 밥집이 지도에서 사라진다 — 이행 dry-run 이 잡아준 건이다."""
    places = [place("P-daon", "다온", *SEEDCUBE, category="기타", biz_type="감성주점")]
    assert [r["place_id"] for r in collect.build_rows(places, set(), {})] == ["P-daon"]


def test_build_rows_keeps_호프통닭():
    """3구에 1,007곳이다. 술집 성격이지만 앱에 치킨 칩이 있고, 빼면 이 전환이
    없애려던 좁은 목록이 다시 생긴다."""
    places = [place("P-1", "영계소문", *SEEDCUBE, category="치킨 전문점", biz_type="호프/통닭")]
    assert [r["place_id"] for r in collect.build_rows(places, set(), {})] == ["P-1"]
