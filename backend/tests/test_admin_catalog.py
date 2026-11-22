from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from api_case import ApiCase


class AdminCatalogTest(ApiCase):
    def create_movie(self):
        return self.api("POST", "/admin/movies", {
            "title": self._testMethodName, "duration_minutes": 60,
        }, self.admin, 201)

    def create_hall(self):
        return self.api("POST", "/admin/halls", {
            "name": self._testMethodName, "rows": 2, "seats_per_row": 3,
        }, self.admin, 201)

    def slot(self, movie, hall, hour):
        return {
            "movie_id": movie["id"], "hall_id": hall["id"],
            "starts_at": f"{self.tomorrow}T{hour:02d}:00:00",
        }

    def test_catalog_crud(self):
        movie = self.create_movie()
        hall = self.create_hall()
        movie_url = f"/admin/movies/{movie['id']}"
        hall_url = f"/admin/halls/{hall['id']}"
        self.assertIn(movie, self.api("GET", "/admin/movies", token=self.admin))
        self.assertIn(hall, self.api("GET", "/admin/halls", token=self.admin))
        self.assertEqual(hall["seat_count"], 6)

        self.api("POST", "/admin/halls", {
            "name": hall["name"], "rows": 1, "seats_per_row": 1,
        }, self.admin, 409)
        renamed = self.api("PUT", hall_url, {
            "name": "Новый зал", "rows": 3, "seats_per_row": 5,
        }, self.admin)
        self.assertEqual((renamed["row_count"], renamed["seat_count"]), (3, 15))
        self.api("PUT", hall_url, {"name": "Новый зал", "rows": 2}, self.admin, 422)
        self.assertEqual(self.api("GET", hall_url, token=self.admin), renamed)
        self.api("PUT", movie_url, {
            "title": "Новый фильм", "duration_minutes": 75, "genre": "Комедия",
        }, self.admin)
        self.assertEqual(self.api("GET", movie_url, token=self.admin)["genre"], "Комедия")
        for url in (movie_url, hall_url):
            self.api("DELETE", url, token=self.admin, expected=204)
            self.api("GET", url, token=self.admin, expected=404)

    def test_schedule_and_duration_conflicts(self):
        movie = self.create_movie()
        hall = self.create_hall()
        movie_url = f"/admin/movies/{movie['id']}"
        hall_url = f"/admin/halls/{hall['id']}"
        url = "/admin/screenings"
        first_slot = self.slot(movie, hall, 10)
        first = self.api("POST", url, first_slot, self.admin, 201)
        second = self.api("POST", url, self.slot(movie, hall, 11), self.admin, 201)
        self.assertEqual(first["end_at"], second["starts_at"])
        self.assertEqual((first["total_seats"], first["occupied_seats"], first["price"]), (6, 0, 350))
        self.api("POST", url, first_slot, self.admin, 409)
        self.api("POST", url, {**first_slot, "starts_at": "2001-01-01T10:00:00"}, self.admin, 422)
        self.api("POST", url, {**first_slot, "starts_at": first_slot["starts_at"] + "Z"}, self.admin, 422)
        self.api("POST", url, {**first_slot, "movie_id": 999999999}, self.admin, 404)

        first_url = f"{url}/{first['id']}"
        self.api("PATCH", first_url, {"starts_at": second["starts_at"]}, self.admin, 409)
        self.api("PATCH", first_url, {"hall_id": hall["id"]}, self.admin, 422)
        self.api("PUT", hall_url, {"name": "Ошибка", "rows": 1, "seats_per_row": 2}, self.admin, 409)
        self.assertEqual(self.api("GET", hall_url, token=self.admin), hall)
        for resource in (movie_url, hall_url):
            self.api("DELETE", resource, token=self.admin, expected=409)

        new_movie = {"title": "Длинный фильм", "duration_minutes": 80}
        self.api("PUT", movie_url, new_movie, self.admin, 409)
        self.assertEqual(self.api("GET", movie_url, token=self.admin), movie)
        filtered = f"{url}?hall_id={hall['id']}&movie_id={movie['id']}&date={self.tomorrow}"
        self.assertEqual(self.api("GET", filtered, token=self.admin), [first, second])

        self.api("DELETE", f"{url}/{second['id']}", token=self.admin, expected=204)
        self.api("PUT", movie_url, new_movie, self.admin)
        updated, = self.api("GET", filtered, token=self.admin)
        self.assertEqual(updated["end_at"], f"{self.tomorrow}T11:20:00")

    def test_booking_survives_reschedule(self):
        movie = self.create_movie()
        hall = self.create_hall()
        slot = self.slot(movie, hall, 10)
        screening = self.api("POST", "/admin/screenings", slot, self.admin, 201)
        url = f"/admin/screenings/{screening['id']}"
        seats = self.api("GET", f"/screenings/{screening['id']}/seats")
        booking = self.api("POST", "/bookings", {
            "screening_id": screening["id"], "seat_ids": [seats[0]["id"]],
        }, self.viewer, 201)
        moved = self.api("PATCH", url, {
            "starts_at": f"{self.tomorrow}T12:00:00", "price": 450,
        }, self.admin)
        self.assertEqual((moved["occupied_seats"], moved["price"]), (1, 450))
        history = self.api("GET", "/bookings", token=self.viewer)
        own = next(row for row in history if row["id"] == booking["id"])
        self.assertEqual(own["ticket_code"], booking["ticket_code"])
        self.assertEqual(own["starts_at"], moved["starts_at"])
        self.assertEqual(own["seats"][0]["id"], seats[0]["id"])
        self.assertEqual((own["price_per_seat"], own["total_price"]), (350, 350))
        self.api("DELETE", url, token=self.admin, expected=409)
        self.api("PATCH", f"/bookings/{booking['id']}/cancel", token=self.viewer)
        self.api("DELETE", url, token=self.admin, expected=409)
        cancelled, = self.api("GET", f"/admin/screenings?hall_id={hall['id']}", token=self.admin)
        self.assertEqual(cancelled["occupied_seats"], 0)

    def test_concurrent_screenings(self):
        movie = self.create_movie()
        hall = self.create_hall()
        slot = self.slot(movie, hall, 13)
        ready = Barrier(2)

        def create():
            ready.wait(timeout=10)
            status, _ = self.request("POST", "/admin/screenings", slot, self.admin)
            return status

        with ThreadPoolExecutor(max_workers=2) as workers:
            requests = [workers.submit(create) for _ in range(2)]
            self.assertEqual(sorted(job.result(timeout=30) for job in requests), [201, 409])
        screenings = self.api("GET", f"/admin/screenings?hall_id={hall['id']}", token=self.admin)
        self.assertEqual(len(screenings), 1)
