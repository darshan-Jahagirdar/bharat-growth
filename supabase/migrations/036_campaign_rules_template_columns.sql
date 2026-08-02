-- =========================================================================
-- Migration 036: campaign_rules template columns
--
-- Campaign sends must use Meta-approved templates with short variables, not
-- free text stuffed into a single template variable (Meta policy). This adds:
--   * name             - display name for the campaigns UI
--   * template_key     - which approved template to send (PROMO/RESTOCK/NEW_ARRIVAL)
--   * custom_variable  - the short {{3}} variable (<= 60 chars, Meta limit)
-- and deprecates free-text message_template (kept nullable for history).
-- Also adds the updated_at trigger that migration 017 forgot.
-- =========================================================================

-- ── name ──
ALTER TABLE campaign_rules ADD COLUMN IF NOT EXISTS name text;

UPDATE campaign_rules cr
SET name = t.name || ' · ' || cr.trigger_days || '-day reminder'
FROM tags t
WHERE t.id = cr.tag_id
  AND cr.name IS NULL;

ALTER TABLE campaign_rules ALTER COLUMN name SET NOT NULL;

-- ── template_key ──
ALTER TABLE campaign_rules ADD COLUMN IF NOT EXISTS template_key text NOT NULL DEFAULT 'PROMO';

ALTER TABLE campaign_rules ADD CONSTRAINT campaign_rules_template_key_check
  CHECK (template_key IN ('PROMO', 'RESTOCK', 'NEW_ARRIVAL'));

-- ── custom_variable (Meta template variable, keep short) ──
ALTER TABLE campaign_rules ADD COLUMN IF NOT EXISTS custom_variable text NOT NULL DEFAULT '';

ALTER TABLE campaign_rules ADD CONSTRAINT campaign_rules_custom_variable_check
  CHECK (char_length(custom_variable) <= 60);

UPDATE campaign_rules
SET custom_variable = left(message_template, 60)
WHERE custom_variable = ''
  AND message_template IS NOT NULL
  AND message_template <> '';

-- ── message_template deprecated: no longer required ──
ALTER TABLE campaign_rules ALTER COLUMN message_template DROP NOT NULL;

-- ── updated_at trigger (missing since 017) ──
DROP TRIGGER IF EXISTS set_campaign_rules_updated_at ON campaign_rules;
CREATE TRIGGER set_campaign_rules_updated_at
  BEFORE UPDATE ON campaign_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
