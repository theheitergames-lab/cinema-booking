import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.errors import UniqueViolation

from app.db import get_connection
from app.schemas import LoginRequest, Movie, RegisterRequest, Screening, Seat, Token, User
from app.security import create_token, decode_token, hash_password, verify_password

app = FastAPI(title="Cinema Booking API")
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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/movies", response_model=list[Movie])
def list_movies():
    with get_connection() as conn:
        movies = conn.execute(
            """
            SELECT id, title, description, duration_minutes,
                   age_rating, genre, poster_path
            FROM movies
            ORDER BY title
            """
        ).fetchall()
    return movies

@app.get("/movies/{movie_id}", response_model=Movie)
def get_movie(movie_id: int):
    with get_connection() as conn:
        movie = conn.execute(
            """
            SELECT id, title, description, duration_minutes,
                   age_rating, genre, poster_path
            FROM movies
            WHERE id = %s
            """,
            (movie_id,),
        ).fetchone()
        if movie is None:
            raise HTTPException(status_code=404, detail="Фильм не найден")
    return movie

@app.get("/screenings", response_model=list[Screening])
def list_screenings(movie_id: int, date: datetime.date):
    with get_connection() as conn:
        screenings = conn.execute(
            """
            SELECT s.id, s.movie_id, s.hall_id, h.name AS hall_name,
                   s.starts_at, s.end_at
            FROM screenings s
            JOIN halls h ON h.id = s.hall_id
            WHERE s.movie_id = %s
              AND s.starts_at::date = %s
              AND s.starts_at > localtimestamp
            ORDER BY s.starts_at
            """,
            (movie_id, date),
        ).fetchall()
    return screenings

@app.get("/screenings/{screening_id}/seats", response_model=list[Seat])
def list_seats(screening_id: int):
    with get_connection() as conn:
        screening = conn.execute(
            "SELECT id FROM screenings WHERE id = %s",
            (screening_id,),
        ).fetchone()
        if screening is None:
            raise HTTPException(status_code=404, detail="Сеанс не найден")

        seats = conn.execute(
            """
            SELECT st.id, st.row_number, st.seat_number,
                   EXISTS (
                       SELECT 1
                       FROM booking_seats bs
                       JOIN bookings b ON b.id = bs.booking_id
                       WHERE bs.seat_id = st.id
                         AND b.screening_id = sc.id
                         AND b.status = 'active'
                   ) AS is_occupied
            FROM screenings sc
            JOIN seats st ON st.hall_id = sc.hall_id
            WHERE sc.id = %s
            ORDER BY st.row_number, st.seat_number
            """,
            (screening_id,),
        ).fetchall()
    return seats

@app.post("/auth/register", response_model=User, status_code=201)
def register(data: RegisterRequest):
    if len(data.password.encode()) > 72:
        raise HTTPException(status_code=422, detail="Пароль слишком длинный")

    password_hash = hash_password(data.password)
    with get_connection() as conn:
        try:
            user = conn.execute(
                """
                INSERT INTO users (name, email, password_hash)
                VALUES (%s, %s, %s)
                RETURNING id, name, email, role
                """,
                (data.name, data.email, password_hash),
            ).fetchone()
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    return user

@app.post("/auth/login", response_model=Token)
def login(data: LoginRequest):
    with get_connection() as conn:
        user = conn.execute(
            "SELECT id, password_hash FROM users WHERE lower(email) = lower(%s)",
            (data.email,),
        ).fetchone()

    if user is None or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    return {"access_token": create_token(user["id"])}


@app.get("/auth/me", response_model=User)
def me(user: dict = Depends(get_current_user)):
    return user