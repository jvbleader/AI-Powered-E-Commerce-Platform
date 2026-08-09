"""VNPay response code mapping."""

from __future__ import annotations


class VNPayError(Exception):
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)


# IPN merchant response codes (RspCode)
IPN_ORDER_NOT_FOUND = "01"
IPN_ALREADY_CONFIRMED = "02"
IPN_INVALID_AMOUNT = "04"
IPN_INVALID_SIGNATURE = "97"
IPN_UNKNOWN_ERROR = "99"
IPN_CONFIRM_SUCCESS = "00"

# vnp_ResponseCode — payment result (00 = success)
PAYMENT_SUCCESS = "00"

# vnp_TransactionStatus
TXN_STATUS_SUCCESS = "00"

QUERYDR_RESPONSE_CODES: dict[str, str] = {
    "00": "Yêu cầu truy vấn thành công",
    "02": "Mã định danh kết nối không hợp lệ",
    "03": "Dữ liệu gửi sang không đúng định dạng",
    "91": "Không tìm thấy giao dịch yêu cầu",
    "94": "Yêu cầu trùng lặp",
    "97": "Checksum không hợp lệ",
    "99": "Lỗi khác",
}

REFUND_RESPONSE_CODES: dict[str, str] = {
    "00": "Yêu cầu hoàn tiền thành công",
    "02": "Mã định danh kết nối không hợp lệ",
    "03": "Dữ liệu gửi sang không đúng định dạng",
    "91": "Không tìm thấy giao dịch yêu cầu hoàn trả",
    "94": "Giao dịch đã được gửi yêu cầu hoàn tiền trước đó",
    "95": "Giao dịch không thành công, VNPAY từ chối xử lý",
    "97": "Checksum không hợp lệ",
    "99": "Lỗi khác",
}

TRANSACTION_STATUS_CODES: dict[str, str] = {
    "00": "Giao dịch thanh toán thành công",
    "01": "Giao dịch chưa hoàn tất",
    "02": "Giao dịch bị lỗi",
    "04": "Giao dịch đảo",
    "05": "VNPAY đang xử lý (hoàn tiền)",
    "06": "VNPAY đã gửi yêu cầu hoàn tiền sang Ngân hàng",
    "07": "Giao dịch bị nghi ngờ gian lận",
    "09": "GD hoàn trả bị từ chối",
}


def querydr_message(code: str) -> str:
    return QUERYDR_RESPONSE_CODES.get(code, f"Mã lỗi không xác định: {code}")


def refund_message(code: str) -> str:
    return REFUND_RESPONSE_CODES.get(code, f"Mã lỗi không xác định: {code}")
