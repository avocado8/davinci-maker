import secrets
from fastapi import Header, HTTPException

_valid_tokens: set[str] = set()


def create_token() -> str:
    token = secrets.token_hex(32)
    _valid_tokens.add(token)
    return token


def revoke_token(token: str) -> None:
    _valid_tokens.discard(token)


def verify_token(authorization: str = Header(default="")) -> None:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="인증이 필요합니다.")
    token = authorization.removeprefix("Bearer ").strip()
    if token not in _valid_tokens:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰입니다.")
