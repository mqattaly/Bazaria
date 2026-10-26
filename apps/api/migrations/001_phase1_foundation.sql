-- Phase 1 foundation schema.
-- Contracts: docs/architecture/data-model.md (identity entities), security-and-permissions.md,
-- api-conventions.md. Every tenant-owned table carries company_id and is protected by RLS.
-- Runtime roles are created by `db:bootstrap`; migration and runtime roles are separate.

CREATE SCHEMA IF NOT EXISTS app;

-- ---------------------------------------------------------------------------
-- Helper functions. Settings are transaction-local (set_config(..., true)).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.current_company_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.company_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app.is_platform_admin() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.platform_admin', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION app.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app.reject_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % is immutable', TG_TABLE_NAME;
END;
$$;

-- ---------------------------------------------------------------------------
-- Identity (platform-level; not company scoped)
-- ---------------------------------------------------------------------------

CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mobile        text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  password_hash text,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_mobile_e164_ir CHECK (mobile ~ '^\+989[0-9]{9}$'),
  CONSTRAINT users_full_name_len CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 120),
  CONSTRAINT users_status_valid CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX users_mobile_idx ON users (mobile);

CREATE TRIGGER users_touch_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- Server-side sessions. Only the SHA-256 fingerprint of the opaque token is stored.
CREATE TABLE sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  last_used_at timestamptz,
  ip           text,
  user_agent   text,
  CONSTRAINT sessions_token_hash_len CHECK (char_length(token_hash) = 64)
);

CREATE INDEX sessions_user_active_idx ON sessions (user_id) WHERE revoked_at IS NULL;
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

-- Platform administrators are a separate identity. There is no foreign key to
-- users and no flag on users that could elevate a company account.
CREATE TABLE platform_admins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username      text NOT NULL UNIQUE,
  full_name     text NOT NULL,
  password_hash text NOT NULL,
  status        text NOT NULL DEFAULT 'active',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_admins_username_format CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,63}$'),
  CONSTRAINT platform_admins_status_valid CHECK (status IN ('active', 'inactive'))
);

CREATE TRIGGER platform_admins_touch_updated_at
BEFORE UPDATE ON platform_admins
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TABLE platform_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES platform_admins(id) ON DELETE CASCADE,
  token_hash  text NOT NULL UNIQUE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  revoked_at  timestamptz,
  last_used_at timestamptz,
  ip          text,
  user_agent  text,
  CONSTRAINT platform_sessions_token_hash_len CHECK (char_length(token_hash) = 64)
);

CREATE INDEX platform_sessions_admin_active_idx
  ON platform_sessions (admin_id) WHERE revoked_at IS NULL;

-- One-time tokens issued by a manager or the provisioning CLI. The plain token
-- is shown once to the issuer; only its hash is stored.
CREATE TABLE password_reset_tokens (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  created_by_type text NOT NULL,
  created_by_id   uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_creator_valid CHECK (created_by_type IN ('user', 'platform_admin', 'system'))
);

CREATE INDEX password_reset_tokens_user_idx ON password_reset_tokens (user_id);

-- ---------------------------------------------------------------------------
-- Companies, entitlement and membership (tenant data)
-- ---------------------------------------------------------------------------

CREATE TABLE companies (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  code       text NOT NULL UNIQUE,
  status     text NOT NULL DEFAULT 'active',
  currency   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companies_name_len CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  CONSTRAINT companies_code_format CHECK (code ~ '^[A-Z0-9][A-Z0-9-]{1,31}$'),
  CONSTRAINT companies_status_valid CHECK (status IN ('active', 'suspended')),
  CONSTRAINT companies_currency_format CHECK (currency ~ '^[A-Z]{3}$')
);

CREATE TRIGGER companies_touch_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TABLE company_entitlements (
  company_id  uuid PRIMARY KEY REFERENCES companies(id) ON DELETE RESTRICT,
  status      text NOT NULL DEFAULT 'active',
  max_stores  integer NOT NULL,
  valid_until date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entitlements_status_valid CHECK (status IN ('active', 'suspended')),
  CONSTRAINT entitlements_max_stores_positive CHECK (max_stores >= 1)
);

CREATE TRIGGER company_entitlements_touch_updated_at
BEFORE UPDATE ON company_entitlements
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

CREATE TABLE company_memberships (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  role_code  text NOT NULL,
  status     text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT memberships_role_valid
    CHECK (role_code IN ('manager', 'sales_representative', 'warehouse_user')),
  CONSTRAINT memberships_status_valid CHECK (status IN ('active', 'inactive')),
  -- One membership row per user/company pair: "unique active membership" is
  -- guaranteed because reactivation reuses the same row.
  CONSTRAINT memberships_user_company_unique UNIQUE (user_id, company_id)
);

CREATE INDEX memberships_company_idx ON company_memberships (company_id, status);
CREATE INDEX memberships_user_idx ON company_memberships (user_id, status);

