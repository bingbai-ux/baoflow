'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils/format'
import type { Deal, Client, DealSpecification, DealQuote } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

type PdfType = 'quote' | 'invoice'

interface DealWithRelations extends Deal {
  clients?: Client
  deal_specifications?: DealSpecification[]
  deal_quotes?: DealQuote[]
}

export default function PdfPage({ params }: Props) {
  const [id, setId] = useState<string | null>(null)
  const [deal, setDeal] = useState<DealWithRelations | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [activeTab, setActiveTab] = useState<PdfType>('quote')

  useEffect(() => {
    params.then(p => {
      setId(p.id)
      loadDeal(p.id)
    })
  }, [params])

  const loadDeal = async (dealId: string) => {
    const supabase = createClient()
    const { data: dealData } = await supabase
      .from('deals')
      .select('*, clients(*), deal_specifications(*), deal_quotes(*)')
      .eq('id', dealId)
      .single()

    if (dealData) {
      setDeal(dealData)
      if (dealData.clients) {
        setClient(dealData.clients as unknown as Client)
      }
    }
  }

  // Get settings from localStorage
  const getSettings = () => {
    if (typeof window === 'undefined') return null
    const saved = localStorage.getItem('baoflow_settings')
    return saved ? JSON.parse(saved) : null
  }

  if (!deal) {
    return (
      <div style={{ padding: '24px 26px' }}>
        <div style={{ color: '#888888', fontSize: '13px' }}>読み込み中...</div>
      </div>
    )
  }

  const settings = getSettings()

  // Get product info from specifications
  const spec = deal.deal_specifications?.[0]
  const quote = deal.deal_quotes?.find(q => q.status === 'approved') || deal.deal_quotes?.[0]

  const productName = spec?.product_name || deal.deal_name || '商品名未設定'
  const specification = spec
    ? [spec.material_category, `${spec.height_mm}×${spec.width_mm}×${spec.depth_mm}mm`].filter(Boolean).join(' ')
    : '-'
  const quantity = quote?.quantity || 1
  const unitPrice = quote?.selling_price_jpy || 0

  const today = new Date()
  const validUntil = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const dueDate = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  const quoteItems = [
    {
      name: productName,
      specification: specification,
      quantity: quantity,
      unitPrice: unitPrice,
    },
  ]

  // Generate printable HTML for quote
  const generateQuoteHtml = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const tax = Math.round(subtotal * 0.1)
    const total = subtotal + tax

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>見積書 - ${deal.deal_code}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
    body { font-family: 'Noto Sans JP', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 700; }
    .title { text-align: center; font-size: 28px; font-weight: 700; margin-bottom: 30px; letter-spacing: 0.3em; }
    .info { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info-block { width: 45%; }
    .label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .value { font-size: 14px; margin-bottom: 12px; }
    .client-name { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f2f2f0; padding: 10px; text-align: left; font-size: 12px; border-bottom: 1px solid #e8e8e6; }
    td { padding: 12px 10px; border-bottom: 1px solid #e8e8e6; font-size: 13px; }
    .right { text-align: right; }
    .summary { text-align: right; margin-top: 20px; }
    .summary-row { display: flex; justify-content: flex-end; margin-bottom: 4px; }
    .summary-label { width: 100px; }
    .summary-value { width: 120px; text-align: right; }
    .total { border-top: 2px solid #0a0a0a; padding-top: 8px; margin-top: 8px; font-weight: 700; font-size: 16px; }
    .notes { background: #f2f2f0; padding: 15px; border-radius: 8px; margin-top: 30px; }
    .notes-title { font-weight: 700; margin-bottom: 8px; }
    .notes-text { font-size: 12px; color: #555; white-space: pre-line; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #e8e8e6; padding-top: 20px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">(bao) flow</div>
    <div>
      <div class="label">見積番号</div>
      <div style="font-weight: 700;">Q-${deal.deal_code}</div>
    </div>
  </div>
  <div class="title">御 見 積 書</div>
  <div class="info">
    <div class="info-block">
      <div class="label">お客様名</div>
      <div class="client-name">${client?.company_name || '顧客名'} 様</div>
      ${client?.address ? `<div class="value">${client.address}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="label">発行日</div>
      <div class="value">${formatDate(today)}</div>
      <div class="label">有効期限</div>
      <div class="value">${formatDate(validUntil)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>商品名</th>
        <th>仕様</th>
        <th class="right">数量</th>
        <th class="right">単価</th>
        <th class="right">金額</th>
      </tr>
    </thead>
    <tbody>
      ${quoteItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.specification}</td>
        <td class="right">${item.quantity.toLocaleString()}</td>
        <td class="right">¥${item.unitPrice.toLocaleString()}</td>
        <td class="right">¥${(item.quantity * item.unitPrice).toLocaleString()}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">小計</span>
      <span class="summary-value">¥${subtotal.toLocaleString()}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">消費税 (10%)</span>
      <span class="summary-value">¥${tax.toLocaleString()}</span>
    </div>
    <div class="summary-row total">
      <span class="summary-label">合計</span>
      <span class="summary-value">¥${total.toLocaleString()}</span>
    </div>
  </div>
  <div class="notes">
    <div class="notes-title">備考</div>
    <div class="notes-text">※ 価格には消費税が含まれておりません。
※ 納期は発注確定後約30-45日となります。</div>
  </div>
  <div class="footer">
    <div>${settings?.company?.name || '株式会社バオフロー'}</div>
    <div>${settings?.company?.address || ''}</div>
    <div>TEL: ${settings?.company?.phone || ''} | Email: ${settings?.company?.email || ''}</div>
  </div>
</body>
</html>
    `
  }

  // Generate printable HTML for invoice
  const generateInvoiceHtml = () => {
    const subtotal = quoteItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const tax = Math.round(subtotal * 0.1)
    const total = subtotal + tax

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>請求書 - ${deal.deal_code}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700&display=swap');
    body { font-family: 'Noto Sans JP', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .logo { font-size: 24px; font-weight: 700; }
    .title { text-align: center; font-size: 28px; font-weight: 700; margin-bottom: 30px; letter-spacing: 0.3em; }
    .info { display: flex; justify-content: space-between; margin-bottom: 30px; }
    .info-block { width: 45%; }
    .label { font-size: 11px; color: #888; margin-bottom: 4px; }
    .value { font-size: 14px; margin-bottom: 12px; }
    .client-name { font-size: 18px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f2f2f0; padding: 10px; text-align: left; font-size: 12px; border-bottom: 1px solid #e8e8e6; }
    td { padding: 12px 10px; border-bottom: 1px solid #e8e8e6; font-size: 13px; }
    .right { text-align: right; }
    .summary { text-align: right; margin-top: 20px; }
    .summary-row { display: flex; justify-content: flex-end; margin-bottom: 4px; }
    .summary-label { width: 100px; }
    .summary-value { width: 120px; text-align: right; }
    .total { border-top: 2px solid #0a0a0a; padding-top: 8px; margin-top: 8px; font-weight: 700; font-size: 16px; }
    .bank { background: #f2f2f0; padding: 15px; border-radius: 8px; margin-top: 30px; }
    .bank-title { font-weight: 700; margin-bottom: 12px; }
    .bank-row { display: flex; margin-bottom: 4px; }
    .bank-label { width: 100px; font-size: 12px; color: #888; }
    .bank-value { font-size: 12px; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #888; border-top: 1px solid #e8e8e6; padding-top: 20px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">(bao) flow</div>
    <div>
      <div class="label">請求書番号</div>
      <div style="font-weight: 700;">INV-${deal.deal_code}</div>
    </div>
  </div>
  <div class="title">請 求 書</div>
  <div class="info">
    <div class="info-block">
      <div class="label">請求先</div>
      <div class="client-name">${client?.company_name || '顧客名'} 様</div>
      ${client?.address ? `<div class="value">${client.address}</div>` : ''}
    </div>
    <div class="info-block">
      <div class="label">発行日</div>
      <div class="value">${formatDate(today)}</div>
      <div class="label">お支払い期限</div>
      <div class="value">${formatDate(dueDate)}</div>
      ${settings?.company?.invoiceNumber ? `
      <div class="label">適格請求書発行事業者番号</div>
      <div class="value" style="font-size: 11px;">${settings.company.invoiceNumber}</div>
      ` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>No.</th>
        <th>商品名</th>
        <th>仕様</th>
        <th class="right">数量</th>
        <th class="right">単価</th>
        <th class="right">金額</th>
      </tr>
    </thead>
    <tbody>
      ${quoteItems.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.specification}</td>
        <td class="right">${item.quantity.toLocaleString()}</td>
        <td class="right">¥${item.unitPrice.toLocaleString()}</td>
        <td class="right">¥${(item.quantity * item.unitPrice).toLocaleString()}</td>
      </tr>
      `).join('')}
    </tbody>
  </table>
  <div class="summary">
    <div class="summary-row">
      <span class="summary-label">小計</span>
      <span class="summary-value">¥${subtotal.toLocaleString()}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">消費税 (10%)</span>
      <span class="summary-value">¥${tax.toLocaleString()}</span>
    </div>
    <div class="summary-row total">
      <span class="summary-label">合計</span>
      <span class="summary-value">¥${total.toLocaleString()}</span>
    </div>
  </div>
  <div class="bank">
    <div class="bank-title">お振込先</div>
    <div class="bank-row"><span class="bank-label">金融機関名</span><span class="bank-value">三菱UFJ銀行</span></div>
    <div class="bank-row"><span class="bank-label">支店名</span><span class="bank-value">渋谷支店</span></div>
    <div class="bank-row"><span class="bank-label">口座種別</span><span class="bank-value">普通</span></div>
    <div class="bank-row"><span class="bank-label">口座番号</span><span class="bank-value">1234567</span></div>
    <div class="bank-row"><span class="bank-label">口座名義</span><span class="bank-value">カ）バオフロー</span></div>
  </div>
  <div class="footer">
    <div>${settings?.company?.name || '株式会社バオフロー'}</div>
    <div>${settings?.company?.address || ''}</div>
    <div>TEL: ${settings?.company?.phone || ''} | Email: ${settings?.company?.email || ''}</div>
  </div>
</body>
</html>
    `
  }

  const handlePrint = () => {
    const html = activeTab === 'quote' ? generateQuoteHtml() : generateInvoiceHtml()
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  return (
    <div style={{ padding: '24px 26px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '24px',
              fontWeight: 600,
              color: '#0a0a0a',
              marginBottom: '4px',
            }}
          >
            帳票出力
          </h1>
          <div style={{ fontSize: '13px', color: '#888888' }}>
            {deal.deal_code} - {productName}
          </div>
        </div>
        <Link
          href={`/deals/${id}`}
          style={{
            backgroundColor: '#ffffff',
            color: '#888888',
            border: '1px solid #e8e8e6',
            borderRadius: '8px',
            padding: '8px 16px',
            fontSize: '13px',
            fontWeight: 500,
            fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            textDecoration: 'none',
          }}
        >
          戻る
        </Link>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          marginBottom: '16px',
        }}
      >
        <button
          onClick={() => setActiveTab('quote')}
          style={{
            padding: '8px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'quote' ? '#0a0a0a' : 'transparent',
            color: activeTab === 'quote' ? '#ffffff' : '#888888',
            fontFamily: activeTab === 'quote' ? "'Fraunces', serif" : "'Zen Kaku Gothic New', system-ui, sans-serif",
            fontWeight: activeTab === 'quote' ? 600 : 400,
          }}
        >
          見積書
        </button>
        <button
          onClick={() => setActiveTab('invoice')}
          style={{
            padding: '8px 16px',
            borderRadius: '9999px',
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            backgroundColor: activeTab === 'invoice' ? '#0a0a0a' : 'transparent',
            color: activeTab === 'invoice' ? '#ffffff' : '#888888',
            fontFamily: activeTab === 'invoice' ? "'Fraunces', serif" : "'Zen Kaku Gothic New', system-ui, sans-serif",
            fontWeight: activeTab === 'invoice' ? 600 : 400,
          }}
        >
          請求書
        </button>
      </div>

      {/* PDF Preview & Download */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.06)',
          padding: '20px 22px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#0a0a0a',
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            }}
          >
            {activeTab === 'quote' ? '見積書' : '請求書'}プレビュー
          </h2>

          <button
            onClick={handlePrint}
            style={{
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              border: 'none',
              cursor: 'pointer',
            }}
          >
            印刷 / PDF保存
          </button>
        </div>

        {/* Preview content */}
        <div
          style={{
            backgroundColor: '#f2f2f0',
            borderRadius: '12px',
            padding: '40px',
            minHeight: '400px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '8px',
              padding: '40px',
              maxWidth: '600px',
              margin: '0 auto',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: '18px', fontWeight: 600 }}>
                (bao) flow
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: '#888888' }}>
                  {activeTab === 'quote' ? '見積番号' : '請求書番号'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>
                  {activeTab === 'quote' ? `Q-${deal.deal_code}` : `INV-${deal.deal_code}`}
                </div>
              </div>
            </div>

            {/* Title */}
            <h3
              style={{
                textAlign: 'center',
                fontSize: '20px',
                fontWeight: 600,
                marginBottom: '30px',
                letterSpacing: '0.2em',
              }}
            >
              {activeTab === 'quote' ? '御 見 積 書' : '請 求 書'}
            </h3>

            {/* Client */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '4px' }}>
                {activeTab === 'quote' ? 'お客様名' : '請求先'}
              </div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>
                {client?.company_name || '顧客名'} 様
              </div>
            </div>

            {/* Items preview */}
            <div
              style={{
                borderTop: '1px solid #e8e8e6',
                borderBottom: '1px solid #e8e8e6',
                padding: '16px 0',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px' }}>{productName}</span>
                <span style={{ fontSize: '13px', fontFamily: "'Fraunces', serif" }}>
                  ¥{(quantity * unitPrice).toLocaleString()}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#888888' }}>
                {specification} × {quantity.toLocaleString()}個
              </div>
            </div>

            {/* Total */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: '#888888', marginBottom: '4px' }}>合計（税込）</div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 600,
                  fontFamily: "'Fraunces', serif",
                }}
              >
                ¥{Math.round(quantity * unitPrice * 1.1).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
