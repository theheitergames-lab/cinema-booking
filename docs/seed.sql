-- Тестовые данные для разработки и демо.
-- Запуск: pgAdmin → база Cinema → Query Tool → открыть этот файл → Execute (F5).
-- Скрипт можно запускать повторно: он очищает таблицы и заполняет их заново.

TRUNCATE booking_seats, bookings, screenings, seats, halls, movies, users RESTART IDENTITY CASCADE;

-- Пользователи. Пароли заменим настоящими хешами, когда появится регистрация.
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Администратор', 'admin@cinema.local', 'not_a_real_hash', 'admin'),
    ('Иван Петров',   'ivan@example.com',   'not_a_real_hash', 'viewer');

INSERT INTO halls (name) VALUES ('Зал 1'), ('Зал 2');

-- Зал 1: 5 рядов по 10 мест, зал 2: 4 ряда по 8 мест
INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 1, r, s FROM generate_series(1, 5) AS r, generate_series(1, 10) AS s;

INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 2, r, s FROM generate_series(1, 4) AS r, generate_series(1, 8) AS s;

-- Те же фильмы, что в демо-данных фронтенда
INSERT INTO movies (title, description, duration_minutes, age_rating, genre, poster_path) VALUES
    ('Последний поезд', 'У каждого свой путь.',              112, '16+', 'Триллер', 'posters/train.jpg'),
    ('Не по плану',     'Лучшее случается случайно.',        98,  '12+', 'Комедия', 'posters/comedy.jpg'),
    ('Письма домой',    'Есть вещи, которые нужно сказать.', 106, '12+', 'Драма',   'posters/drama.jpg'),
    ('Тихий этаж',      'Здесь тебя услышат.',               104, '18+', 'Триллер', 'posters/thriller.jpg');

-- Сеансы на 7 дней, начиная с завтрашнего.
-- Даты считаются от дня запуска скрипта, поэтому никогда не устаревают.
INSERT INTO screenings (movie_id, hall_id, starts_at, end_at)
SELECT p.movie_id,
       p.hall_id,
       current_date + day_offset + p.start_time,
       current_date + day_offset + p.start_time + m.duration_minutes * interval '1 minute'
FROM generate_series(1, 7) AS day_offset
CROSS JOIN (VALUES
    (1, 1, time '15:00'),
    (2, 1, time '18:00'),
    (4, 1, time '21:00'),
    (3, 2, time '16:00'),
    (1, 2, time '19:30')
) AS p(movie_id, hall_id, start_time)
JOIN movies m ON m.id = p.movie_id
ORDER BY day_offset, p.start_time;

-- Иван забронировал 2 места на первый сеанс (ряд 1, места 5 и 6 в Зале 1)
INSERT INTO bookings (user_id, screening_id) VALUES (2, 1);
INSERT INTO booking_seats (booking_id, seat_id) VALUES (1, 5), (1, 6);