-- Run this whole file in pgAdmin's Query Tool (or `psql globetrotter -f db/schema.sql`)
-- against the "globetrotter" database. Safe to re-run: uses IF NOT EXISTS everywhere.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gives us gen_random_uuid()

CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  name           TEXT NOT NULL,
  photo_url      TEXT,
  is_admin       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  country       TEXT NOT NULL,
  region        TEXT,
  cost_index    INTEGER NOT NULL DEFAULT 50,   -- 0-100 relative daily cost
  popularity    INTEGER NOT NULL DEFAULT 50,   -- 0-100
  image_url     TEXT,
  UNIQUE (name, country)
);

CREATE TABLE IF NOT EXISTS activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id        UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL, -- sightseeing | food | adventure | culture | nightlife
  default_cost   NUMERIC(10,2) NOT NULL DEFAULT 0,
  duration_min   INTEGER NOT NULL DEFAULT 60,
  image_url      TEXT
);
CREATE INDEX IF NOT EXISTS idx_activities_city ON activities(city_id);

CREATE TABLE IF NOT EXISTS trips (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  description    TEXT,
  cover_photo    TEXT,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  is_public      BOOLEAN NOT NULL DEFAULT FALSE,
  share_slug     TEXT UNIQUE,
  budget_amount  NUMERIC(10,2),   -- optional budget goal the traveler sets for the whole trip
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (budget_amount IS NULL OR budget_amount >= 0)
);
CREATE INDEX IF NOT EXISTS idx_trips_owner ON trips(owner_id);

-- Older databases created before budget_amount existed: add it on re-run.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS budget_amount NUMERIC(10,2);

DO $$ BEGIN
  ALTER TABLE trips ADD CONSTRAINT trips_budget_amount_nonneg CHECK (budget_amount IS NULL OR budget_amount >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS stops (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id        UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  city_id        UUID NOT NULL REFERENCES cities(id),
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  order_index    INTEGER NOT NULL DEFAULT 0,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_stops_trip ON stops(trip_id);

CREATE TABLE IF NOT EXISTS trip_activities (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id        UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
  activity_id    UUID NOT NULL REFERENCES activities(id),
  date           DATE NOT NULL,
  start_time     TEXT NOT NULL,   -- "09:30"
  cost           NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT
);
CREATE INDEX IF NOT EXISTS idx_trip_activities_stop ON trip_activities(stop_id);

-- keep updated_at fresh on trips without an ORM doing it for us
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trips_set_updated_at ON trips;
CREATE TRIGGER trips_set_updated_at BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
