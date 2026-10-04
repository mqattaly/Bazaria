CREATE SEQUENCE bazariya.order_number_seq AS bigint START WITH 1;

CREATE TABLE bazariya.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number varchar(24) NOT NULL UNIQUE,
  customer_id uuid REFERENCES bazariya.customers (id) ON DELETE SET NULL,
  status varchar(16) NOT NULL DEFAULT 'draft',
  note varchar(2000),
  subtotal bigint NOT NULL DEFAULT 0,
  discount bigint NOT NULL DEFAULT 0,
  total bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  CONSTRAINT orders_order_number_valid CHECK (order_number ~ '^BAZ-[0-9]{9,19}$'),
  CONSTRAINT orders_status_valid CHECK (status IN ('draft', 'confirmed', 'cancelled')),
  CONSTRAINT orders_amounts_safe CHECK (
    subtotal BETWEEN 0 AND 9007199254740991
    AND discount BETWEEN 0 AND 9007199254740991
    AND total BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT orders_amounts_consistent CHECK (discount <= subtotal AND total = subtotal - discount),
  CONSTRAINT orders_status_timestamps_consistent CHECK (
    (status = 'draft' AND confirmed_at IS NULL AND cancelled_at IS NULL)
    OR (status = 'confirmed' AND confirmed_at IS NOT NULL AND cancelled_at IS NULL)
    OR (status = 'cancelled' AND cancelled_at IS NOT NULL)
  ),
  CONSTRAINT orders_note_trimmed CHECK (note IS NULL OR note = btrim(note))
);

