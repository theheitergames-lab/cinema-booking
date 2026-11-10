import datetime

from pydantic import BaseModel

class Movie(BaseModel):
    id: int
    title: str
    description: str | None
    duration_minutes: int
    age_rating: str | None
    genre: str | None
    poster_path: str | None
  
class Screening(BaseModel):
    id: int
    movie_id: int
    hall_id: int
    hall_name: str
    starts_at: datetime.datetime
    end_at: datetime.datetime

class Seat(BaseModel):
    id: int
    row_number: int
    seat_number: int
    is_occupied: bool
