-- ============================================================================
-- SHIBUichi BAKERY (PF-EXCEL-001) データ移行: spec → product + variant
-- 既存 15 specs → products (重複除去) + 15 variants
-- 既存 38 quotes の spec_id を維持しつつ variant_id を埋める
-- 既存 15 fees の spec_id を維持しつつ variant_id を埋める
-- ============================================================================

DO $$
DECLARE
  v_spec RECORD;
  v_product_id UUID;
  v_variant_id UUID;
  v_product_no INTEGER;
  v_product_desc TEXT;
  v_variant_label TEXT;
  v_food_grade TEXT;
  v_food_inspect TEXT;
  v_code TEXT;
  v_pantone TEXT;
  v_processing TEXT;
  v_color TEXT;
BEGIN
  -- 既に移行済みの場合はスキップ (deal_products に既に存在)
  IF EXISTS (
    SELECT 1 FROM deal_products dp
    JOIN deals d ON d.id = dp.deal_id
    WHERE d.deal_code = 'PF-EXCEL-001'
  ) THEN
    RAISE NOTICE 'SHIBUichi 移行は既に実施済み。スキップ';
    RETURN;
  END IF;

  FOR v_spec IN
    SELECT s.*, d.id AS d_id
    FROM deal_specifications s
    JOIN deals d ON d.id = s.deal_id
    WHERE d.deal_code = 'PF-EXCEL-001'
    ORDER BY s.created_at
  LOOP
    -- 商品名から product_desc と variant_label を分離
    -- 例: "Plastic Bag (small)" → desc="Plastic Bag", variant="small"
    v_product_desc := regexp_replace(v_spec.product_name, '\s*\([^)]*\)\s*$', '');
    IF v_product_desc = v_spec.product_name THEN
      -- 括弧なし → 商品全体
      v_variant_label := 'standard';
    ELSE
      v_variant_label := (regexp_match(v_spec.product_name, '\(([^)]+)\)\s*$'))[1];
    END IF;

    -- specification_memo から code/食品検査/パントン/加工を抽出 (best effort)
    v_code := COALESCE((regexp_match(v_spec.specification_memo, 'code:\s*([^|]+)'))[1], NULL);
    IF v_code IS NOT NULL THEN
      v_code := trim(v_code);
    END IF;
    v_food_inspect := COALESCE((regexp_match(v_spec.specification_memo, '食品検査:\s*([^|]+)'))[1], NULL);
    IF v_food_inspect IS NOT NULL THEN
      v_food_inspect := trim(v_food_inspect);
      -- '*'/'●'/'同' 以外は NULL
      IF v_food_inspect NOT IN ('*', '●', '同') THEN v_food_inspect := NULL; END IF;
    END IF;
    v_pantone := COALESCE((regexp_match(v_spec.specification_memo, 'パントン:\s*([^|]+)'))[1], NULL);
    IF v_pantone IS NOT NULL THEN v_pantone := trim(v_pantone); END IF;
    v_processing := COALESCE((regexp_match(v_spec.specification_memo, '加工備考:\s*([^|]+)'))[1], NULL);
    IF v_processing IS NOT NULL THEN v_processing := trim(v_processing); END IF;

    -- 商品が既に存在するか確認
    SELECT id INTO v_product_id
    FROM deal_products
    WHERE deal_id = v_spec.d_id AND description = v_product_desc;

    IF v_product_id IS NULL THEN
      SELECT COALESCE(MAX(product_no), 0) + 1 INTO v_product_no
      FROM deal_products WHERE deal_id = v_spec.d_id;
      INSERT INTO deal_products (
        deal_id, product_no, description,
        factory_staff_code, food_inspection_status, product_memo
      )
      VALUES (
        v_spec.d_id, v_product_no, v_product_desc,
        v_code, v_food_inspect, NULL
      )
      RETURNING id INTO v_product_id;
    END IF;

    -- variant 作成
    INSERT INTO deal_product_variants (
      product_id, variant_label,
      width_mm, height_mm, depth_mm,
      material, color_description, pantone_colors,
      processing, print_color_count, print_method
    )
    VALUES (
      v_product_id, v_variant_label,
      v_spec.width_mm, v_spec.height_mm, v_spec.depth_mm,
      v_spec.material_category, NULL, v_pantone,
      v_processing, v_spec.print_colors, v_spec.printing_method
    )
    RETURNING id INTO v_variant_id;

    -- 関連 quotes に variant_id を設定
    UPDATE deal_quotes
    SET variant_id = v_variant_id
    WHERE deal_id = v_spec.d_id
      AND spec_id = v_spec.id
      AND variant_id IS NULL;

    -- 関連 fees に variant_id を設定
    UPDATE deal_fees
    SET variant_id = v_variant_id
    WHERE deal_id = v_spec.d_id
      AND spec_id = v_spec.id
      AND variant_id IS NULL;
  END LOOP;

  -- ★ FINAL (status='approved') の quotes に対応する variant に is_selected=true
  UPDATE deal_product_variants v
  SET is_selected = TRUE
  WHERE EXISTS (
    SELECT 1 FROM deal_quotes q
    JOIN deals d ON d.id = q.deal_id
    WHERE q.variant_id = v.id
      AND q.status = 'approved'
      AND d.deal_code = 'PF-EXCEL-001'
  );

  -- 採用された variant を持つ products に is_selected=true
  UPDATE deal_products p
  SET is_selected = TRUE
  WHERE EXISTS (
    SELECT 1 FROM deal_product_variants v
    WHERE v.product_id = p.id AND v.is_selected = TRUE
  )
  AND deal_id = (SELECT id FROM deals WHERE deal_code = 'PF-EXCEL-001');

  RAISE NOTICE '移行完了';
END $$;
