from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

import services.auth.jwt_service as jwt_service


async def validate_auth_cookie_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = jwt_service.decode_jwt_token(token)
            if payload.get("type") == "access":
                request.state.auth_payload = payload
        except Exception:
            pass

    return await call_next(request)
