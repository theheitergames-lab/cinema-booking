from pydantic import BaseModel

class Movie(BaseModel):
    id: int
    title: str
    description: str | None
    duration_minutes: int
    age_rating: str | None
    genre: str | None
    poster_path: str | None