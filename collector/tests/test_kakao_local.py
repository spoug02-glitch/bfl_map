import kakao_local


def _doc(place_id="123", name="몬도커피 도봉점", road="서울 도봉구 도봉로150마길 34", x="127.04", y="37.65"):
    return {"id": place_id, "place_name": name, "road_address_name": road,
            "address_name": road, "x": x, "y": y, "place_url": f"http://place.map.kakao.com/{place_id}"}


def test_match_returns_first_same_gu_doc(monkeypatch):
    monkeypatch.setattr(kakao_local, "_search", lambda q: [_doc()])
    got = kakao_local.match_place("몬도커피", "서울특별시 도봉구 도봉로150마길 34")
    assert got == {"place_id": "123", "lat": 37.65, "lng": 127.04,
                   "kakao_url": "http://place.map.kakao.com/123"}


def test_match_rejects_wrong_gu(monkeypatch):
    monkeypatch.setattr(kakao_local, "_search",
                        lambda q: [_doc(road="서울 강남구 테헤란로 1")])
    assert kakao_local.match_place("몬도커피", "서울특별시 도봉구 도봉로150마길 34") is None


def test_match_no_results(monkeypatch):
    monkeypatch.setattr(kakao_local, "_search", lambda q: [])
    assert kakao_local.match_place("없는가게", "서울특별시 도봉구 어딘가") is None


def test_clean_name_strips_corp_prefix_and_branch_parens():
    # zeropay DB names like "(주)거궁창동점" / "노모어피자(창동점)" need cleanup for kakao search
    assert kakao_local._clean_name("(주)거궁창동점") == "거궁창동점"
    assert kakao_local._clean_name("노모어피자(창동점)") == "노모어피자 창동점"
    assert kakao_local._clean_name("순대신록 씨드큐브 창동점") == "순대신록 씨드큐브 창동점"
