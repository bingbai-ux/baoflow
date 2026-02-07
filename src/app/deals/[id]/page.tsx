import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusDot, statusLabelMap } from '@/components/deals/status-dot'
import { StatusChanger } from './status-changer'
import { RepeatButton } from './repeat-button'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DealDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: deal } = await supabase
    .from('deals')
    .select(`
      *,
      clients (id, company_name, contact_name, email, phone),
      factories (id, name, city, country),
      profiles (id, display_name)
    `)
    .eq('id', id)
    .single()

  if (!deal) {
    notFound()
  }

  const { data: statusHistory } = await supabase
    .from('deal_status_history')
    .select(`
      *,
      profiles (id, display_name)
    `)
    .eq('deal_id', id)
    .order('changed_at', { ascending: false })

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const infoRowStyle = {
    display: 'flex',
    borderBottom: '1px solid rgba(0,0,0,0.06)',
    padding: '12px 0',
  }

  const labelCellStyle = {
    width: '120px',
    fontSize: '12px',
    color: '#888888',
    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
    flexShrink: 0,
  }

  const valueCellStyle = {
    fontSize: '13px',
    color: '#0a0a0a',
    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
  }

  return (
    <div style={{ padding: '24px 26px' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '24px',
              fontWeight: 600,
              color: '#0a0a0a',
            }}
          >
            {deal.deal_number}
          </h1>
          <StatusDot status={deal.status} />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/deals/${id}/quote`}
            style={{
              backgroundColor: '#22c55e',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              textDecoration: 'none',
            }}
          >
            見積もり計算
          </Link>
          <Link
            href={`/deals/${id}/excel-import`}
            style={{
              backgroundColor: '#ffffff',
              color: '#0a0a0a',
              border: '1px solid #e8e8e6',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              textDecoration: 'none',
            }}
          >
            Excel取込
          </Link>
          <Link
            href={`/deals/${id}/pdf`}
            style={{
              backgroundColor: '#ffffff',
              color: '#0a0a0a',
              border: '1px solid #e8e8e6',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              textDecoration: 'none',
            }}
          >
            帳票出力
          </Link>
          <Link
            href={`/deals/${id}/designs`}
            style={{
              backgroundColor: '#ffffff',
              color: '#0a0a0a',
              border: '1px solid #e8e8e6',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              textDecoration: 'none',
            }}
          >
            デザイン
          </Link>
          <RepeatButton dealId={id} />
          <Link
            href={`/deals/${id}/edit`}
            style={{
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              textDecoration: 'none',
            }}
          >
            編集
          </Link>
          <Link
            href="/deals"
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
            一覧に戻る
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {/* Deal Info Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '20px 22px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#0a0a0a',
              marginBottom: '16px',
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            }}
          >
            案件情報
          </h2>

          <div style={infoRowStyle}>
            <div style={labelCellStyle}>クライアント</div>
            <div style={valueCellStyle}>{deal.clients?.company_name || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>工場</div>
            <div style={valueCellStyle}>
              {deal.factories ? `${deal.factories.name} (${deal.factories.city || deal.factories.country})` : '-'}
            </div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>商品名</div>
            <div style={valueCellStyle}>{deal.product_name}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>材質</div>
            <div style={valueCellStyle}>{deal.material || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>サイズ</div>
            <div style={valueCellStyle}>{deal.size || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>数量</div>
            <div style={{ ...valueCellStyle, fontFamily: "'Fraunces', serif", fontVariantNumeric: 'tabular-nums' }}>
              {deal.quantity?.toLocaleString() || '-'}
            </div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>担当者</div>
            <div style={valueCellStyle}>{deal.profiles?.display_name || '-'}</div>
          </div>
          <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
            <div style={labelCellStyle}>備考</div>
            <div style={valueCellStyle}>{deal.notes || '-'}</div>
          </div>
        </div>

        {/* Status Card */}
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.06)',
            padding: '20px 22px',
          }}
        >
          <h2
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: '#0a0a0a',
              marginBottom: '16px',
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            }}
          >
            ステータス変更
          </h2>

          <StatusChanger dealId={id} currentStatus={deal.status} userId={user.id} />

          {/* Status History */}
          <h3
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: '#888888',
              marginTop: '24px',
              marginBottom: '12px',
              fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
            }}
          >
            変更履歴
          </h3>

          {statusHistory && statusHistory.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {statusHistory.map((history) => (
                <div
                  key={history.id}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#f2f2f0',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <StatusDot status={history.from_status || 'draft'} showLabel={false} />
                    <span style={{ color: '#888888', fontSize: '11px' }}>→</span>
                    <StatusDot status={history.to_status} />
                  </div>
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#888888',
                      fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                    }}
                  >
                    {history.profiles?.display_name || '不明'} · {formatDateTime(history.changed_at)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                fontSize: '12px',
                color: '#888888',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              }}
            >
              履歴がありません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
