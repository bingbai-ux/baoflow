import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function FactoriesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: factories } = await supabase
    .from('factories')
    .select('*')
    .order('created_at', { ascending: false })

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
          Factories
        </h1>
        <Link
          href="/factories/new"
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
          + 新規工場
        </Link>
      </div>

      {/* Factories Table */}
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '20px',
          border: '1px solid rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr
              style={{
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <th style={headerCellStyle}>工場名</th>
              <th style={headerCellStyle}>都市</th>
              <th style={headerCellStyle}>専門分野</th>
              <th style={headerCellStyle}>評価</th>
              <th style={headerCellStyle}>連絡先</th>
              <th style={{ ...headerCellStyle, width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {factories && factories.length > 0 ? (
              factories.map((factory) => (
                <tr
                  key={factory.id}
                  style={{
                    borderBottom: '1px solid rgba(0,0,0,0.06)',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  <td style={cellStyle}>
                    <Link
                      href={`/factories/${factory.id}`}
                      style={{
                        color: '#0a0a0a',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      {factory.name}
                    </Link>
                  </td>
                  <td style={cellStyle}>
                    {factory.city ? `${factory.city}, ${factory.country}` : factory.country}
                  </td>
                  <td style={cellStyle}>
                    {factory.specialties && factory.specialties.length > 0 ? (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {factory.specialties.slice(0, 3).map((s: string, i: number) => (
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
                        {factory.specialties.length > 3 && (
                          <span style={{ fontSize: '11px', color: '#888888' }}>
                            +{factory.specialties.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: "'Fraunces', serif" }}>
                    {factory.rating ? `${factory.rating.toFixed(1)}` : '-'}
                  </td>
                  <td style={cellStyle}>
                    {factory.contact_email || factory.contact_wechat || '-'}
                  </td>
                  <td style={cellStyle}>
                    <Link
                      href={`/factories/${factory.id}/edit`}
                      style={{
                        color: '#888888',
                        fontSize: '12px',
                        textDecoration: 'none',
                      }}
                    >
                      編集
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    padding: '40px 14px',
                    textAlign: 'center',
                    color: '#888888',
                    fontSize: '13px',
                    fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
                  }}
                >
                  工場がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const headerCellStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 500,
  color: '#bbbbbb',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: '#0a0a0a',
  fontFamily: "'Zen Kaku Gothic New', system-ui, sans-serif",
}
