-- =========================================================================
-- Migration 012: Digital Storefront — Theme columns on shops
-- Adds theme_preference & primary_color for auto-generated storefronts
-- =========================================================================

-- Theme preference: which layout component to render
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS theme_preference text NOT NULL DEFAULT 'modern'
CHECK (theme_preference IN ('modern', 'festive', 'industrial'));

-- Brand primary color (hex)
ALTER TABLE shops
ADD COLUMN IF NOT EXISTS primary_color text NOT NULL DEFAULT '#2563EB';
