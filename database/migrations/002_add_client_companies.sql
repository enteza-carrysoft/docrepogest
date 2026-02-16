-- Migration: add_client_companies
-- Adds client_companies table, client_company_id FK on tenant_client,
-- and RLS fix for access_tokens (clients can view own tokens)

-- ============================================================
-- Table: client_companies
-- ============================================================
CREATE TABLE IF NOT EXISTS public.client_companies (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        text NOT NULL,
  cif_nif     text,
  address     text,
  contact_email text,
  phone       text,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_companies_tenant ON public.client_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_tenant_name ON public.client_companies(tenant_id, name);

CREATE TRIGGER set_updated_at_client_companies
  BEFORE UPDATE ON public.client_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;

-- RLS: tenant users CRUD
CREATE POLICY "tenant_users_select_companies" ON public.client_companies
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE auth_user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "tenant_users_insert_companies" ON public.client_companies
  FOR INSERT WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE auth_user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "tenant_users_update_companies" ON public.client_companies
  FOR UPDATE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE auth_user_id = auth.uid() AND active = true
    )
  );

CREATE POLICY "tenant_users_delete_companies" ON public.client_companies
  FOR DELETE USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users
      WHERE auth_user_id = auth.uid() AND active = true
    )
  );

-- ============================================================
-- ALTER tenant_client: add client_company_id
-- ============================================================
ALTER TABLE public.tenant_client
  ADD COLUMN IF NOT EXISTS client_company_id uuid REFERENCES public.client_companies(id);

CREATE INDEX IF NOT EXISTS idx_tenant_client_company ON public.tenant_client(client_company_id);

-- ============================================================
-- Fix: RLS on access_tokens so clients can see their own tokens
-- ============================================================
CREATE POLICY "clients_select_own_tokens" ON public.access_tokens
  FOR SELECT USING (
    session_id IN (
      SELECT s.id FROM public.sessions s
      JOIN public.tenant_client tc ON tc.id = s.tenant_client_id
      WHERE tc.client_global_id = public.get_client_global_id()
    )
  );
