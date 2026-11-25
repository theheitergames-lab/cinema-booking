-- Тестовые данные для разработки и демо.
-- Запуск: pgAdmin → база Cinema → Query Tool → открыть этот файл → Execute (F5).
-- Скрипт можно запускать повторно: он очищает таблицы и заполняет их заново.
-- Даты считаются от дня запуска, поэтому перед демо скрипт лучше перезапустить.

TRUNCATE booking_seats, bookings, screenings, seats, halls, movies, users RESTART IDENTITY CASCADE;


-- ---------- Пользователи ----------
-- В БД хранятся только bcrypt-хеши. Пароли для входа на демо:
--   admin@cinema.local  / admin123  (администратор)
--   ivan@example.com    / ivan123   (зритель)
--   maria@example.com   / maria123  (зритель)
INSERT INTO users (name, email, password_hash, role) VALUES
    ('Администратор', 'admin@cinema.local', '$2b$12$5Hyy.7xVSjv78S9CczaeF.p7xtSCN1skMxkj8O/YfTa7IF6/zl3Qe', 'admin'),
    ('Иван Петров',   'ivan@example.com',   '$2b$12$P3.QkRheCKg/01NzCGTXAu8vgB8/eUOVrnzBBiHOBpGpMv3Zxlgp.', 'viewer'),
    ('Мария Смирнова', 'maria@example.com', '$2b$12$hYMg3.994NZylqrJV.6l.OWpFRolO31weJr8peCFgSr9zj0RiITH6', 'viewer');


-- ---------- Залы и места ----------
INSERT INTO halls (name) VALUES ('Зал 1'), ('Зал 2'), ('Панорамный зал');

-- Зал 1: 5 рядов по 10 мест (50)
INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 1, r, s FROM generate_series(1, 5) AS r, generate_series(1, 10) AS s;

-- Зал 2: 4 ряда по 8 мест (32)
INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 2, r, s FROM generate_series(1, 4) AS r, generate_series(1, 8) AS s;

-- Панорамный зал: ряды расширяются к концу зала (100 мест).
-- Для каждого ряда указано число мест, generate_series раскладывает его на номера.
INSERT INTO seats (hall_id, row_number, seat_number)
SELECT 3, r.row_number, s
FROM (VALUES
    (1, 10), (2, 10),
    (3, 12), (4, 12),
    (5, 14), (6, 14), (7, 14), (8, 14)
) AS r(row_number, seat_count),
generate_series(1, r.seat_count) AS s;


