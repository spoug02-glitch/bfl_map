import kakao_local


def _doc(place_id="123", name="몬도커피 도봉점", road="서울 도봉구 도봉로150마길 34", x="127.04", y="37.65"):
    return {"id": place_id, "place_name": name, "road_address_name": road,
            "address_name": road, "x": x, "y": y, "place_url": f"http://place.map.kakao.com/{place_id}"}


def test_match_returns_first_same_gu_doc(monkeypatch):
    monkeypatch.setattr(kakao_local, "_search", lambda q, **kw: [_doc()])
    got = kakao_local.match_place("몬도커피", "서울특별시 도봉구 도봉로150마길 34")
    assert got == {"place_id": "123", "lat": 37.65, "lng": 127.04,
                   "kakao_url": "http://place.map.kakao.com/123", "place_name": "몬도커피 도봉점"}


def test_match_rejects_wrong_gu(monkeypatch):
    # fallback (Step C) also runs and finds nothing acceptable -> still None
    monkeypatch.setattr(kakao_local, "_search",
                        lambda q, **kw: [_doc(road="서울 강남구 테헤란로 1")])
    assert kakao_local.match_place("몬도커피", "서울특별시 도봉구 도봉로150마길 34") is None


def test_match_no_results(monkeypatch):
    monkeypatch.setattr(kakao_local, "_search", lambda q, **kw: [])
    assert kakao_local.match_place("없는가게", "서울특별시 도봉구 어딘가") is None


def test_clean_name_strips_corp_prefix_and_branch_parens():
    # zeropay DB names like "(주)거궁창동점" / "노모어피자(창동점)" need cleanup for kakao search
    assert kakao_local._clean_name("(주)거궁창동점") == "거궁창동점"
    assert kakao_local._clean_name("노모어피자(창동점)") == "노모어피자 창동점"
    assert kakao_local._clean_name("순대신록 씨드큐브 창동점") == "순대신록 씨드큐브 창동점"


def test_search_passes_size_and_category_group_code(monkeypatch):
    captured = {}

    def fake_get(url, params, headers, timeout):
        captured.update(params)
        class R:
            def raise_for_status(self):
                pass
            def json(self):
                return {"documents": []}
        return R()

    monkeypatch.setattr(kakao_local.requests, "get", fake_get)
    kakao_local._search("query", size=15, category_group_code="FD6")
    assert captured["size"] == 15
    assert captured["category_group_code"] == "FD6"


def test_search_omits_category_group_code_when_none(monkeypatch):
    captured = {}

    def fake_get(url, params, headers, timeout):
        captured.update(params)
        class R:
            def raise_for_status(self):
                pass
            def json(self):
                return {"documents": []}
        return R()

    monkeypatch.setattr(kakao_local.requests, "get", fake_get)
    kakao_local._search("query")
    assert "category_group_code" not in captured
    assert captured["size"] == 5


def test_match_place_alias_aware_cu_recovers_via_variant(monkeypatch):
    """zeropay says '씨유 ...', Kakao lists 'CU ...' -> the alias variant query must be tried."""
    calls = []

    def fake_search(query, **kw):
        calls.append(query)
        if query.startswith("cu"):
            return [_doc(name="CU 방학롯데캐슬점")]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place("씨유 방학롯데캐슬점", "서울특별시 도봉구 방학로 1")
    assert got is not None
    assert got["place_name"] == "CU 방학롯데캐슬점"
    assert any(c.startswith("cu") for c in calls)


def test_match_place_address_fallback_recovers_from_typo(monkeypatch):
    """zeropay '순대신록' (typo) vs kakao '순대실록' -> name query finds nothing,
    address+category fallback picks the correct store over an unrelated tenant."""
    def fake_search(query, size=5, category_group_code=None):
        if query == "서울특별시 도봉구 마들로13길 61":
            return [
                _doc(place_id="p1", name="씨드큐브 창동 공영주차장",
                     road="서울특별시 도봉구 마들로13길 61"),
                _doc(place_id="p2", name="순대실록 창동씨드큐브점",
                     road="서울특별시 도봉구 마들로13길 61"),
            ]
        return []  # every name-based attempt finds nothing

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place(
        "순대신록 씨드큐브 창동점", "서울특별시 도봉구 마들로13길 61", category="한식 일반 음식점업"
    )
    assert got is not None
    assert got["place_id"] == "p2"
    assert got["place_name"] == "순대실록 창동씨드큐브점"


