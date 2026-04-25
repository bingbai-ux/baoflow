// Parse the SHIBUichi BAKERY Excel and emit a transactional INSERT SQL.
// v2: spec_id linkage for quotes, deal_fees inserts, ★FINAL → quote_status='approved'
import { createRequire } from 'module'
import { writeFileSync } from 'fs'
const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const SALES_USER_ID = '2ffbfab9-5763-4a7b-b41d-9ad97c182bd3'
const EXCHANGE_RATE = 155
const COST_RATIO = 0.55
const TAX_RATE = 10
const DEAL_CODE = 'PF-EXCEL-001'

const wb = XLSX.readFile(
  '/Users/bingbai/Downloads/管理表たたき【工場⇄クライアント兼用オーダー_見積書】.xlsx'
)
const sheet = wb.Sheets[wb.SheetNames[0]]
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, blankrows: false })

const C = {
  CHECK: 0, HASH: 1, CODE: 2, FOOD_INSPECT: 5, DESC: 6,
  SIZE_LABEL: 8, WIDE: 9, HEIGHT: 10, DEPTH: 11,
  MATERIAL: 12, COLOR: 13, PANTONE: 14, PROCESSING: 15, OTHER: 16,
  PRINT_COLORS: 17, PRINT_METHOD: 18, MOQ: 19, ORDER_QTY: 20,
  COST_RATIO_PCT: 34, UNIT_PRICE_JPY: 35, TOTAL_NOTAX_JPY: 36, TOTAL_TAX_JPY: 37,
  PLATE_USD: 38, PLATE_JPY: 39,
  PANTONE_FEE_JPY: 41, SAMPLE_MAKE_JPY: 43, SAMPLE_SHIP_JPY: 45, FOOD_INSPECT_JPY: 47,
  LEAD_PRODUCTION: 48,
}

const dataRows = []
let currentSpec = null
for (let i = 9; i < rows.length; i++) {
  const r = rows[i]
  if (!r) continue
  const qty = r[C.ORDER_QTY]
  const unitPrice = r[C.UNIT_PRICE_JPY]
  if (typeof qty !== 'number' || typeof unitPrice !== 'number') continue

  if (r[C.DESC]) {
    currentSpec = {
      hash: r[C.HASH], code: r[C.CODE], description: r[C.DESC],
      foodInspect: r[C.FOOD_INSPECT],
    }
  }
  if (r[C.SIZE_LABEL] || r[C.WIDE] || r[C.HEIGHT] || r[C.DEPTH]) {
    currentSpec = {
      ...currentSpec,
      sizeLabel: r[C.SIZE_LABEL] || currentSpec?.sizeLabel || null,
      wide: typeof r[C.WIDE] === 'number' ? r[C.WIDE] : currentSpec?.wide || null,
      height: typeof r[C.HEIGHT] === 'number' ? r[C.HEIGHT] : currentSpec?.height || null,
      depth: typeof r[C.DEPTH] === 'number' ? r[C.DEPTH] : currentSpec?.depth || null,
      material: r[C.MATERIAL] || currentSpec?.material || null,
      color: r[C.COLOR] || currentSpec?.color || null,
      pantone: r[C.PANTONE] || currentSpec?.pantone || null,
      printColors: r[C.PRINT_COLORS] || currentSpec?.printColors || null,
      printMethod: r[C.PRINT_METHOD] || currentSpec?.printMethod || null,
      processing: r[C.PROCESSING] || currentSpec?.processing || null,
    }
  }

  // Capture per-row fees (often only on the first row of each spec block)
  const fees = {
    plate_jpy: typeof r[C.PLATE_JPY] === 'number' ? r[C.PLATE_JPY] : null,
    plate_note: typeof r[C.PLATE_JPY] === 'string' ? r[C.PLATE_JPY] : null,
    pantone_jpy: typeof r[C.PANTONE_FEE_JPY] === 'number' ? r[C.PANTONE_FEE_JPY] : null,
    pantone_note: typeof r[C.PANTONE_FEE_JPY] === 'string' ? r[C.PANTONE_FEE_JPY] : null,
    sample_make_jpy: typeof r[C.SAMPLE_MAKE_JPY] === 'number' ? r[C.SAMPLE_MAKE_JPY] : null,
    sample_make_note: typeof r[C.SAMPLE_MAKE_JPY] === 'string' ? r[C.SAMPLE_MAKE_JPY] : null,
    sample_ship_jpy: typeof r[C.SAMPLE_SHIP_JPY] === 'number' ? r[C.SAMPLE_SHIP_JPY] : null,
    sample_ship_note: typeof r[C.SAMPLE_SHIP_JPY] === 'string' ? r[C.SAMPLE_SHIP_JPY] : null,
    food_inspection_jpy: typeof r[C.FOOD_INSPECT_JPY] === 'number' ? r[C.FOOD_INSPECT_JPY] : null,
    food_inspection_note: typeof r[C.FOOD_INSPECT_JPY] === 'string' ? r[C.FOOD_INSPECT_JPY] : null,
  }

  dataRows.push({
    isFinal: r[C.CHECK] === '✔️' || r[C.CHECK] === '✔',
    spec: { ...currentSpec },
    quantity: qty,
    unitPriceJpy: unitPrice,
    totalNoTaxJpy: r[C.TOTAL_NOTAX_JPY],
    leadProduction: r[C.LEAD_PRODUCTION],
    fees,
  })
}

