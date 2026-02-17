-- 003: Terminal Fijo de Firma
-- Permite que una tablet/dispositivo fijo capture firmas
-- pending_terminal_at indica que la sesion espera firma en terminal

ALTER TABLE sessions ADD COLUMN pending_terminal_at timestamptz;

-- Indice sparse: solo sesiones pendientes de terminal
CREATE INDEX idx_sessions_pending_terminal ON sessions(tenant_id, pending_terminal_at)
  WHERE pending_terminal_at IS NOT NULL;
