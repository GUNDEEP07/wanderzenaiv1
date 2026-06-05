-- WanderZenAI Database Schema
-- Run this on your RDS Postgres instance after provisioning
-- psql -h <DB_HOST> -U wanderzen_admin -d wanderzenai -f schema.sql

-- ─── Users table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email               VARCHAR(255) UNIQUE NOT NULL,
  plan                VARCHAR(50) DEFAULT 'free' CHECK (plan IN ('free', 'paid_once', 'subscriber')),
  itineraries_remaining INTEGER DEFAULT 0,
  stripe_customer_id  VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);

-- ─── Submissions table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
  id                  VARCHAR(50) PRIMARY KEY,
  email               VARCHAR(255) NOT NULL,
  destination         VARCHAR(255) NOT NULL,
  days                INTEGER NOT NULL CHECK (days BETWEEN 1 AND 30),
  budget              DECIMAL(12, 2) NOT NULL,
  currency            VARCHAR(10) NOT NULL DEFAULT 'USD',
  traveler_type       VARCHAR(100) NOT NULL,
  travel_style        JSONB DEFAULT '[]',
  interests           TEXT,
  travel_date         DATE,
  travel_pace         VARCHAR(50) DEFAULT 'balanced',
  wants_hotel_recs    BOOLEAN DEFAULT true,
  plan                VARCHAR(50) DEFAULT 'free',
  status              VARCHAR(50) DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'itinerary_ready', 'pdf_ready', 'email_sent', 'failed')
  ),
  itinerary_id        VARCHAR(50),
  error_message       TEXT,
  email_sent_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_submissions_email ON submissions(email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);

