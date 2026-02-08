-- ============================================================================
-- BAO Flow Seed Data
-- Test data for development and demonstration
-- Created: 2026-02-08
-- ============================================================================

-- ============================================================================
-- 1. CLIENTS (5 records)
-- ============================================================================

INSERT INTO clients (
  company_name,
  brand_name,
  industry,
  address,
  default_sample_cost_rate,
  notes
) VALUES
  ('ROAST WORKS', 'ROAST WORKS', 'コーヒーロースター', '東京都渋谷区神宮前3-15-8', 0.6, 'スペシャルティコーヒーの自家焙煎店。デザインにこだわりあり'),
  ('Patisserie MORI', 'MORI', '洋菓子店', '東京都世田谷区成城6-12-3', 0.5, '高級洋菓子店。ギフトボックスの需要が高い'),
  ('gelato BENE', 'BENE', 'ジェラート店', '神奈川県鎌倉市小町2-8-15', 0.7, 'ナチュラル素材のジェラート専門店'),
  ('抹茶一期', '一期', '抹茶カフェ', '京都府京都市中京区河原町通四条上ル', 0.5, '京都の老舗抹茶カフェ。缶容器の発注が多い'),
  ('Burger CRAFT', 'CRAFT', 'バーガーショップ', '大阪府大阪市中央区心斎橋筋1-5-22', 1.0, 'クラフトバーガー専門店。包装資材の大量発注');

-- ============================================================================
-- 2. FACTORIES (4 records)
-- ============================================================================

INSERT INTO factories (
  factory_name,
  contact_name,
  address,
  specialties,
  rating,
  default_payment_terms,
  default_payment_method,
  quality,
  price_level,
  response_speed,
  notes
) VALUES
  ('深圳宝星包装有限公司', '李経理', '広東省深圳市宝安区福永街道',
   ARRAY['コーヒーバッグ', 'パウチ', '紙袋'], 4.5,
   '50% advance, 50% balance', 'wise',
   '高品質', '中〜高', '早い（1-2日）',
   'コーヒー関連のパッケージに強い。英語対応可'),
  ('東莞創彩印刷包装', '王小姐', '広東省東莞市長安鎮',
   ARRAY['ギフトボックス', '化粧品箱', '紙袋'], 4.2,
   '30% advance, 70% balance', 'alibaba_cc',
   '高品質', '中', '普通（3-4日）',
   '箱類の加工が得意。UV印刷、箔押し対応'),
  ('広州金属罐業', '陳先生', '広東省広州市番禺区',
   ARRAY['抹茶缶', 'コーヒー缶', '金属容器'], 4.0,
   '50% advance, 50% balance', 'bank_transfer',
   '中〜高', '安い', '普通（3-5日）',
   '金属缶専門。MOQ高め'),
  ('義烏利達塑料製品', '張経理', '浙江省義烏市北苑街道',
   ARRAY['PETカップ', 'PP蓋', 'プラ容器'], 3.8,
   '30% advance, 70% balance', 'wise',
   '中', '安い', '早い（1-2日）',
   'プラスチック容器専門。大量発注向け');

-- ============================================================================
-- 3. DEALS (8 records)
-- ============================================================================

