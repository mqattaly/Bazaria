CREATE TABLE bazariya.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  description varchar(1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_name_trimmed CHECK (name = btrim(name)),
  CONSTRAINT categories_name_length CHECK (char_length(name) BETWEEN 2 AND 80)
);

CREATE UNIQUE INDEX categories_name_unique ON bazariya.categories (lower(name));

CREATE TABLE bazariya.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  sku varchar(64) COLLATE "C" NOT NULL,
  category_id uuid NOT NULL,
  unit varchar(16) NOT NULL,
  description varchar(1000),
  sale_price bigint NOT NULL,
  purchase_price bigint,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_name_trimmed CHECK (name = btrim(name)),
  CONSTRAINT products_name_length CHECK (char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT products_sku_unique UNIQUE (sku),
  CONSTRAINT products_sku_trimmed CHECK (sku = btrim(sku)),
  CONSTRAINT products_sku_uppercase CHECK (sku = upper(sku)),
  CONSTRAINT products_sku_length CHECK (char_length(sku) BETWEEN 1 AND 64),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id)
    REFERENCES bazariya.categories (id) ON DELETE RESTRICT,
  CONSTRAINT products_unit_valid CHECK (unit IN ('piece', 'pack', 'carton', 'kilogram', 'gram', 'liter', 'meter')),
  CONSTRAINT products_sale_price_nonnegative CHECK (sale_price >= 0),
  CONSTRAINT products_purchase_price_nonnegative CHECK (purchase_price IS NULL OR purchase_price >= 0)
);

CREATE INDEX products_category_id_idx ON bazariya.products (category_id);
CREATE INDEX products_is_active_idx ON bazariya.products (is_active);
CREATE INDEX products_name_lower_pattern_idx ON bazariya.products (lower(name) text_pattern_ops);
