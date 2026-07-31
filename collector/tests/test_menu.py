import menu


class FakeRes:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")


def test_fetch_menu_top5(monkeypatch):
    payload = {"menu": {"menus": {"items": [
        {"name": f"메뉴{i}", "price": str(1000 * i)} for i in range(1, 8)
    ]}}}
    monkeypatch.setattr(menu.requests, "get", lambda *a, **k: FakeRes(200, payload))
    got = menu.fetch_menu("111")
    assert len(got) == 5
    assert got[0] == {"name": "메뉴1", "price": "1000"}


def test_fetch_menu_never_returns_photo_data(monkeypatch):
    """We cannot attribute image sources, so menu photos must never be collected."""
    payload = {"menu": {"menus": {
        "photos": [{"url": "https://img.kakaocdn.net/menu1.jpg"}],
        "items": [
            {"name": "얼큰 순대국", "price": "15000",
             "photo": {"url": "https://img.kakaocdn.net/item1.jpg"},
             "image_url": "https://img.kakaocdn.net/item1b.jpg"},
        ],
    }}}
    monkeypatch.setattr(menu.requests, "get", lambda *a, **k: FakeRes(200, payload))
    got = menu.fetch_menu("111")
    assert got == [{"name": "얼큰 순대국", "price": "15000"}]
    assert all(set(item) == {"name", "price"} for item in got)
    assert "jpg" not in str(got)


def test_fetch_menu_missing_menu_key(monkeypatch):
    monkeypatch.setattr(menu.requests, "get", lambda *a, **k: FakeRes(200, {}))
    assert menu.fetch_menu("111") == []


def test_fetch_menu_http_error_returns_empty(monkeypatch):
    monkeypatch.setattr(menu.requests, "get", lambda *a, **k: FakeRes(406, {}))
    assert menu.fetch_menu("111") == []


def test_fetch_menu_mixed_valid_invalid_items(monkeypatch):
    payload = {"menu": {"menus": {"items": [
        "string",
        None,
        123,
        {"name": "유효한메뉴", "price": "5000"},
        {"name": "", "price": "0"},
    ]}}}
    monkeypatch.setattr(menu.requests, "get", lambda *a, **k: FakeRes(200, payload))
    got = menu.fetch_menu("111")
    assert len(got) == 1
    assert got[0] == {"name": "유효한메뉴", "price": "5000"}
