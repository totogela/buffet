import base64
import hashlib
import hmac
import json
import os
import time
from typing import Annotated

from fastapi import Header, HTTPException
from pydantic import BaseModel

from db_context import get_db

SECRET = os.getenv("BUFFET_AUTH_SECRET", "cambiar-este-secreto")
TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30


class LoginRequest(BaseModel):
    usuario: str
    password: str


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _unb64(data: str) -> bytes:
    data += "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data.encode("ascii"))


def crear_token(user: dict) -> str:
    payload = {
        "id": user["id"],
        "usuario": user["usuario"],
        "rol": user.get("rol", "jefe"),
        "exp": int(time.time()) + TOKEN_TTL_SECONDS,
    }
    body = _b64(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"{body}.{_b64(sig)}"


def leer_token(token: str) -> dict:
    try:
        body, sig = token.split(".", 1)
        expected = hmac.new(SECRET.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
        if not hmac.compare_digest(_unb64(sig), expected):
            raise ValueError("firma invalida")
        payload = json.loads(_unb64(body))
        if payload.get("exp", 0) < time.time():
            raise ValueError("token vencido")
        return payload
    except Exception:
        raise HTTPException(401, "Sesión inválida")


def usuario_actual(x_session_token: Annotated[str | None, Header()] = None) -> dict:
    if not x_session_token:
        raise HTTPException(401, "Iniciá sesión")
    return leer_token(x_session_token)


def login_usuario(data: LoginRequest) -> dict:
    usuario = data.usuario.strip().lower()
    res = (
        get_db().table("usuarios")
        .select("*")
        .eq("usuario", usuario)
        .eq("activo", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(401, "Usuario o contraseña incorrectos")

    user = res.data[0]
    if user.get("password_hash") != hash_password(data.password):
        raise HTTPException(401, "Usuario o contraseña incorrectos")

    token = crear_token(user)
    return {
        "token": token,
        "usuario": user["usuario"],
        "rol": user.get("rol", "jefe"),
    }