-- ─── Itineraries table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS itineraries (
  id                    VARCHAR(50) PRIMARY KEY,
  submission_id         VARCHAR(50) REFERENCES submissions(id),
  email                 VARCHAR(255) NOT NULL,
  destination           VARCHAR(255) NOT NULL,
  itinerary_data        JSONB NOT NULL,
  total_cost            DECIMAL(12, 2),
  currency              VARCHAR(10) DEFAULT 'USD',
  pdf_s3_key            VARCHAR(500),
  pdf_generated_at      TIMESTAMPTZ,
  claude_input_tokens   INTEGER DEFAULT 0,
  claude_output_tokens  INTEGER DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_itineraries_email ON itineraries(email);
CREATE INDEX IF NOT EXISTS idx_itineraries_submission ON itineraries(submission_id);

-- ─── Email log table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS email_log (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id         VARCHAR(50) REFERENCES submissions(id),
  itinerary_id          VARCHAR(50) REFERENCES itineraries(id),
  email                 VARCHAR(255) NOT NULL,
  sent_at               TIMESTAMPTZ DEFAULT NOW(),
  signed_url_expires_at TIMESTAMPTZ
);

-- ─── Autocomplete cache table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS autocomplete_cache (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query                 VARCHAR(255) NOT NULL,
  suggestions           JSONB NOT NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(query)
);

CREATE INDEX IF NOT EXISTS idx_autocomplete_query ON autocomplete_cache(query);

-- ─── Foursquare categories table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS foursquare_categories (
  id                    VARCHAR(100) PRIMARY KEY,
  name                  VARCHAR(255) NOT NULL,
  label                 VARCHAR(500),
  parent_id             VARCHAR(100),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foursquare_categories_name ON foursquare_categories(name);
CREATE INDEX IF NOT EXISTS idx_foursquare_categories_parent ON foursquare_categories(parent_id);

-- ─── Analytics view (useful for monitoring costs) ─────────────────────────────
CREATE OR REPLACE VIEW daily_stats AS
SELECT
  DATE(created_at) AS date,
  COUNT(*) AS total_submissions,
  SUM(CASE WHEN plan = 'paid' THEN 1 ELSE 0 END) AS paid_submissions,
  SUM(CASE WHEN status = 'email_sent' THEN 1 ELSE 0 END) AS completed,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
  SUM(claude_input_tokens) AS total_input_tokens,
  SUM(claude_output_tokens) AS total_output_tokens
FROM submissions s
LEFT JOIN itineraries i ON i.submission_id = s.id
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- ─── Cost tracking view ───────────────────────────────────────────────────────
CREATE OR REPLACE VIEW monthly_costs AS
SELECT
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS itineraries_generated,
  SUM(claude_input_tokens) AS input_tokens,
  SUM(claude_output_tokens) AS output_tokens,
  -- Claude Sonnet pricing: $3/M input, $15/M output
  ROUND(SUM(claude_input_tokens) * 3.0 / 1000000, 4) AS claude_input_cost_usd,
  ROUND(SUM(claude_output_tokens) * 15.0 / 1000000, 4) AS claude_output_cost_usd,
  ROUND((SUM(claude_input_tokens) * 3.0 + SUM(claude_output_tokens) * 15.0) / 1000000, 4) AS total_claude_cost_usd
FROM itineraries
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;

-- ─── User profile columns (added for auth feature) ────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid        VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS name                VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender              VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS age                 INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp            VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS home_city           VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS language            VARCHAR(50) DEFAULT 'English';
ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

-- ─── Recommendation cache ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommendation_cache (
  email           VARCHAR(255) PRIMARY KEY,
  recommendations JSONB NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Submissions: missing columns added post-launch ───────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS language      VARCHAR(50)  DEFAULT 'English';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_age      INTEGER;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_location VARCHAR(255);
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS start_time    VARCHAR(10)  DEFAULT '09:00';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS user_must_dos TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS selected_venues JSONB      DEFAULT '{}';

-- ─── Destination insights cache ───────────────────────────────────────────────
-- travel_styles_key: sorted lowercased comma-joined styles, e.g. "nature,parks"
-- Unique per (destination, dates, style combination) so different interests get separate entries
CREATE TABLE IF NOT EXISTS destination_insights_cache (
  id                UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  destination       VARCHAR(255) NOT NULL,
  start_date        DATE         NOT NULL,
  end_date          DATE         NOT NULL,
  travel_styles_key VARCHAR(500) NOT NULL DEFAULT 'general',
  insights          JSONB        NOT NULL,
  expires_at        TIMESTAMPTZ  NOT NULL,
  created_at        TIMESTAMPTZ  DEFAULT NOW(),
  UNIQUE(destination, start_date, end_date, travel_styles_key)
);
CREATE INDEX IF NOT EXISTS idx_insights_cache_dest    ON destination_insights_cache(destination);
CREATE INDEX IF NOT EXISTS idx_insights_cache_expires ON destination_insights_cache(expires_at);

-- ─── RBAC: roles catalogue ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO roles (name, description) VALUES
  ('user',       'Standard customer — trip planning access'),
  ('admin',      'Internal team — full monitoring dashboard'),
  ('agency',     'B2B partner — white-label itinerary portal'),
  ('support',    'Support team — view submissions, no revenue/cost data'),
  ('superadmin', 'Owner — full access including role management')
ON CONFLICT (name) DO NOTHING;

-- ─── RBAC: user → role join ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_roles (
  id          SERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id     INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES users(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);

-- ─── Chat session tracking ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chat_sessions (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID REFERENCES users(id),
  firebase_uid   VARCHAR(255),
  messages_count INTEGER DEFAULT 0,
  led_to_plan    BOOLEAN DEFAULT FALSE,
  destination    VARCHAR(255),
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user    ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created ON chat_sessions(created_at DESC);

-- ─── User feedback ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feedback (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id VARCHAR(50) REFERENCES submissions(id),
  user_id       UUID REFERENCES users(id),
  email         VARCHAR(255),
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  destination   VARCHAR(255),
  source        VARCHAR(50) DEFAULT 'post_delivery',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_rating  ON feedback(rating);

-- ─── destination_insights_cache: add travel_styles_key if missing (table existed without it) ───
ALTER TABLE destination_insights_cache ADD COLUMN IF NOT EXISTS travel_styles_key VARCHAR(500) NOT NULL DEFAULT 'general';
CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_unique ON destination_insights_cache(destination, start_date, end_date, travel_styles_key);
