'use client'

import { useState, use, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  parseFactoryDocument,
  applyParsedQuote,
  checkApiKeyAvailable,
  ParsedQuote,
} from '@/lib/actions/excel-parse'

interface Props {
  params: Promise<{ id: string }>
}

export default function ExcelImportPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<ParsedQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [apiKeyAvailable, setApiKeyAvailable] = useState<boolean | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Editable fields
  const [editedData, setEditedData] = useState<ParsedQuote>({})

  useEffect(() => {
    checkApiKeyAvailable().then(setApiKeyAvailable)
  }, [])

  useEffect(() => {
    if (result) {
      setEditedData(result)
    }
  }, [result])

  const handleFileSelect = (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv', '.pdf', '.png', '.jpg', '.jpeg', '.webp']
    const ext = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'))

    if (!validExtensions.includes(ext)) {
      setError('対応していないファイル形式です。Excel, CSV, PDF, 画像ファイルをアップロードしてください。')
      return
    }

    setFile(selectedFile)
    setResult(null)
    setError(null)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      handleFileSelect(selected)
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [])

  const handleParse = async () => {
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await parseFactoryDocument(formData)

      if (!response.success) {
        setError(response.error || '解析に失敗しました')
        return
      }

      setResult(response.data || null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!editedData) return

    setApplying(true)
    setError(null)

    try {
      const response = await applyParsedQuote(id, editedData)

      if (!response.success) {
        setError(response.error || '反映に失敗しました')
        return
      }

      router.push(`/deals/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setApplying(false)
    }
  }

  const updateField = (key: keyof ParsedQuote, value: string | number | null) => {
    setEditedData(prev => ({ ...prev, [key]: value }))
  }

  const inputClassName = "w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] transition-all"

  return (
    <>
      <div className="py-[18px]">
        <Link
          href={`/deals/${id}`}
          className="text-[13px] text-[#888] hover:text-[#555] font-body mb-2 inline-block"
        >
          ← 案件詳細
        </Link>
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          Excel/PDF 自動取込
        </h1>
        <p className="text-[13px] text-[#888] font-body mt-1">
          工場の見積もりファイルをアップロードすると、AIが自動で内容を読み取ります
        </p>
      </div>

      <div className="grid grid-cols-[1fr_1.5fr] gap-2">
        {/* Upload Card */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            ファイルアップロード
          </h2>

          {apiKeyAvailable === false ? (
            <div className="p-4 bg-[#fef3c7] rounded-[12px] text-[13px] text-[#92400e] font-body">
              <p className="font-medium mb-1">AI解析を利用するにはAPI Keyの設定が必要です</p>
              <p className="text-[12px]">
                設定 → <code className="bg-[#fff] px-1 rounded">ANTHROPIC_API_KEY</code>
              </p>
            </div>
          ) : (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-[12px] p-6 text-center transition-all cursor-pointer ${
                  isDragging
                    ? 'border-[#22c55e] bg-[#f0fdf4]'
                    : 'border-[#e8e8e6] bg-[#f2f2f0] hover:border-[#ccc]'
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-input"
                />
                <label htmlFor="file-input" className="cursor-pointer block">
                  <svg
                    width="40"
                    height="40"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isDragging ? '#22c55e' : '#888888'}
                    strokeWidth="1.5"
                    className="mx-auto mb-3"
                  >
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                  <div className="text-[13px] text-[#555] font-body">
                    {isDragging ? 'ドロップしてアップロード' : 'クリックまたはドラッグ&ドロップ'}
                  </div>
                  <div className="text-[11px] text-[#bbb] font-body mt-1">
                    Excel (.xlsx, .xls), CSV, PDF, 画像 対応
                  </div>
                </label>
              </div>

              {file && (
                <div className="mt-3 p-3 bg-[#f2f2f0] rounded-[10px] flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-[#0a0a0a] font-body">{file.name}</div>
                    <div className="text-[11px] text-[#888] font-body">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null)
                      setResult(null)
                      setError(null)
                    }}
                    className="text-[#888] hover:text-[#555] p-1"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}

              <button
                onClick={handleParse}
                disabled={!file || loading || !apiKeyAvailable}
                className={`w-full mt-4 py-[10px] rounded-[8px] text-[13px] font-medium font-body transition-all ${
                  !file || loading || !apiKeyAvailable
                    ? 'bg-[#e8e8e6] text-[#888] cursor-not-allowed'
                    : 'bg-[#0a0a0a] text-white cursor-pointer hover:bg-[#333]'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    AI解析中...
                  </span>
                ) : (
                  'AIで解析する'
                )}
              </button>
            </>
          )}

          {error && (
            <div className="mt-3 p-3 bg-[#fef3c7] rounded-[10px] text-[12px] text-[#92400e] font-body">
              {error}
            </div>
          )}
        </div>

        {/* Results Card */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
          <h2 className="text-[14px] font-medium text-[#0a0a0a] mb-4 font-body">
            解析結果
          </h2>

          {!result ? (
            <div className="text-center py-12 text-[#888] text-[13px] font-body">
              ファイルをアップロードしてAI解析を実行してください
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">商品名</label>
                  <input
                    type="text"
                    value={editedData.product_name || ''}
                    onChange={(e) => updateField('product_name', e.target.value || null)}
                    className={inputClassName}
                    placeholder="未検出"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">素材</label>
                  <input
                    type="text"
                    value={editedData.material || ''}
                    onChange={(e) => updateField('material', e.target.value || null)}
                    className={inputClassName}
                    placeholder="未検出"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] text-[#888] mb-1 font-body">サイズ</label>
                <input
                  type="text"
                  value={editedData.size_description || ''}
                  onChange={(e) => updateField('size_description', e.target.value || null)}
                  className={inputClassName}
                  placeholder="例: W140×D80×H230mm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">数量</label>
                  <input
                    type="number"
                    value={editedData.quantity ?? ''}
                    onChange={(e) => updateField('quantity', e.target.value ? parseInt(e.target.value) : null)}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">単価 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.unit_price_usd ?? ''}
                    onChange={(e) => updateField('unit_price_usd', e.target.value ? parseFloat(e.target.value) : null)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">合計 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.total_usd ?? ''}
                    onChange={(e) => updateField('total_usd', e.target.value ? parseFloat(e.target.value) : null)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">MOQ</label>
                  <input
                    type="number"
                    value={editedData.moq ?? ''}
                    onChange={(e) => updateField('moq', e.target.value ? parseInt(e.target.value) : null)}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">製造日数</label>
                  <input
                    type="number"
                    value={editedData.production_days ?? ''}
                    onChange={(e) => updateField('production_days', e.target.value ? parseInt(e.target.value) : null)}
                    className={inputClassName}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-[#888] mb-1 font-body">送料 (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editedData.shipping_cost_usd ?? ''}
                    onChange={(e) => updateField('shipping_cost_usd', e.target.value ? parseFloat(e.target.value) : null)}
                    className={inputClassName}
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-[11px] text-[#888] mb-1 font-body">特記事項</label>
                <textarea
                  value={editedData.notes || ''}
                  onChange={(e) => updateField('notes', e.target.value || null)}
                  className={`${inputClassName} min-h-[80px] resize-none`}
                  placeholder="備考、条件など"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-[rgba(0,0,0,0.06)]">
                <button
                  onClick={() => {
                    setResult(null)
                    setEditedData({})
                  }}
                  className="px-4 py-[10px] bg-white border border-[#e8e8e6] rounded-[8px] text-[13px] text-[#555] font-medium font-body hover:bg-[#f2f2f0] transition-all cursor-pointer"
                >
                  キャンセル
                </button>
                <button
                  onClick={handleApply}
                  disabled={applying}
                  className="px-5 py-[10px] bg-[#22c55e] text-white rounded-[8px] text-[13px] font-medium font-body hover:bg-[#16a34a] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {applying ? '反映中...' : '案件に反映する'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
