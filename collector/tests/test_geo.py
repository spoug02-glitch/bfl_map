import math

import pytest

from geo import epsg5174_to_wgs84, haversine_km


def test_zero_distance():
    assert haversine_km(37.6545, 127.0499, 37.6545, 127.0499) == 0.0


def test_known_distance_one_degree_latitude():
    # 위도 1도 ≈ 111.19 km
    d = haversine_km(37.0, 127.0, 38.0, 127.0)
    assert abs(d - 111.19) < 0.5


def test_seedcube_to_changdong_station():
    # 씨드큐브(37.6545,127.0499) ~ 창동역(37.6533,127.0475) 약 0.24km
    d = haversine_km(37.6545, 127.0499, 37.6533, 127.0475)
    assert 0.15 < d < 0.35


# --- EPSG:5174 -> WGS84 ---
#
# 기준값은 인허가 API 가 준 CRD_INFO_X/Y 실측치이고, 기대 좌표는 같은 가게의
# 카카오 좌표(restaurants.json)다. 두 출처가 독립이라 변환이 틀리면 바로 벌어진다.
# 500건 대조에서 오차 중앙값 4.8m 였다 (2026-08-27).
PERMIT_SAMPLES = [
    # (x, y, lat, lng, 상호)  — 주소는 전부 도봉구
    (204357.382835077, 461235.763310872, 37.6534906, 127.0501654, "역전우동0410 창동역점"),
    (203580.310485303, 459037.113074794, 37.6336841, 127.0413493, "88족발"),
    (202691.242549211, 460278.200925020, 37.6448693, 127.0312812, "이게볶음밥"),
    (202837.499688588, 462794.399739944, 37.6675394, 127.0329478, "오구이"),
]


@pytest.mark.parametrize("x,y,lat,lng,name", PERMIT_SAMPLES)
def test_epsg5174_matches_kakao_within_50m(x, y, lat, lng, name):
    got_lat, got_lng = epsg5174_to_wgs84(x, y)
    off_m = haversine_km(got_lat, got_lng, lat, lng) * 1000
    assert off_m < 50, f"{name}: {off_m:.1f}m 벗어남"


def test_epsg5174_lands_in_seoul_northeast():
    """도봉구 좌표가 서울 북동부 범위 안에 떨어지는지 — 원점·거짓좌표 실수 감지."""
    lat, lng = epsg5174_to_wgs84(204357.382835077, 461235.763310872)
    assert 37.5 < lat < 37.8
    assert 126.9 < lng < 127.2


def test_epsg5174_rejects_non_finite():
    with pytest.raises(ValueError):
        epsg5174_to_wgs84(float("nan"), 555387.0)
    with pytest.raises(ValueError):
        epsg5174_to_wgs84(201782.0, math.inf)
