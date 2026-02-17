-- Migration 004: Rename hash fields from SHA-256 to MD5
-- This migration renames the hash columns to reflect the MD5 algorithm

-- Rename column in documents table
ALTER TABLE documents RENAME COLUMN hash_sha256 TO hash_md5;

-- Rename column in sessions table
ALTER TABLE sessions RENAME COLUMN pdf_original_hash TO pdf_original_hash_md5;

-- Add comments for documentation
COMMENT ON COLUMN documents.hash_md5 IS 'MD5 hash of the file content (32 hex characters)';
COMMENT ON COLUMN sessions.pdf_original_hash_md5 IS 'MD5 hash of the original PDF for integrity verification';
