-- =========================================================================
-- Migration 015: Add UPI ID to shops for dynamic QR payment
-- =========================================================================

ALTER TABLE shops
ADD COLUMN IF NOT EXISTS upi_id text;
