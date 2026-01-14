-- EPIC-01-S07: Tabla reca_transactions
-- Ventas y compras de monotributo (separadas de FINBLIX)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reca_transaction_type') THEN
    CREATE TYPE reca_transaction_type AS ENUM ('SALE', 'PURCHASE');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.reca_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  transaction_type reca_transaction_type NOT NULL,
  period VARCHAR(6) NOT NULL, -- YYYYMM
  amount DECIMAL(15,2) NOT NULL, -- Puede ser negativo (NC)

  transaction_date DATE,
  description VARCHAR(500),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_reca_transactions_client ON public.reca_transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_reca_transactions_period ON public.reca_transactions(period);
CREATE INDEX IF NOT EXISTS idx_reca_transactions_type ON public.reca_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_reca_transactions_client_period ON public.reca_transactions(client_id, period);

-- RLS
ALTER TABLE public.reca_transactions ENABLE ROW LEVEL SECURITY;

-- Acceso a través del cliente
CREATE POLICY "reca_transactions_via_client" ON public.reca_transactions
  FOR ALL USING (
    client_id IN (
      SELECT c.id FROM public.clients c
      JOIN public.studio_members sm ON sm.studio_id = c.studio_id
      WHERE sm.user_id = auth.uid()
    )
  );

-- Comentario
COMMENT ON TABLE public.reca_transactions IS 'RECABLIX: Transacciones de ventas y compras por cliente y período YYYYMM';
