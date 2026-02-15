// ============================================================
// Entregas Firmadas - TypeScript types (mirror del schema SQL)
// ============================================================

// Enums
// ============================================================
export type SessionStatus =
  | 'CREATED'
  | 'SIGNED'
  | 'PDF_UPLOADED'
  | 'FINALIZED'
  | 'CLOSED'
  | 'EXPIRED';

export type UserRole = 'admin' | 'employee';

export type DocType = 'original' | 'final';

export type TokenType = 'qr' | 'email';

export type ActorType = 'employee' | 'client' | 'system';

// Row types (SELECT)
// ============================================================
export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logo_url: string | null;
  settings: Record<string, unknown>;
  max_sessions_month: number;
  max_storage_mb: number;
  retention_months: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  auth_user_id: string;
  role: UserRole;
  name: string;
  email: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientGlobal {
  id: string;
  full_name: string;
  email_norm: string | null;
  phone_norm: string | null;
  dni_hash: string | null;
  auth_user_id: string | null;
  created_at: string;
}

export interface TenantClient {
  id: string;
  tenant_id: string;
  client_global_id: string;
  internal_ref: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  tenant_id: string;
  tenant_user_id: string;
  tenant_client_id: string;
  doc_num: string | null;
  status: SessionStatus;
  signature_path: string | null;
  pdf_original_path: string | null;
  pdf_final_path: string | null;
  pdf_original_hash: string | null;
  finalizing_at: string | null;
  finalized_at: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  session_id: string;
  tenant_id: string;
  type: DocType;
  storage_path: string;
  file_size: number | null;
  mime_type: string;
  hash_sha256: string | null;
  created_at: string;
}

export interface AccessToken {
  id: string;
  session_id: string;
  tenant_id: string;
  token: string;
  type: TokenType;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

export interface AuditEvent {
  id: string;
  tenant_id: string | null;
  session_id: string | null;
  event_type: string;
  actor_type: ActorType;
  actor_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

// Insert types (campos obligatorios para INSERT)
// ============================================================
export type TenantInsert = Pick<Tenant, 'name' | 'slug'> & Partial<Omit<Tenant, 'id' | 'name' | 'slug' | 'created_at' | 'updated_at'>>;

export type TenantUserInsert = Pick<TenantUser, 'tenant_id' | 'auth_user_id' | 'name' | 'email'> & Partial<Pick<TenantUser, 'role' | 'active'>>;

export type ClientGlobalInsert = Pick<ClientGlobal, 'full_name'> & Partial<Omit<ClientGlobal, 'id' | 'full_name' | 'created_at'>>;

export type TenantClientInsert = Pick<TenantClient, 'tenant_id' | 'client_global_id'> & Partial<Pick<TenantClient, 'internal_ref'>>;

export type SessionInsert = Pick<Session, 'tenant_id' | 'tenant_user_id' | 'tenant_client_id'> & Partial<Pick<Session, 'doc_num' | 'expires_at'>>;

export type DocumentInsert = Pick<Document, 'session_id' | 'tenant_id' | 'type' | 'storage_path'> & Partial<Pick<Document, 'file_size' | 'mime_type' | 'hash_sha256'>>;

export type AccessTokenInsert = Pick<AccessToken, 'session_id' | 'tenant_id' | 'type' | 'expires_at'>;

export type AuditEventInsert = Pick<AuditEvent, 'event_type' | 'actor_type'> & Partial<Omit<AuditEvent, 'id' | 'event_type' | 'actor_type' | 'created_at'>>;
