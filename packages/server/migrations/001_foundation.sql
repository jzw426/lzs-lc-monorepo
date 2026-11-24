CREATE TABLE IF NOT EXISTS idempotency_records (
  idempotency_key text PRIMARY KEY,
  fingerprint character(64) NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_settlements (
  match_id text PRIMARY KEY,
  player_id text NOT NULL,
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw', 'invalid')),
  reason_code text NOT NULL,
  state_hash text NOT NULL,
  game_version text NOT NULL,
  content_version text NOT NULL,
  rules_version text NOT NULL,
  config_hash text NOT NULL,
  response jsonb NOT NULL,
  settled_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text
);

CREATE INDEX IF NOT EXISTS outbox_events_unpublished
  ON outbox_events (id)
  WHERE published_at IS NULL;