def test_match_place_precision_guard_rejects_low_similarity_candidates(monkeypatch):
    """No candidate is similar enough -> must return None, never guess the
    nearest-sounding (or worst, a parking lot) tenant."""
    def fake_search(query, size=5, category_group_code=None):
        if query == "서울특별시 도봉구 마들로13길 61":
            return [
                _doc(place_id="p1", name="씨드큐브 창동 공영주차장",
                     road="서울특별시 도봉구 마들로13길 61"),
                _doc(place_id="p3", name="탐앤탐스 창동씨드큐브점",
                     road="서울특별시 도봉구 마들로13길 61"),
            ]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place(
        "순대신록 씨드큐브 창동점", "서울특별시 도봉구 마들로13길 61", category="한식 일반 음식점업"
    )
    assert got is None


def test_match_place_fallback_still_enforces_gu(monkeypatch):
    """A same-name, same-road+number store in a different 구 must not be
    accepted even via fallback (contrived: real road names don't usually
    repeat across cities, but the guard must still hold when they do)."""
    def fake_search(query, size=5, category_group_code=None):
        if query == "서울특별시 도봉구 어딘가로 1":
            return [_doc(place_id="p9", name="순대실록 어딘가점", road="서울 강남구 어딘가로 1")]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place(
        "순대신록 어딘가점", "서울특별시 도봉구 어딘가로 1", category="한식 일반 음식점업"
    )
    assert got is None


# --- F1/F2: address is authoritative, name similarity is only a tiebreaker ---

def test_address_fallback_rejects_high_similarity_wrong_address(monkeypatch):
    """Reproduces F1/F2: an exact-name candidate at the WRONG road/building
    (same 구, kilometres off) must be rejected even though its similarity
    score is 1.0 — the correct-address, lower-scoring candidate must win
    instead."""
    def fake_search(query, size=5, category_group_code=None):
        if query == "서울특별시 도봉구 마들로13길 61":
            return [
                _doc(place_id="wrong", name="순대신록 씨드큐브 창동점",
                     road="서울특별시 도봉구 다른로 999"),  # exact name, wrong building
                _doc(place_id="right", name="순대실록 창동씨드큐브점",
                     road="서울특별시 도봉구 마들로13길 61"),  # typo'd name, correct building
            ]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place(
        "순대신록 씨드큐브 창동점", "서울특별시 도봉구 마들로13길 61", category="한식 일반 음식점업"
    )
    assert got is not None
    assert got["place_id"] == "right"


def test_address_fallback_rejects_same_chain_different_branch(monkeypatch):
    """Reproduces F2's proof case: _similarity('GS25 신창동점','GS25
    도봉로120점').token == 1.0 (two branches of the same chain), but they
    are at different addresses -> must not be accepted."""
    assert kakao_local._similarity("GS25 신창동점", "GS25 도봉로120점").token == 1.0

    def fake_search(query, size=5, category_group_code=None):
        if query == "서울특별시 도봉구 창동로 1":
            return [_doc(place_id="other-branch", name="GS25 도봉로120점",
                          road="서울특별시 도봉구 도봉로120길 5")]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place(
        "GS25 신창동점", "서울특별시 도봉구 창동로 1", category="체인화 편의점"
    )
    assert got is None


def test_similarity_returns_full_and_token_components():
    """_similarity must expose both component scores (not just the max) so
    a caller can distinguish a real typo (both scores close) from a
    same-brand-different-branch false positive (token high, full low)."""
    score = kakao_local._similarity("GS25 신창동점", "GS25 도봉로120점")
    assert score.token == 1.0
    assert score.full < score.token
    assert score.best == max(score.full, score.token)


# --- F5: gu missing must not disable the address gate -----------------------

def test_address_fallback_gu_none_still_gates_on_address_core(monkeypatch):
    """When _gu_of(address) is None, the fallback must still require an
    exact road+number match rather than accepting any candidate the search
    happens to return."""
    def fake_search(query, size=5, category_group_code=None):
        if query == "마들로13길 61":
            return [_doc(place_id="wrong-place", name="아무가게",
                          road="부산광역시 해운대구 다른로 5")]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place("아무가게점", "마들로13길 61", category="한식 일반 음식점업")
    assert got is None
    assert kakao_local._gu_of("마들로13길 61") is None


