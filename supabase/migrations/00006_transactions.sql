-- EPIC-01-S07: Tabla transactions
-- Ventas y compras de cada cliente por período

-- Tipo de transacción
CREATE TYPE transaction_type AS ENUM ('SALE', 'PURCHASE');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,

  transaction_type transaction_type NOT NULL,
  period VARCHAR(6) NOT NULL, -- YYYYMM
  amount DECIMAL(15,2) NOT NULL, -- Puede ser negativo (nota de crédito)

  transaction_date DATE,
  description VARCHAR(500),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_transactions_client ON transactions(client_id);
CREATE INDEX idx_transactions_period ON transactions(period);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_client_period ON transactions(client_id, period);

-- RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Acceso a través del cliente
CREATE POLICY "transactions_via_client" ON transactions
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM clients c
      JOIN studios s ON c.studio_id = s.id
      WHERE s.auth_user_id = auth.uid()
    )
    OR is_superadmin_user()
  );

-- Comentario
COMMENT ON TABLE transactions IS 'Transacciones de ventas y compras por cliente y período';