function specKey(s) {
  return [s.description, s.sizeLabel, s.wide, s.height, s.depth, s.material, s.printColors].join('|')
}

// Build spec list with stable keys for use in DO block
const specsArr = []
const specKeyToIndex = new Map()
for (const dr of dataRows) {
  const key = specKey(dr.spec)
  if (!specKeyToIndex.has(key)) {
    specKeyToIndex.set(key, specsArr.length)
    specsArr.push({ key, ...dr.spec, fees: dr.fees })
  } else {
    // Merge fees from the first row into the spec
    const existing = specsArr[specKeyToIndex.get(key)]
    for (const k of Object.keys(dr.fees)) {
      if (!existing.fees[k] && dr.fees[k]) existing.fees[k] = dr.fees[k]
    }
  }
}

console.log(`Parsed ${dataRows.length} quote rows, ${specsArr.length} unique specs`)

const q = (v) => v == null ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'"
const sizeMm = (v) => typeof v === 'number' ? String(v) : 'NULL'
const productCategoryFromDesc = (desc) => {
  if (!desc) return null
  if (/Plastic/i.test(desc)) return 'プラスチックバッグ'
  if (/Paper Bag/i.test(desc)) return '紙袋'
  if (/Pastry/i.test(desc)) return 'ペストリーバッグ'
  if (/Coffee Cup/i.test(desc) || /Hot Coffee/i.test(desc) || /Ice Coffee/i.test(desc)) return 'カップ'
  if (/lid/i.test(desc)) return '蓋'
  return 'その他'
}

let sql = ''
sql += `-- ===========================================\n`
sql += `-- SHIBUichi BAKERY Excel 取込 v2 (再実行)\n`
sql += `-- ===========================================\n\n`

// 既存 deal を削除 (CASCADE)
sql += `DELETE FROM deals WHERE deal_code = ${q(DEAL_CODE)};\n\n`

sql += `DO $$\nDECLARE\n  v_deal_id uuid;\n`
for (let i = 0; i < specsArr.length; i++) sql += `  v_spec_${i} uuid;\n`
sql += `BEGIN\n`

// 1. Deal
sql += `  INSERT INTO deals (deal_code, deal_name, client_name_text, desired_delivery_date, memo, sales_user_id, last_activity_at)\n`
sql += `  VALUES (${q(DEAL_CODE)}, ${q('新規パッケージ２店舗目オープン＆オフィス移転')}, ${q('SHIBUichi BAKERY')}, '2026-05-20',\n`
sql += `    ${q('Excel テスト取込: 全体要望: 翻訳 日英 / 共有: 工場⇄クライアント兼用')},\n`
sql += `    '${SALES_USER_ID}', now()) RETURNING id INTO v_deal_id;\n\n`

sql += `  INSERT INTO deal_status_history (deal_id, from_status, to_status, from_simple_status, to_simple_status, changed_by, note)\n`
sql += `  VALUES (v_deal_id, NULL, 'M01', NULL, 'quoting', '${SALES_USER_ID}', 'Excel取込');\n\n`

