-- Migration 005: Add terminal_token to tenant_users
-- This token allows physical terminals to connect to a specific employee session without manual login.

ALTER TABLE tenant_users ADD COLUMN terminal_token text unique default encode(gen_random_bytes(16), 'hex');

-- Update existing users to have a token if they don't have one (though default handles it)
UPDATE tenant_users SET terminal_token = encode(gen_random_bytes(16), 'hex') WHERE terminal_token IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN tenant_users.terminal_token IS 'Persistent token for pairing physical counter terminals 1:1 with employees';
