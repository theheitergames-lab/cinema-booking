from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Barrier
from urllib.parse import urlencode
from uuid import uuid4

from api_case import ApiCase


class CinemaTest(ApiCase):
    def test_poster(self):
        full = self.api("GET", "/movies")
        movies = self.api("GET", f"/movies?date={self.tomorrow}")
        ids = [movie["id"] for movie in movies]
        self.assertTrue(0 < len(movies) < len(full))
        self.assertEqual(len(set(ids)), len(ids))
        for movie in movies:
            self.assertIn(movie, full)
            self.assertTrue(self.api("GET", f"/screenings?movie_id={movie['id']}&date={self.tomorrow}"))
        genre = movies[0]["genre"]
        url = "/movies?" + urlencode({"date": self.tomorrow, "genre": genre.lower()})
        self.assertEqual(self.api("GET", url), [movie for movie in movies if movie["genre"] == genre])
        self.assertEqual(self.api("GET", "/movies?date=2000-01-01"), [])
        self.api("GET", "/movies?date=32-13-2000", expected=422)

    def test_access(self):
        routes = (
            ("GET", "/admin/bookings", None),
            ("GET", "/admin/movies", None),
            ("GET", "/admin/halls", None),
            ("GET", "/admin/screenings", None),
            ("PATCH", "/admin/bookings/1/status", {"status": "cancelled"}),
            ("GET", f"/admin/tickets/{uuid4()}", None),
        )
        for method, url, data in routes:
            with self.subTest(path=url):
                self.api(method, url, data, expected=401)
                self.api(method, url, data, self.viewer, 403)
        self.api("GET", f"/admin/tickets/{uuid4()}", token=self.admin, expected=404)

    def test_viewer_to_admin_and_back(self):
        # Две свободные позиции на завтрашнем сеансе, даже при изменении seed.
        screening = self.api("GET", f"/admin/screenings?date={self.tomorrow}", token=self.admin)[0]
        seats_url = f"/screenings/{screening['id']}/seats"
        seat_ids = [s["id"] for s in self.api("GET", seats_url) if not s["is_occupied"]][:2]
        data = {"screening_id": screening["id"], "seat_ids": seat_ids}
        booking = self.api("POST", "/bookings", data, self.viewer, 201)
        self.api("POST", "/bookings", data, self.viewer, 409)
        self.assertEqual(booking["total_price"], screening["price"] * 2)
        code = booking["ticket_code"]
        url = f"/admin/bookings/{booking['id']}/status"

        self.api("PATCH", f"/admin/screenings/{screening['id']}", {"price": 620}, self.admin)
        ticket = self.api("GET", f"/admin/tickets/{code}", token=self.admin)
        self.assertEqual(ticket["user_email"], "ivan@example.com")
        self.assertEqual(ticket["total_price"], booking["total_price"])
        listed = self.api("GET", "/admin/bookings?status=active", token=self.admin)
        self.assertIn(ticket, listed)
        self.api("PATCH", url, {"status": "completed"}, self.admin, 409)
        self.api("PATCH", url, {"status": "cancelled"}, self.admin)
        self.api("PATCH", url, {"status": "cancelled"}, self.admin, 409)
        self.api("PATCH", url, {"status": "active"}, self.admin, 422)
        self.api("PATCH", "/admin/bookings/999999/status", {"status": "cancelled"}, self.admin, 404)
        self.assertEqual(self.api("GET", f"/admin/tickets/{code}", token=self.admin)["status"], "cancelled")
        history = self.api("GET", "/bookings", token=self.viewer)
        own = next(row for row in history if row["id"] == booking["id"])
        self.assertEqual((own["status"], own["ticket_code"]), ("cancelled", code))
        self.assertNotIn("user_email", own)
        self.assertFalse(any(s["is_occupied"] for s in self.api("GET", seats_url) if s["id"] in seat_ids))
        other = self.login("maria@example.com", "maria123")
        self.assertNotIn(booking["id"], [b["id"] for b in self.api("GET", "/bookings", token=other)])

    def test_completed_after_end(self):
        # Сдвигаем только тестовый сеанс Марии в прошлое, чтобы проверить границу времени.
        booking = self.api("GET", "/bookings", token=self.login("maria@example.com", "maria123"))[0]
        with self.db() as conn:
            conn.execute("""
                UPDATE screenings SET starts_at = localtimestamp - interval '3 hours',
                                      end_at = localtimestamp - interval '1 hour'
                WHERE id = %s
            """, (booking["screening_id"],))
        url = f"/admin/bookings/{booking['id']}/status"
        self.api("PATCH", url, {"status": "cancelled"}, self.admin, 409)
        self.api("PATCH", url, {"status": "completed"}, self.admin)
        self.assertEqual(self.api("GET", f"/admin/tickets/{booking['ticket_code']}",
                                  token=self.admin)["status"], "completed")

    def test_two_viewers_one_seat(self):
        day = self.tomorrow + timedelta(days=1)
        screening = self.api("GET", f"/admin/screenings?date={day}", token=self.admin)[0]
        seats = self.api("GET", f"/screenings/{screening['id']}/seats")
        data = {"screening_id": screening["id"], "seat_ids": [seats[0]["id"]]}
        ready = Barrier(2)

        def book(token):
            ready.wait(timeout=10)
            return self.request("POST", "/bookings", data, token)[0]

        tokens = [self.viewer, self.login("maria@example.com", "maria123")]
        with ThreadPoolExecutor(max_workers=2) as pool:
            self.assertEqual(sorted(pool.map(book, tokens)), [201, 409])
        bookings = self.api("GET", "/admin/bookings", token=self.admin)
        self.assertEqual(sum(b["screening_id"] == screening["id"] for b in bookings), 1)
