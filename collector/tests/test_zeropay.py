import pytest
import requests

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


def test_fetch_merchants_retries_on_failure(monkeypatch):
    """Test that fetch_merchants retries on transient failure then succeeds."""
    call_count = 0

    def fake_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise requests.RequestException("Transient error")
        # Succeed on third attempt
        class FakeResponse:
            def json(self):
                return {"TOTAL_CNT": 1, "LIST2": [{"AFLT_NM": "가게"}]}
            def raise_for_status(self):
                pass
        return FakeResponse()

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr("time.sleep", lambda x: None)  # Skip sleep

    result = zeropay.fetch_merchants("도봉구", "56221", 1)
    assert call_count == 3
    assert result["TOTAL_CNT"] == 1


def test_fetch_merchants_raises_after_max_retries(monkeypatch):
    """Test that fetch_merchants raises RuntimeError after MAX_RETRIES+1 failures."""
    call_count = 0

    def fake_post(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        raise requests.RequestException("Persistent error")

    monkeypatch.setattr(requests, "post", fake_post)
    monkeypatch.setattr("time.sleep", lambda x: None)  # Skip sleep

    with pytest.raises(RuntimeError, match="zeropay fetch failed"):
        zeropay.fetch_merchants("도봉구", "56221", 1)

    assert call_count == zeropay.MAX_RETRIES + 1


def test_iter_all_merchants_caps_pages_on_lying_total(monkeypatch):
    """Test that iter_all_merchants terminates even if server keeps echoing full pages with lying TOTAL_CNT."""
    call_count = 0

    def fake_fetch(gu, code, page, page_size=100):
        nonlocal call_count
        call_count += 1
        # Server lies: says TOTAL_CNT=1000 but only has 50 actual items
        # Server keeps returning full pages even past the real data
        # Without page cap, this would infinite loop
        if page <= 5:  # Real data is on pages 1-5 (5 pages × 10 items = 50 items)
            return {
                "TOTAL_CNT": 1000,  # Lying about total
                "PAGE_SIZE": page_size,
                "LIST2": [
                    {"AFLT_NM": f"가게{page}_{i}", "AFLT_ROAD_ADDR": f"주소{page}_{i}", "BIZ_TYPE": "카테고리", "SHOP_TEL_NO": f"0{i}"}
                    for i in range(page_size)
                ]
            }
        else:
            # Server still returns full page even beyond actual data (buggy behavior)
            return {
                "TOTAL_CNT": 1000,
                "PAGE_SIZE": page_size,
                "LIST2": [
                    {"AFLT_NM": f"가게{page}_{i}", "AFLT_ROAD_ADDR": f"주소{page}_{i}", "BIZ_TYPE": "카테고리", "SHOP_TEL_NO": f"0{i}"}
                    for i in range(page_size)
                ]
            }

    monkeypatch.setattr(zeropay, "fetch_merchants", fake_fetch)

    # With page_size=10 and TOTAL_CNT=1000, server would report max_pages ~= 1000//10 + 2 = 102
    # Iterator should stop at the page cap, not infinite loop
    got = list(zeropay.iter_all_merchants("도봉구", "56221", delay_sec=0, page_size=10))

    # Should have stopped well before 102 pages due to cap
    # Actual calculation: max_pages = 1000 // 10 + 2 = 102, so should stop around page 102
    assert call_count <= 103
    assert len(got) > 0


# --- D1: single-request crawl + completeness guarantee -------------------

def test_iter_all_merchants_default_page_size_is_1000():
    """The default page size must be large enough that a whole (gu, code)
    result set arrives in one request for real-world category sizes."""
    import inspect
    assert inspect.signature(zeropay.iter_all_merchants).parameters["page_size"].default == 1000


def test_iter_all_merchants_single_full_page_makes_one_request(monkeypatch):
    """(a) A single request that returns everything (rows == TOTAL_CNT)
    must not trigger a second request."""
    call_count = 0

    def fake_fetch(gu, code, page, page_size=1000):
        nonlocal call_count
        call_count += 1
        return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": [
            {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "주소1", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "1"},
            {"AFLT_NM": "가게B", "AFLT_ROAD_ADDR": "주소2", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "2"},
            {"AFLT_NM": "가게C", "AFLT_ROAD_ADDR": "주소3", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "3"},
        ]}

    monkeypatch.setattr(zeropay, "fetch_merchants", fake_fetch)
    got = list(zeropay.iter_all_merchants("도봉구", "56111", delay_sec=0))
    assert call_count == 1
    assert len(got) == 3


