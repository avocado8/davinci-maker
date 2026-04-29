import os

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from ..dependencies.auth import create_token, revoke_token

router = APIRouter()


class LoginRequest(BaseModel):
    password: str


@router.post("/auth/login")
def login(req: LoginRequest):
    admin_password = os.getenv("ADMIN_PASSWORD", "")
    if not admin_password or req.password != admin_password:
        raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")
    return {"token": create_token()}


@router.post("/auth/logout")
def logout(authorization: str = Header(default="")):
    if authorization.startswith("Bearer "):
        revoke_token(authorization.removeprefix("Bearer ").strip())
    return {"ok": True}
