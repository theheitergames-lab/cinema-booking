-- До этой миграции цены не хранились. Для существующих сеансов и билетов принимаем 350 ₽.
BEGIN;
ALTER TABLE screenings ADD COLUMN price INTEGER NOT NULL DEFAULT 350 CHECK (price >= 0);
ALTER TABLE bookings ADD COLUMN price_per_seat INTEGER CHECK (price_per_seat >= 0);
UPDATE bookings b SET price_per_seat = s.price FROM screenings s WHERE s.id = b.screening_id;
ALTER TABLE bookings ALTER COLUMN price_per_seat SET NOT NULL;

CREATE FUNCTION set_booking_price() RETURNS trigger AS $$
BEGIN
    SELECT price INTO NEW.price_per_seat FROM screenings WHERE id = NEW.screening_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_booking_price
BEFORE INSERT ON bookings
FOR EACH ROW EXECUTE FUNCTION set_booking_price();
COMMIT;
