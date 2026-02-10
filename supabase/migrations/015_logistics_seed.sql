-- ============================================================================
-- Phase 2: 物流エージェント初期データ
-- ============================================================================

-- D2D（海上速達便）- 主要担当
INSERT INTO logistics_agents (name, name_en, agent_type, services, is_primary, notes)
VALUES (
  'D2D海上速達便',
  'D2D Express Sea',
  'all_in_one',
  ARRAY['海上D2D', '通関代行', '国内配送'],
  true,
  '海上輸送の一括委託先。月額固定費なし・完全従量制。'
) ON CONFLICT DO NOTHING;

-- 海源物流
INSERT INTO logistics_agents (name, name_en, agent_type, services, is_primary, notes)
VALUES (
  '海源物流',
  'Haiyuan Logistics',
  'forwarder',
  ARRAY['航空OCS', '海上混載', '通関代行'],
  false,
  '航空便・海上混載に対応。'
) ON CONFLICT DO NOTHING;

-- OCS
INSERT INTO logistics_agents (name, name_en, agent_type, services, is_primary, notes)
VALUES (
  'OCS',
  'OCS',
  'forwarder',
  ARRAY['航空宅配便', 'ドアツードア'],
  false,
  '航空宅配便。小口・サンプル向け。'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- カタログ商品の初期データ（サンプル）
-- ============================================================================

INSERT INTO catalog_items (
  category,
  product_type_ja,
  product_type_en,
  description_ja,
  available_sizes,
  material_display,
  moq_estimate,
  price_range,
  is_visible,
  is_featured,
  sort_order
) VALUES
(
  'コーヒーバッグ',
  'スタンドパック（バルブ付き）',
  'Stand Up Pouch with Valve',
  'コーヒー豆の保存に最適。ガス抜きバルブ付きで鮮度を保ちます。',
  ARRAY['100g', '200g', '250g', '500g', '1kg'],
  'クラフト紙 / アルミ内層',
  3000,
  '15〜30円/個',
  true,
  true,
  1
),
(
  'コーヒーバッグ',
  'ドリップバッグ外袋',
  'Drip Bag Outer Pouch',
  'ドリップバッグ用の外装袋。個包装または5〜10個入り用。',
  ARRAY['1個入り', '5個入り', '10個入り'],
  'クラフト紙 / アルミ内層',
  5000,
  '5〜15円/個',
  true,
  false,
  2
),
(
  'ギフトボックス',
  'スリーブ箱',
  'Sleeve Box',
  'スリーブ式のギフトボックス。中身をスライドして取り出すタイプ。',
  ARRAY['S', 'M', 'L'],
  'コート紙 / 板紙',
  1000,
  '100〜300円/個',
  true,
  true,
  3
),
(
  'カップ',
  '紙カップ（ホット用）',
  'Paper Cup (Hot)',
  'ホットドリンク用紙カップ。断熱二重構造もオプションで対応。',
  ARRAY['8oz (240ml)', '12oz (360ml)', '16oz (480ml)'],
  'PE コート紙',
  5000,
  '8〜20円/個',
  true,
  false,
  4
),
(
  'パウチ',
  'レトルトパウチ',
  'Retort Pouch',
  'レトルト食品用耐熱パウチ。高温殺菌対応。',
  ARRAY['100g', '200g', '500g'],
  'PET / アルミ / CPP',
  5000,
  '20〜50円/個',
  true,
  false,
  5
)
ON CONFLICT DO NOTHING;
