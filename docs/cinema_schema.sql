-- =====================================================================
-- Физическая модель данных: ИС онлайн-бронирования мест в кинотеатре
-- СУБД: PostgreSQL 11+
-- Запуск: createdb cinema && psql -d cinema -f cinema_schema.sql
-- =====================================================================

-- чтобы скрипт можно было запускать повторно
DROP TABLE IF EXISTS booking_seats, bookings, screenings, seats, halls, movies, users CASCADE;
DROP FUNCTION IF EXISTS check_seat_free() CASCADE;


-- ---------- Пользователи ----------
-- гость после регистрации становится viewer, admin заводится вручную
CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'viewer'
                  CHECK (role IN ('viewer', 'admin'))
);

-- уникальность email без учёта регистра
CREATE UNIQUE INDEX idx_users_email_lower ON users (lower(email));

-- ---------- Фильмы ----------
CREATE TABLE movies (
    id               SERIAL PRIMARY KEY,
    title            VARCHAR(255) NOT NULL,
    description      TEXT,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
    age_rating       VARCHAR(5) CHECK (age_rating IN ('0+', '6+', '12+', '16+', '18+')),
    genre            VARCHAR(50),
    poster_path      VARCHAR(500)   -- путь к файлу в каталоге постеров на сервере
);

-- ---------- Залы ----------
CREATE TABLE halls (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ---------- Места в зале ----------
CREATE TABLE seats (
    id          SERIAL PRIMARY KEY,
    hall_id     INTEGER NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    row_number  INTEGER NOT NULL CHECK (row_number > 0),
    seat_number INTEGER NOT NULL CHECK (seat_number > 0),
    UNIQUE (hall_id, row_number, seat_number)
);

-- ---------- Сеансы ----------
CREATE TABLE screenings (
    id        SERIAL PRIMARY KEY,
    movie_id  INTEGER   NOT NULL REFERENCES movies(id),
    hall_id   INTEGER   NOT NULL REFERENCES halls(id),
    starts_at TIMESTAMP NOT NULL,
    end_at    TIMESTAMP NOT NULL,
    CHECK (end_at > starts_at)
);
-- пересечение сеансов в одном зале проверяет backend

-- ---------- Бронирования ----------
CREATE TABLE bookings (
    id           SERIAL PRIMARY KEY,
    user_id      INTEGER     NOT NULL REFERENCES users(id),
    screening_id INTEGER     NOT NULL REFERENCES screenings(id),
    created_at   TIMESTAMP   NOT NULL DEFAULT now(),
    status       VARCHAR(20) NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'cancelled', 'completed'))
);

-- ---------- Места в бронировании (многие-ко-многим) ----------
CREATE TABLE booking_seats (
    booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id    INTEGER NOT NULL REFERENCES seats(id),
    PRIMARY KEY (booking_id, seat_id)
);


-- ---------- Индексы под частые запросы ----------
CREATE INDEX idx_screenings_movie   ON screenings(movie_id);
CREATE INDEX idx_screenings_hall    ON screenings(hall_id, starts_at);
CREATE INDEX idx_bookings_user      ON bookings(user_id);
CREATE INDEX idx_bookings_screening ON bookings(screening_id);
CREATE INDEX idx_booking_seats_seat ON booking_seats(seat_id);


-- ---------- Защита от двойного бронирования ----------
-- нельзя добавить место, если оно уже в активной брони на этот же сеанс,
-- и нельзя взять место из другого зала
CREATE FUNCTION check_seat_free() RETURNS trigger AS $$
DECLARE
    v_screening INTEGER;
    v_hall      INTEGER;
BEGIN
    SELECT b.screening_id, sc.hall_id INTO v_screening, v_hall
    FROM bookings b
    JOIN screenings sc ON sc.id = b.screening_id
    WHERE b.id = NEW.booking_id;

    -- блокируем сеанс, чтобы две одновременные брони не проскочили
    PERFORM 1 FROM screenings WHERE id = v_screening FOR NO KEY UPDATE;

    IF NOT EXISTS (SELECT 1 FROM seats WHERE id = NEW.seat_id AND hall_id = v_hall) THEN
        RAISE EXCEPTION 'Место % не из зала этого сеанса', NEW.seat_id;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM booking_seats bs
        JOIN bookings b ON b.id = bs.booking_id
        WHERE bs.seat_id = NEW.seat_id
          AND b.screening_id = v_screening
          AND b.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Место % уже забронировано на этот сеанс', NEW.seat_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_seat_free
BEFORE INSERT ON booking_seats
FOR EACH ROW EXECUTE FUNCTION check_seat_free();


-- =====================================================================
-- Тестовые данные
-- =====================================================================
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Администратор', 'admin@cinema.local', '$2b$12$replace_with_real_hash', 'admin'),
    ('Иван Петров',   'ivan@example.com',   '$2b$12$replace_with_real_hash', 'viewer');

INSERT INTO halls (name) VALUES ('Зал 1'), ('Зал 2');

-- зал 1: 5 рядов по 10 мест, зал 2: 4 ряда по 8 мест
INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 1, r, s FROM generate_series(1, 5) r, generate_series(1, 10) s;
INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 2, r, s FROM generate_series(1, 4) r, generate_series(1, 8) s;

INSERT INTO movies (title, description, duration_minutes, age_rating, genre, poster_path) VALUES
    ('Космический рейс', 'Фантастика про экипаж дальнего корабля', 140, '12+', 'Фантастика', 'posters/space.jpg'),
    ('Тихий город',      'Детектив в маленьком городке',           105, '16+', 'Детектив',   'posters/town.jpg');

INSERT INTO screenings (movie_id, hall_id, starts_at, end_at) VALUES
    (1, 1, '2026-11-01 18:00', '2026-11-01 20:20'),
    (2, 1, '2026-11-01 21:00', '2026-11-01 22:45'),
    (2, 2, '2026-11-02 19:00', '2026-11-02 20:45');

INSERT INTO bookings (user_id, screening_id) VALUES (2, 1);
INSERT INTO booking_seats (booking_id, seat_id) VALUES (1, 5), (1, 6);


-- =====================================================================
-- Примеры запросов для backend
-- =====================================================================
-- Свободные места на сеанс 1:
-- SELECT s.id, s.row_number, s.seat_number
-- FROM seats s
-- JOIN screenings sc ON sc.hall_id = s.hall_id
-- WHERE sc.id = 1
--   AND s.id NOT IN (SELECT bs.seat_id
--                    FROM booking_seats bs
--                    JOIN bookings b ON b.id = bs.booking_id
--                    WHERE b.screening_id = 1 AND b.status = 'active')
-- ORDER BY s.row_number, s.seat_number;
--
-- Мои бронирования (user_id = 2):
-- SELECT b.id, m.title, sc.starts_at, h.name AS hall, b.status
-- FROM bookings b
-- JOIN screenings sc ON sc.id = b.screening_id
-- JOIN movies m ON m.id = sc.movie_id
-- JOIN halls h ON h.id = sc.hall_id
-- WHERE b.user_id = 2
-- ORDER BY sc.starts_at DESC;
--
-- Отмена брони (места сразу освобождаются):
-- UPDATE bookings SET status = 'cancelled' WHERE id = 1;
