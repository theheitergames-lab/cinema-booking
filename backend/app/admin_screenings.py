import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, NaiveDatetime

from app.auth import require_admin
from app.db import get_connection
from app.schemas import Screening


router = APIRouter(
    prefix="/admin/screenings",
    tags=["Администратор"],
    dependencies=[Depends(require_admin)],
)


class ScreeningCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    movie_id: int = Field(gt=0)
    hall_id: int = Field(gt=0)
    starts_at: NaiveDatetime
    price: int = Field(default=350, ge=0, le=2147483647)


class ScreeningUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    starts_at: NaiveDatetime | None = None
    price: int | None = Field(default=None, ge=0, le=2147483647)


class AdminScreening(Screening):
    movie_title: str
    occupied_seats: int
    total_seats: int


SCREENING_DETAILS = """
    SELECT s.id, s.movie_id, m.title AS movie_title, s.hall_id,
           h.name AS hall_name, s.starts_at, s.end_at, s.price,
           (SELECT count(*) FROM seats WHERE hall_id = s.hall_id) AS total_seats,
           (SELECT count(DISTINCT bs.seat_id)
            FROM bookings b
            JOIN booking_seats bs ON bs.booking_id = b.id
            WHERE b.screening_id = s.id AND b.status IN ('active', 'completed')
           ) AS occupied_seats
    FROM screenings s
    JOIN movies m ON m.id = s.movie_id
    JOIN halls h ON h.id = s.hall_id
"""


def get_future_screening(conn, screening_id):
    screening = conn.execute(
        """
        SELECT movie_id, hall_id,
               starts_at > statement_timestamp()::timestamp AS is_future
        FROM screenings WHERE id = %s FOR UPDATE
        """,
        (screening_id,),
    ).fetchone()
    if screening is None:
        raise HTTPException(404, "Сеанс не найден")
    if not screening["is_future"]:
        raise HTTPException(409, "Начавшийся сеанс нельзя изменить или удалить")
    return screening


def check_screening_time(conn, movie_id, hall_id, starts_at, screening_id=None):
    movie = conn.execute(
        """
        SELECT duration_minutes, statement_timestamp()::timestamp AS now
        FROM movies WHERE id = %s FOR KEY SHARE
        """,
        (movie_id,),
    ).fetchone()
    if movie is None:
        raise HTTPException(404, "Фильм не найден")
    if starts_at <= movie["now"]:
        raise HTTPException(422, "Начало сеанса должно быть в будущем")

    try:
        end_at = starts_at + datetime.timedelta(minutes=movie["duration_minutes"])
    except OverflowError:
        raise HTTPException(422, "Дата окончания сеанса слишком велика")

    overlap = conn.execute(
        """
        SELECT id FROM screenings
        WHERE hall_id = %s AND id IS DISTINCT FROM %s
          AND starts_at < %s AND end_at > %s
        LIMIT 1
        """,
        (hall_id, screening_id, end_at, starts_at),
    ).fetchone()
    if overlap:
        raise HTTPException(409, f"В этом зале уже запланирован сеанс №{overlap['id']}")
    return end_at


@router.get("", response_model=list[AdminScreening])
def list_admin_screenings(
    date: datetime.date | None = None,
    movie_id: int | None = Query(default=None, gt=0, le=2147483647),
    hall_id: int | None = Query(default=None, gt=0, le=2147483647),
):
    with get_connection() as conn:
        return conn.execute(
            SCREENING_DETAILS + """
            WHERE (%s::date IS NULL OR s.starts_at::date = %s)
              AND (%s::int IS NULL OR s.movie_id = %s)
              AND (%s::int IS NULL OR s.hall_id = %s)
            ORDER BY s.starts_at, s.id
            """,
            (date, date, movie_id, movie_id, hall_id, hall_id),
        ).fetchall()


@router.post("", response_model=AdminScreening, status_code=201)
def create_screening(data: ScreeningCreate):
    with get_connection() as conn:
        # Все изменения расписания по очереди проверяют пересечения и записывают результат.
        conn.execute("LOCK TABLE screenings IN SHARE ROW EXCLUSIVE MODE")
        hall = conn.execute(
            "SELECT id FROM halls WHERE id = %s FOR KEY SHARE", (data.hall_id,)
        ).fetchone()
        if hall is None:
            raise HTTPException(404, "Зал не найден")
        end_at = check_screening_time(conn, data.movie_id, data.hall_id, data.starts_at)
        screening = conn.execute(
            """
            INSERT INTO screenings (movie_id, hall_id, starts_at, end_at, price)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
            """,
            (data.movie_id, data.hall_id, data.starts_at, end_at, data.price),
        ).fetchone()
        return conn.execute(
            SCREENING_DETAILS + " WHERE s.id = %s", (screening["id"],)
        ).fetchone()


@router.patch("/{screening_id}", response_model=AdminScreening)
def update_screening(screening_id: int, data: ScreeningUpdate):
    if data.starts_at is None and data.price is None:
        raise HTTPException(422, "Укажите новое время начала или цену")
    with get_connection() as conn:
        conn.execute("LOCK TABLE screenings IN SHARE ROW EXCLUSIVE MODE")
        screening = get_future_screening(conn, screening_id)
        if data.starts_at is not None:
            end_at = check_screening_time(
                conn, screening["movie_id"], screening["hall_id"], data.starts_at, screening_id
            )
            conn.execute(
                "UPDATE screenings SET starts_at = %s, end_at = %s WHERE id = %s",
                (data.starts_at, end_at, screening_id),
            )
        if data.price is not None:
            conn.execute(
                "UPDATE screenings SET price = %s WHERE id = %s", (data.price, screening_id)
            )
        return conn.execute(
            SCREENING_DETAILS + " WHERE s.id = %s", (screening_id,)
        ).fetchone()


@router.delete("/{screening_id}", status_code=204)
def delete_screening(screening_id: int):
    with get_connection() as conn:
        conn.execute("LOCK TABLE screenings IN SHARE ROW EXCLUSIVE MODE")
        get_future_screening(conn, screening_id)
        booking = conn.execute(
            "SELECT id FROM bookings WHERE screening_id = %s LIMIT 1", (screening_id,)
        ).fetchone()
        if booking:
            raise HTTPException(409, "У сеанса есть бронирования")
        conn.execute("DELETE FROM screenings WHERE id = %s", (screening_id,))
    return Response(status_code=204)
