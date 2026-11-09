-- Registry: relational, small, rarely changes and needs referential integrity.
CREATE SCHEMA IF NOT EXISTS registry;

CREATE TABLE registry.customers (
  id      text PRIMARY KEY,
  name    text NOT NULL,
  segment text
);

CREATE TABLE registry.stores (
  id             text PRIMARY KEY,
  customer_id    text NOT NULL REFERENCES registry.customers (id),
  name           text NOT NULL,
  kind           text,
  city           text NOT NULL,
  state          char(2) NOT NULL,
  latitude       double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude      double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone       text NOT NULL,
  business_hours jsonb NOT NULL
);
CREATE INDEX stores_customer_idx ON registry.stores (customer_id);

CREATE TABLE registry.zones (
  id             text PRIMARY KEY,
  store_id       text NOT NULL REFERENCES registry.stores (id),
  name           text NOT NULL,
  comfort_min    numeric(4, 1) NOT NULL,
  comfort_max    numeric(4, 1) NOT NULL,
  business_hours jsonb NOT NULL,
  CHECK (comfort_min < comfort_max)
);
CREATE INDEX zones_store_idx ON registry.zones (store_id);

-- One device per zone; a device may exist without a zone (in stock, under maintenance).
CREATE TABLE registry.devices (
  id      text PRIMARY KEY,
  zone_id text UNIQUE REFERENCES registry.zones (id)
);

CREATE TABLE registry.users (
  id          text PRIMARY KEY,
  name        text NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL CHECK (role IN ('admin_diel', 'gestor_cliente', 'gerente_loja')),
  customer_id text REFERENCES registry.customers (id),
  CHECK ((role = 'admin_diel') = (customer_id IS NULL))
);
CREATE UNIQUE INDEX users_email_idx ON registry.users (lower(email));

CREATE TABLE registry.user_stores (
  user_id  text NOT NULL REFERENCES registry.users (id) ON DELETE CASCADE,
  store_id text NOT NULL REFERENCES registry.stores (id),
  PRIMARY KEY (user_id, store_id)
);
