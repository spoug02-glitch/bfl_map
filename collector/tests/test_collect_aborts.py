"""수집이 온전하지 않으면 restaurants.json 을 건드리지 않는다.

두 출처 모두에 같은 계약이 있어야 한다. 인허가가 덜 오면 지도에서 가게가 사라지고,
제로페이가 덜 오면 비플페이 되는 집이 "안 된다"고 나간다 — 어느 쪽도 배포되면 안 된다.
"""
import sys

import pytest

import collect
import permit_data
import zeropay

SAMPLE = {
    "permit_no": "3090000-101-2023-00123",
    "name": "역전우동0410 창동역점",
    "address": "서울특별시 도봉구 마들로11길 57",
    "lotno_address": "서울특별시 도봉구 창동 1-1",
    "category": "한식 일반 음식점업",
    "biz_type": "한식",
    "phone": "",
    "lat": 37.6534906,
    "lng": 127.0501654,
    "licensed_on": "2023-05-02",
    "updated_at": "2026-08-26 22:47:50",
}


@pytest.fixture
def guarded(monkeypatch, tmp_path):
    """출력 경로를 tmp 로 돌리고, 그 파일이 생겼는지 볼 수 있게 한다."""
    out = tmp_path / "restaurants.json"
    monkeypatch.setattr(collect, "OUT_PATH", out)
    monkeypatch.setattr(collect, "UNFLAGGED_PATH", tmp_path / "unmatched.json")
    monkeypatch.setattr(collect, "HISTORY_PATH", tmp_path / "runs.json")
    monkeypatch.setattr(collect, "_read_api_key", lambda: "test-key")
    monkeypatch.setattr(sys, "argv", ["collect.py", "--districts", "도봉구"])
    return out


def test_incomplete_permit_crawl_leaves_output_untouched(guarded, monkeypatch):
    def boom(*a, **kw):
        raise permit_data.IncompletePermitCrawl("expected=250 actual=1")
        yield  # pragma: no cover — generator 로 만들기 위한 것

    monkeypatch.setattr(permit_data, "iter_places", boom)
    with pytest.raises(SystemExit):
        collect.main()
    assert not guarded.exists(), "부분 수집인데 restaurants.json 을 썼다"


def test_incomplete_zeropay_crawl_leaves_output_untouched(guarded, monkeypatch):
    monkeypatch.setattr(permit_data, "iter_places", lambda *a, **kw: iter([SAMPLE]))

    def boom(*a, **kw):
        raise zeropay.IncompleteZeropayCrawl("expected=848 actual=12")
        yield  # pragma: no cover

    monkeypatch.setattr(zeropay, "iter_all_merchants", boom)
    with pytest.raises(SystemExit):
        collect.main()
    assert not guarded.exists(), "제로페이가 부분인데 restaurants.json 을 썼다"


def test_complete_run_writes_output(guarded, monkeypatch):
    monkeypatch.setattr(permit_data, "iter_places", lambda *a, **kw: iter([SAMPLE]))
    monkeypatch.setattr(zeropay, "iter_all_merchants", lambda *a, **kw: iter([]))
    collect.main()
    assert guarded.exists()
