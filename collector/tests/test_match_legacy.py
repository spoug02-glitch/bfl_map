import match_legacy as ml


def place(name, lat, lng, permit_no="3090000-101-2026-00001"):
    return {"name": name, "lat": lat, "lng": lng, "permit_no": permit_no}


def row(name, lat, lng, kakao_place_id="1", zeropay_name=None):
    r = {"name": name, "lat": lat, "lng": lng, "kakao_place_id": kakao_place_id}
    if zeropay_name:
        r["zeropay_name"] = zeropay_name
    return r


def test_normalize_drops_brackets_and_punctuation():
    assert ml.normalize_name("세친구곱창(수유인수점)") == "세친구곱창"
    assert ml.normalize_name("영계소문 옛날통닭 · 창동") == "영계소문옛날통닭창동"


def test_base_name_drops_only_the_trailing_점():
    """지점명 전체를 떼려면 '상계'가 지명인 걸 알아야 한다 — 그건 못 한다.
    끝의 점/본점/직영점만 떼고, 남는 차이는 PARTIAL 이 받는다."""
    assert ml.base_name("섭생정식 창동본점") == "섭생정식창동"
    assert ml.base_name("이조모밀 상계점") == "이조모밀상계"


def test_branch_name_resolves_as_partial():
    assert ml.name_score("이조모밀", "이조모밀 상계점") == ml.PARTIAL


def test_name_score_levels():
    assert ml.name_score("사누끼", "사누끼") == ml.EXACT
    assert ml.name_score("짱구네", "짱구네 분식") == ml.PARTIAL
    assert ml.name_score("황제소곱창", "빵과함께") == ml.NO_MATCH


def test_name_score_uses_zeropay_spelling_too():
    """`name` 은 카카오 표기다. 2,541행이 제로페이 상호와 다르다."""
    assert ml.name_score("이조모밀", "이조모밀 상계점", "이조모밀") == ml.EXACT


def test_name_score_ignores_one_character_overlap():
    """한 글자 겹침으로 붙으면 한 건물 안 가게끼리 신원이 바뀐다."""
    assert ml.name_score("가", "가나다라") == ml.NO_MATCH


def test_match_one_prefers_exact_name_over_nearer_partial():
    index = ml.build_index([
        place("짱구네 분식", 37.65300, 127.04780, "P-partial"),
        place("짱구네", 37.65310, 127.04790, "P-exact"),
    ])
    got, score, _ = ml.match_one(row("짱구네", 37.65300, 127.04780), index)
    assert got["permit_no"] == "P-exact"
    assert score == ml.EXACT


def test_match_one_rejects_beyond_max_distance():
    index = ml.build_index([place("사누끼", 37.66500, 127.04780)])
    got, _, _ = ml.match_one(row("사누끼", 37.65300, 127.04780), index)
    assert got is None


def test_match_one_never_matches_on_distance_alone():
    """같은 건물의 다른 가게로 붙으면 남의 메뉴가 조용히 옮겨간다."""
    index = ml.build_index([place("황제소곱창", 37.65300, 127.04780)])
    got, _, _ = ml.match_one(row("빵과함께", 37.65300, 127.04780), index)
    assert got is None


def test_build_mapping_tallies_each_outcome():
    places = [
        place("사누끼", 37.65300, 127.04780, "P-1"),
        place("짱구네 분식", 37.65310, 127.04790, "P-2"),
    ]
    rows = [
        row("사누끼", 37.65300, 127.04780, "K-1"),
        row("짱구네", 37.65310, 127.04790, "K-2"),
        row("없는가게", 37.65300, 127.04780, "K-3"),
    ]
    mapping, tally = ml.build_mapping(rows, places)
    assert mapping == {"K-1": "P-1", "K-2": "P-2"}
    assert tally["exact"] == 1 and tally["partial"] == 1 and tally["none"] == 1


def test_unique_name_matches_past_the_distance_cap():
    """'박은선닭꼬치' 는 카카오 좌표에서 154m 떨어져 있지만 3구에 하나뿐이다."""
    name_index = ml.build_name_index([place("박은선닭꼬치", 37.65440, 127.04780, "P-1")])
    got = ml.match_unique_name(row("박은선닭꼬치", 37.65300, 127.04780), name_index)
    assert got["permit_no"] == "P-1"


def test_unique_name_refuses_when_the_name_repeats():
    """'락궁' 은 3구에 일곱 곳이다. 가까운 걸 찍으면 남의 가게가 된다."""
    name_index = ml.build_name_index([
        place("락궁", 37.65440, 127.04780, "P-1"),
        place("락궁", 37.68000, 127.03000, "P-2"),
    ])
    assert ml.match_unique_name(row("락궁", 37.65300, 127.04780), name_index) is None


def test_unique_name_still_has_an_outer_limit():
    name_index = ml.build_name_index([place("멀리있는집", 37.70000, 127.04780, "P-1")])
    assert ml.match_unique_name(row("멀리있는집", 37.65300, 127.04780), name_index) is None


def test_build_mapping_counts_unique_name_separately():
    places = [place("사누끼", 37.65300, 127.04780, "P-1"),
              place("박은선닭꼬치", 37.65440, 127.04780, "P-2")]
    rows = [row("사누끼", 37.65300, 127.04780, "K-1"),
            row("박은선닭꼬치", 37.65300, 127.04780, "K-2")]
    mapping, tally = ml.build_mapping(rows, places)
    assert mapping == {"K-1": "P-1", "K-2": "P-2"}
    assert tally["exact"] == 1 and tally["unique_name"] == 1