INSERT INTO deals (
  deal_code,
  deal_name,
  client_id,
  master_status,
  win_probability,
  delivery_type,
  ai_mode,
  last_activity_at
) VALUES
  -- PF-202602-001: ROAST WORKS - コーヒーバッグ 250g - M18（製造中）
  ('PF-202602-001', 'コーヒーバッグ 250g',
   (SELECT id FROM clients WHERE company_name = 'ROAST WORKS'),
   'M18', 'won', 'direct', 'assist', NOW() - INTERVAL '2 days'),

  -- PF-202602-002: Patisserie MORI - ギフトボックス A4 - M04（工場回答待ち）
  ('PF-202602-002', 'ギフトボックス A4',
   (SELECT id FROM clients WHERE company_name = 'Patisserie MORI'),
   'M04', 'high', 'direct', 'assist', NOW() - INTERVAL '1 day'),

  -- PF-202602-003: gelato BENE - アイスカップ 280ml - M25（納品完了）
  ('PF-202602-003', 'アイスカップ 280ml',
   (SELECT id FROM clients WHERE company_name = 'gelato BENE'),
   'M25', 'won', 'direct', 'assist', NOW() - INTERVAL '30 days'),

  -- PF-202602-004: 抹茶一期 - 抹茶缶 100g - M11（クライアント承認）
  ('PF-202602-004', '抹茶缶 100g',
   (SELECT id FROM clients WHERE company_name = '抹茶一期'),
   'M11', 'won', 'direct', 'assist', NOW() - INTERVAL '3 days'),

  -- PF-202602-005: Burger CRAFT - レジ袋 M - M15（工場へ前払い）
  ('PF-202602-005', 'レジ袋 M',
   (SELECT id FROM clients WHERE company_name = 'Burger CRAFT'),
   'M15', 'won', 'logistics_center', 'assist', NOW() - INTERVAL '5 days'),

  -- PF-202602-006: ROAST WORKS - コーヒー蓋 12oz - M22（発送済み）
  ('PF-202602-006', 'コーヒー蓋 12oz',
   (SELECT id FROM clients WHERE company_name = 'ROAST WORKS'),
   'M22', 'won', 'logistics_center', 'assist', NOW() - INTERVAL '7 days'),

  -- PF-202602-007: gelato BENE - 化粧箱 ケーキ用 - M17（製造開始）
  ('PF-202602-007', '化粧箱 ケーキ用',
   (SELECT id FROM clients WHERE company_name = 'gelato BENE'),
   'M17', 'won', 'direct', 'assist', NOW() - INTERVAL '4 days'),

  -- PF-202602-008: gelato BENE - スプーン 木製 - M01（見積もり依頼受付）
  ('PF-202602-008', 'スプーン 木製',
   (SELECT id FROM clients WHERE company_name = 'gelato BENE'),
   'M01', 'medium', 'direct', 'assist', NOW());

-- ============================================================================
-- 4. DEAL SPECIFICATIONS (8 records)
-- ============================================================================

INSERT INTO deal_specifications (
  deal_id,
  product_category,
  product_name,
  height_mm,
  width_mm,
  depth_mm,
  material_category,
  printing_method,
  print_colors,
  processing_list
) VALUES
  -- PF-202602-001: コーヒーバッグ 250g
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   'コーヒーバッグ', 'クラフト紙スタンドパウチ 250g',
   280, 180, 80,
   'クラフト紙+アルミ蒸着', 'グラビア印刷', '4色（CMYK）',
   ARRAY['バルブ付き', 'ジッパー', 'マットラミネート']),

  -- PF-202602-002: ギフトボックス A4
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   'ギフトボックス', 'A4サイズ ケーキ用化粧箱',
   60, 297, 210,
   'コートボール紙 350g', 'オフセット印刷', '5色（CMYK+特色ゴールド）',
   ARRAY['箔押し', 'エンボス', 'グロスPP']),

  -- PF-202602-003: アイスカップ 280ml
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-003'),
   'カップ', 'PETアイスカップ 280ml',
   95, NULL, NULL,
   'PET', 'フレキソ印刷', '2色（緑+白）',
   ARRAY['フタ付き']),

  -- PF-202602-004: 抹茶缶 100g
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   '金属缶', '抹茶保存缶 100g',
   120, 80, NULL,
   'ブリキ', 'オフセット印刷', '3色（特色抹茶緑+金+黒）',
   ARRAY['内蓋付き', 'マット仕上げ']),

  -- PF-202602-005: レジ袋 M
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   '袋', 'バイオマスレジ袋 Mサイズ',
   450, 300, NULL,
   'バイオマスプラスチック', 'フレキソ印刷', '1色（黒）',
   ARRAY['ロゴ印刷']),

  -- PF-202602-006: コーヒー蓋 12oz
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   '蓋', 'テイクアウト用リッド 12oz',
   NULL, 90, NULL,
   'PP', '無印刷', NULL,
   ARRAY['飲み口穴付き']),

  -- PF-202602-007: 化粧箱 ケーキ用
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-007'),
   'ギフトボックス', 'ホールケーキ用化粧箱 5号',
   100, 200, 200,
   'コートボール紙 400g', 'オフセット印刷', '4色（CMYK）',
   ARRAY['窓付き', 'マットPP', 'リボン穴']),

  -- PF-202602-008: スプーン 木製
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-008'),
   'カトラリー', '木製アイススプーン',
   100, 25, 2,
   '白樺', '無印刷', NULL,
   ARRAY['個包装']);

