import zeropay_flag as zf


def place(name, address, permit_no):
    return {"name": name, "address": address, "permit_no": permit_no}


def test_address_key_extracts_road_and_number():
    assert zf.address_key("서울특별시 도봉구 마들로13길 61 (창동, 씨드큐브)") == ("마들로13길", "61")
    assert zf.address_key("서울 도봉구 노해로69길 21-11") == ("노해로69길", "21-11")


def test_address_key_returns_none_when_unparseable():
    assert zf.address_key("") is None
    assert zf.address_key("주소미상") is None


def test_match_merchant_needs_both_address_and_name():
    index = zf.build_permit_index([
        place("역전우동0410 창동역점", "서울특별시 도봉구 마들로11길 57, 1층", "P-1"),
        place("두찜 창동역점", "서울특별시 도봉구 마들로11길 57, 2층", "P-2"),
    ])
    got = zf.match_merchant({"name": "역전우동0410", "address": "서울 도봉구 마들로11길 57"}, index)
    assert got["permit_no"] == "P-1"


def test_match_merchant_refuses_when_the_building_has_no_matching_name():
    """한 건물에 여러 가게가 있다. 이름이 안 맞으면 플래그를 달지 않는다 —
    안 되는 집에 '비플페이 됨'을 붙이는 것이 제일 나쁜 실패다."""
    index = zf.build_permit_index([place("두찜 창동역점", "서울특별시 도봉구 마들로11길 57", "P-2")])
    assert zf.match_merchant({"name": "역전우동0410", "address": "서울 도봉구 마들로11길 57"}, index) is None


def test_match_merchant_refuses_on_unparseable_address():
    index = zf.build_permit_index([place("아무집", "서울특별시 도봉구 마들로11길 57", "P-1")])
    assert zf.match_merchant({"name": "아무집", "address": "주소미상"}, index) is None


def test_flag_reports_merchants_it_could_not_place():
    places = [place("역전우동0410 창동역점", "서울특별시 도봉구 마들로11길 57", "P-1")]
    merchants = [
        {"name": "역전우동0410", "address": "서울 도봉구 마들로11길 57"},
        {"name": "사라진집", "address": "서울 도봉구 마들로11길 99"},
    ]
    flagged, unmatched = zf.flag(places, merchants)
    assert flagged == {"P-1"}
    assert [m["name"] for m in unmatched] == ["사라진집"]


def test_lot_key_extracts_dong_and_number():
    assert zf.lot_key("서울시 도봉구 쌍문동 74-4") == ("쌍문동", "74-4")
    assert zf.lot_key("서울특별시 도봉구 창동 산12") == ("창동", "산12")
    assert zf.lot_key("서울특별시 도봉구 마들로11길 57") is None


def test_match_falls_back_to_lot_address():
    """제로페이는 스무 곳에 한 곳꼴로 지번 주소를 준다 — 도로명이 아예 없다."""
    index = zf.build_permit_index([{
        "name": "철수네조개일번지",
        "address": "서울특별시 도봉구 도봉로 100",
        "lotno_address": "서울특별시 도봉구 쌍문동 74-4",
        "permit_no": "P-1",
    }])
    got = zf.match_merchant({"name": "철수네조개일번지", "address": "서울시 도봉구 쌍문동 74-4"}, index)
    assert got["permit_no"] == "P-1"


def test_reordered_branch_words_match_within_one_building():
    """'순대실록 씨드큐브창동점' 과 '순대실록 창동씨드큐브점' 은 같은 집이다."""
    index = zf.build_permit_index([
        place("순대실록 씨드큐브창동점", "서울특별시 도봉구 마들로13길 61", "P-1")])
    got = zf.match_merchant(
        {"name": "순대실록 창동씨드큐브점", "address": "서울 도봉구 마들로13길 61"}, index)
    assert got["permit_no"] == "P-1"


def test_typo_on_one_side_matches():
    index = zf.build_permit_index([
        place("원조의정부부대찌게", "서울특별시 도봉구 마들로13길 61", "P-1")])
    got = zf.match_merchant(
        {"name": "원조의정부부대찌개", "address": "서울 도봉구 마들로13길 61"}, index)
    assert got["permit_no"] == "P-1"


def test_three_shared_characters_is_not_enough():
    """'장모님사철탕' 과 '장모님집' 은 다른 집일 수 있다. 없는 플래그보다
    틀린 플래그가 훨씬 나쁘다."""
    index = zf.build_permit_index([
        place("장모님집", "서울특별시 도봉구 마들로13길 61", "P-1")])
    assert zf.match_merchant(
        {"name": "장모님사철탕", "address": "서울 도봉구 마들로13길 61"}, index) is None
