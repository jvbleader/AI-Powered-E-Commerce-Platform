"""VNPay gateway client: payment URL, QueryDR, Refund."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from core.config import settings
from services.vnpay.crypto import build_pay_hash_data, sign_pay_params, sign_pipe_data, verify_pipe_signature
from services.vnpay.errors import VNPayError

logger = logging.getLogger(__name__)

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _now_vn() -> datetime:
    return datetime.now(VN_TZ)


def _format_vn_datetime(value: datetime) -> str:
    return value.strftime("%Y%m%d%H%M%S")


def _require_config() -> None:
    missing = []
    if not settings.VNPAY_TMN_CODE:
        missing.append("VNPAY_TMN_CODE")
    if not settings.VNPAY_HASH_SECRET:
        missing.append("VNPAY_HASH_SECRET")
    if not settings.VNPAY_PAYMENT_URL:
        missing.append("VNPAY_PAYMENT_URL")
    if missing:
        raise VNPayError("CONFIG", f"Thiếu cấu hình VNPay: {', '.join(missing)}")


def _redact_payload(payload: dict[str, Any]) -> dict[str, Any]:
    redacted = dict(payload)
    if "vnp_SecureHash" in redacted:
        redacted["vnp_SecureHash"] = "***"
    return redacted


class VNPayClient:
    def __init__(self) -> None:
        _require_config()
        self.tmn_code = settings.VNPAY_TMN_CODE
        self.hash_secret = settings.VNPAY_HASH_SECRET
        self.payment_url = settings.VNPAY_PAYMENT_URL
        self.api_url = settings.VNPAY_API_URL
        self.return_url = settings.VNPAY_RETURN_URL
        self.version = settings.VNPAY_VERSION
        self.curr_code = settings.VNPAY_CURR_CODE
        self.locale = settings.VNPAY_LOCALE
        self.order_type = settings.VNPAY_ORDER_TYPE
        self.hash_algorithm = settings.VNPAY_HASH_ALGORITHM
        self.timeout_minutes = settings.VNPAY_TIMEOUT_MINUTES

    def build_payment_url(
        self,
        *,
        txn_ref: str,
        amount: Decimal,
        order_info: str,
        ip_addr: str,
        bank_code: str | None = None,
    ) -> tuple[str, dict[str, str]]:
        create_date = _now_vn()
        expire_date = create_date + timedelta(minutes=self.timeout_minutes)
        vnp_amount = int(amount * 100)

        params: dict[str, str] = {
            "vnp_Version": self.version,
            "vnp_Command": "pay",
            "vnp_TmnCode": self.tmn_code,
            "vnp_Amount": str(vnp_amount),
            "vnp_CurrCode": self.curr_code,
            "vnp_TxnRef": txn_ref,
            "vnp_OrderInfo": order_info,
            "vnp_OrderType": self.order_type,
            "vnp_Locale": self.locale,
            "vnp_ReturnUrl": self.return_url,
            "vnp_IpAddr": ip_addr,
            "vnp_CreateDate": _format_vn_datetime(create_date),
            "vnp_ExpireDate": _format_vn_datetime(expire_date),
        }
        if bank_code:
            params["vnp_BankCode"] = bank_code

        secure_hash = sign_pay_params(params, self.hash_secret, self.hash_algorithm)
        params["vnp_SecureHash"] = secure_hash

        hash_data = build_pay_hash_data(params)
        query = hash_data + f"&vnp_SecureHash={secure_hash}"
        payment_url = f"{self.payment_url}?{query}"

        meta = {
            "vnp_CreateDate": params["vnp_CreateDate"],
            "vnp_ExpireDate": params["vnp_ExpireDate"],
            "vnp_Amount": params["vnp_Amount"],
        }
        return payment_url, meta

    async def query_transaction(
        self,
        *,
        txn_ref: str,
        transaction_date: str,
        order_info: str,
        ip_addr: str,
        transaction_no: str | None = None,
    ) -> dict[str, Any]:
        if not self.api_url:
            raise VNPayError("CONFIG", "Thiếu VNPAY_API_URL")

        request_id = secrets.token_hex(8)
        create_date = _format_vn_datetime(_now_vn())
        payload: dict[str, str] = {
            "vnp_RequestId": request_id,
            "vnp_Version": self.version,
            "vnp_Command": "querydr",
            "vnp_TmnCode": self.tmn_code,
            "vnp_TxnRef": txn_ref,
            "vnp_OrderInfo": order_info,
            "vnp_TransactionDate": transaction_date,
            "vnp_CreateDate": create_date,
            "vnp_IpAddr": ip_addr,
        }
        if transaction_no:
            payload["vnp_TransactionNo"] = transaction_no

        sign_fields = [
            request_id,
            self.version,
            "querydr",
            self.tmn_code,
            txn_ref,
            transaction_date,
            create_date,
            ip_addr,
            order_info,
        ]

        payload["vnp_SecureHash"] = sign_pipe_data(
            sign_fields, self.hash_secret, self.hash_algorithm
        )

        logger.info("VNPay QueryDR request: %s", _redact_payload(payload))
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.api_url, json=payload)
            response.raise_for_status()
            data = response.json()

        logger.info("VNPay QueryDR response: %s", _redact_payload(data))
        self._verify_querydr_response(data)
        return data

    async def refund_transaction(
        self,
        *,
        txn_ref: str,
        amount: Decimal,
        transaction_date: str,
        order_info: str,
        ip_addr: str,
        created_by: str,
        transaction_no: str | None = None,
        transaction_type: str = "02",
    ) -> dict[str, Any]:
        if not self.api_url:
            raise VNPayError("CONFIG", "Thiếu VNPAY_API_URL")

        request_id = secrets.token_hex(8)
        create_date = _format_vn_datetime(_now_vn())
        vnp_amount = str(int(amount * 100))

        payload: dict[str, str] = {
            "vnp_RequestId": request_id,
            "vnp_Version": self.version,
            "vnp_Command": "refund",
            "vnp_TmnCode": self.tmn_code,
            "vnp_TransactionType": transaction_type,
            "vnp_TxnRef": txn_ref,
            "vnp_Amount": vnp_amount,
            "vnp_OrderInfo": order_info,
            "vnp_TransactionDate": transaction_date,
            "vnp_CreateBy": created_by,
            "vnp_CreateDate": create_date,
            "vnp_IpAddr": ip_addr,
        }
        if transaction_no:
            payload["vnp_TransactionNo"] = transaction_no

        sign_fields = [
            request_id,
            self.version,
            "refund",
            self.tmn_code,
            transaction_type,
            txn_ref,
            vnp_amount,
            transaction_no or "",
            transaction_date,
            created_by,
            create_date,
            ip_addr,
            order_info,
        ]
        payload["vnp_SecureHash"] = sign_pipe_data(
            sign_fields, self.hash_secret, self.hash_algorithm
        )

        logger.info("VNPay Refund request: %s", _redact_payload(payload))
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(self.api_url, json=payload)
            response.raise_for_status()
            data = response.json()

        logger.info("VNPay Refund response: %s", _redact_payload(data))
        self._verify_refund_response(data)
        return data

    def _verify_querydr_response(self, data: dict[str, Any]) -> None:
        received = data.get("vnp_SecureHash") or ""
        if not received:
            # Một số lỗi API có thể không kèm hash — không tin response không chữ ký
            if str(data.get("vnp_ResponseCode", "")) == "00":
                raise VNPayError("97", "Thiếu checksum phản hồi QueryDR")
            return
        fields = [
            str(data.get("vnp_ResponseId", "")),
            str(data.get("vnp_Command", "")),
            str(data.get("vnp_ResponseCode", "")),
            str(data.get("vnp_Message", "")),
            str(data.get("vnp_TmnCode", "")),
            str(data.get("vnp_TxnRef", "")),
            str(data.get("vnp_Amount", "")),
            str(data.get("vnp_BankCode", "")),
            str(data.get("vnp_PayDate", "")),
            str(data.get("vnp_TransactionNo", "")),
            str(data.get("vnp_TransactionType", "")),
            str(data.get("vnp_TransactionStatus", "")),
            str(data.get("vnp_OrderInfo", "")),
            str(data.get("vnp_PromotionCode", "")),
            str(data.get("vnp_PromotionAmount", "")),
        ]
        if not verify_pipe_signature(fields, received, self.hash_secret, self.hash_algorithm):
            raise VNPayError("97", "Checksum phản hồi QueryDR không hợp lệ")

    def _verify_refund_response(self, data: dict[str, Any]) -> None:
        received = data.get("vnp_SecureHash") or ""
        if not received:
            if str(data.get("vnp_ResponseCode", "")) == "00":
                raise VNPayError("97", "Thiếu checksum phản hồi Refund")
            return
        fields = [
            str(data.get("vnp_ResponseId", "")),
            str(data.get("vnp_Command", "")),
            str(data.get("vnp_ResponseCode", "")),
            str(data.get("vnp_Message", "")),
            str(data.get("vnp_TmnCode", "")),
            str(data.get("vnp_TxnRef", "")),
            str(data.get("vnp_Amount", "")),
            str(data.get("vnp_BankCode", "")),
            str(data.get("vnp_PayDate", "")),
            str(data.get("vnp_TransactionNo", "")),
            str(data.get("vnp_TransactionType", "")),
            str(data.get("vnp_TransactionStatus", "")),
            str(data.get("vnp_OrderInfo", "")),
        ]
        if not verify_pipe_signature(fields, received, self.hash_secret, self.hash_algorithm):
            raise VNPayError("97", "Checksum phản hồi Refund không hợp lệ")
