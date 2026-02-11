import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils/format'
import { StatusDot } from '@/components/deals/status-dot'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClientDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .single()

  if (!client) {
    notFound()
  }

  // Get deals for this client
  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('client_id', id)
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
        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: '24px',
            fontWeight: 600,
            color: '#0a0a0a',
          }}
        >
          {client.company_name}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Link
            href={`/clients/${id}/edit`}
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
            href="/clients"
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
        {/* Client Info Card */}
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
            顧客情報
          </h2>

          <div style={infoRowStyle}>
            <div style={labelCellStyle}>会社名</div>
            <div style={valueCellStyle}>{client.company_name}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>担当者</div>
            <div style={valueCellStyle}>{client.contact_name || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>メール</div>
            <div style={valueCellStyle}>{client.email || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>電話</div>
            <div style={valueCellStyle}>{client.phone || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>住所</div>
            <div style={valueCellStyle}>{client.address || '-'}</div>
          </div>
          <div style={infoRowStyle}>
            <div style={labelCellStyle}>登録日</div>
            <div style={{ ...valueCellStyle, fontFamily: "'Fraunces', serif", fontVariantNumeric: 'tabular-nums' }}>
              {formatDate(client.created_at)}
            </div>
          </div>
          <div style={{ ...infoRowStyle, borderBottom: 'none' }}>
            <div style={labelCellStyle}>備考</div>
            <div style={valueCellStyle}>{client.notes || '-'}</div>
          </div>
        </div>

        {/* Client Deals Card */}
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
