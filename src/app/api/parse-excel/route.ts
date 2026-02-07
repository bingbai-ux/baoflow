import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

interface ParsedQuoteRow {
  item: string
  material: string
  size: string
  quantity: number
  unitPriceCny: number
  totalCny: number
  notes: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file as ArrayBuffer
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })

    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]

    // Skip header rows and parse data
    // Try to find header row by looking for common column names
    let headerRowIndex = 0
    const commonHeaders = ['品名', '品目', '材質', 'サイズ', '数量', '単価', '金額', 'item', 'material', 'quantity', 'price']

    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i]
      if (Array.isArray(row)) {
        const rowStr = row.map(c => String(c || '').toLowerCase()).join(' ')
        if (commonHeaders.some(h => rowStr.includes(h.toLowerCase()))) {
          headerRowIndex = i
          break
        }
      }
    }

    const headers = data[headerRowIndex] as string[]
    const rows: ParsedQuoteRow[] = []

    // Parse data rows
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i] as unknown[]
      if (!row || row.length === 0) continue

      // Try to extract values based on common patterns
      const item = findValue(row, headers, ['品名', '品目', 'item', '商品名', '製品名']) || ''
      const material = findValue(row, headers, ['材質', 'material', '素材']) || ''
      const size = findValue(row, headers, ['サイズ', 'size', '寸法', '規格']) || ''
      const quantityRaw = findValue(row, headers, ['数量', 'quantity', 'qty', '個数'])
      const unitPriceRaw = findValue(row, headers, ['単価', 'price', 'unit price', '価格'])
      const totalRaw = findValue(row, headers, ['金額', 'total', '合計', '小計'])
      const notes = findValue(row, headers, ['備考', 'notes', 'remarks', '注記']) || ''

      const quantity = parseNumber(quantityRaw)
      const unitPriceCny = parseNumber(unitPriceRaw)
      const totalCny = parseNumber(totalRaw) || quantity * unitPriceCny

      // Only add rows that have meaningful data
      if (item || quantity > 0 || unitPriceCny > 0) {
        rows.push({
          item: String(item),
          material: String(material),
          size: String(size),
          quantity,
          unitPriceCny,
          totalCny,
          notes: String(notes),
        })
      }
    }

    // Calculate summary
    const summary = {
      totalItems: rows.length,
      totalQuantity: rows.reduce((sum, r) => sum + r.quantity, 0),
      totalAmountCny: rows.reduce((sum, r) => sum + r.totalCny, 0),
      averageUnitPrice: rows.length > 0
        ? rows.reduce((sum, r) => sum + r.unitPriceCny, 0) / rows.length
        : 0,
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      sheetName,
      headers,
      rows,
      summary,
    })
  } catch (error) {
    console.error('Excel parse error:', error)
    return NextResponse.json(
      { error: 'Failed to parse Excel file' },
      { status: 500 }
    )
  }
}

function findValue(row: unknown[], headers: string[], possibleNames: string[]): unknown {
  for (const name of possibleNames) {
    const index = headers.findIndex(h =>
      String(h || '').toLowerCase().includes(name.toLowerCase())
    )
    if (index >= 0 && index < row.length) {
      return row[index]
    }
  }
  // Fallback: try to find by position for numeric columns
  return null
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    // Remove currency symbols, commas, spaces
    const cleaned = value.replace(/[¥￥$,，\s]/g, '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }
  return 0
}
