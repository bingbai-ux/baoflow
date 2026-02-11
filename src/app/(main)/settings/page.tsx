'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/page-header'

interface Settings {
  company: {
    name: string
    address: string
    phone: string
    email: string
    invoiceNumber: string
  }
  exchange: {
    baseCurrency: string
    sourceCurrency: string
    defaultRate: number
    bufferRate: number
  }
  fees: {
    wiseRate: number
    wiseFixed: number
    alibabaRate: number
  }
  shipping: {
    seaD2dRate: number
    airOcsRate: number
  }
  markupRate: number
}

const defaultSettings: Settings = {
  company: {
    name: '',
    address: '',
    phone: '',
    email: '',
    invoiceNumber: '',
  },
  exchange: {
    baseCurrency: 'JPY',
    sourceCurrency: 'CNY',
    defaultRate: 21.5,
    bufferRate: 2,
  },
  fees: {
    wiseRate: 0.6,
    wiseFixed: 150,
    alibabaRate: 3.0,
  },
  shipping: {
    seaD2dRate: 40000,
    airOcsRate: 2000,
  },
  markupRate: 1.8,
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [activeSection, setActiveSection] = useState('company')
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const savedSettings = localStorage.getItem('baoflow_settings')
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [])

  const handleSave = () => {
    setIsSaving(true)
    localStorage.setItem('baoflow_settings', JSON.stringify(settings))
    setTimeout(() => {
      setIsSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }, 500)
  }

  const updateSettings = <T extends keyof Omit<Settings, 'markupRate'>>(
    section: T,
    key: string,
    value: string | number
  ) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...(prev[section] as object),
        [key]: value,
      },
    }))
  }

  const sidebarItems = [
    { id: 'company', label: '会社情報' },
    { id: 'exchange', label: '為替設定' },
    { id: 'fees', label: '手数料設定' },
    { id: 'shipping', label: '配送設定' },
    { id: 'markup', label: '掛率設定' },
  ]

  const inputClassName = "w-full bg-[#f2f2f0] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border border-transparent outline-none focus:border-[#e8e8e6] transition-all"
  const inputDisabledClassName = "w-full bg-[#e8e8e6] rounded-[10px] px-[14px] py-[10px] text-[13px] font-body text-[#0a0a0a] border-none outline-none"

  return (
    <>
      <div className="py-[18px]">
        <PageHeader title="Settings" />
      </div>

        <div className="grid grid-cols-[200px_1fr] gap-4">
          {/* Sidebar */}
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-3">
            {sidebarItems.map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`block w-full px-[14px] py-[10px] rounded-[10px] text-[13px] text-left mb-1 font-body transition-colors cursor-pointer border-none ${
                  activeSection === item.id
                    ? 'bg-[#0a0a0a] text-white font-semibold'
                    : 'bg-transparent text-[#555] hover:bg-[#f2f2f0]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] p-[20px_22px]">
            {activeSection === 'company' && (
              <>
                <h2 className="text-[16px] font-semibold text-[#0a0a0a] mb-5 font-body">会社情報</h2>
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">会社名</label>
                  <input
                    type="text"
                    value={settings.company.name}
                    onChange={(e) => updateSettings('company', 'name', e.target.value)}
                    className={inputClassName}
                    placeholder="株式会社バオフロー"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">住所</label>
                  <input
                    type="text"
                    value={settings.company.address}
                    onChange={(e) => updateSettings('company', 'address', e.target.value)}
                    className={inputClassName}
                    placeholder="東京都渋谷区..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">電話番号</label>
                    <input
                      type="text"
                      value={settings.company.phone}
                      onChange={(e) => updateSettings('company', 'phone', e.target.value)}
                      className={inputClassName}
                      placeholder="03-1234-5678"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">メールアドレス</label>
                    <input
                      type="email"
                      value={settings.company.email}
                      onChange={(e) => updateSettings('company', 'email', e.target.value)}
                      className={inputClassName}
                      placeholder="info@baoflow.jp"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">適格請求書発行事業者番号</label>
                  <input
                    type="text"
                    value={settings.company.invoiceNumber}
                    onChange={(e) => updateSettings('company', 'invoiceNumber', e.target.value)}
                    className={inputClassName}
                    placeholder="T1234567890123"
                  />
                </div>
              </>
            )}

            {activeSection === 'exchange' && (
              <>
                <h2 className="text-[16px] font-semibold text-[#0a0a0a] mb-5 font-body">為替設定</h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">基準通貨</label>
                    <input
                      type="text"
                      value={settings.exchange.baseCurrency}
                      disabled
                      className={inputDisabledClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">仕入通貨</label>
                    <input
                      type="text"
                      value={settings.exchange.sourceCurrency}
                      disabled
                      className={inputDisabledClassName}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">デフォルトレート (CNY→JPY)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={settings.exchange.defaultRate}
                      onChange={(e) => updateSettings('exchange', 'defaultRate', parseFloat(e.target.value))}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">バッファ率 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.exchange.bufferRate}
                      onChange={(e) => updateSettings('exchange', 'bufferRate', parseFloat(e.target.value))}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </>
            )}

            {activeSection === 'fees' && (
              <>
                <h2 className="text-[16px] font-semibold text-[#0a0a0a] mb-5 font-body">手数料設定</h2>
                <div className="mb-5">
                  <h3 className="text-[13px] font-medium text-[#555] mb-3 font-body">Wise</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">手数料率 (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.fees.wiseRate}
                        onChange={(e) => updateSettings('fees', 'wiseRate', parseFloat(e.target.value))}
                        className={inputClassName}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">固定手数料 (円)</label>
                      <input
                        type="number"
                        value={settings.fees.wiseFixed}
                        onChange={(e) => updateSettings('fees', 'wiseFixed', parseInt(e.target.value))}
                        className={inputClassName}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="text-[13px] font-medium text-[#555] mb-3 font-body">Alibaba</h3>
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">手数料率 (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.fees.alibabaRate}
                      onChange={(e) => updateSettings('fees', 'alibabaRate', parseFloat(e.target.value))}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </>
            )}

            {activeSection === 'shipping' && (
              <>
                <h2 className="text-[16px] font-semibold text-[#0a0a0a] mb-5 font-body">配送設定</h2>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">D2D海上輸送単価 (円/CBM)</label>
                    <input
                      type="number"
                      value={settings.shipping.seaD2dRate}
                      onChange={(e) => updateSettings('shipping', 'seaD2dRate', parseInt(e.target.value))}
                      className={inputClassName}
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">OCS航空輸送単価 (円/kg)</label>
                    <input
                      type="number"
                      value={settings.shipping.airOcsRate}
                      onChange={(e) => updateSettings('shipping', 'airOcsRate', parseInt(e.target.value))}
                      className={inputClassName}
                    />
                  </div>
                </div>
              </>
            )}

            {activeSection === 'markup' && (
              <>
                <h2 className="text-[16px] font-semibold text-[#0a0a0a] mb-5 font-body">掛率設定</h2>
                <div className="mb-4">
                  <label className="block text-[12px] font-medium text-[#555] mb-[6px] font-body">デフォルト掛率</label>
                  <input
                    type="number"
                    step="0.1"
                    value={settings.markupRate}
                    onChange={(e) => setSettings(prev => ({ ...prev, markupRate: parseFloat(e.target.value) }))}
                    className={inputClassName}
                  />
                  <p className="text-[11px] text-[#888] mt-[6px] font-body">
                    原価に対する販売価格の倍率（例: 1.8 = 80%の粗利）
                  </p>
                </div>
              </>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-[#0a0a0a] text-white rounded-[8px] px-5 py-[10px] text-[13px] font-medium font-body disabled:opacity-70 transition-opacity cursor-pointer border-none"
              >
                {isSaving ? '保存中...' : '設定を保存'}
              </button>
              {saved && (
                <span className="text-[13px] text-[#22c55e] font-body">
                  保存しました
                </span>
              )}
            </div>
        </div>
      </div>
    </>
  )
}
