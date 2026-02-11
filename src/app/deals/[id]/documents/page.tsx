'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatJPY, formatDate } from '@/lib/utils/format'

interface DealData {
  id: string
  deal_code: string
  deal_name?: string | null
  client?: {
    company_name: string
    contact_name?: string | null
    address?: string | null
    phone?: string | null
  }
  specifications?: Array<{
    product_name?: string | null
  }>
  quotes?: Array<{
    quantity: number
    selling_price_jpy: number
    total_billing_jpy: number
    total_billing_tax_jpy: number
    status: string
  }>
}

interface SystemSettings {
  company_name?: string
  company_address?: string
  company_phone?: string
  company_email?: string
  invoice_number?: string
  bank_accounts?: Array<{
    bank_name: string
    branch_name: string
    account_type: string
    account_number: string
    account_holder: string
  }>
  stamp_image_url?: string
}

const tabs = [
  { id: 'quotation', label: '見積書' },
  { id: 'invoice', label: '請求書' },
  { id: 'delivery', label: '納品書' },
]

export default function DocumentsPage() {
  const params = useParams()
  const dealId = params.id as string

  const [activeTab, setActiveTab] = useState('quotation')
  const [deal, setDeal] = useState<DealData | null>(null)
  const [settings, setSettings] = useState<SystemSettings>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      // Get deal data
      const { data: dealData } = await supabase
        .from('deals')
        .select(`
          id, deal_code, deal_name,
          client:clients(company_name, contact_name, address, phone),
          specifications:deal_specifications(product_name),
          quotes:deal_quotes(quantity, selling_price_jpy, total_billing_jpy, total_billing_tax_jpy, status)
        `)
        .eq('id', dealId)
        .single()

      if (dealData) {
        // Handle client being returned as array or single object
        const clientData = Array.isArray(dealData.client) ? dealData.client[0] : dealData.client
        setDeal({
          ...dealData,
          client: clientData,
        } as DealData)
      }

      // Get system settings
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('key, value')

      if (settingsData) {
        const settingsObj: SystemSettings = {}
        settingsData.forEach((s: { key: string; value: string }) => {
          if (s.key === 'bank_accounts') {
            try {
              settingsObj.bank_accounts = JSON.parse(s.value)
            } catch {
              settingsObj.bank_accounts = []
            }
          } else if (s.key === 'company_name') {
            settingsObj.company_name = s.value
          } else if (s.key === 'company_address') {
            settingsObj.company_address = s.value
          } else if (s.key === 'company_phone') {
            settingsObj.company_phone = s.value
          } else if (s.key === 'company_email') {
            settingsObj.company_email = s.value
          } else if (s.key === 'invoice_number') {
            settingsObj.invoice_number = s.value
          } else if (s.key === 'stamp_image_url') {
            settingsObj.stamp_image_url = s.value
          }
        })
        setSettings(settingsObj)
      }

      setLoading(false)
    }

    fetchData()
  }, [dealId])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f2f2f0] flex items-center justify-center">
        <p className="text-[13px] text-[#888] font-body">読み込み中...</p>
      </div>
    )
  }

  const approvedQuote = deal?.quotes?.find(q => q.status === 'approved') || deal?.quotes?.[0]
  const productName = deal?.specifications?.[0]?.product_name || deal?.deal_name || ''
  const today = formatDate(new Date().toISOString())

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <div className="px-[26px] py-6">
        {/* Page Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">
            帳票出力
          </h1>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="bg-[#22c55e] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body"
            >
              PDFとして保存
            </button>
            <Link
              href={`/deals/${dealId}`}
              className="text-[#888] text-[13px] font-body no-underline bg-white border border-[#e8e8e6] rounded-[8px] px-4 py-2"
            >
              戻る
            </Link>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 no-print">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '9999px',
                fontSize: '13px',
                border: 'none',
                cursor: 'pointer',
                fontFamily: activeTab === tab.id
                  ? "'Fraunces', serif"
                  : "'Zen Kaku Gothic New', system-ui, sans-serif",
                fontWeight: activeTab === tab.id ? 600 : 400,
                backgroundColor: activeTab === tab.id ? '#0a0a0a' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#888888',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Document Preview */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-10 print:p-0 print:border-0 print:rounded-none" style={{ maxWidth: '800px', margin: '0 auto' }}>
          {/* Document Header */}
          <h2 className="text-center text-[24px] font-bold mb-8 font-body">
            {activeTab === 'quotation' && '御見積書'}
            {activeTab === 'invoice' && '請求書'}
            {activeTab === 'delivery' && '納品書'}
          </h2>

          {/* Client Info */}
          <div className="mb-8">
            <p className="text-[16px] font-bold font-body mb-2">
              {deal?.client?.company_name || '顧客名'} 御中
            </p>
            {deal?.client?.contact_name && (
              <p className="text-[13px] text-[#555] font-body">{deal.client.contact_name} 様</p>
            )}
          </div>

          {/* Document Info */}
          <div className="flex justify-between mb-8">
            <div>
              <p className="text-[13px] font-body">発行日: {today}</p>
              <p className="text-[13px] font-body">案件番号: {deal?.deal_code}</p>
              {activeTab === 'invoice' && settings.invoice_number && (
                <p className="text-[13px] font-body">登録番号: {settings.invoice_number}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[14px] font-bold font-body">{settings.company_name || '会社名'}</p>
              <p className="text-[12px] text-[#555] font-body">{settings.company_address}</p>
              <p className="text-[12px] text-[#555] font-body">TEL: {settings.company_phone}</p>
              <p className="text-[12px] text-[#555] font-body">{settings.company_email}</p>
              {settings.stamp_image_url && (
                <img src={settings.stamp_image_url} alt="角印" className="w-16 h-16 ml-auto mt-2" />
              )}
            </div>
          </div>

          {/* Amount Summary */}
          {approvedQuote && (
            <div className="bg-[#f2f2f0] rounded-[12px] p-4 mb-8">
              <div className="flex justify-between items-center">
                <span className="text-[14px] font-body">合計金額（税込）</span>
                <span className="text-[24px] font-bold font-display tabular-nums">
                  {formatJPY(approvedQuote.total_billing_tax_jpy)}
                </span>
              </div>
            </div>
          )}

          {/* Items Table */}
          <table className="w-full border-collapse mb-8">
            <thead>
              <tr className="border-b-2 border-[#0a0a0a]">
                <th className="text-left py-2 text-[12px] font-medium font-body">品名</th>
                <th className="text-right py-2 text-[12px] font-medium font-body">数量</th>
                <th className="text-right py-2 text-[12px] font-medium font-body">単価</th>
                <th className="text-right py-2 text-[12px] font-medium font-body">金額</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[rgba(0,0,0,0.1)]">
                <td className="py-3 text-[13px] font-body">{productName}</td>
                <td className="py-3 text-[13px] text-right font-display tabular-nums">
                  {approvedQuote?.quantity?.toLocaleString() || '-'}
                </td>
                <td className="py-3 text-[13px] text-right font-display tabular-nums">
                  {approvedQuote ? formatJPY(approvedQuote.selling_price_jpy) : '-'}
                </td>
                <td className="py-3 text-[13px] text-right font-display tabular-nums">
                  {approvedQuote ? formatJPY(approvedQuote.total_billing_jpy) : '-'}
                </td>
              </tr>
            </tbody>
            <tfoot>
              <tr className="border-b border-[rgba(0,0,0,0.1)]">
                <td colSpan={3} className="py-2 text-[12px] text-right font-body">小計</td>
                <td className="py-2 text-[13px] text-right font-display tabular-nums">
                  {approvedQuote ? formatJPY(approvedQuote.total_billing_jpy) : '-'}
                </td>
              </tr>
              <tr className="border-b border-[rgba(0,0,0,0.1)]">
                <td colSpan={3} className="py-2 text-[12px] text-right font-body">消費税 (10%)</td>
                <td className="py-2 text-[13px] text-right font-display tabular-nums">
                  {approvedQuote ? formatJPY(approvedQuote.total_billing_tax_jpy - approvedQuote.total_billing_jpy) : '-'}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="py-2 text-[13px] text-right font-bold font-body">合計（税込）</td>
                <td className="py-2 text-[14px] text-right font-bold font-display tabular-nums">
                  {approvedQuote ? formatJPY(approvedQuote.total_billing_tax_jpy) : '-'}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Bank Info (for invoice) */}
          {activeTab === 'invoice' && settings.bank_accounts && settings.bank_accounts.length > 0 && (
            <div className="border-t border-[rgba(0,0,0,0.1)] pt-6">
              <h3 className="text-[13px] font-bold font-body mb-3">お振込先</h3>
              {settings.bank_accounts.map((bank, index) => (
                <div key={index} className="mb-4">
                  <p className="text-[12px] font-body">
                    {bank.bank_name} {bank.branch_name}
                  </p>
                  <p className="text-[12px] font-body">
                    {bank.account_type} {bank.account_number}
                  </p>
                  <p className="text-[12px] font-body">
                    口座名義: {bank.account_holder}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <div className="mt-8 text-[11px] text-[#888] font-body">
            {activeTab === 'quotation' && <p>※ 本見積書の有効期限は発行日より30日間です。</p>}
            {activeTab === 'invoice' && <p>※ お支払い期限は請求日より30日以内にお願いいたします。</p>}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  )
}
