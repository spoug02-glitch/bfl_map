import json

import pytest

import verify_zeropay as vz


def merchant(name="맑음이네", address="서울특별시 도봉구 노해로69길 21-11", **kw):
    return {"name": name, "address": address, "category": "한식 일반 음식점업",
            "phone": "0212345678", **kw}


def place(name="맑음이네", address="서울특별시 도봉구 노해로69길 21-11", pid="1", **kw):
    return {"name": name, "address": address, "kakao_place_id": pid,
            "category": "한식 일반 음식점업", **kw}


class TestKeyOf:
    def test_같은_가게는_표기가_달라도_같은_키다(self):
        # 상호의 공백·괄호, 주소의 띄어쓰기가 출처마다 다르다
        a = vz.key_of("맑음이네", "서울특별시 도봉구 노해로69길 21-11")
        b = vz.key_of("맑 음 이 네", "도봉구 노해로69길 21-11 (창동)")
        assert a == b

    def test_다른_번지는_다른_키다(self):
        a = vz.key_of("김밥천국", "서울특별시 도봉구 노해로69길 21")
        b = vz.key_of("김밥천국", "서울특별시 도봉구 노해로69길 22")
        assert a != b

    def test_도로명_파싱이_안되면_None이다(self):
        # "확인 불가"를 "아무거나 통과"로 바꾸면 안 된다
        assert vz.key_of("어딘가", "서울 어딘가 산기슭") is None


class TestKeyOfRow:
    """우리 행의 name 은 카카오 표기다. 제로페이와 대조하려면 zeropay_name 을 써야 한다 —
    이걸 놓치면 이름이 다르게 적힌 2,541곳이 통째로 이탈로 잡힌다(2026-08-21 실제로 겪음)."""

    def test_zeropay_name_이_있으면_그걸_쓴다(self):
        row = place(name="CU 창동씨드큐브점", zeropay_name="씨유 창동씨드큐브점")
        assert vz.key_of_row(row) == vz.key_of("씨유 창동씨드큐브점", row["address"])

    def test_없으면_name_을_쓴다(self):
        row = place(name="맑음이네")
        assert vz.key_of_row(row) == vz.key_of("맑음이네", row["address"])


class TestDiff:
    def test_이름이_카카오_표기로_달라도_이탈이_아니다(self):
        ours = [place(name="CU 창동씨드큐브점", zeropay_name="씨유 창동씨드큐브점")]
        live = [merchant(name="씨유 창동씨드큐브점")]
        assert vz.diff(ours, live).departed == []

    def test_제로페이에서_사라진_가게를_이탈로_센다(self):
        ours = [place(name="스시황", pid="9"), place(name="맑음이네", pid="1")]
        live = [merchant(name="맑음이네")]
        d = vz.diff(ours, live)
        assert [p["name"] for p in d.departed] == ["스시황"]

    def test_제로페이에만_있는_가게를_신규로_센다(self):
        ours = [place(name="맑음이네")]
        live = [merchant(name="맑음이네"), merchant(name="새로생긴집", address="서울특별시 도봉구 노해로69길 30")]
        d = vz.diff(ours, live)
        assert [m["name"] for m in d.arrived] == ["새로생긴집"]

    def test_주소를_못읽는_우리_행은_이탈로_치지_않는다(self):
        # 대조할 수 없는 것을 "없어졌다"로 판정하면 멀쩡한 가게가 지워진다
        ours = [place(name="어딘가", address="서울 어딘가 산기슭")]
        d = vz.diff(ours, [])
        assert d.departed == []
        assert d.unverifiable == 1


class TestPruneGuard:
    def test_한_조합이라도_불완전하면_삭제를_거부한다(self):
        # 제로페이가 일시적으로 행을 누락한 적이 있다. 그때 지우면 멀쩡한 가게가 날아간다
        fetches = [vz.Fetch("도봉구", "56111", received=845, total=845),
                   vz.Fetch("노원구", "56111", received=100, total=140)]
        ok, reason = vz.prune_allowed(fetches)
        assert ok is False
        assert "노원구" in reason and "56111" in reason

    def test_전부_완전하면_허용한다(self):
        fetches = [vz.Fetch("도봉구", "56111", received=845, total=845),
                   vz.Fetch("노원구", "56111", received=140, total=140)]
        ok, _ = vz.prune_allowed(fetches)
        assert ok is True

    def test_받은게_더_많아도_완전으로_본다(self):
        # 원본에 완전 중복 등록이 있어 received > total 이 정상이다
        fetches = [vz.Fetch("도봉구", "56111", received=846, total=845)]
        assert vz.prune_allowed(fetches)[0] is True

    def test_한_건도_못_받았으면_거부한다(self):
        assert vz.prune_allowed([])[0] is False


class TestPruneScope:
    """부분 조회 뒤 --prune 하면 조회 안 한 범위가 통째로 이탈로 찍힌다.
    조회 완결성(TOTAL_CNT)만 봐서는 이걸 못 잡는다 — 그 한 조합은 완전하니까."""

    def test_구를_일부만_조회했으면_거부한다(self):
        ok, reason = vz.scope_allows_prune(["도봉구"], list(vz.ALL_CODES))
        assert ok is False
        assert "노원구" in reason or "구" in reason

    def test_코드를_일부만_조회했으면_거부한다(self):
        ok, reason = vz.scope_allows_prune(list(vz.DISTRICTS), ["56111"])
        assert ok is False

    def test_전체_범위면_허용한다(self):
        ok, _ = vz.scope_allows_prune(list(vz.DISTRICTS), list(vz.ALL_CODES))
        assert ok is True

    def test_순서가_달라도_전체면_허용한다(self):
        ok, _ = vz.scope_allows_prune(list(reversed(vz.DISTRICTS)), list(vz.ALL_CODES))
        assert ok is True


class TestLiveUnparsed:
    """라이브 쪽 주소가 안 읽히면 그 가맹점은 live_keys 에 안 들어간다.
    우리 행은 멀쩡히 읽히는데 짝이 사라져 거짓 이탈이 된다 — 조용하면 안 된다."""

    def test_라이브_주소를_못읽으면_센다(self):
        live = [merchant(address="서울 어딘가 산기슭"), merchant(name="맑음이네")]
        d = vz.diff([], live)
        assert d.live_unverifiable == 1


class TestPrune:
    def test_이탈분만_빼고_나머지_순서와_내용을_보존한다(self, tmp_path):
        p = tmp_path / "restaurants.json"
        rows = [place(name="가", pid="1"), place(name="나", pid="2"), place(name="다", pid="3")]
        p.write_text(json.dumps(rows, ensure_ascii=False), encoding="utf-8")

        vz.prune(p, {"2"})

        left = json.loads(p.read_text(encoding="utf-8"))
        assert [r["kakao_place_id"] for r in left] == ["1", "3"]
        assert left[0] == rows[0]  # 남는 행은 한 글자도 안 바뀐다

    def test_지울게_없으면_파일을_건드리지_않는다(self, tmp_path):
        p = tmp_path / "restaurants.json"
        original = json.dumps([place()], ensure_ascii=False)
        p.write_text(original, encoding="utf-8")

        vz.prune(p, set())

        assert p.read_text(encoding="utf-8") == original