CREATE TABLE bazariya.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES bazariya.orders (id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES bazariya.products (id) ON DELETE RESTRICT,
  product_name varchar(120) NOT NULL,
  sku varchar(64) NOT NULL,
  unit varchar(16) NOT NULL,
  quantity integer NOT NULL,
  unit_price bigint NOT NULL,
  line_total bigint NOT NULL,
  CONSTRAINT order_items_product_unique UNIQUE (order_id, product_id),
  CONSTRAINT order_items_product_name_trimmed CHECK (product_name = btrim(product_name)),
  CONSTRAINT order_items_sku_trimmed CHECK (sku = btrim(sku)),
  CONSTRAINT order_items_unit_valid CHECK (unit IN ('piece', 'pack', 'carton', 'kilogram', 'gram', 'liter', 'meter')),
  CONSTRAINT order_items_quantity_valid CHECK (quantity BETWEEN 1 AND 2147483647),
  CONSTRAINT order_items_amounts_safe CHECK (
    unit_price BETWEEN 0 AND 9007199254740991
    AND line_total BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT order_items_line_total_consistent CHECK (line_total = quantity::bigint * unit_price)
);

CREATE INDEX orders_created_at_idx ON bazariya.orders (created_at DESC, id DESC);
CREATE INDEX orders_status_created_at_idx ON bazariya.orders (status, created_at DESC, id DESC);
CREATE INDEX orders_customer_created_at_idx ON bazariya.orders (customer_id, created_at DESC, id DESC);
CREATE INDEX order_items_order_id_idx ON bazariya.order_items (order_id, id);
CREATE INDEX order_items_product_id_idx ON bazariya.order_items (product_id);

CREATE FUNCTION bazariya.guard_order_update() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'cancelled' THEN
    IF OLD.customer_id IS NOT NULL
      AND NEW.customer_id IS NULL
      AND NEW.id IS NOT DISTINCT FROM OLD.id
      AND NEW.order_number IS NOT DISTINCT FROM OLD.order_number
      AND NEW.status IS NOT DISTINCT FROM OLD.status
      AND NEW.note IS NOT DISTINCT FROM OLD.note
      AND NEW.subtotal IS NOT DISTINCT FROM OLD.subtotal
      AND NEW.discount IS NOT DISTINCT FROM OLD.discount
      AND NEW.total IS NOT DISTINCT FROM OLD.total
      AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
      AND NEW.confirmed_at IS NOT DISTINCT FROM OLD.confirmed_at
      AND NEW.cancelled_at IS NOT DISTINCT FROM OLD.cancelled_at
    THEN
      NEW.updated_at := now();
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Cancelled orders are immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'orders_cancelled_immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
    AND NOT (
      (OLD.status = 'draft' AND NEW.status IN ('confirmed', 'cancelled'))
      OR (OLD.status = 'confirmed' AND NEW.status = 'cancelled')
    )
  THEN
    RAISE EXCEPTION 'Invalid order status transition.'
      USING ERRCODE = '23514', CONSTRAINT = 'orders_status_transition_valid';
  END IF;

  IF OLD.status = 'confirmed'
    AND (
      NEW.id IS DISTINCT FROM OLD.id
      OR NEW.order_number IS DISTINCT FROM OLD.order_number
      OR (NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NEW.customer_id IS NOT NULL)
      OR NEW.note IS DISTINCT FROM OLD.note
      OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.discount IS DISTINCT FROM OLD.discount
      OR NEW.total IS DISTINCT FROM OLD.total
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
      OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
    )
  THEN
    RAISE EXCEPTION 'Confirmed order contents are immutable.'
      USING ERRCODE = '23514', CONSTRAINT = 'orders_confirmed_immutable';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'confirmed' THEN
    NEW.confirmed_at := now();
    NEW.cancelled_at := NULL;
  END IF;
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    NEW.cancelled_at := now();
    IF OLD.status = 'draft' THEN
      NEW.confirmed_at := NULL;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_update_guard
BEFORE UPDATE ON bazariya.orders
FOR EACH ROW EXECUTE FUNCTION bazariya.guard_order_update();

CREATE FUNCTION bazariya.guard_order_delete() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft orders can be deleted.'
      USING ERRCODE = '23514', CONSTRAINT = 'orders_delete_draft_only';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER orders_delete_guard
BEFORE DELETE ON bazariya.orders
FOR EACH ROW EXECUTE FUNCTION bazariya.guard_order_delete();

CREATE FUNCTION bazariya.guard_order_item_mutation() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id uuid;
  target_status varchar(16);
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.order_id IS DISTINCT FROM OLD.order_id THEN
    RAISE EXCEPTION 'Order items cannot be transferred between orders.'
      USING ERRCODE = '23514', CONSTRAINT = 'order_items_draft_only';
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.order_id;
  ELSE
    target_order_id := NEW.order_id;
  END IF;

  SELECT status INTO target_status
  FROM bazariya.orders
  WHERE id = target_order_id
  FOR UPDATE;

  IF target_status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Order items can only be changed while the order is a draft.'
      USING ERRCODE = '23514', CONSTRAINT = 'order_items_draft_only';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER order_items_draft_guard
BEFORE INSERT OR UPDATE OR DELETE ON bazariya.order_items
FOR EACH ROW EXECUTE FUNCTION bazariya.guard_order_item_mutation();

CREATE FUNCTION bazariya.validate_order_item_totals() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id uuid;
  recorded_subtotal bigint;
  calculated_subtotal bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.id;
  ELSE
    target_order_id := NEW.id;
  END IF;

  SELECT subtotal INTO recorded_subtotal
  FROM bazariya.orders
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(sum(line_total), 0) INTO calculated_subtotal
  FROM bazariya.order_items
  WHERE order_id = target_order_id;

  IF calculated_subtotal IS DISTINCT FROM recorded_subtotal THEN
    RAISE EXCEPTION 'Order subtotal must equal the sum of its item totals.'
      USING ERRCODE = '23514', CONSTRAINT = 'orders_item_subtotal_consistent';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER orders_item_totals_check
AFTER INSERT OR UPDATE OR DELETE ON bazariya.orders
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bazariya.validate_order_item_totals();

CREATE FUNCTION bazariya.validate_changed_order_item_totals() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  target_order_id uuid;
  recorded_subtotal bigint;
  calculated_subtotal bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_order_id := OLD.order_id;
  ELSE
    target_order_id := NEW.order_id;
  END IF;

  SELECT subtotal INTO recorded_subtotal
  FROM bazariya.orders
  WHERE id = target_order_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(sum(line_total), 0) INTO calculated_subtotal
  FROM bazariya.order_items
  WHERE order_id = target_order_id;

  IF calculated_subtotal IS DISTINCT FROM recorded_subtotal THEN
    RAISE EXCEPTION 'Order subtotal must equal the sum of its item totals.'
      USING ERRCODE = '23514', CONSTRAINT = 'orders_item_subtotal_consistent';
  END IF;

  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER order_items_totals_check
AFTER INSERT OR UPDATE OR DELETE ON bazariya.order_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION bazariya.validate_changed_order_item_totals();
