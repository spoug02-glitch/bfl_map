import zeropay


def test_food_codes_has_13_categories():
    assert len(zeropay.FOOD_CODES) == 13
    assert zeropay.FOOD_CODES["56221"] == "커피 전문점"
    # DB-verified codes (site dropdown lies: 56193 etc. return 0 rows)
    assert zeropay.FOOD_CODES["56162"] == "치킨 전문점"
    assert zeropay.FOOD_CODES["56150"] == "제과점업"
    assert "56193" not in zeropay.FOOD_CODES
    assert zeropay.CONVENIENCE_CODES == {"47122": "체인화 편의점"}


def test_build_payload_double_encoded():
    body = zeropay._build_body("도봉구", "56221", 2, 100)
    assert body.startswith("_JSON_=")
    # 이중 인코딩: '{' -> %7B -> %257B
    assert "%257B" in body
    assert "56221" in body


def test_iter_all_merchants_paginates(monkeypatch):
    pages = {
        1: {"TOTAL_CNT": 3, "PAGE_SIZE": 2, "LIST2": [
            {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "서울 도봉구 1", "BIZ_TYPE": "커피 전문점", "SHOP_TEL_NO": "02-1"},
            {"AFLT_NM": "가게B", "AFLT_ROAD_ADDR": "서울 도봉구 2", "BIZ_TYPE": "커피 전문점", "SHOP_TEL_NO": "02-2"},
        ]},
        2: {"TOTAL_CNT": 3, "PAGE_SIZE": 2, "LIST2": [
            {"AFLT_NM": "가게C", "AFLT_ROAD_ADDR": "서울 도봉구 3", "BIZ_TYPE": "커피 전문점", "SHOP_TEL_NO": "02-3"},
        ]},
    }

    def fake_fetch(gu, code, page, page_size=100):
        return pages[page]

    monkeypatch.setattr(zeropay, "fetch_merchants", fake_fetch)
    got = list(zeropay.iter_all_merchants("도봉구", "56221", delay_sec=0, page_size=2))
    assert [m["name"] for m in got] == ["가게A", "가게B", "가게C"]
    assert got[0] == {"name": "가게A", "address": "서울 도봉구 1", "category": "커피 전문점", "phone": "02-1"}
