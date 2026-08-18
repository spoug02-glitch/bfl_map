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
