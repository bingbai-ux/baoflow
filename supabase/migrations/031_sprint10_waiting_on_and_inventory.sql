-- ============================================================
-- 031: waiting_on(ボール管理) + 在庫管理(社内MVP)
-- Sprint 10 — F&C リデザイン後の第一弾機能
--
-- 1) deals.waiting_on: 「いま誰の返答/作業を待っているか」。
--    やり取り回数最小化(要件1.3)の中心となる管理項目。
-- 2) inventory_items / inventory_transactions:
--    物流センター切替(現行サービス今月末終了)に伴い、
--    発注商品の入庫→在庫→出庫を BAO Flow 内で台帳管理する(要件3.19縮小版)。
--    数量は取引の符号つき増減(quantity_delta)の積み上げで、
--    現在庫はトリガーで inventory_items.quantity_on_hand に反映する。
-- ============================================================

-- 1. deals.waiting_on ------------------------------------------------
ALTER TABLE deals ADD COLUMN IF NOT EXISTS waiting_on TEXT NOT NULL DEFAULT 'us'
  CHECK (waiting_on IN ('us', 'client', 'factory', 'none'));

COMMENT ON COLUMN deals.waiting_on IS
  'ボールの所在: us=自分たちが動く番 / client=クライアント待ち / factory=工場待ち / none=待ちなし(完了・保留)';

CREATE INDEX IF NOT EXISTS idx_deals_waiting_on ON deals(waiting_on);

-- 2. 在庫アイテム ----------------------------------------------------
CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  product_id UUID REFERENCES deal_products(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  item_code TEXT,
  spec_note TEXT,
  unit TEXT NOT NULL DEFAULT '個',
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  cartons_on_hand INTEGER,
  warehouse_name TEXT,
  location_note TEXT,
  thumbnail_url TEXT,
  first_arrived_at DATE,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_client ON inventory_items(client_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_deal ON inventory_items(deal_id);

-- 3. 在庫取引(入庫/出庫/調整の台帳。取消は逆仕訳で表現し、行の更新・削除はしない)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('inbound', 'outbound', 'adjust')),
  quantity_delta INTEGER NOT NULL,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  destination TEXT,
  note TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_delta_sign CHECK (
    (tx_type = 'inbound' AND quantity_delta > 0) OR
    (tx_type = 'outbound' AND quantity_delta < 0) OR
    (tx_type = 'adjust')
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_tx_item ON inventory_transactions(item_id, occurred_on DESC);

-- 4. 現在庫をトリガーで維持 -----------------------------------------
CREATE OR REPLACE FUNCTION apply_inventory_delta()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inventory_items
     SET quantity_on_hand = quantity_on_hand + NEW.quantity_delta,
         updated_at = now()
   WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inventory_tx_apply ON inventory_transactions;
CREATE TRIGGER trg_inventory_tx_apply
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW EXECUTE FUNCTION apply_inventory_delta();

-- updated_at(migration 010 の update_updated_at_column を再利用)
DROP TRIGGER IF EXISTS trg_inventory_items_updated ON inventory_items;
CREATE TRIGGER trg_inventory_items_updated
  BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 5. RLS(社内ツール標準: authenticated 全権) -----------------------
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_full_access" ON inventory_items;
CREATE POLICY "authenticated_full_access" ON inventory_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_full_access" ON inventory_transactions;
CREATE POLICY "authenticated_full_access" ON inventory_transactions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
