const XLSX = require('xlsx')
const fs = require('fs')

const wb = XLSX.readFile('/Users/bingbai/Downloads/営業CRM.xlsx')
const ws = wb.Sheets['顧客マスター']
const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const BING = '2ffbfab9-5763-4a7b-b41d-9ad97c182bd3'
const MAKIKO_EMAIL = 'makiko.ogata@foodandcompany.co.jp'
const esc = (v) => v == null || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'"

let sql = '-- Update assigned_sales_ids to include both staff where applicable\n'
sql += "WITH makiko AS (SELECT id FROM profiles WHERE email = '" + MAKIKO_EMAIL + "' LIMIT 1)\n"
sql += 'SELECT 1;  -- noop, just for context\n\n'
sql += 'BEGIN;\n\n'

const dataRows = arr.slice(1).filter((r) => r[0])
for (const row of dataRows) {
  const company = row[0]
  const salesField = String(row[8] || '').trim() // 営業担当
  if (!salesField) continue

  const names = salesField.split(',').map((s) => s.trim()).filter(Boolean)
  const parts = []
  for (const n of names) {
    if (n === '氷 白' || n === '氷白') {
      parts.push(`'${BING}'::uuid`)
    } else if (n.startsWith('Makiko')) {
      parts.push(`(SELECT id FROM profiles WHERE email = '${MAKIKO_EMAIL}' LIMIT 1)`)
    }
  }
  if (parts.length === 0) continue
  sql += `UPDATE clients SET assigned_sales_ids = ARRAY[${parts.join(',')}] WHERE company_name = ${esc(company)};\n`
}
sql += '\nCOMMIT;\n'
fs.writeFileSync('/tmp/update-sales-ids.sql', sql)
console.log('Wrote /tmp/update-sales-ids.sql')
