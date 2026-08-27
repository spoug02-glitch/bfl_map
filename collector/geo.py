"""Geodesy helpers: WGS84 distance, and EPSG:5174 -> WGS84 for permit data.

EPSG:5174 is what the 행정안전부 인허가 API returns in CRD_INFO_X / CRD_INFO_Y:
Korean 1985 (Bessel 1841) on a Transverse Mercator "modified central belt".
Converting needs two steps that are easy to conflate -- unproject on Bessel,
*then* shift the datum to WGS84. Skipping the datum shift lands you ~350m off,
which looks plausible on a map and is therefore the dangerous failure.

Implemented here rather than via pyproj: the collector depends on three packages
and pulling in PROJ for one formula is not worth it.
"""
import math

EARTH_RADIUS_KM = 6371.0088

# --- EPSG:5174 (Korean 1985 / Modified Central Belt) ---
_BESSEL_A = 6377397.155
_BESSEL_F = 1 / 299.1528128
_LAT_0 = math.radians(38.0)
_LON_0 = math.radians(127.0028902777778)  # 127deg 00' 10.405"
_X_0 = 200000.0
_Y_0 = 500000.0

# Position Vector 7-parameter shift, Korean 1985 -> WGS84 (PROJ's EPSG:5174 towgs84).
_DX, _DY, _DZ = -115.80, 474.99, 674.11
_RX, _RY, _RZ = 1.16, -2.31, -1.63  # arc-seconds
_PPM = 6.43

_WGS84_A = 6378137.0
_WGS84_F = 1 / 298.257223563


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    if lat1 == lat2 and lng1 == lng2:
        return 0.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def _meridional_arc(lat: float, a: float, e2: float) -> float:
    return a * (
        (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * lat
        - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * lat)
        + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * lat)
        - (35 * e2**3 / 3072) * math.sin(6 * lat)
    )


def _tm_inverse_bessel(x: float, y: float) -> tuple[float, float]:
    """Transverse Mercator inverse on the Bessel ellipsoid. Returns radians."""
    e2 = 2 * _BESSEL_F - _BESSEL_F**2
    ep2 = e2 / (1 - e2)

    m = _meridional_arc(_LAT_0, _BESSEL_A, e2) + (y - _Y_0)
    mu = m / (_BESSEL_A * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))

    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    phi1 = (
        mu
        + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
        + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
        + (151 * e1**3 / 96) * math.sin(6 * mu)
        + (1097 * e1**4 / 512) * math.sin(8 * mu)
    )

    sin_p, cos_p, tan_p = math.sin(phi1), math.cos(phi1), math.tan(phi1)
    c1 = ep2 * cos_p**2
    t1 = tan_p**2
    n1 = _BESSEL_A / math.sqrt(1 - e2 * sin_p**2)
    r1 = _BESSEL_A * (1 - e2) / (1 - e2 * sin_p**2) ** 1.5
    d = (x - _X_0) / n1

    lat = phi1 - (n1 * tan_p / r1) * (
        d**2 / 2
        - (5 + 3 * t1 + 10 * c1 - 4 * c1**2 - 9 * ep2) * d**4 / 24
        + (61 + 90 * t1 + 298 * c1 + 45 * t1**2 - 252 * ep2 - 3 * c1**2) * d**6 / 720
    )
    lon = _LON_0 + (
        d
        - (1 + 2 * t1 + c1) * d**3 / 6
        + (5 - 2 * c1 + 28 * t1 - 3 * c1**2 + 8 * ep2 + 24 * t1**2) * d**5 / 120
    ) / cos_p
    return lat, lon


def _helmert_bessel_to_wgs84(lat: float, lon: float) -> tuple[float, float]:
    """Position Vector 7-parameter datum shift, via geocentric coordinates."""
    e2_b = 2 * _BESSEL_F - _BESSEL_F**2
    n = _BESSEL_A / math.sqrt(1 - e2_b * math.sin(lat) ** 2)
    x = n * math.cos(lat) * math.cos(lon)
    y = n * math.cos(lat) * math.sin(lon)
    z = n * (1 - e2_b) * math.sin(lat)

    rx, ry, rz = (math.radians(v / 3600) for v in (_RX, _RY, _RZ))
    s = 1 + _PPM * 1e-6
    xt = _DX + s * (x - rz * y + ry * z)
    yt = _DY + s * (rz * x + y - rx * z)
    zt = _DZ + s * (-ry * x + rx * y + z)

    # Geocentric -> geodetic on WGS84 (Bowring, iterated: sub-mm at these scales).
    e2_w = 2 * _WGS84_F - _WGS84_F**2
    p = math.hypot(xt, yt)
    lat_w = math.atan2(zt, p * (1 - e2_w))
    for _ in range(5):
        n_w = _WGS84_A / math.sqrt(1 - e2_w * math.sin(lat_w) ** 2)
        lat_w = math.atan2(zt + e2_w * n_w * math.sin(lat_w), p)
    return math.degrees(lat_w), math.degrees(math.atan2(yt, xt))


def epsg5174_to_wgs84(x: float, y: float) -> tuple[float, float]:
    """Convert 인허가 API CRD_INFO_X/Y to (lat, lng). Raises on non-finite input."""
    if not (math.isfinite(x) and math.isfinite(y)):
        raise ValueError(f"non-finite EPSG:5174 coordinate: x={x} y={y}")
    lat, lon = _tm_inverse_bessel(x, y)
    return _helmert_bessel_to_wgs84(lat, lon)