-- ---------- Фильмы (23) ----------
INSERT INTO movies (title, description, duration_minutes, age_rating, genre, poster_path) VALUES
    -- фильмы из макета фронтенда
    ('Остров проклятых', 'Два судебных маршала прибывают в закрытую лечебницу на острове, чтобы расследовать исчезновение пациентки.', 138, '18+', 'Триллер', '/images/shutter-island.jpg'),
    ('1+1', 'Аристократ Филипп нанимает помощником Дрисса — молодого человека, который переворачивает его привычную жизнь.', 115, '16+', 'Комедия', '/images/comedy.jpeg'),
    ('Голодные игры: Рассвет Жатвы', 'Молодой Хеймитч Эбернети из 12-го дистрикта участвует в легендарных 50-х Голодных играх.', 150, '12+', 'Боевик',   '/images/The-hunger-games.jpg'),
    ('Оно', 'Друзья из маленького города сталкиваются с существом, которое принимает облик клоуна и воплощает их страхи.', 135, '18+', 'Ужасы', '/images/it.jpg'),

    -- Гарри Поттер: все 8 фильмов
    ('Гарри Поттер и философский камень', 'Гарри узнаёт, что он волшебник, и впервые приезжает в Хогвартс.', 152, '6+', 'Фэнтези', '/images/harry-potter-1.jpg'),
    ('Гарри Поттер и Тайная комната', 'В Хогвартсе кто-то открыл Тайную комнату, и ученики каменеют.', 161, '6+', 'Фэнтези', '/images/harry-potter-2.jpg'),
    ('Гарри Поттер и узник Азкабана', 'Из тюрьмы Азкабан сбежал опасный узник, и он ищет Гарри.', 142, '12+', 'Фэнтези', '/images/harry-potter-3.webp'),
    ('Гарри Поттер и Кубок огня', 'Гарри неожиданно становится участником Турнира трёх волшебников.', 157, '12+', 'Фэнтези', '/images/harry-potter-4.jpg'),
    ('Гарри Поттер и Орден Феникса', 'Министерство магии не верит, что Волан-де-Морт вернулся.', 138, '12+', 'Фэнтези', '/images/harry-potter-5.jpg'),
    ('Гарри Поттер и Принц-полукровка', 'Дамблдор раскрывает Гарри прошлое Тёмного Лорда.', 153, '12+', 'Фэнтези', '/images/harry-potter-6.jpg'),
    ('Гарри Поттер и Дары Смерти: Часть I', 'Гарри, Рон и Гермиона ищут крестражи вдали от Хогвартса.', 146, '12+', 'Фэнтези', '/images/harry-potter-7.jpg'),
    ('Гарри Поттер и Дары Смерти: Часть II', 'Последняя битва за Хогвартс.', 130, '12+', 'Фэнтези', '/images/harry-potter-8.jpg'),

    -- другие фильмы
    ('Интерстеллар',   'Экспедиция ищет новый дом для человечества.',                     169, '12+', 'Фантастика', '/images/interstellar.png'),
    ('Начало',         'Команда проникает в чужие сны, чтобы внедрить идею.',             148, '12+', 'Фантастика', '/images/inception.jpg'),
    ('Достать ножи',   'Детектив расследует смерть писателя после семейного праздника.',  130, '16+', 'Детектив',   '/images/knives-out.png'),
    ('Грань будущего', 'Солдат снова и снова проживает один день сражения.',              113, '12+', 'Фантастика', '/images/edge-of-tomorrow.png'),

    -- мультфильмы
    ('Рататуй',     'Крысёнок Реми мечтает стать поваром в Париже.',                    111, '0+', 'Мультфильм', '/images/ratatouille.jpg'),
    ('Тайна Коко',  'Мигель попадает в мир предков и узнаёт историю своей семьи.',      105, '6+', 'Мультфильм', '/images/coco.jpg'),
    ('ВАЛЛ·И',      'Робот с опустевшей Земли отправляется в космос вслед за ЕВОЙ.',    98,  '0+', 'Мультфильм', '/images/wall-e.jpg'),
    ('Головоломка', 'Эмоции девочки Райли пытаются помочь ей привыкнуть к переезду.',   95,  '6+', 'Мультфильм', '/images/inside-out.webp'),
    ('Зверополис',  'Крольчиха Джуди становится первой зайкой-полицейским.',            108, '6+', 'Мультфильм', '/images/zootopia.jpg'),
    ('Вверх',       'Старик Карл улетает в путешествие на доме, привязанном к шарам.',  96,  '0+', 'Мультфильм', '/images/up.jpg'),
    ('Король Лев',  'Львёнок Симба должен занять своё место в круге жизни.',            88,  '0+', 'Мультфильм', '/images/lion-king.webp');


-- ---------- Сеансы на 7 дней, начиная с завтрашнего ----------
-- 'каждый' — все 7 дней;
-- 'нечётные' — 1, 3, 5, 7-й день от сегодня;
-- 'чётные' — 2, 4, 6-й день.
-- «Голодные игры» — не раньше 26 ноября 2026 года.
-- В день премьеры они заменяют «Остров проклятых» в 14:30.

INSERT INTO screenings (movie_id, hall_id, starts_at, end_at)
SELECT m.id,
       h.id,
       current_date + day_offset + p.start_time,
       current_date + day_offset + p.start_time
           + m.duration_minutes * interval '1 minute'
FROM generate_series(1, 7) AS day_offset
CROSS JOIN (VALUES
    -- Зал 1
    ('Зверополис',                     'Зал 1', time '10:00', 'каждый'),
    ('1+1',                            'Зал 1', time '12:15', 'каждый'),
    ('Остров проклятых',                'Зал 1', time '14:30', 'нечётные'),
    ('Голодные игры: Рассвет Жатвы',     'Зал 1', time '14:30', 'чётные'),
    ('Начало',                         'Зал 1', time '17:15', 'каждый'),
    ('Достать ножи',                    'Зал 1', time '20:00', 'нечётные'),
    ('Оно',                            'Зал 1', time '20:00', 'чётные'),

    -- Зал 2
    ('Рататуй',         'Зал 2', time '10:00', 'нечётные'),
    ('ВАЛЛ·И',          'Зал 2', time '10:00', 'чётные'),
    ('Головоломка',     'Зал 2', time '12:15', 'нечётные'),
    ('Вверх',           'Зал 2', time '12:15', 'чётные'),
    ('Тайна Коко',      'Зал 2', time '14:15', 'нечётные'),
    ('Король Лев',      'Зал 2', time '14:15', 'чётные'),
    ('Грань будущего',  'Зал 2', time '16:30', 'каждый'),
    ('Интерстеллар',    'Зал 2', time '19:00', 'каждый'),

    -- Панорамный зал
    ('Гарри Поттер и философский камень',
     'Панорамный зал', time '10:00', 'нечётные'),

    ('Гарри Поттер и Тайная комната',
     'Панорамный зал', time '13:00', 'нечётные'),

    ('Гарри Поттер и узник Азкабана',
     'Панорамный зал', time '16:00', 'нечётные'),

    ('Гарри Поттер и Кубок огня',
     'Панорамный зал', time '19:00', 'нечётные'),

    ('Гарри Поттер и Орден Феникса',
     'Панорамный зал', time '10:00', 'чётные'),

    ('Гарри Поттер и Принц-полукровка',
     'Панорамный зал', time '13:00', 'чётные'),

    ('Гарри Поттер и Дары Смерти: Часть I',
     'Панорамный зал', time '16:00', 'чётные'),

    ('Гарри Поттер и Дары Смерти: Часть II',
     'Панорамный зал', time '19:00', 'чётные')
) AS p(title, hall_name, start_time, days)
JOIN movies m ON m.title = p.title
JOIN halls h ON h.name = p.hall_name
WHERE
    (
        p.days = 'каждый'
        OR (p.days = 'нечётные' AND day_offset % 2 = 1)
        OR (p.days = 'чётные' AND day_offset % 2 = 0)
        OR (
            p.title = 'Голодные игры: Рассвет Жатвы'
            AND current_date + day_offset = DATE '2026-11-26'
        )
    )
    AND (
        p.title <> 'Голодные игры: Рассвет Жатвы'
        OR current_date + day_offset >= DATE '2026-11-26'
    )
    AND NOT (
        p.title = 'Остров проклятых'
        AND current_date + day_offset = DATE '2026-11-26'
    )
