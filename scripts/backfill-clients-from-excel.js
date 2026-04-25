const XLSX = require('xlsx')
const fs = require('fs')

const wb = XLSX.readFile('/Users/bingbai/Downloads/営業CRM.xlsx')
const ws = wb.Sheets['顧客マスター']
const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

const BING = '2ffbfab9-5763-4a7b-b41d-9ad97c182bd3' // 氷 白
// Makiko placeholder will be set after profile creation; UPDATE later
const MAKIKO_PLACEHOLDER_EMAIL = 'makiko.ogata@foodandcompany.co.jp'

const esc = (v) => v == null || v === '' ? 'NULL' : "'" + String(v).replace(/'/g, "''") + "'"

let sql = '-- Backfill registered_by + is_shared from Excel data\n'
sql += 'BEGIN;\n\n'

const dataRows = arr.slice(1).filter((r) => r[0])
for (const row of dataRows) {
  const company = row[0]
  const registrant = String(row[9] || '').trim()
  const sharedFlag = row[15] === '是'

  let regSql = 'NULL'
  if (registrant === '氷 白' || registrant === '氷白') {
    regSql = `'${BING}'::uuid`
  } else if (registrant === 'Makiko Ogata' || registrant.startsWith('Makiko')) {
    // Reference Makiko profile by email lookup (set later)
    regSql = `(SELECT id FROM profiles WHERE email = '${MAKIKO_PLACEHOLDER_EMAIL}' LIMIT 1)`
  }

  sql += `UPDATE clients SET registered_by = ${regSql}, is_shared = ${sharedFlag} WHERE company_name = ${esc(company)};\n`
}

sql += '\nCOMMIT;\n'
fs.writeFileSync('/tmp/backfill-clients.sql', sql)
console.log('Wrote /tmp/backfill-clients.sql', sql.split('\n').length, 'lines')
