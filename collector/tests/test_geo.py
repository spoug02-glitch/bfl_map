from geo import haversine_km


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
