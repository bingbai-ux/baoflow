'use client'

import { useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ParsedRow {
  item: string
  material: string
  size: string
  quantity: number
  unitPriceCny: number
  totalCny: number
  notes: string
}

interface ParseResult {
  success: boolean
  fileName: string
  sheetName: string
  headers: string[]
  rows: ParsedRow[]
  summary: {
    totalItems: number
    totalQuantity: number
    totalAmountCny: number
    averageUnitPrice: number
  }
}

interface Props {
  params: Promise<{ id: string }>
}

export default function ExcelImportPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setResult(null)
      setError(null)
    }
  }

  const handleParse = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/parse-excel', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to parse file')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!result || result.rows.length === 0) return

    // Find the best matching row (usually first non-empty)
    const primaryRow = result.rows[0]

    // Navigate back to deal with parsed data in URL params
    const params = new URLSearchParams({
      product_name: primaryRow.item,
      material: primaryRow.material,
      size: primaryRow.size,
      quantity: primaryRow.quantity.toString(),
      unit_price_cny: primaryRow.unitPriceCny.toString(),
    })

    router.push(`/deals/${id}/edit?${params.toString()}`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0', padding: '24px 26px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: 24, fontWeight: 600 }}>
          工場見積Excel取込
        </h1>
        <Link
          href={`/deals/${id}`}
          style={{
            backgroundColor: '#ffffff',
            color: '#888888',
            border: '1px solid #e8e8e6',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          戻る
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
        {/* Upload Card */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
            ファイルアップロード
          </h2>

          <div
            style={{
              border: '2px dashed #e8e8e6',
              borderRadius: 10,
              padding: 24,
              textAlign: 'center',
              backgroundColor: '#f2f2f0',
            }}
          >
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              id="file-input"
            />
            <label
              htmlFor="file-input"
              style={{
                cursor: 'pointer',
                display: 'block',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#888888"
                strokeWidth="1.5"
                style={{ margin: '0 auto 12px' }}
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
              <div style={{ fontSize: 12, color: '#888888' }}>
                クリックしてファイルを選択
              </div>
              <div style={{ fontSize: 11, color: '#bbbbbb', marginTop: 4 }}>
                .xlsx, .xls, .csv 対応
              </div>
            </label>
          </div>

          {file && (
            <div style={{ marginTop: 12, padding: '10px 12px', backgroundColor: '#f2f2f0', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{file.name}</div>
              <div style={{ fontSize: 11, color: '#888888' }}>
                {(file.size / 1024).toFixed(1)} KB
              </div>
            </div>
          )}

          <button
            onClick={handleParse}
            disabled={!file || loading}
            style={{
              width: '100%',
              marginTop: 16,
              padding: '10px 16px',
              backgroundColor: loading || !file ? '#e8e8e6' : '#0a0a0a',
              color: loading || !file ? '#888888' : '#ffffff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: loading || !file ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? '解析中...' : '解析する'}
          </button>

          {error && (
            <div style={{ marginTop: 12, padding: 12, backgroundColor: '#fef3c7', borderRadius: 8, fontSize: 12, color: '#92400e' }}>
              {error}
            </div>
          )}
        </div>

        {/* Results Card */}
        <div style={cardStyle}>
          <h2 style={{ fontSize: 14, fontWeight: 500, marginBottom: 16 }}>
            解析結果
          </h2>

          {!result ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888888', fontSize: 13 }}>
              ファイルをアップロードして解析してください
            </div>
          ) : (
            <>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                <div style={{ padding: 12, backgroundColor: '#f2f2f0', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888888' }}>品目数</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                    {result.summary.totalItems}
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: '#f2f2f0', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888888' }}>総数量</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                    {result.summary.totalQuantity.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: '#f2f2f0', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888888' }}>総額 (CNY)</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                    ¥{result.summary.totalAmountCny.toLocaleString()}
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: '#f2f2f0', borderRadius: 8, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888888' }}>平均単価</div>
                  <div style={{ fontSize: 18, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
                    ¥{result.summary.averageUnitPrice.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div style={{ overflow: 'auto', maxHeight: 400 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                      <th style={thStyle}>品名</th>
                      <th style={thStyle}>材質</th>
                      <th style={thStyle}>サイズ</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>数量</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>単価</th>
                      <th style={{ ...thStyle, textAlign: 'right' }}>金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <td style={tdStyle}>{row.item || '-'}</td>
                        <td style={tdStyle}>{row.material || '-'}</td>
                        <td style={tdStyle}>{row.size || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Fraunces', serif" }}>
                          {row.quantity.toLocaleString()}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Fraunces', serif" }}>
                          ¥{row.unitPriceCny.toFixed(2)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Fraunces', serif", fontWeight: 500 }}>
                          ¥{row.totalCny.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Apply Button */}
              <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button
                  onClick={handleApply}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  案件に反映する
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '20px 22px',
}

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 500,
  color: '#bbbbbb',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  color: '#555555',
}
