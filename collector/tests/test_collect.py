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


def fake_matcher(name, address):
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

    def matcher(name, address):
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
