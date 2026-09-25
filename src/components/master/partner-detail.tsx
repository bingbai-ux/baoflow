'use client'

// Sprint 11: 物流パートナー詳細 (発送業者 / ロジスティック会社)。InlineCell で直接編集。

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { InlineCell } from '@/components/deals/inline-cell'
import {
  updatePartnerField,
  setPartnerActive,
  type LogisticsPartner,
} from '@/lib/actions/logistics-partners'
import { useUi } from '@/components/ui/ui-store'
import { formatDate } from '@/lib/utils/format'

const SERVICE_LABELS: Record<string, string> = {
  sea: '海運',
  air: '空輸',
  express: '快递/クーリエ',
  customs: '通関',
  pickup: '集荷',
  ddp: 'DDP(双清包税)',
  storage: '在庫保管',
  inbound: '入庫・検品',
  picking: 'ピッキング・出荷',
  delivery: '配送手配',
  kitting: 'セット組み',
  returns: '返品対応',
}

export function PartnerDetail({ partner }: { partner: LogisticsPartner }) {
  const router = useRouter()
  const { toast } = useUi()
  const [pending, startTransition] = useTransition()

  const save = (field: string) => async (val: string) =>
    updatePartnerField(partner.id, field, val || null)

  const toggleActive = () =>
    startTransition(async () => {
      const r = await setPartnerActive(partner.id, !partner.is_active)
      if (r.success) {
        toast(partner.is_active ? '取引停止にしました' : '取引再開しました')
        router.refresh()
      } else {
        toast(r.error || '更新に失敗しました', 'warn')
      }
    })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-display text-[17px] font-bold text-[#351E28]">
              {partner.company_name}
            </h2>
            <span className="rounded-full bg-[#D7EFFF] text-[#33566F] text-[10px] font-bold px-2 py-[2px]">
              {partner.partner_kind === 'shipping' ? '発送業者' : 'ロジ会社(在庫保管)'}
            </span>
            {!partner.is_active && (
              <span className="rounded-full bg-[#EFEFEA] border border-[#E2E1DA] text-[#84787D] text-[10px] font-bold px-2 py-[2px]">
                取引停止中
              </span>
            )}
            {partner.self_registered_at && (
              <span className="rounded-full bg-[#AEB8A0] text-[#4C5544] text-[10px] font-bold px-2 py-[2px]">
                自己登録 {formatDate(partner.self_registered_at)}
              </span>
            )}
          </div>
          {(partner.services || []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {(partner.services || []).map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[#EFEFEA] border border-[#E2E1DA] text-[#4C5544] text-[10px] px-2 py-[2px]"
                >
                  {SERVICE_LABELS[s] || s}
                </span>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={toggleActive}
          disabled={pending}
          className={`rounded-full text-[11px] font-bold px-3 py-1.5 disabled:opacity-40 ${
            partner.is_active
              ? 'bg-white border border-[#FF5C34] text-[#B03616]'
              : 'bg-[#351E28] text-[#C9A2B8]'
          }`}
        >
          {partner.is_active ? '取引停止にする' : '取引再開する'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
        <Row label="会社名">
          <InlineCell value={partner.company_name} onSave={save('company_name')} />
        </Row>
        <Row label="英/中社名">
          <InlineCell value={partner.name_cn} onSave={save('name_cn')} placeholder="—" />
        </Row>
        <Row label="担当者">
          <InlineCell value={partner.contact_name} onSave={save('contact_name')} placeholder="—" />
        </Row>
        <Row label="電話">
          <InlineCell value={partner.contact_phone} onSave={save('contact_phone')} placeholder="—" />
        </Row>
        <Row label="メール">
          <InlineCell value={partner.contact_email} onSave={save('contact_email')} placeholder="—" />
        </Row>
        <Row label="WeChat">
          <InlineCell value={partner.wechat} onSave={save('wechat')} placeholder="—" />
        </Row>
        <Row label="住所/拠点">
          <InlineCell value={partner.address} onSave={save('address')} placeholder="—" />
        </Row>
        <Row label="対応範囲">
          <InlineCell value={partner.coverage} onSave={save('coverage')} placeholder="—" />
        </Row>
        <Row label="支払条件">
          <InlineCell value={partner.payment_terms} onSave={save('payment_terms')} placeholder="—" />
        </Row>
      </div>

      <div>
        <p className="text-[10.5px] text-[#84787D] font-body mb-1">料金の目安</p>
        <InlineCell value={partner.pricing_notes} onSave={save('pricing_notes')} placeholder="クリックで入力" />
      </div>
      <div>
        <p className="text-[10.5px] text-[#84787D] font-body mb-1">メモ</p>
        <InlineCell value={partner.notes} onSave={save('notes')} placeholder="クリックで入力" />
      </div>
      {partner.bank_info && typeof partner.bank_info === 'object' && 'raw' in partner.bank_info && (
        <div>
          <p className="text-[10.5px] text-[#84787D] font-body mb-1">銀行口座</p>
          <p className="text-[12px] text-[#351E28] font-body whitespace-pre-line bg-[#FBFAF6] rounded-[12px] px-3 py-2 border border-[#E2E1DA]">
            {String((partner.bank_info as { raw?: string }).raw || '')}
          </p>
        </div>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[90px_1fr] gap-2 py-1.5 border-b border-[#EFEFEA] items-center">
      <span className="text-[10.5px] text-[#84787D] font-body">{label}</span>
      <div className="text-[12.5px] min-w-0">{children}</div>
    </div>
  )
}
