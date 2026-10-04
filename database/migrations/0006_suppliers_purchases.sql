CREATE SEQUENCE bazariya.purchase_number_seq AS bigint START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE NO CYCLE;

CREATE TABLE bazariya.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  phone varchar(32),
  email varchar(254),
  address varchar(500),
  note varchar(1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_trimmed CHECK (name = btrim(name) AND char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT suppliers_phone_trimmed CHECK (phone IS NULL OR (phone = btrim(phone) AND char_length(phone) <= 32)),
  CONSTRAINT suppliers_email_normalized CHECK (
    email IS NULL OR (email = btrim(email) AND email = lower(email) AND char_length(email) <= 254)
  ),
  CONSTRAINT suppliers_address_trimmed CHECK (address IS NULL OR (address = btrim(address) AND char_length(address) <= 500)),
  CONSTRAINT suppliers_note_trimmed CHECK (note IS NULL OR (note = btrim(note) AND char_length(note) <= 1000))
);

CREATE INDEX suppliers_name_idx ON bazariya.suppliers (lower(name), id);
CREATE INDEX suppliers_is_active_name_idx ON bazariya.suppliers (is_active, lower(name), id);
CREATE INDEX suppliers_phone_idx ON bazariya.suppliers (phone) WHERE phone IS NOT NULL;
CREATE INDEX suppliers_email_idx ON bazariya.suppliers (email) WHERE email IS NOT NULL;

CREATE TABLE bazariya.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_number varchar(24) NOT NULL UNIQUE,
  supplier_id uuid NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'draft',
  subtotal bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  total bigint NOT NULL DEFAULT 0,
  note varchar(2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT purchases_purchase_number_valid CHECK (purchase_number ~ '^PUR-[0-9]{6,19}$'),
  CONSTRAINT purchases_supplier_id_fkey FOREIGN KEY (supplier_id)
    REFERENCES bazariya.suppliers (id) ON DELETE RESTRICT,
  CONSTRAINT purchases_status_valid CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  CONSTRAINT purchases_amounts_safe CHECK (
    subtotal BETWEEN 0 AND 9007199254740991
    AND discount BETWEEN 0 AND 9007199254740991
    AND total BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT purchases_amounts_consistent CHECK (discount <= subtotal AND total = subtotal - discount),
  CONSTRAINT purchases_status_timestamps_consistent CHECK (
    (status = 'draft' AND confirmed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'confirmed' AND confirmed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND confirmed_at IS NULL AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT purchases_note_trimmed CHECK (note IS NULL OR (note = btrim(note) AND char_length(note) <= 2000))
);

CREATE TABLE bazariya.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  product_id uuid NOT NULL,
  product_name_snapshot varchar(120) NOT NULL,
  product_sku_snapshot varchar(64) NOT NULL,
  unit_snapshot varchar(16) NOT NULL,
  unit_price bigint NOT NULL,
  quantity bigint NOT NULL,
  line_total bigint NOT NULL,
  CONSTRAINT purchase_items_purchase_id_fkey FOREIGN KEY (purchase_id)
    REFERENCES bazariya.purchases (id) ON DELETE RESTRICT,
  CONSTRAINT purchase_items_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES bazariya.products (id) ON DELETE RESTRICT,
  CONSTRAINT purchase_items_product_unique UNIQUE (purchase_id, product_id),
  CONSTRAINT purchase_items_name_snapshot_trimmed CHECK (
    product_name_snapshot = btrim(product_name_snapshot) AND char_length(product_name_snapshot) BETWEEN 1 AND 120
  ),
  CONSTRAINT purchase_items_sku_snapshot_trimmed CHECK (
    product_sku_snapshot = btrim(product_sku_snapshot) AND char_length(product_sku_snapshot) BETWEEN 1 AND 64
  ),
  CONSTRAINT purchase_items_unit_snapshot_valid CHECK (
    unit_snapshot IN ('piece', 'pack', 'carton', 'kilogram', 'gram', 'liter', 'meter')
  ),
  CONSTRAINT purchase_items_quantity_valid CHECK (quantity BETWEEN 1 AND 9007199254740991),
  CONSTRAINT purchase_items_amounts_safe CHECK (
    unit_price BETWEEN 0 AND 9007199254740991
    AND line_total BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT purchase_items_line_total_consistent CHECK (line_total = quantity::numeric * unit_price::numeric)
);

CREATE INDEX purchases_created_at_idx ON bazariya.purchases (created_at DESC, id DESC);
CREATE INDEX purchases_status_created_at_idx ON bazariya.purchases (status, created_at DESC, id DESC);
CREATE INDEX purchases_supplier_created_at_idx ON bazariya.purchases (supplier_id, created_at DESC, id DESC);
CREATE INDEX purchase_items_purchase_id_idx ON bazariya.purchase_items (purchase_id, id);
CREATE INDEX purchase_items_product_id_idx ON bazariya.purchase_items (product_id);

CREATE FUNCTION bazariya.guard_purchase_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION 'Purchases must be created as drafts.'
        USING ERRCODE = '23514', CONSTRAINT = 'purchases_create_as_draft';
    END IF;
    NEW.confirmed_at := NULL;
    NEW.cancelled_at := NULL;
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Purchases cannot be hard-deleted.'
      USING ERRCODE = '23514', CONSTRAINT = 'purchases_delete_forbidden';
  END IF;

  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Confirmed and cancelled purchases are immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'purchases_immutable';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.purchase_number IS DISTINCT FROM OLD.purchase_number
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Purchase identity and creation time are immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'purchases_identity_immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (OLD.status = 'draft' AND NEW.status IN ('confirmed', 'cancelled')) THEN
      RAISE EXCEPTION 'Invalid purchase status transition.'
        USING ERRCODE = '23514', CONSTRAINT = 'purchases_status_transition_valid';
    END IF;
    IF NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
      OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.discount IS DISTINCT FROM OLD.discount
      OR NEW.total IS DISTINCT FROM OLD.total
      OR NEW.note IS DISTINCT FROM OLD.note
    THEN
      RAISE EXCEPTION 'Purchase contents cannot change during a status transition.'
        USING ERRCODE = '23514', CONSTRAINT = 'purchases_status_transition_immutable';
    END IF;
    IF NEW.status = 'confirmed' THEN
      NEW.confirmed_at := now();
      NEW.cancelled_at := NULL;
    ELSE
      NEW.confirmed_at := NULL;
      NEW.cancelled_at := now();
    END IF;
  ELSE
    NEW.confirmed_at := NULL;
    NEW.cancelled_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchases_mutation_guard
BEFORE INSERT OR UPDATE OR DELETE ON bazariya.purchases
FOR EACH ROW EXECUTE FUNCTION bazariya.guard_purchase_mutation();

CREATE FUNCTION bazariya.guard_purchase_item_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_purchase_id uuid;
  target_status varchar(16);
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.purchase_id IS DISTINCT FROM OLD.purchase_id THEN
    RAISE EXCEPTION 'Purchase items cannot be transferred between purchases.'
      USING ERRCODE = '23514', CONSTRAINT = 'purchase_items_draft_only';
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_purchase_id := OLD.purchase_id;
  ELSE
    target_purchase_id := NEW.purchase_id;
  END IF;

  SELECT status INTO target_status
  FROM bazariya.purchases
  WHERE id = target_purchase_id
  FOR UPDATE;

  IF target_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Purchase items can only be changed while the purchase is a draft.'
      USING ERRCODE = '23514', CONSTRAINT = 'purchase_items_draft_only';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_items_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON bazariya.purchase_items
FOR EACH ROW EXECUTE FUNCTION bazariya.guard_purchase_item_mutation();

CREATE FUNCTION bazariya.validate_purchase_item_totals() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_purchase_id uuid;
  recorded_subtotal bigint;
  calculated_subtotal numeric;
  item_count bigint;
BEGIN
  IF TG_TABLE_NAME = 'purchases' THEN
    IF TG_OP = 'DELETE' THEN
      target_purchase_id := OLD.id;
    ELSE
      target_purchase_id := NEW.id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    target_purchase_id := OLD.purchase_id;
  ELSE
    target_purchase_id := NEW.purchase_id;
  END IF;

  SELECT subtotal INTO recorded_subtotal
  FROM bazariya.purchases
  WHERE id = target_purchase_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(sum(line_total), 0), count(*)
    INTO calculated_subtotal, item_count
  FROM bazariya.purchase_items
  WHERE purchase_id = target_purchase_id;

  IF item_count = 0 OR calculated_subtotal IS DISTINCT FROM recorded_subtotal::numeric THEN
    RAISE EXCEPTION 'A purchase must have items whose line totals equal its subtotal.'
      USING ERRCODE = '23514', CONSTRAINT = 'purchases_item_subtotal_consistent';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER purchases_item_totals_check
AFTER INSERT OR UPDATE OR DELETE ON bazariya.purchases
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bazariya.validate_purchase_item_totals();

CREATE CONSTRAINT TRIGGER purchase_items_totals_check
AFTER INSERT OR UPDATE OR DELETE ON bazariya.purchase_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bazariya.validate_purchase_item_totals();
