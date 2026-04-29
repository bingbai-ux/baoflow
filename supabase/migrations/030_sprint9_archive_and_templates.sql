-- ============================================================================
-- BAO Flow v2.0 Sprint 9
-- 030_sprint9_archive_and_templates.sql
--
-- 目的:
--   1. deals に archive 関連フィールド (archived_at / archived_by /
--      archive_reason / archive_note / tags) を追加
--   2. system_settings に帳票定型文 4 種 (見積書 / 請求書 / 納品書 / RFQ)
--      を追加し、I'm donuts ベースのデフォルト値を投入
--
-- §0.5-6: アーカイブ後の編集ロック
--   - 編集可能: archive_note / tags / deal_communications
--   - ロック:   deal_name / 商品 / バリエーション / 見積 / 添付
--
-- 適用後:
--   - /deals は archived_at IS NULL のみ表示
--   - /archive (Sprint 9-3) は archived_at IS NOT NULL を表示
--   - 設定画面で 4 種の定型文を編集可能 (Sprint 9-5)
-- ============================================================================

-- 1. deals に archive 関連フィールド ----------------------------------------
ALTER TABLE deals
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS archive_reason TEXT,             -- 'completed' | 'cancelled' | 'lost' | 'other'
  ADD COLUMN IF NOT EXISTS archive_note TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}'::text[];

-- archived_at で /archive ページの一覧を高速取得
CREATE INDEX IF NOT EXISTS idx_deals_archived_at
  ON deals(archived_at DESC) WHERE archived_at IS NOT NULL;

-- tags の検索 (要対応 / リピート 等のフィルタ)
CREATE INDEX IF NOT EXISTS idx_deals_tags
  ON deals USING GIN(tags);

-- archive_reason のチェック制約 (ENUM 化はしない、テキストで保つ)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'deals_archive_reason_check'
  ) THEN
    ALTER TABLE deals
      ADD CONSTRAINT deals_archive_reason_check
      CHECK (
        archive_reason IS NULL OR
        archive_reason IN ('completed', 'cancelled', 'lost', 'other')
      );
  END IF;
END $$;

-- 2. system_settings に帳票定型文 4 種 ---------------------------------------
ALTER TABLE system_settings
  ADD COLUMN IF NOT EXISTS quote_default_text TEXT,
  ADD COLUMN IF NOT EXISTS invoice_default_text TEXT,
  ADD COLUMN IF NOT EXISTS delivery_note_default_text TEXT,
  ADD COLUMN IF NOT EXISTS rfq_default_text TEXT;

-- 既存行があればデフォルト値を投入 (空のままなら触らない)
UPDATE system_settings
SET
  quote_default_text = COALESCE(quote_default_text,
    '※リードタイムは、ご入金確認後、工場との最終入稿データ確認後からの日数となります。
※価格は情勢等の影響により変化がございます。
※合計金額は送料、関税費用、手数料を含んだ合計金額となります。'),
  invoice_default_text = COALESCE(invoice_default_text,
    '※お支払い期限は発行日より 30 日以内です。
※振込手数料はお客様負担にてお願いいたします。'),
  delivery_note_default_text = COALESCE(delivery_note_default_text,
    '※商品の数量・状態をご確認の上、不備がございましたら 7 日以内にご連絡ください。
※検品済みの商品となります。'),
  rfq_default_text = COALESCE(rfq_default_text,
    'Please provide your quotation including:
- Unit price (USD, FOB)
- MOQ (minimum order quantity)
- Production lead time (days)
- Carton dimensions and gross weight
- Payment terms

请提供以下内容的报价：
- 单价（美金，FOB）
- 起订量 (MOQ)
- 生产交期（天数）
- 外箱尺寸及毛重
- 付款条件')
WHERE id IS NOT NULL;

-- 3. コメント -----------------------------------------------------------------
COMMENT ON COLUMN deals.archived_at IS
  'Sprint 9 (§0.5-6): アーカイブ日時。NOT NULL の案件は /archive に表示され、編集ロック';
COMMENT ON COLUMN deals.archived_by IS
  'Sprint 9: アーカイブ操作したスタッフ';
COMMENT ON COLUMN deals.archive_reason IS
  'Sprint 9: completed / cancelled / lost / other';
COMMENT ON COLUMN deals.archive_note IS
  'Sprint 9 (§0.5-6): アーカイブ後も編集可能なメモ欄';
COMMENT ON COLUMN deals.tags IS
  'Sprint 9 (§0.5-6): タグ配列。例 ["大口","リピート","要注意"]。アーカイブ後も編集可';
COMMENT ON COLUMN system_settings.quote_default_text IS
  'Sprint 9: 見積書テンプレートに差し込む定型文';
COMMENT ON COLUMN system_settings.invoice_default_text IS
  'Sprint 9: 請求書テンプレートの定型文';
COMMENT ON COLUMN system_settings.delivery_note_default_text IS
  'Sprint 9: 納品書テンプレートの定型文';
COMMENT ON COLUMN system_settings.rfq_default_text IS
  'Sprint 9: RFQ (見積依頼) の定型文。バイリンガル EN+CN';
