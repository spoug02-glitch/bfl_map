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


# --- F4: alias substitution must only fire at a brand boundary ---------

def test_lovecup_produces_no_cu_search_key():
    """'러브컵(LOVECUP)' must not yield a 씨유/cu search key, and a live
    query for 씨유 must not surface this unrelated cafe (real false hit)."""
    keys = brands.search_keys("러브컵(LOVECUP)")
    assert not any(brands._contains_at_boundary(k, "cu") for k in keys)
    assert brands.matches("씨유", keys) is False


def test_baskinrobbins_alias_does_not_match_mid_word():
    """'선배라면' contains '배라' at index 1 (선[배라]면), not at a brand
    boundary -> must not produce a baskinrobbins variant."""
    variants = brands.name_variants("선배라면")
    assert not any("baskinrobbins" in v for v in variants)


def test_cu_alias_does_not_match_mid_word_in_pharmacy_name():
    """'아이씨유약국' contains '씨유' at index 2 (아이[씨유]약국), not at a
    brand boundary -> must not produce a cu variant."""
    variants = brands.name_variants("아이씨유약국")
    assert not any("cu" in v for v in variants)


def test_mcdonalds_alias_does_not_match_unseparated_compound():
    """'맥날레스토랑' starts with '맥날' but it runs straight into '레스토랑'
    with no separator -> not a genuine McDonald's branch name, must not
    produce an mcdonalds variant."""
    variants = brands.name_variants("맥날레스토랑")
    assert not any("mcdonalds" in v for v in variants)


def test_cu_alias_still_matches_real_branch_name():
    """Regression guard: '씨유 방학롯데캐슬점' (real branch name, brand
    followed by a space) must still produce the cu variant."""
    variants = brands.name_variants("씨유 방학롯데캐슬점")
    assert "cu 방학롯데캐슬점" in variants


def test_bhc_alias_still_matches_plain_prefix():
    keys = brands.search_keys("bhc창동행복점")
    assert brands.matches("비에이치씨", keys)


def test_bhc_alias_still_matches_paren_variant():
    keys = brands.search_keys("비에이치씨(BHC)치킨창2동점")
    assert brands.matches("bhc", keys)


def test_gs25_aliases_still_cross_match():
    keys_latin = brands.search_keys("gs25방학본점")
    keys_hangul = brands.search_keys("지에스25방학본점")
    assert brands.matches("지에스25", keys_latin)
    assert brands.matches("gs25", keys_hangul)


# --- D3: alias boundary must not reject a digit-ending member followed by
#         a Latin letter (script transition, not a word continuation) -----

def test_gs25_digit_boundary_followed_by_latin_letter_still_matches():
    """'GS25 S노원역점' normalizes (space stripped) to 'gs25s노원역점' — the
    'gs25' alias member ends in a digit, so the following Latin 's' is a
    real boundary (script transition), not a continuation of the same
    word. Must still yield a 지에스25 variant and match."""
    keys = brands.search_keys("GS25 S노원역점")
    assert brands.matches("지에스25", keys)
    assert any(key.startswith("지에스25") for key in keys)


def test_lovecup_still_produces_no_cu_key_after_digit_boundary_relaxation():
    """Regression guard: relaxing the digit-ending boundary rule must not
    reopen the 'cu' (Latin-letter-ending alias) false positive inside
    'lovecup' — 'cu' still ends in a letter, so the guard still applies."""
    keys = brands.search_keys("러브컵(LOVECUP)")
    assert not any(brands._contains_at_boundary(k, "cu") for k in keys)
    assert brands.matches("씨유", keys) is False
