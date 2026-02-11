-- ============================================================================
-- Migration: Add is_system_message column to chat_messages
-- ============================================================================

-- Add is_system_message column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'is_system_message'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN is_system_message BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Make sender_id nullable for system messages
ALTER TABLE chat_messages ALTER COLUMN sender_id DROP NOT NULL;

-- ============================================================================
-- Add product_category column to price_records for Smart Quote
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_records' AND column_name = 'product_category'
  ) THEN
    ALTER TABLE price_records ADD COLUMN product_category TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_records' AND column_name = 'shipping_usd'
  ) THEN
    ALTER TABLE price_records ADD COLUMN shipping_usd NUMERIC(12, 2) DEFAULT 0;
  END IF;
END $$;