// 2. Specs (with capture of returning id)
for (let i = 0; i < specsArr.length; i++) {
  const s = specsArr[i]
  const productName = s.sizeLabel ? `${s.description} (${s.sizeLabel})` : s.description
  const memoParts = [
    s.code ? `code: ${s.code}` : null,
    s.foodInspect ? `食品検査: ${s.foodInspect}` : null,
    s.pantone ? `パントン: ${String(s.pantone).replace(/\n/g, ' / ')}` : null,
    s.processing ? `加工備考: ${s.processing}` : null,
  ].filter(Boolean).join(' | ')

  sql += `  INSERT INTO deal_specifications (deal_id, product_name, product_category, height_mm, width_mm, depth_mm, material_category, print_colors, printing_method, specification_memo)\n`
  sql += `  VALUES (v_deal_id, ${q(productName)}, ${q(productCategoryFromDesc(s.description))},\n`
  sql += `    ${sizeMm(s.height)}, ${sizeMm(s.wide)}, ${sizeMm(s.depth)},\n`
  sql += `    ${q(s.material)}, ${q(s.printColors)}, ${q(s.printMethod)}, ${q(memoParts)})\n`
  sql += `  RETURNING id INTO v_spec_${i};\n`

  // Insert fees for this spec
  const f = s.fees
  const feeRows = []
  if (f.plate_jpy) feeRows.push(`('plate', ${f.plate_jpy}, ${q(f.plate_note)})`)
  else if (f.plate_note) feeRows.push(`('plate', NULL, ${q(f.plate_note)})`)
  if (f.pantone_jpy) feeRows.push(`('pantone', ${f.pantone_jpy}, ${q(f.pantone_note)})`)
  else if (f.pantone_note && f.pantone_note !== '/') feeRows.push(`('pantone', NULL, ${q(f.pantone_note)})`)
  if (f.sample_make_jpy) feeRows.push(`('sample_make', ${f.sample_make_jpy}, ${q(f.sample_make_note)})`)
  else if (f.sample_make_note && f.sample_make_note !== '/') feeRows.push(`('sample_make', NULL, ${q(f.sample_make_note)})`)
  if (f.sample_ship_jpy) feeRows.push(`('sample_ship', ${f.sample_ship_jpy}, ${q(f.sample_ship_note)})`)
  else if (f.sample_ship_note && f.sample_ship_note !== '/') feeRows.push(`('sample_ship', NULL, ${q(f.sample_ship_note)})`)
  if (f.food_inspection_jpy) feeRows.push(`('food_inspection', ${f.food_inspection_jpy}, ${q(f.food_inspection_note)})`)
  else if (f.food_inspection_note && f.food_inspection_note !== '/') feeRows.push(`('food_inspection', NULL, ${q(f.food_inspection_note)})`)

  for (const fr of feeRows) {
    sql += `  INSERT INTO deal_fees (deal_id, spec_id, fee_type, amount_jpy, note, is_initial_only) VALUES (v_deal_id, v_spec_${i}, ${fr.replace(/^\(/, '').replace(/\)$/, '')}, true);\n`
  }
}
sql += `\n`

// 3. Quotes
let version = 0
for (const dr of dataRows) {
  version++
  const idx = specKeyToIndex.get(specKey(dr.spec))
  const sellingJpy = dr.unitPriceJpy
  const sellingUsd = sellingJpy / EXCHANGE_RATE
  const unitCostUsd = sellingUsd * COST_RATIO
  const factoryUsd = unitCostUsd
  const totalCostUsd = factoryUsd * dr.quantity
  const totalNoTax = sellingJpy * dr.quantity
  const totalTax = Math.ceil(totalNoTax * (1 + TAX_RATE / 100))
  const status = dr.isFinal ? 'approved' : 'drafting'
  const sourceNote = `excel:${dr.spec.description}${dr.spec.sizeLabel ? ' ' + dr.spec.sizeLabel : ''}${dr.isFinal ? ' ★FINAL' : ''}${dr.leadProduction ? ' ' + dr.leadProduction : ''}`

  sql += `  INSERT INTO deal_quotes (deal_id, spec_id, factory_id, version, quantity, factory_unit_price_usd, plate_fee_usd, other_fees_usd, total_cost_usd, unit_cost_usd, cost_ratio, exchange_rate, selling_price_usd, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status, source_type)\n`
  sql += `  VALUES (v_deal_id, v_spec_${idx}, NULL, ${version}, ${dr.quantity}, ${factoryUsd.toFixed(4)}, 0, 0, ${totalCostUsd.toFixed(4)}, ${unitCostUsd.toFixed(4)}, ${COST_RATIO}, ${EXCHANGE_RATE}, ${sellingUsd.toFixed(4)}, ${sellingJpy}, ${totalNoTax}, ${totalTax}, '${status}', ${q(sourceNote)});\n`
}

sql += `\nEND $$;\n`

const outPath = '/tmp/shibuichi-import-v2.sql'
writeFileSync(outPath, sql)
console.log(`Wrote ${sql.length} bytes to ${outPath}`)
console.log(`Will create: 1 deal, ${specsArr.length} specs (with fees), ${dataRows.length} quotes`)
const finalCount = dataRows.filter((d) => d.isFinal).length
console.log(`★FINAL count (will be quote_status='approved'): ${finalCount}`)
