import blog_search as bs


def test_strip_tags_removes_naver_highlight():
    assert bs.strip_tags("창동역 <b>오스시</b> 후기") == "창동역 오스시 후기"


def test_strip_tags_unescapes_entities():
    assert bs.strip_tags("&quot;맛집&quot; &amp; 카페") == '"맛집" & 카페'


def test_title_mentions_ignores_spacing_and_parens():
    assert bs.title_mentions("꽈백최선생 창동점", "엄마의 최애꽈배기맛집 [꽈백최선생창동점]")
    assert bs.title_mentions("긱", "창동 긱 분위기 좋은 빙수 맛집 추천")


# 필터가 존재하는 이유. 실제 검색에서 상위에 올라온 스팸 글들이다 — 가맹점 명단을
# 통째로 덤프해서 상호가 목록 한 줄로 들어 있고, 제목에는 없다.
def test_title_mentions_rejects_merchant_list_spam():
    assert not bs.title_mentions("화목칼국수", "수원시 지역화폐 가맹점 알아보기(2탄)")
    assert not bs.title_mentions("빽다방 창동역점", "화성시 지역화폐 가맹점 알아보기")
    assert not bs.title_mentions("힘찬장어", "전국 로또 판매점 주소록 최신업데이트")


def test_pick_keeps_only_titles_that_name_the_shop():
    items = [
        {"title": "화성시 지역화폐 가맹점 알아보기", "link": "https://spam/1"},
        {"title": "창동역 혼밥 라멘 <b>코토코토</b> 솔직후기", "link": "https://good/1"},
    ]
    assert bs.pick("코토코토", items) == [
        {"url": "https://good/1", "title": "창동역 혼밥 라멘 코토코토 솔직후기"}
    ]


def test_pick_caps_at_keep_per_place():
    items = [{"title": f"창동 코토코토 후기 {i}", "link": f"https://b/{i}"} for i in range(5)]
    assert len(bs.pick("코토코토", items)) == bs.KEEP_PER_PLACE


def test_pick_returns_empty_when_nothing_names_the_shop():
    items = [{"title": "전국 로또 판매점 주소록", "link": "https://spam/2"}]
    assert bs.pick("화목칼국수", items) == []


# 본문은 가져오지도 저장하지도 않는다. description 이 넘어와도 결과에 남으면 안 된다.
def test_pick_never_stores_post_body():
    items = [{"title": "창동 코토코토 후기", "link": "https://b/1",
              "description": "본문 일부가 여기 들어온다"}]
    (row,) = bs.pick("코토코토", items)
    assert set(row) == {"url", "title"}


# 아래 제목들은 실제 수집분에서 나온 오탐이다. 상호가 제목에 있지만 다른 가게다.
def test_rejects_shop_of_the_same_name_in_another_city():
    assert not bs.looks_like_same_shop("미스테이크", "창원 마산 분위기 좋은 양식전문 맛집 '미스테이크'")
    assert not bs.looks_like_same_shop("포대포", "대전 송촌동 한우소곱창 포대포소곱창구이")
    assert not bs.looks_like_same_shop("맥켄치킨", "성남 금광동 치킨 맛집 맥켄치킨")


def test_rejects_short_name_that_is_just_a_common_word():
    assert not bs.looks_like_same_shop("미자", "오지산행후기(800차) 다시 미자사냥")
    assert not bs.looks_like_same_shop("주장", "주장하는 글쓰기 + 논술 수행 평가")
    assert not bs.looks_like_same_shop("행운", "토스행운의 퀴즈 정답 유플러스 다이브")


# 길이만으로 자르면 이것들을 잃는다. 2자 상호 78건 중 대부분이 이런 정상 글이었다.
def test_keeps_short_name_when_the_area_backs_it_up():
    assert bs.looks_like_same_shop("긱", "창동 긱 분위기 좋은 빙수 맛집 추천")
    assert bs.looks_like_same_shop("소녹", "쌍문역 카페 소녹 말차라떼 딸기롤케이크 맛집")
    assert bs.looks_like_same_shop("늘", "[창동] 창동역 안주 맛집 이자카야 '늘'")


def test_keeps_a_local_post_that_also_names_another_area():
    # 우리 지역이 함께 있으면 다른 지명이 있어도 받는다 — "창동 수유역 …" 같은 글.
    assert bs.looks_like_same_shop("야끼니꾸소량 수유점", "창동 수유역 술집 야끼니꾸소량 수유점")
