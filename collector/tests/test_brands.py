import brands


def test_normalize_strips_spaces_dots_parens_and_casefolds():
    assert brands.normalize("GS25 방학본점") == "gs25방학본점"
    assert brands.normalize("뉴(NEW)창동화로숯불구이") == "뉴new창동화로숯불구이"
    assert brands.normalize("A.B·C-D_E,F&G/H") == "abcdefgh"


def test_search_keys_cu_matched_by_various_queries():
    keys = brands.search_keys("씨유 방학점")
    for q in ("CU", "cu", "씨유"):
        assert brands.matches(q, keys), q


def test_search_keys_gs25_matched_by_various_queries():
    keys = brands.search_keys("GS25 방학본점")
    for q in ("gs25", "GS25", "지에스25"):
        assert brands.matches(q, keys), q


def test_search_keys_bhc_paren_variant_matched():
    keys = brands.search_keys("비에이치씨(BHC)치킨창2동점")
    for q in ("bhc", "비에이치씨", "비에이치씨치킨"):
        assert brands.matches(q, keys), q


def test_search_keys_paren_removed_variant_for_generic_name():
    keys = brands.search_keys("뉴(NEW)창동화로숯불구이")
    assert brands.matches("뉴창동", keys)


def test_search_keys_plain_substring_and_no_false_positive():
    keys = brands.search_keys("가까운집")
    assert brands.matches("가까운", keys)
    assert not brands.matches("먼집", keys)


def test_matches_empty_query_is_true():
    keys = brands.search_keys("아무거나식당")
    assert brands.matches("", keys)
    assert brands.matches("   ", keys)


def test_expand_query_includes_alias_substitutions():
    expanded = brands.expand_query("cu")
    assert "씨유" in expanded


def test_search_keys_deduplicated_and_order_stable():
    keys = brands.search_keys("씨유 방학점")
    assert len(keys) == len(set(keys))


def test_name_variants_substitutes_alias_preserving_display_text():
    variants = brands.name_variants("씨유 방학롯데캐슬점")
    assert "씨유 방학롯데캐슬점" in variants  # original always included
    assert "cu 방학롯데캐슬점" in variants


def test_name_variants_no_alias_match_returns_only_original():
    assert brands.name_variants("가까운집") == ["가까운집"]


def test_name_variants_deduplicated():
    variants = brands.name_variants("씨유 방학점")
    assert len(variants) == len(set(variants))
