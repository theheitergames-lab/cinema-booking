from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response
from psycopg.errors import ForeignKeyViolation, UniqueViolation
from pydantic import BaseModel, ConfigDict, Field

from app.auth import require_admin
from app.db import get_connection
from app.schemas import Movie


router = APIRouter(
    prefix="/admin",
    tags=["Администратор"],
    dependencies=[Depends(require_admin)],
)
LOCK_SCHEDULE = "LOCK TABLE screenings IN SHARE ROW EXCLUSIVE MODE"


class MovieForm(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    duration_minutes: int = Field(gt=0, le=2147483647)
    description: str | None = None
    genre: str | None = Field(default=None, max_length=50)
    age_rating: Literal["0+", "6+", "12+", "16+", "18+"] | None = None
    poster_path: str | None = Field(default=None, max_length=500)


class HallCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    rows: int = Field(ge=1, le=100)
    seats_per_row: int = Field(ge=1, le=100)


class HallUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    rows: int | None = Field(default=None, ge=1, le=100)
    seats_per_row: int | None = Field(default=None, ge=1, le=100)


class Hall(BaseModel):
    id: int
    name: str
    row_count: int
    seat_count: int


@router.get("/movies", response_model=list[Movie])
def list_movies():
    with get_connection() as conn:
        return conn.execute("SELECT * FROM movies ORDER BY title, id").fetchall()


@router.get("/movies/{movie_id}", response_model=Movie)
def get_movie(movie_id: int):
    with get_connection() as conn:
        movie = conn.execute("SELECT * FROM movies WHERE id = %s", (movie_id,)).fetchone()
        if movie is None:
            raise HTTPException(status_code=404, detail="Фильм не найден")
        return movie


@router.post("/movies", response_model=Movie, status_code=201)
def create_movie(data: MovieForm):
    with get_connection() as conn:
        return conn.execute(
            """
            INSERT INTO movies (title, duration_minutes, description, genre, age_rating, poster_path)
            VALUES (%(title)s, %(duration_minutes)s, %(description)s, %(genre)s, %(age_rating)s, %(poster_path)s)
            RETURNING *
            """,
            data.model_dump(),
        ).fetchone()


@router.put("/movies/{movie_id}", response_model=Movie)
def update_movie(movie_id: int, data: MovieForm):
    with get_connection() as conn:
        conn.execute(LOCK_SCHEDULE)
        previous = conn.execute(
            "SELECT duration_minutes, statement_timestamp()::timestamp AS now FROM movies WHERE id = %s",
            (movie_id,),
        ).fetchone()
        if previous is None:
            raise HTTPException(status_code=404, detail="Фильм не найден")

        movie = conn.execute(
            """
            UPDATE movies SET title = %(title)s, duration_minutes = %(duration_minutes)s,
                description = %(description)s, genre = %(genre)s, age_rating = %(age_rating)s,
                poster_path = %(poster_path)s
            WHERE id = %(id)s RETURNING *
            """,
            {**data.model_dump(), "id": movie_id},
        ).fetchone()

        if data.duration_minutes != previous["duration_minutes"]:
            result = conn.execute(
                """
                WITH updated AS (
                    UPDATE screenings SET end_at = starts_at + %s * interval '1 minute'
                    WHERE movie_id = %s AND starts_at > %s
                    RETURNING end_at
                )
                SELECT bool_or(end_at >= timestamp '10000-01-01') AS out_of_range FROM updated
                """,
                (data.duration_minutes, movie_id, previous["now"]),
            ).fetchone()
            if result["out_of_range"]:
                raise HTTPException(status_code=422, detail="Дата окончания сеанса слишком велика")
            conflict = conn.execute(
                """
                SELECT s.id, other.id AS other_id FROM screenings s
                JOIN screenings other ON other.hall_id = s.hall_id AND other.id <> s.id
                    AND s.starts_at < other.end_at AND other.starts_at < s.end_at
                WHERE s.movie_id = %s AND s.starts_at > %s
                LIMIT 1
                """,
                (movie_id, previous["now"]),
            ).fetchone()
            if conflict:
                raise HTTPException(
                    status_code=409,
                    detail=f"После изменения длительности пересекаются сеансы "
                           f"№{conflict['id']} и №{conflict['other_id']}",
                )
        return movie


@router.delete("/movies/{movie_id}", status_code=204)
def delete_movie(movie_id: int):
    with get_connection() as conn:
        conn.execute(LOCK_SCHEDULE)
        try:
            deleted = conn.execute("DELETE FROM movies WHERE id = %s", (movie_id,))
        except ForeignKeyViolation:
            raise HTTPException(status_code=409, detail="У фильма есть сеансы")
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Фильм не найден")
    return Response(status_code=204)


HALL_SELECT = """
    SELECT h.id, h.name, COUNT(DISTINCT s.row_number) AS row_count, COUNT(s.id) AS seat_count
    FROM halls h LEFT JOIN seats s ON s.hall_id = h.id
"""


def read_hall(conn, hall_id: int):
    hall = conn.execute(
        HALL_SELECT + " WHERE h.id = %s GROUP BY h.id", (hall_id,)
    ).fetchone()
    if hall is None:
        raise HTTPException(status_code=404, detail="Зал не найден")
    return hall


def add_grid_seats(conn, hall_id: int, rows: int, seats_per_row: int):
    conn.execute(
        """
        INSERT INTO seats (hall_id, row_number, seat_number)
        SELECT %s, r, s FROM generate_series(1, %s) r CROSS JOIN generate_series(1, %s) s
        ON CONFLICT (hall_id, row_number, seat_number) DO NOTHING
        """,
        (hall_id, rows, seats_per_row),
    )


@router.get("/halls", response_model=list[Hall])
def list_halls():
    with get_connection() as conn:
        return conn.execute(HALL_SELECT + " GROUP BY h.id ORDER BY h.name, h.id").fetchall()


@router.get("/halls/{hall_id}", response_model=Hall)
def get_hall(hall_id: int):
    with get_connection() as conn:
        return read_hall(conn, hall_id)


@router.post("/halls", response_model=Hall, status_code=201)
def create_hall(data: HallCreate):
    with get_connection() as conn:
        try:
            hall = conn.execute(
                "INSERT INTO halls (name) VALUES (%s) RETURNING id", (data.name,)
            ).fetchone()
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Зал с таким названием уже существует")
        add_grid_seats(conn, hall["id"], data.rows, data.seats_per_row)
        return read_hall(conn, hall["id"])


@router.put("/halls/{hall_id}", response_model=Hall)
def update_hall(hall_id: int, data: HallUpdate):
    if (data.rows is None) != (data.seats_per_row is None):
        raise HTTPException(status_code=422, detail="Укажи и число рядов, и число мест в ряду")

    with get_connection() as conn:
        conn.execute(LOCK_SCHEDULE)
        try:
            updated = conn.execute("UPDATE halls SET name = %s WHERE id = %s", (data.name, hall_id))
        except UniqueViolation:
            raise HTTPException(status_code=409, detail="Зал с таким названием уже существует")
        if updated.rowcount == 0:
            raise HTTPException(status_code=404, detail="Зал не найден")

        if data.rows is not None:
            # Если сетка уже совпадает, сохраняем идентификаторы и не трогаем места.
            shape = conn.execute(
                """
                SELECT count(*) AS seats, max(row_number) AS rows, max(seat_number) AS width
                FROM seats WHERE hall_id = %s
                """,
                (hall_id,),
            ).fetchone()
            expected_shape = {
                "seats": data.rows * data.seats_per_row,
                "rows": data.rows,
                "width": data.seats_per_row,
            }
            if shape != expected_shape:
                scheduled = conn.execute(
                    "SELECT 1 FROM screenings WHERE hall_id = %s LIMIT 1", (hall_id,)
                ).fetchone()
                if scheduled:
                    raise HTTPException(status_code=409, detail="В зале есть сеансы, схема мест используется")
                conn.execute(
                    "DELETE FROM seats WHERE hall_id = %s AND (row_number > %s OR seat_number > %s)",
                    (hall_id, data.rows, data.seats_per_row),
                )
                add_grid_seats(conn, hall_id, data.rows, data.seats_per_row)
        return read_hall(conn, hall_id)


@router.delete("/halls/{hall_id}", status_code=204)
def delete_hall(hall_id: int):
    with get_connection() as conn:
        conn.execute(LOCK_SCHEDULE)
        try:
            deleted = conn.execute("DELETE FROM halls WHERE id = %s", (hall_id,))
        except ForeignKeyViolation:
            raise HTTPException(status_code=409, detail="У зала есть сеансы")
        if deleted.rowcount == 0:
            raise HTTPException(status_code=404, detail="Зал не найден")
    return Response(status_code=204)
