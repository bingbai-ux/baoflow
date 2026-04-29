import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getSettings } from '@/lib/actions/settings'
import { SettingsForm } from '@/components/settings/settings-form'

export default async function SettingsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, settings] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, email, role')
      .eq('id', user.id)
      .single(),
    getSettings(),
  ])

  const initial = {
    default_exchange_rate: Number(settings?.default_exchange_rate) || 155,
    default_tax_rate: Number(settings?.default_tax_rate) || 10,
    default_cost_ratio: Number(settings?.default_cost_ratio) || 0.55,
    default_china_freight_rate_yuan_per_kg:
      Number(settings?.default_china_freight_rate_yuan_per_kg) || 7.0,
    default_yuan_to_usd_rate: Number(settings?.default_yuan_to_usd_rate) || 7.2,
    default_pantone_color_fee_yuan:
      Number(settings?.default_pantone_color_fee_yuan) || 11775,
    company_info_phase1: settings?.company_info_phase1 || null,
    bank_accounts_phase1: settings?.bank_accounts_phase1 || null,
    default_shipping_address: settings?.default_shipping_address || null,
    // Sprint 9: 帳票定型文
    quote_default_text: settings?.quote_default_text || '',
    invoice_default_text: settings?.invoice_default_text || '',
    delivery_note_default_text: settings?.delivery_note_default_text || '',
    rfq_default_text: settings?.rfq_default_text || '',
  }

  return (
    <>
      <div className="py-[18px]">
        <h1 className="font-display text-[24px] font-semibold text-[#0a0a0a]">設定</h1>
        <p className="text-[12px] text-[#888] font-body mt-1">
          見積計算のデフォルトとプロフィール情報を管理します。
        </p>
      </div>

      <SettingsForm
        initial={initial}
        profile={{
          display_name: profile?.display_name || null,
          email: profile?.email || user.email || null,
          role: profile?.role || null,
        }}
      />
    </>
  )
}
