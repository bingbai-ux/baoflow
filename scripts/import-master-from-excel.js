const XLSX = require('xlsx')
const fs = require('fs')

const wb = XLSX.readFile('/Users/bingbai/Downloads/営業CRM.xlsx')

// SQL escape
const esc = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL'
  return "'" + String(v).replace(/'/g, "''") + "'"
}
const escNum = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL'
  const n = Number(v)
  return Number.isFinite(n) ? String(n) : 'NULL'
}

// Excel serial → ISO date string
const excelDate = (n) => {
  if (!n || isNaN(Number(n))) return null
  const v = Number(n)
  // Excel epoch: 1899-12-30
  const d = new Date(Math.round((v - 25569) * 86400 * 1000))
  return d.toISOString()
}

const BING_PROFILE_ID = '2ffbfab9-5763-4a7b-b41d-9ad97c182bd3'

let sql = '-- ===========================================\n'
sql += '-- Import 営業CRM.xlsx → clients + factories\n'
sql += '-- Generated ' + new Date().toISOString() + '\n'
sql += '-- ===========================================\n\n'
sql += 'BEGIN;\n\n'

// =========== CLIENTS ===========
sql += '-- ---------- CLIENTS (12 rows from 顧客マスター) ----------\n'
const clientsWS = wb.Sheets['顧客マスター']
const clientsArr = XLSX.utils.sheet_to_json(clientsWS, { header: 1, defval: '' })
const clientsCols = clientsArr[0]
const dataRows = clientsArr.slice(1).filter((r) => r[0])

for (const row of dataRows) {
  const company = row[0]
  const brand = row[1]
  const contact = row[2]
  const role = row[3]
  const industry = row[4]
  const size = row[5]
  const phone = row[6]
  const address = row[7]
  const salesNames = row[8] // 営業担当 (e.g. "Makiko Ogata" or "氷 白,Makiko Ogata")
  const registrant = row[9] // 顧客登録者
  const createdSerial = row[10]
  const createdAt = excelDate(createdSerial)
  const sharedFlag = row[15] // 共有顧客フラグ ("是" → true)

  // Map sales names → profile UUIDs (only 氷 白 is mapped)
  const salesNameList = String(salesNames || '').split(',').map((s) => s.trim()).filter(Boolean)
  const salesIds = []
  for (const name of salesNameList) {
    if (name === '氷 白' || name === '氷白') {
      salesIds.push(BING_PROFILE_ID)
    }
    // Makiko Ogata not yet in profiles
  }
  const salesIdsArr = salesIds.length
    ? `ARRAY[${salesIds.map((id) => `'${id}'::uuid`).join(',')}]`
    : 'NULL'

  // Notes: preserve registrant + non-mapped sales + shared flag
  const noteParts = []
  if (registrant) noteParts.push('登録者: ' + registrant)
  if (salesNames) noteParts.push('営業担当(原文): ' + salesNames)
  if (sharedFlag === '是') noteParts.push('共有顧客')
  const notes = noteParts.length ? noteParts.join(' / ') : null

  sql += `INSERT INTO clients (
  company_name, brand_name, contact_name, contact_role, industry, company_size,
  phone, address, assigned_sales_ids, notes, created_at, updated_at
) VALUES (
  ${esc(company)}, ${esc(brand)}, ${esc(contact)}, ${esc(role)}, ${esc(industry)}, ${esc(size)},
  ${esc(phone)}, ${esc(address)}, ${salesIdsArr}, ${esc(notes)},
  ${createdAt ? `'${createdAt}'::timestamptz` : 'now()'}, now()
)
ON CONFLICT DO NOTHING;
`
}
sql += '\n'

// =========== FACTORIES ===========
sql += '-- ---------- FACTORIES (12 rows from 工場マスター) ----------\n'
const factoriesWS = wb.Sheets['工場マスター']
const factArr = XLSX.utils.sheet_to_json(factoriesWS, { header: 1, defval: '' })
const factDataRows = factArr.slice(1).filter((r) => r[1]) // require factory_name

for (const row of factDataRows) {
  const contact = row[0]
  const name = row[1]
  const rating = row[2]
  const specialties = row[3] // comma/punctuation separated
  const quality = row[4]
  const priceLevel = row[5]
  const responseSpeed = row[6]
  const politeness = row[7]
  const contactMethod = row[8]
  const address = row[9]
  const catalog = row[10]
  const bank = row[11]
  const memo = row[12]
  const createdSerial = row[13]
  const createdAt = excelDate(createdSerial)
  const updatedSerial = row[15]
  const updatedAt = excelDate(updatedSerial)

  // Convert specialties string → array
  const specArray = String(specialties || '')
    .split(/[、,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  const specSql = specArray.length
    ? `ARRAY[${specArray.map((s) => `'${s.replace(/'/g, "''")}'`).join(',')}]::text[]`
    : 'NULL'

  // Notes: append catalog references + memo
  const noteParts = []
  if (memo) noteParts.push(memo)
  if (catalog) noteParts.push('カタログ: ' + catalog)
  const notes = noteParts.length ? noteParts.join('\n---\n') : null

  // bank_info as jsonb
  const bankJson = bank
    ? `'${JSON.stringify({ raw: String(bank) }).replace(/'/g, "''")}'::jsonb`
    : 'NULL'

  sql += `INSERT INTO factories (
  contact_name, factory_name, rating, specialties, quality, price_level,
  response_speed, politeness, contact_method, address, bank_info, notes,
  created_at, updated_at
) VALUES (
  ${esc(contact)}, ${esc(name)}, ${escNum(rating)}, ${specSql}, ${esc(quality)}, ${esc(priceLevel)},
  ${esc(responseSpeed)}, ${esc(politeness)}, ${esc(contactMethod)}, ${esc(address)}, ${bankJson}, ${esc(notes)},
  ${createdAt ? `'${createdAt}'::timestamptz` : 'now()'},
  ${updatedAt ? `'${updatedAt}'::timestamptz` : 'now()'}
)
ON CONFLICT DO NOTHING;
`
}

// =========== Update bing.bai display_name ===========
sql += '\n-- ---------- Set display_name on bing.bai ----------\n'
sql += `UPDATE profiles SET display_name = '氷 白' WHERE id = '${BING_PROFILE_ID}' AND display_name IS NULL;\n`

sql += '\nCOMMIT;\n'

fs.writeFileSync('/tmp/import-master.sql', sql)
console.log('Wrote /tmp/import-master.sql')
console.log('Lines:', sql.split('\n').length)