ORDER BY day_offset, p.start_time, h.id;


-- ---------- Брони ----------
-- Сеанс 1 — завтра в 10:00, «Зверополис» в Зале 1.

-- Бронь 1: Иван, 2 места (ряд 3, места 5 и 6) — активная
INSERT INTO bookings (user_id, screening_id) VALUES (2, 1);
INSERT INTO booking_seats (booking_id, seat_id)
SELECT 1, id FROM seats
WHERE hall_id = 1 AND row_number = 3 AND seat_number IN (5, 6);

-- Бронь 2: Иван, 2 места (ряд 1, места 1 и 2) — отменена,
-- поэтому эти места на схеме зала свободны.
INSERT INTO bookings (user_id, screening_id, status) VALUES (2, 1, 'cancelled');
INSERT INTO booking_seats (booking_id, seat_id)
SELECT 2, id FROM seats
WHERE hall_id = 1 AND row_number = 1 AND seat_number IN (1, 2);

-- Бронь 3: Мария, групповая (школьная экскурсия) — ряды 5 и 6 целиком (28 мест)
-- на первый показ «Философского камня» в панорамном зале.
INSERT INTO bookings (user_id, screening_id)
SELECT 3, s.id
FROM screenings s
JOIN movies m ON m.id = s.movie_id
WHERE m.title = 'Гарри Поттер и философский камень'
ORDER BY s.starts_at
LIMIT 1;
INSERT INTO booking_seats (booking_id, seat_id)
SELECT 3, id FROM seats
WHERE hall_id = 3 AND row_number IN (5, 6);


-- ---------- Прошедшие сеансы ----------

INSERT INTO screenings (movie_id, hall_id, starts_at, end_at)
SELECT id,
       1,
       current_date - 3 + time '18:00',
       current_date - 3 + time '18:00'
           + duration_minutes * interval '1 minute'
FROM movies
WHERE title = 'Начало';

INSERT INTO screenings (movie_id, hall_id, starts_at, end_at)
SELECT id,
       1,
       current_date - 2 + time '18:00',
       current_date - 2 + time '18:00'
           + duration_minutes * interval '1 minute'
FROM movies
WHERE title = 'Рататуй';


-- ---------- Прошедшие брони Ивана ----------

-- Бронь 4: «Начало», ряд 3, места 5 и 6
INSERT INTO bookings (user_id, screening_id, status, created_at)
SELECT 2, s.id, 'completed', current_date - 4 + time '12:00'
FROM screenings s
JOIN movies m ON m.id = s.movie_id
WHERE m.title = 'Начало'
  AND s.hall_id = 1
  AND s.starts_at = current_date - 3 + time '18:00';

INSERT INTO booking_seats (booking_id, seat_id)
SELECT 4, id FROM seats
WHERE hall_id = 1
  AND row_number = 3
  AND seat_number IN (5, 6);


-- Бронь 5: «Рататуй», ряд 2, место 4
INSERT INTO bookings (user_id, screening_id, status, created_at)
SELECT 2, s.id, 'completed', current_date - 3 + time '12:00'
FROM screenings s
JOIN movies m ON m.id = s.movie_id
WHERE m.title = 'Рататуй'
  AND s.hall_id = 1
  AND s.starts_at = current_date - 2 + time '18:00';

INSERT INTO booking_seats (booking_id, seat_id)
SELECT 5, id FROM seats
WHERE hall_id = 1
  AND row_number = 2
  AND seat_number = 4;
