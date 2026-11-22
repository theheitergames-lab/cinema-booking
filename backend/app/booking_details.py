# Одинаковая карточка билета для кабинета зрителя и администратора.
# Модель ответа зрителя выдаёт только поля его билета.
BOOKING_DETAILS = """
    SELECT b.id, b.screening_id, m.title AS movie_title, h.name AS hall_name,
           sc.starts_at, sc.end_at, b.status, b.ticket_code, b.price_per_seat,
           b.user_id, u.name AS user_name, u.email AS user_email,
           COALESCE((
               SELECT jsonb_agg(
                   jsonb_build_object('id', st.id, 'row_number', st.row_number,
                                      'seat_number', st.seat_number)
                   ORDER BY st.row_number, st.seat_number
               )
               FROM booking_seats bs
               JOIN seats st ON st.id = bs.seat_id
               WHERE bs.booking_id = b.id
           ), '[]'::jsonb) AS seats
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    JOIN screenings sc ON sc.id = b.screening_id
    JOIN movies m ON m.id = sc.movie_id
    JOIN halls h ON h.id = sc.hall_id
"""
