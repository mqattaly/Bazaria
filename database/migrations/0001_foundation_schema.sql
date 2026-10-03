-- Establish an application-owned schema without creating Phase 1 business tables.
CREATE SCHEMA IF NOT EXISTS bazariya;

COMMENT ON SCHEMA bazariya IS 'Application-owned schema for Bazariya data';