-- ============================================================================
-- 5. DEAL FACTORY ASSIGNMENTS (10 records = 8 + 2 competitive quotes)
-- ============================================================================

-- Standard assignments (1 factory per deal)
INSERT INTO deal_factory_assignments (deal_id, factory_id, is_competitive_quote, status)
VALUES
  -- PF-202602-001: 深圳宝星 (selected)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   FALSE, 'selected'),

  -- PF-202602-002: 東莞創彩 (requesting - competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   (SELECT id FROM factories WHERE factory_name = '東莞創彩印刷包装'),
   TRUE, 'requesting'),

  -- PF-202602-002: 深圳宝星 (requesting - competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   TRUE, 'requesting'),

  -- PF-202602-003: 義烏利達 (selected)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-003'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   FALSE, 'selected'),

  -- PF-202602-004: 広州金属罐業 (selected)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   (SELECT id FROM factories WHERE factory_name = '広州金属罐業'),
   FALSE, 'selected'),

  -- PF-202602-005: 義烏利達 (selected)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   FALSE, 'selected'),

  -- PF-202602-006: 義烏利達 (selected)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   FALSE, 'selected'),

  -- PF-202602-007: 東莞創彩 (selected)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-007'),
   (SELECT id FROM factories WHERE factory_name = '東莞創彩印刷包装'),
   FALSE, 'selected'),

  -- PF-202602-008: 義烏利達 (requesting - competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-008'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   TRUE, 'requesting'),

  -- PF-202602-008: 深圳宝星 (requesting - competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-008'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   TRUE, 'requesting');

-- ============================================================================
-- 6. DEAL QUOTES (10 records)
-- ============================================================================

INSERT INTO deal_quotes (
  deal_id,
  factory_id,
  version,
  quantity,
  factory_unit_price_usd,
  plate_fee_usd,
  other_fees_usd,
  total_cost_usd,
  unit_cost_usd,
  cost_ratio,
  exchange_rate,
  selling_price_usd,
  selling_price_jpy,
  total_billing_jpy,
  moq,
  status,
  source_type
) VALUES
  -- PF-202602-001: コーヒーバッグ - approved
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   1, 5000, 0.35, 200, 0, 1950, 0.39, 0.55,
   155.0, 0.71, 110, 550000, 3000, 'approved', 'manual'),

  -- PF-202602-002: ギフトボックス - 東莞創彩 - presented
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   (SELECT id FROM factories WHERE factory_name = '東莞創彩印刷包装'),
   1, 1000, 1.20, 350, 50, 1600, 1.60, 0.50,
   155.0, 3.20, 496, 496000, 500, 'presented', 'manual'),

  -- PF-202602-002: ギフトボックス - 深圳宝星 - drafting (competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   1, 1000, 1.35, 400, 50, 1800, 1.80, 0.50,
   155.0, 3.60, 558, 558000, 500, 'drafting', 'manual'),

  -- PF-202602-003: アイスカップ - approved
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-003'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   1, 10000, 0.08, 150, 0, 950, 0.095, 0.45,
   155.0, 0.21, 33, 330000, 5000, 'approved', 'manual'),

  -- PF-202602-004: 抹茶缶 - approved
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   (SELECT id FROM factories WHERE factory_name = '広州金属罐業'),
   1, 2000, 0.85, 300, 0, 2000, 1.00, 0.50,
   155.0, 2.00, 310, 620000, 1000, 'approved', 'manual'),

  -- PF-202602-005: レジ袋 - approved
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   1, 50000, 0.02, 100, 0, 1100, 0.022, 0.40,
   155.0, 0.055, 8.5, 425000, 10000, 'approved', 'manual'),

  -- PF-202602-006: コーヒー蓋 - approved
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   1, 20000, 0.015, 80, 0, 380, 0.019, 0.45,
   155.0, 0.042, 6.5, 130000, 5000, 'approved', 'manual'),

  -- PF-202602-007: 化粧箱 - approved
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-007'),
   (SELECT id FROM factories WHERE factory_name = '東莞創彩印刷包装'),
   1, 2000, 0.95, 280, 30, 2210, 1.105, 0.50,
   155.0, 2.21, 343, 686000, 500, 'approved', 'manual'),

  -- PF-202602-008: スプーン - 義烏利達 - drafting (competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-008'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   1, 10000, 0.01, 50, 0, 150, 0.015, 0.45,
   155.0, 0.033, 5.1, 51000, 5000, 'drafting', 'manual'),

  -- PF-202602-008: スプーン - 深圳宝星 - drafting (competitive)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-008'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   1, 10000, 0.012, 60, 0, 180, 0.018, 0.45,
   155.0, 0.040, 6.2, 62000, 5000, 'drafting', 'manual');

