CREATE TABLE bazariya.inventory (
  product_id uuid NOT NULL,
  quantity bigint NOT NULL DEFAULT 0,
  minimum_quantity bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_product_id_unique PRIMARY KEY (product_id),
  CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES bazariya.products (id) ON DELETE CASCADE,
  CONSTRAINT inventory_quantity_nonnegative CHECK (quantity BETWEEN 0 AND 9007199254740991),
  CONSTRAINT inventory_minimum_nonnegative CHECK (minimum_quantity BETWEEN 0 AND 9007199254740991)
);

-- Products that predate Inventory start at zero stock. Products added later are
-- treated as virtual zero-stock records until their first inventory operation.
INSERT INTO bazariya.inventory (product_id)
SELECT id FROM bazariya.products;

CREATE TABLE bazariya.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  type varchar(16) NOT NULL,
  quantity bigint NOT NULL,
  before_quantity bigint NOT NULL,
  after_quantity bigint NOT NULL,
  note varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id)
    REFERENCES bazariya.products (id) ON DELETE RESTRICT,
  CONSTRAINT stock_movements_type_valid CHECK (type IN ('IN', 'OUT', 'ADJUSTMENT')),
  CONSTRAINT stock_movements_quantities_safe CHECK (
    quantity BETWEEN 0 AND 9007199254740991
    AND before_quantity BETWEEN 0 AND 9007199254740991
    AND after_quantity BETWEEN 0 AND 9007199254740991
  ),
  CONSTRAINT stock_movements_values_consistent CHECK (
    (type = 'IN' AND quantity > 0 AND after_quantity > before_quantity
      AND after_quantity - before_quantity = quantity)
    OR (type = 'OUT' AND quantity > 0 AND before_quantity > after_quantity
      AND before_quantity - after_quantity = quantity)
    OR (type = 'ADJUSTMENT' AND quantity = abs(after_quantity - before_quantity))
  ),
  CONSTRAINT stock_movements_note_trimmed CHECK (note IS NULL OR note = btrim(note)),
  CONSTRAINT stock_movements_note_length CHECK (note IS NULL OR char_length(note) <= 500)
);

CREATE INDEX inventory_quantity_idx
  ON bazariya.inventory (quantity, minimum_quantity, product_id);
CREATE INDEX stock_movements_product_created_idx
  ON bazariya.stock_movements (product_id, created_at DESC, id DESC);

CREATE FUNCTION bazariya.guard_stock_movement_immutable() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Stock movement history is immutable.'
    USING ERRCODE = '23514', CONSTRAINT = 'stock_movements_immutable';
END;
$$;

CREATE TRIGGER stock_movements_immutable_guard
BEFORE UPDATE OR DELETE ON bazariya.stock_movements
FOR EACH ROW EXECUTE FUNCTION bazariya.guard_stock_movement_immutable();
