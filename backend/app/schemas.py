import datetime
from uuid import UUID

from pydantic import BaseModel, Field

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

class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=255, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=6, max_length=72)

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class User(BaseModel):
    id: int
    name: str
    email: str
    role: str

class BookingRequest(BaseModel):
    screening_id: int = Field(gt=0)
    seat_ids: list[int] = Field(min_length=1)

class Booking(BaseModel):
    id: int
    user_id: int
    screening_id: int
    created_at: datetime.datetime
    status: str
    ticket_code: UUID
    seat_ids: list[int]

class BookingSeat(BaseModel):
    id: int
    row_number: int
    seat_number: int


class BookingListItem(BaseModel):
    id: int
    screening_id: int
    movie_title: str
    hall_name: str
    starts_at: datetime.datetime
    status: str
    ticket_code: UUID
    seats: list[BookingSeat]

class BookingStatusResponse(BaseModel):
    id: int
    status: str