-- ============================================================================
-- 7. DEAL SHIPPING OPTIONS (20 records - 2 per quote)
-- ============================================================================

-- For each quote, add sea and air options
INSERT INTO deal_shipping_options (deal_quote_id, shipping_method, incoterm, shipping_cost_usd, shipping_days, is_selected, notes)
SELECT
  dq.id,
  'sea'::shipping_method,
  'exw'::incoterm,
  CASE
    WHEN d.deal_code = 'PF-202602-001' THEN 180
    WHEN d.deal_code = 'PF-202602-002' THEN 250
    WHEN d.deal_code = 'PF-202602-003' THEN 320
    WHEN d.deal_code = 'PF-202602-004' THEN 200
    WHEN d.deal_code = 'PF-202602-005' THEN 450
    WHEN d.deal_code = 'PF-202602-006' THEN 280
    WHEN d.deal_code = 'PF-202602-007' THEN 220
    WHEN d.deal_code = 'PF-202602-008' THEN 120
    ELSE 200
  END::DECIMAL(12,2),
  25,
  CASE WHEN dq.status = 'approved' THEN TRUE ELSE FALSE END,
  '船便 - 通常配送'
FROM deal_quotes dq
JOIN deals d ON dq.deal_id = d.id;

INSERT INTO deal_shipping_options (deal_quote_id, shipping_method, incoterm, shipping_cost_usd, shipping_days, is_selected, notes)
SELECT
  dq.id,
  'air'::shipping_method,
  'ddp'::incoterm,
  CASE
    WHEN d.deal_code = 'PF-202602-001' THEN 450
    WHEN d.deal_code = 'PF-202602-002' THEN 580
    WHEN d.deal_code = 'PF-202602-003' THEN 720
    WHEN d.deal_code = 'PF-202602-004' THEN 480
    WHEN d.deal_code = 'PF-202602-005' THEN 950
    WHEN d.deal_code = 'PF-202602-006' THEN 620
    WHEN d.deal_code = 'PF-202602-007' THEN 520
    WHEN d.deal_code = 'PF-202602-008' THEN 280
    ELSE 500
  END::DECIMAL(12,2),
  7,
  FALSE,
  '航空便 - 急ぎの場合'
FROM deal_quotes dq
JOIN deals d ON dq.deal_id = d.id;

-- ============================================================================
-- 8. DEAL SAMPLES (3 records)
-- ============================================================================

INSERT INTO deal_samples (
  deal_id,
  round_number,
  sample_production_fee_usd,
  sample_shipping_fee_usd,
  plate_fee_usd,
  subtotal_usd,
  subtotal_jpy,
  sample_status,
  feedback_memo
) VALUES
  -- PF-202602-001: Round 1 - OK
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   1, 50, 45, 200, 295, 45725,
   'ok', 'デザイン・品質ともに問題なし。本生産へ進む'),

  -- PF-202602-001: Round 2 - OK (色調整後)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   2, 30, 45, 0, 75, 11625,
   'ok', '色調整後のサンプル確認OK'),

  -- PF-202602-004: Round 1 - arrived
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   1, 80, 60, 300, 440, 68200,
   'arrived', 'サンプル到着。クライアント確認待ち');

-- ============================================================================
-- 9. DEAL FACTORY PAYMENTS (5 records for 3 deals)
-- ============================================================================

