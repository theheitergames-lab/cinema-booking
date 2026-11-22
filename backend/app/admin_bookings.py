from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import require_admin
from app.booking_details import BOOKING_DETAILS
from app.db import get_connection
from app.schemas import BookingListItem, BookingStatusResponse


router = APIRouter(prefix="/admin", tags=["Администратор"], dependencies=[Depends(require_admin)])


class AdminBooking(BookingListItem):
    user_id: int
    user_name: str
    user_email: str


class BookingStatusUpdate(BaseModel):
    status: Literal["cancelled", "completed"]


@router.get("/bookings", response_model=list[AdminBooking])
def list_admin_bookings(status: Literal["active", "cancelled", "completed"] | None = None):
    with get_connection() as conn:
        return conn.execute(
            BOOKING_DETAILS + """
            WHERE (%(status)s::text IS NULL OR b.status = %(status)s)
            ORDER BY sc.starts_at DESC, b.id DESC
            """,
            {"status": status},
        ).fetchall()


@router.patch("/bookings/{booking_id}/status", response_model=BookingStatusResponse)
def update_booking_status(booking_id: int, data: BookingStatusUpdate):
    with get_connection() as conn:
        booking = conn.execute(
            """
            UPDATE bookings b SET status = %(status)s
            FROM screenings sc
            WHERE b.id = %(id)s AND sc.id = b.screening_id AND b.status = 'active'
              AND ((%(status)s = 'cancelled' AND sc.starts_at > localtimestamp)
                OR (%(status)s = 'completed' AND sc.end_at <= localtimestamp))
            RETURNING b.id, b.status
            """,
            {"id": booking_id, "status": data.status},
        ).fetchone()
        if booking is not None:
            return booking
        if conn.execute("SELECT id FROM bookings WHERE id = %s", (booking_id,)).fetchone() is None:
            raise HTTPException(404, "Бронь не найдена")
        raise HTTPException(409, "Активную бронь можно отменить до начала или завершить после конца сеанса")


@router.get("/tickets/{ticket_code}", response_model=AdminBooking)
def check_ticket(ticket_code: UUID):
    with get_connection() as conn:
        booking = conn.execute(
            BOOKING_DETAILS + " WHERE b.ticket_code = %s", (ticket_code,),
        ).fetchone()
    if booking is None:
        raise HTTPException(404, "Билет не найден")
    return booking
