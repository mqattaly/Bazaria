CREATE TABLE bazariya.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(120) NOT NULL,
  phone varchar(16),
  email varchar(254),
  address varchar(500),
  description varchar(1000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customers_name_trimmed CHECK (name = btrim(name)),
  CONSTRAINT customers_name_length CHECK (char_length(name) BETWEEN 2 AND 120),
  CONSTRAINT customers_phone_valid CHECK (phone IS NULL OR phone ~ '^0[0-9]{9,10}$')
);

CREATE INDEX customers_phone_idx ON bazariya.customers (phone) WHERE phone IS NOT NULL;
CREATE INDEX customers_is_active_idx ON bazariya.customers (is_active);
