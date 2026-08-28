import pytest

import permit_data
from geo import haversine_km

# 도봉구 '역전우동0410 창동역점' 실제 API 응답에서 필요한 필드만 추린 것.
SAMPLE_ROW = {
    "MNG_NO": "3090000-101-2023-00123",
    "BPLC_NM": "역전우동0410 창동역점",
    "BZSTAT_SE_NM": "한식",
    "SALS_STTS_CD": "01",
    "SALS_STTS_NM": "영업/정상",
    "ROAD_NM_ADDR": "서울특별시 도봉구 마들로11길 57, EQ빌딩 1층 103호 (창동)",
    "LOTNO_ADDR": "서울특별시 도봉구 창동 1-1",
    "TELNO": "",
    "CRD_INFO_X": "204357.382835077",
    "CRD_INFO_Y": "461235.763310872",
    "LCPMT_YMD": "2023-05-02",
    "DAT_UPDT_PNT": "2026-08-26 22:47:50",
}


def test_normalize_maps_fields_and_converts_coordinates():
    place = permit_data.normalize(SAMPLE_ROW)
    assert place is not None
    assert place["permit_no"] == "3090000-101-2023-00123"
    assert place["name"] == "역전우동0410 창동역점"
    assert place["category"] == "한식 일반 음식점업"
    assert place["biz_type"] == "한식"
    # 카카오가 같은 가게에 주는 좌표와 50m 안이어야 한다
    assert haversine_km(place["lat"], place["lng"], 37.6534906, 127.0501654) * 1000 < 50


def test_normalize_prefers_road_address_but_falls_back():
    row = dict(SAMPLE_ROW, ROAD_NM_ADDR="")
    assert permit_data.normalize(row)["address"] == SAMPLE_ROW["LOTNO_ADDR"]


@pytest.mark.parametrize("x,y", [("", "461235.7"), ("204357.3", ""), (None, None), ("abc", "461235.7")])
def test_normalize_returns_none_without_usable_coordinate(x, y):
    assert permit_data.normalize(dict(SAMPLE_ROW, CRD_INFO_X=x, CRD_INFO_Y=y)) is None


@pytest.mark.parametrize("biz_type,expected", [
    ("한식", "한식 일반 음식점업"),
    ("식육(숯불구이)", "한식 육류요리 전문점"),
    ("중국식", "중식 음식점업"),
    ("횟집", "일식 음식점업"),
    ("분식", "김밥 및 기타 간이 음식점업"),
    ("통닭(치킨)", "치킨 전문점"),
    ("까페", "커피 전문점"),
])
def test_map_category(biz_type, expected):
    assert permit_data.map_category(biz_type) == expected


def test_unknown_biz_type_passes_through_rather_than_becoming_기타():
    """새 업태가 조용히 '기타'로 뭉개지면 보고서에서 안 보인다."""
    assert permit_data.map_category("우주정거장식당") == "우주정거장식당"
    assert permit_data.map_category("") == "기타"


@pytest.mark.parametrize("biz_type", ["룸살롱", "간이주점", "푸드트럭", "식품소분업", "키즈카페"])
def test_non_lunch_biz_types_rejected(biz_type):
    assert not permit_data.is_lunch_candidate(biz_type)


@pytest.mark.parametrize("biz_type", ["한식", "중국식", "분식", "기타"])
def test_lunch_candidates_accepted(biz_type):
    assert permit_data.is_lunch_candidate(biz_type)


@pytest.mark.parametrize("biz_type", ["감성주점", "정종/대포집/소주방", "다방", "라이브카페"])
def test_drink_led_but_fixed_address_is_kept(biz_type):
    """'다온' 은 업태가 감성주점인데 착한가격업소로 비빔밥 8,000원이 등록돼 있다.
    인허가는 등록한 것을 적지 파는 것을 적지 않는다 — 업태만으로 빼면
    이 전환이 없애려던 좁은 목록이 다시 생긴다."""
    assert permit_data.is_lunch_candidate(biz_type)


def test_호프통닭_is_kept():
    """3구에 1,007곳이다. 빼면 이 전환이 없애려던 좁은 목록이 다시 생긴다."""
    assert permit_data.is_lunch_candidate("호프/통닭")
    assert permit_data.map_category("호프/통닭") == "치킨 전문점"


def test_every_biz_type_seen_in_3gu_is_mapped():
    """2026-08-27 전량 수집에서 실제로 나온 37개 업태. 새 업태가 들어오면
    map_category 가 원문을 그대로 흘려보내므로 이 목록으로 잡는다."""
    seen_in_3gu = [
        "한식", "기타", "호프/통닭", "커피숍", "기타 휴게음식점", "분식", "편의점",
        "일식", "중국식", "경양식", "일반조리판매", "식육(숯불구이)", "통닭(치킨)",
        "패스트푸드", "까페", "횟집", "김밥(도시락)", "제과점영업", "뷔페식",
        "외국음식전문점(인도,태국등)", "냉면집", "전통찻집", "복어취급", "탕류(보신용)",
        "패밀리레스트랑", "백화점", "아이스크림", "떡카페", "철도역구내", "과자점", "극장",
    ]
    unmapped = [
        b for b in seen_in_3gu
        if permit_data.is_lunch_candidate(b) and b not in permit_data.CATEGORY_MAP
    ]
    assert unmapped == [], f"매핑 안 된 업태: {unmapped}"


def test_items_of_handles_single_object():
    """결과가 1건이면 API 가 배열 대신 객체를 준다."""
    assert permit_data._items_of({"items": {"item": SAMPLE_ROW}}) == [SAMPLE_ROW]
    assert permit_data._items_of({"items": {"item": [SAMPLE_ROW]}}) == [SAMPLE_ROW]
    assert permit_data._items_of({"items": {}}) == []
    assert permit_data._items_of({}) == []


def test_fetch_page_rejects_oversized_num_rows():
    """numOfRows 상한 100 을 넘기면 서버가 조용히 100 으로 깎는다 — 그러면
    totalCount 대조가 어긋나 완전성 판정이 망가진다."""
    with pytest.raises(ValueError):
        permit_data.fetch_page("general_restaurants", "3090000", 1, 1000, api_key="x")


def test_incomplete_crawl_raises_instead_of_warning(monkeypatch):
    """부분 수집을 통과시키면 collect.py 가 restaurants.json 을 줄어든 목록으로
    덮어쓴다. 위키의 '--limit 스모크 테스트가 5,834곳을 19곳으로 덮어썼다' 사고와
    같은 종류라, 경고가 아니라 실패여야 한다."""
    # 서버가 250건이라 해놓고 2페이지에서 빈 목록을 준다 — 실제로 겪는 절단 모양이다.
    def fake_fetch(service, local_code, page, num_rows=100, *, api_key, status="01"):
        rows = [SAMPLE_ROW] if page == 1 else []
        return {"totalCount": 250, "items": {"item": rows}}

    monkeypatch.setattr(permit_data, "fetch_page", fake_fetch)
    with pytest.raises(permit_data.IncompletePermitCrawl):
        list(permit_data.iter_places("general_restaurants", "3090000", api_key="x"))


def test_complete_crawl_does_not_raise(monkeypatch):
    def fake_fetch(service, local_code, page, num_rows=100, *, api_key, status="01"):
        return {"totalCount": 1, "items": {"item": [SAMPLE_ROW]}}

    monkeypatch.setattr(permit_data, "fetch_page", fake_fetch)
    got = list(permit_data.iter_places("general_restaurants", "3090000", api_key="x"))
    assert len(got) == 1
