import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { StatusDot } from '@/components/status-dot'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FactoryDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: factory } = await supabase
    .from('factories')
    .select('*')
    .eq('id', id)
    .single()

  if (!factory) {
    notFound()
  }

  // Get deals for this factory
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('factory_id', id)
    .order('created_at', { ascending: false })

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1
            style={{
              fontFamily: "'Fraunces', serif",
              fontSize: '24px',
              fontWeight: 600,
              color: '#0a0a0a',
            }}
          >
            {factory.name}
          </h1>
          {factory.rating && (
            <span
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: '14px',
                color: '#22c55e',
                fontWeight: 500,
              }}
            >
              {factory.rating.toFixed(1)}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/factories/${id}/edit`}
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
            href="/factories"
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
        {/* Factory Info Card */}
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
            工場情報
          </h2>

          <div style={infoRowStyle}>
            <div style={labelCellStyle}>工場名</div>
            <div style={valueCellStyle}>{factory.name}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>所在地</div>
            <div style={valueCellStyle}>
              {factory.city ? `${factory.city}, ${factory.country}` : factory.country}
            </div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>専門分野</div>
            <div style={valueCellStyle}>
              {factory.specialties && factory.specialties.length > 0 ? (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {factory.specialties.map((s: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        backgroundColor: '#f2f2f0',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        color: '#555555',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                '-'
              )}
            </div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>支払い条件</div>
            <div style={valueCellStyle}>{factory.payment_terms || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>担当者</div>
            <div style={valueCellStyle}>{factory.contact_name || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>メール</div>
            <div style={valueCellStyle}>{factory.contact_email || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>WeChat</div>
            <div style={valueCellStyle}>{factory.contact_wechat || '-'}</div>
          </div>
          <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
            <div style={labelCellStyle}>備考</div>
            <div style={valueCellStyle}>{factory.notes || '-'}</div>
          </div>
        </div>

        {/* Factory Deals Card */}
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
            案件一覧
          </h2>

          {deals && deals.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {deals.map((deal) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 14px',
                    backgroundColor: '#f2f2f0',
                    borderRadius: '10px',
                    textDecoration: 'none',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontFamily: "'Fraunces', serif",
                        fontSize: '13px',
                        fontWeight: 500,
                        color: '#0a0a0a',
                        marginBottom: '4px',
                      }}
                    >
                      {deal.deal_number}
                    </div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#555555',
                        fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                      }}
                    >
                      {deal.product_name}
                    </div>
                  </div>
                  <StatusDot status={deal.status} />
                </Link>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '20px',
                textAlign: 'center',
                color: '#888888',
                fontSize: '13px',
                fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
              }}
            >
              案件がありません
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