CREATE TRIGGER company_memberships_touch_updated_at
BEFORE UPDATE ON company_memberships
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Audit and security events
-- ---------------------------------------------------------------------------

CREATE TABLE audit_events (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  actor_type  text NOT NULL,
  actor_id    uuid,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   text,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_id  text,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_actor_type_valid CHECK (actor_type IN ('user', 'platform_admin', 'system'))
);

CREATE INDEX audit_events_company_created_idx ON audit_events (company_id, created_at DESC);

CREATE TRIGGER audit_events_immutable
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();

-- Login failures, lockouts and session events are platform-level: they can occur
-- before any company context exists and are never exposed through tenant routes.
CREATE TABLE security_events (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type        text NOT NULL,
  user_id           uuid,
  platform_admin_id uuid,
  identifier        text,
  ip                text,
  user_agent        text,
  request_id        text,
  details           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX security_events_identifier_idx
  ON security_events (event_type, identifier, created_at DESC);
CREATE INDEX security_events_ip_idx
  ON security_events (event_type, ip, created_at DESC);

CREATE TRIGGER security_events_immutable
BEFORE UPDATE OR DELETE ON security_events
FOR EACH ROW EXECUTE FUNCTION app.reject_mutation();

-- ---------------------------------------------------------------------------
-- Row level security. ENABLE + FORCE so even the table owner is subject to
-- policies. The API connects with bazaria_app, which is neither owner nor
-- superuser and does not have BYPASSRLS.
-- ---------------------------------------------------------------------------

ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
ALTER TABLE company_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE company_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;

CREATE POLICY companies_tenant_select ON companies
  FOR SELECT TO bazaria_app
  USING (
    app.is_platform_admin()
    OR id = app.current_company_id()
    -- Company selection needs the list of companies the signed-in user belongs
    -- to. The subquery is itself filtered by the membership RLS policy.
    OR EXISTS (
      SELECT 1 FROM company_memberships m
      WHERE m.company_id = companies.id
        AND m.user_id = app.current_user_id()
        AND m.status = 'active'
    )
  );

CREATE POLICY companies_platform_insert ON companies
  FOR INSERT TO bazaria_app
  WITH CHECK (app.is_platform_admin());

CREATE POLICY companies_tenant_update ON companies
  FOR UPDATE TO bazaria_app
  USING (app.is_platform_admin() OR id = app.current_company_id())
  WITH CHECK (app.is_platform_admin() OR id = app.current_company_id());

CREATE POLICY entitlements_tenant_select ON company_entitlements
  FOR SELECT TO bazaria_app
  USING (app.is_platform_admin() OR company_id = app.current_company_id());

CREATE POLICY entitlements_platform_insert ON company_entitlements
  FOR INSERT TO bazaria_app
  WITH CHECK (app.is_platform_admin());

CREATE POLICY entitlements_platform_update ON company_entitlements
  FOR UPDATE TO bazaria_app
  USING (app.is_platform_admin())
  WITH CHECK (app.is_platform_admin());

-- A user may always read their own memberships (needed for company selection).
-- Full company membership lists require an established company context.
CREATE POLICY memberships_select ON company_memberships
  FOR SELECT TO bazaria_app
  USING (
    user_id = app.current_user_id()
    OR (company_id = app.current_company_id() AND app.current_user_id() IS NOT NULL)
    OR app.is_platform_admin()
  );

CREATE POLICY memberships_insert ON company_memberships
  FOR INSERT TO bazaria_app
  WITH CHECK (company_id = app.current_company_id() OR app.is_platform_admin());

CREATE POLICY memberships_update ON company_memberships
  FOR UPDATE TO bazaria_app
  USING (company_id = app.current_company_id() OR app.is_platform_admin())
  WITH CHECK (company_id = app.current_company_id() OR app.is_platform_admin());

CREATE POLICY audit_events_tenant_select ON audit_events
  FOR SELECT TO bazaria_app
  USING (company_id = app.current_company_id());

CREATE POLICY audit_events_insert ON audit_events
  FOR INSERT TO bazaria_app
  WITH CHECK (app.is_platform_admin() OR company_id = app.current_company_id());

-- ---------------------------------------------------------------------------
-- Privileges for the runtime role. No DELETE anywhere; audit/security tables
-- are insert-only. DDL stays with the migration role.
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO bazaria_app;
GRANT USAGE ON SCHEMA app TO bazaria_app;

GRANT SELECT, INSERT, UPDATE ON users TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON sessions TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON platform_admins TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON platform_sessions TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON password_reset_tokens TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON companies TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON company_entitlements TO bazaria_app;
GRANT SELECT, INSERT, UPDATE ON company_memberships TO bazaria_app;
GRANT SELECT, INSERT ON audit_events TO bazaria_app;
GRANT SELECT, INSERT ON security_events TO bazaria_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO bazaria_app;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
