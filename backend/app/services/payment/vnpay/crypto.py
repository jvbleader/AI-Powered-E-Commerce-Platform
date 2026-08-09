"""VNPay HMAC/sign helpers (v2.1.0 HMAC-SHA512 default)."""

from __future__ import annotations

import hashlib
import hmac
from urllib.parse import quote_plus


SUPPORTED_ALGORITHMS = frozenset({"SHA512", "SHA256", "MD5"})


def _normalize_algorithm(algorithm: str) -> str:
    normalized = (algorithm or "SHA512").upper()
    if normalized not in SUPPORTED_ALGORITHMS:
        raise ValueError(f"Thuật toán hash không hỗ trợ: {algorithm}")
    return normalized


def build_pay_hash_data(params: dict[str, str]) -> str:
    """Build hash payload for pay URL / IPN / Return (sorted query string, url-encoded)."""
    filtered = {
        key: value
        for key, value in params.items()
        if key.startswith("vnp_")
        and key not in ("vnp_SecureHash", "vnp_SecureHashType")
        and value is not None
        and str(value) != ""
    }
    items = sorted(filtered.items())
    parts: list[str] = []
    for index, (key, value) in enumerate(items):
        encoded = f"{quote_plus(str(key))}={quote_plus(str(value))}"
        if index == 0:
            parts.append(encoded)
        else:
            parts.append(f"&{encoded}")
    return "".join(parts)


def sign_with_algorithm(data: str, secret: str, algorithm: str) -> str:
    algo = _normalize_algorithm(algorithm)
    if algo == "SHA512":
        return hmac.new(secret.encode("utf-8"), data.encode("utf-8"), hashlib.sha512).hexdigest()
    if algo == "SHA256":
        return hashlib.sha256((secret + data).encode("utf-8")).hexdigest()
    return hashlib.md5((secret + data).encode("utf-8")).hexdigest()


def sign_pay_params(params: dict[str, str], secret: str, algorithm: str = "SHA512") -> str:
    hash_data = build_pay_hash_data(params)
    return sign_with_algorithm(hash_data, secret, algorithm)


def verify_pay_signature(
    params: dict[str, str],
    secret: str,
    algorithm: str = "SHA512",
) -> bool:
    received = params.get("vnp_SecureHash")
    if not received:
        return False
    expected = sign_pay_params(params, secret, algorithm)
    return hmac.compare_digest(expected.lower(), received.lower())


def sign_pipe_data(fields: list[str], secret: str, algorithm: str = "SHA512") -> str:
    data = "|".join(fields)
    return sign_with_algorithm(data, secret, algorithm)


def verify_pipe_signature(
    fields: list[str],
    received_hash: str,
    secret: str,
    algorithm: str = "SHA512",
) -> bool:
    if not received_hash:
        return False
    expected = sign_pipe_data(fields, secret, algorithm)
    return hmac.compare_digest(expected.lower(), received_hash.lower())
