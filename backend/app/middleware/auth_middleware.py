from collections.abc import Awaitable, Callable

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse

from services import jwt_service


async def validate_auth_cookie_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    if request.url.path == "/auth/refresh":
        return await call_next(request)

    token = request.cookies.get("access_token")
    if not token:
        return await call_next(request)

    try:
        payload = jwt_service.decode_jwt_token(token)
        if payload.get("type") != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token không phải là access token.",
            )
    except HTTPException as exc:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

    request.state.auth_payload = payload
    return await call_next(request)
