-- ---------------------------------------------------------------------------
-- Phase 2: stores (tenant data) and safe status handling.
--
-- Stores are never hard-deleted through the API: Phase 1 business rules keep
-- history and defer physical deletion (BR-STORE-004). The runtime role gets no
-- DELETE privilege and RLS is enabled + forced, so a missing company context
-- yields zero rows rather than cross-tenant access.
-- ---------------------------------------------------------------------------

CREATE TABLE stores (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id         uuid NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
  name               text NOT NULL,
  contact_name       text,
  contact_mobile     text,
  address            text,
  note               text,
  status             text NOT NULL DEFAULT 'active',
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stores_name_len
    CHECK (char_length(btrim(name)) BETWEEN 2 AND 160),
  CONSTRAINT stores_contact_name_len
    CHECK (contact_name IS NULL OR char_length(btrim(contact_name)) BETWEEN 2 AND 120),
  CONSTRAINT stores_contact_mobile_format
    CHECK (contact_mobile IS NULL OR contact_mobile ~ '^[+]98[0-9]{10}$'),
  CONSTRAINT stores_address_len
    CHECK (address IS NULL OR char_length(btrim(address)) BETWEEN 1 AND 500),
  CONSTRAINT stores_note_len
    CHECK (note IS NULL OR char_length(note) <= 1000),
  CONSTRAINT stores_status_valid
    CHECK (status IN ('active', 'inactive'))
);

CREATE INDEX stores_company_created_idx
  ON stores (company_id, created_at DESC, id);
CREATE INDEX stores_company_status_created_idx
  ON stores (company_id, status, created_at DESC, id);
CREATE INDEX stores_company_name_idx
  ON stores (company_id, lower(name));

CREATE TRIGGER stores_touch_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores FORCE ROW LEVEL SECURITY;

CREATE POLICY stores_tenant_select ON stores
  FOR SELECT TO bazaria_app
  USING (company_id = app.current_company_id());

CREATE POLICY stores_tenant_insert ON stores
  FOR INSERT TO bazaria_app
  WITH CHECK (company_id = app.current_company_id());

CREATE POLICY stores_tenant_update ON stores
  FOR UPDATE TO bazaria_app
  USING (company_id = app.current_company_id())
  WITH CHECK (company_id = app.current_company_id());

-- No DELETE privilege: deactivation is the only supported removal path.
GRANT SELECT, INSERT, UPDATE ON stores TO bazaria_app;
