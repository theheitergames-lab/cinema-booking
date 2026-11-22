ALTER TABLE bookings
    ADD COLUMN ticket_code UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;