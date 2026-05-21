from fastapi import APIRouter

from auth import LoginRequest, login_usuario

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
def login(data: LoginRequest):
    return login_usuario(data)