INSERT INTO deal_factory_payments (
  deal_id,
  factory_id,
  payment_type,
  payment_method,
  amount_usd,
  amount_jpy,
  fee_amount,
  status,
  due_date,
  paid_at,
  trigger_condition
) VALUES
  -- PF-202602-001: advance paid
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   'advance', 'wise', 975, 151125, 8.50, 'paid',
   (CURRENT_DATE - INTERVAL '20 days')::DATE,
   NOW() - INTERVAL '18 days',
   'on_order'),

  -- PF-202602-005: advance paid
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   'advance', 'wise', 330, 51150, 5.50, 'paid',
   (CURRENT_DATE - INTERVAL '10 days')::DATE,
   NOW() - INTERVAL '8 days',
   'on_order'),

  -- PF-202602-006: advance paid
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   'advance', 'wise', 190, 29450, 4.50, 'paid',
   (CURRENT_DATE - INTERVAL '25 days')::DATE,
   NOW() - INTERVAL '23 days',
   'on_order'),

  -- PF-202602-006: balance paid
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   (SELECT id FROM factories WHERE factory_name = '義烏利達塑料製品'),
   'balance', 'wise', 190, 29450, 4.50, 'paid',
   (CURRENT_DATE - INTERVAL '12 days')::DATE,
   NOW() - INTERVAL '10 days',
   'on_production_complete'),

  -- PF-202602-001: balance unpaid (pending)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   (SELECT id FROM factories WHERE factory_name = '深圳宝星包装有限公司'),
   'balance', 'wise', 975, 151125, 8.50, 'unpaid',
   (CURRENT_DATE + INTERVAL '5 days')::DATE,
   NULL,
   'on_production_complete');

-- ============================================================================
-- 10. DEAL STATUS HISTORY (2-3 records per deal = ~20 records)
-- ============================================================================

INSERT INTO deal_status_history (deal_id, from_status, to_status, note, changed_at)
VALUES
  -- PF-202602-001: M01 -> M11 -> M18
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '45 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   'M01', 'M11', 'クライアント承認完了', NOW() - INTERVAL '30 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-001'),
   'M11', 'M18', '製造中（進捗60%）', NOW() - INTERVAL '10 days'),

  -- PF-202602-002: M01 -> M03 -> M04
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '5 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   'M01', 'M03', '工場へ見積もり依頼送信', NOW() - INTERVAL '3 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-002'),
   'M03', 'M04', '工場回答待ち', NOW() - INTERVAL '1 day'),

  -- PF-202602-003: M01 -> M18 -> M25
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-003'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '90 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-003'),
   'M01', 'M18', '製造中', NOW() - INTERVAL '60 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-003'),
   'M18', 'M25', '納品完了', NOW() - INTERVAL '30 days'),

  -- PF-202602-004: M01 -> M06 -> M11
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '20 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   'M01', 'M06', 'クライアントへ見積もり提示', NOW() - INTERVAL '12 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-004'),
   'M06', 'M11', 'クライアント承認', NOW() - INTERVAL '3 days'),

  -- PF-202602-005: M01 -> M11 -> M15
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '25 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   'M01', 'M11', 'クライアント承認', NOW() - INTERVAL '15 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-005'),
   'M11', 'M15', '工場へ前払い完了', NOW() - INTERVAL '5 days'),

  -- PF-202602-006: M01 -> M18 -> M22
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '40 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   'M01', 'M18', '製造中', NOW() - INTERVAL '20 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-006'),
   'M18', 'M22', '発送済み（トラッキング番号発行）', NOW() - INTERVAL '7 days'),

  -- PF-202602-007: M01 -> M11 -> M17
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-007'),
   NULL, 'M01', '見積もり依頼受付', NOW() - INTERVAL '18 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-007'),
   'M01', 'M11', 'クライアント承認', NOW() - INTERVAL '10 days'),
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-007'),
   'M11', 'M17', '製造開始', NOW() - INTERVAL '4 days'),

  -- PF-202602-008: M01 only (new)
  ((SELECT id FROM deals WHERE deal_code = 'PF-202602-008'),
   NULL, 'M01', '見積もり依頼受付', NOW());

-- ============================================================================
-- SEED DATA COMPLETE
-- ============================================================================
