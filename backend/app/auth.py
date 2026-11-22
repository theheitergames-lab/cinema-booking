from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.db import get_connection
from app.security import decode_token


bearer = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Нужно войти")

    user_id = decode_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Токен недействителен или истёк")

    with get_connection() as conn:
        user = conn.execute(
            "SELECT id, name, email, role FROM users WHERE id = %s",
            (user_id,),
        ).fetchone()

    if user is None:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user


def require_admin(user: dict = Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Нужны права администратора")
    return user
