import server

DATA = [
    {"name": "순대실록 창동씨드큐브점", "category": "한식 일반 음식점업", "distance_km": 0.0,
     "address": "서울 도봉구 마들로13길 61", "phone": "02-1", "kakao_place_id": "1080924210",
     "kakao_url": "http://place.map.kakao.com/1080924210",
     "menus": [{"name": "얼큰 순대국", "price": "15000"}]},
    {"name": "몬도커피", "category": "커피 전문점", "distance_km": 2.5,
     "address": "서울 도봉구 도봉로 1", "phone": "02-2", "kakao_place_id": "2",
     "kakao_url": "http://place.map.kakao.com/2", "menus": []},
]

# Fixture with search_keys populated, used to verify search_keys is stripped
# from tool output and never leaks into the caller-facing result.
DATA_WITH_KEYS = [
    {**row, "search_keys": [server.brands.normalize(row["name"])]} for row in DATA
]


def test_filter_by_keyword():
    got = server.filter_restaurants(DATA, keyword="순대", category=None, max_distance_km=None)
    assert [r["name"] for r in got] == ["순대실록 창동씨드큐브점"]


def test_filter_by_category_and_distance():
    got = server.filter_restaurants(DATA, keyword=None, category="커피", max_distance_km=3.0)
    assert [r["name"] for r in got] == ["몬도커피"]
    got2 = server.filter_restaurants(DATA, keyword=None, category="커피", max_distance_km=1.0)
    assert got2 == []


def test_search_restaurants_never_returns_search_keys(monkeypatch):
    monkeypatch.setattr(server, "_load", lambda: DATA_WITH_KEYS)
    rows = server.search_restaurants(keyword="", category="", max_distance_km=0)
    assert len(rows) == 2
    for row in rows:
        assert "search_keys" not in row


def test_search_restaurants_truncates_with_note(monkeypatch):
    many = [
        {"name": f"가게{i}", "category": "한식", "distance_km": 0.1 * i,
         "address": "a", "phone": "p", "kakao_place_id": str(i),
         "kakao_url": "u", "search_keys": [f"가게{i}"], "menus": []}
        for i in range(35)
    ]
    monkeypatch.setattr(server, "_load", lambda: many)
    rows = server.search_restaurants(keyword="", category="", max_distance_km=0)
    assert len(rows) == server.LIMIT + 1
    assert "note" in rows[-1]
    assert "35" in rows[-1]["note"]


def test_get_menu_ambiguous_name_returns_candidates(monkeypatch):
    dup = [
        {"name": "커피나무 창동점", "category": "커피 전문점", "distance_km": 0.5,
         "address": "a1", "phone": "p1", "kakao_place_id": "10",
         "kakao_url": "u1", "search_keys": ["커피나무창동점"], "menus": []},
        {"name": "커피나무 도봉점", "category": "커피 전문점", "distance_km": 0.8,
         "address": "a2", "phone": "p2", "kakao_place_id": "11",
         "kakao_url": "u2", "search_keys": ["커피나무도봉점"], "menus": []},
    ]
    monkeypatch.setattr(server, "_load", lambda: dup)
    result = server.get_menu("커피나무")
    assert "error" in result
    assert "candidates" in result
    assert set(result["candidates"]) == {"커피나무 창동점", "커피나무 도봉점"}


def test_get_menu_not_found(monkeypatch):
    monkeypatch.setattr(server, "_load", lambda: DATA)
    result = server.get_menu("존재하지않는가게이름xyz")
    assert "error" in result


def test_get_menu_uses_live_menus_when_fetch_returns_results(monkeypatch):
    monkeypatch.setattr(server, "_load", lambda: DATA)
    fresh_menus = [{"name": "새우튀김", "price": "8000"}]
    monkeypatch.setattr(server.menu_mod, "fetch_menu", lambda place_id: fresh_menus)
    result = server.get_menu("순대실록")
    assert result["source"] == "live"
    assert result["menus"] == fresh_menus


def test_get_menu_falls_back_to_cached_menus_when_fetch_returns_empty(monkeypatch):
    monkeypatch.setattr(server, "_load", lambda: DATA)
    monkeypatch.setattr(server.menu_mod, "fetch_menu", lambda place_id: [])
    result = server.get_menu("순대실록")
    assert result["source"] == "cached"
    assert result["menus"] == DATA[0]["menus"]
