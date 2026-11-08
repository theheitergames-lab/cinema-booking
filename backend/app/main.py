from fastapi import FastAPI

from app.db import get_connection

app = FastAPI(title="Cinema Booking API")

@app.get("/health")
def health():
    return {"status": "ok"}
@app.get("/movies")
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