def test_iter_all_merchants_retries_once_and_recovers(monkeypatch, capsys):
    """(b) An unstable server that omits a row on the first attempt but is
    complete on the (whole-batch) retry ends up complete, with no warning."""
    attempt = {"n": 0}

    def fake_fetch(gu, code, page, page_size=1000):
        if page == 1:
            attempt["n"] += 1
        if attempt["n"] == 1:
            if page == 1:
                return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": [
                    {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "주소1", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "1"},
                    {"AFLT_NM": "가게B", "AFLT_ROAD_ADDR": "주소2", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "2"},
                ]}
            return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": []}
        if page == 1:
            return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": [
                {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "주소1", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "1"},
                {"AFLT_NM": "가게B", "AFLT_ROAD_ADDR": "주소2", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "2"},
                {"AFLT_NM": "가게C", "AFLT_ROAD_ADDR": "주소3", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "3"},
            ]}
        return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": []}

    monkeypatch.setattr(zeropay, "fetch_merchants", fake_fetch)
    got = list(zeropay.iter_all_merchants("도봉구", "56111", delay_sec=0))
    assert attempt["n"] == 2
    assert [m["name"] for m in got] == ["가게A", "가게B", "가게C"]
    out = capsys.readouterr().out
    assert "[warn]" not in out


def test_iter_all_merchants_permanently_short_yields_partial_and_warns(monkeypatch, capsys):
    """(c) A server that stays short even after the retry still yields what
    it has (partial beats nothing) AND emits a clear warning naming gu,
    code, expected and actual counts."""

    def fake_fetch(gu, code, page, page_size=1000):
        if page == 1:
            return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": [
                {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "주소1", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "1"},
                {"AFLT_NM": "가게B", "AFLT_ROAD_ADDR": "주소2", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "2"},
            ]}
        return {"TOTAL_CNT": 3, "PAGE_SIZE": page_size, "LIST2": []}

    monkeypatch.setattr(zeropay, "fetch_merchants", fake_fetch)
    got = list(zeropay.iter_all_merchants("도봉구", "56111", delay_sec=0))
    assert [m["name"] for m in got] == ["가게A", "가게B"]
    out = capsys.readouterr().out
    assert "도봉구" in out
    assert "56111" in out
    assert "expected=3" in out
    assert "actual=2" in out


def test_iter_all_merchants_dedupes_repeated_rows_across_pages(monkeypatch):
    """A repeated (name, address) row seen on more than one page must not
    inflate the yielded count."""

    def fake_fetch(gu, code, page, page_size=2):
        if page == 1:
            return {"TOTAL_CNT": 2, "PAGE_SIZE": page_size, "LIST2": [
                {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "주소1", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "1"},
                {"AFLT_NM": "가게A", "AFLT_ROAD_ADDR": "주소1", "BIZ_TYPE": "cat", "SHOP_TEL_NO": "1"},
            ]}
        return {"TOTAL_CNT": 2, "PAGE_SIZE": page_size, "LIST2": []}

    monkeypatch.setattr(zeropay, "fetch_merchants", fake_fetch)
    got = list(zeropay.iter_all_merchants("도봉구", "56111", delay_sec=0, page_size=2))
    assert len(got) == 1