def test_address_fallback_rejects_different_brand_sharing_location_suffix(monkeypatch):
    """Found via the live F6 audit: a multi-tenant building can have an
    UNRELATED business at the exact same address whose full-name score is
    inflated by a shared generic branch/location suffix (e.g. a hospital
    name) even though the brand itself is completely different. The
    address gate alone isn't enough here (both are genuinely at that
    building) — the low brand-token score must also reject it.
    Real case: '이마트24 상계백병원점' (Emart24) vs '카페센트 상계백병원점' (an
    unrelated cafe) scores full=0.667 (>= FALLBACK_THRESHOLD) but
    token=0.222 (< TOKEN_FLOOR)."""
    score = kakao_local._similarity("이마트24 상계백병원점", "카페센트 상계백병원점")
    assert score.full >= kakao_local.FALLBACK_THRESHOLD
    assert score.token < kakao_local.TOKEN_FLOOR

    def fake_search(query, size=5, category_group_code=None):
        if query == "서울특별시 노원구 동일로 1342":
            return [_doc(place_id="wrong-tenant", name="카페센트 상계백병원점",
                          road="서울특별시 노원구 동일로 1342")]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place(
        "이마트24 상계백병원점", "서울특별시 노원구 동일로 1342", category="체인화 편의점"
    )
    assert got is None


def test_address_fallback_gu_none_still_accepts_correct_address_core(monkeypatch):
    """The gu-less gate isn't overly strict: a candidate at the exact same
    road+number must still be accepted."""
    def fake_search(query, size=5, category_group_code=None):
        if query == "마들로13길 61":
            return [_doc(place_id="right", name="가나다마트", road="마들로13길 61")]
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    got = kakao_local.match_place("가나다마트점", "마들로13길 61", category="한식 일반 음식점업")
    assert got is not None
    assert got["place_id"] == "right"


def test_address_core_extracts_road_and_main_number():
    assert kakao_local._address_core("서울특별시 도봉구 마들로13길 61 (창동, 씨드큐브)") == \
        ("마들로13길", "61")


def test_address_core_handles_main_sub_number():
    assert kakao_local._address_core("서울 도봉구 시루봉로 105-2") == ("시루봉로", "105-2")


def test_address_core_handles_san_lot_prefix():
    assert kakao_local._address_core("서울특별시 노원구 동일로 산36-1") == ("동일로", "36-1")


def test_address_core_none_when_unparseable():
    assert kakao_local._address_core("서울특별시 도봉구 어딘가 1") is None


def test_clean_address_strips_trailing_dong_building_annotation():
    assert kakao_local._clean_address(
        "서울특별시 도봉구 도봉로150마길 34 (방학동, 도봉 롯데캐슬 골든파크)"
    ) == "서울특별시 도봉구 도봉로150마길 34"
    assert kakao_local._clean_address("서울특별시 도봉구 마들로13길 61") == "서울특별시 도봉구 마들로13길 61"


def test_category_group_code_mapping():
    assert kakao_local._category_group_code("체인화 편의점") == "CS2"
    assert kakao_local._category_group_code("커피 전문점") == "CE7"
    assert kakao_local._category_group_code("제과점업") == "CE7"
    assert kakao_local._category_group_code("한식 일반 음식점업") == "FD6"
    assert kakao_local._category_group_code(None) is None


def test_match_place_call_budget(monkeypatch):
    """Total _search calls per merchant stays within the documented maximum:
    len(name_variants) [Step B] + up to 2 [Step C: with-category, then
    no-category retry]. For a name matching exactly one alias group that's
    2 + 2 = 4 total calls (3 'added' beyond the single pre-existing lookup)."""
    calls = []

    def fake_search(query, size=5, category_group_code=None):
        calls.append(query)
        return []

    monkeypatch.setattr(kakao_local, "_search", fake_search)
    kakao_local.match_place("씨유 방학롯데캐슬점", "서울특별시 도봉구 방학로 1", category="체인화 편의점")
    assert len(calls) <= 4
