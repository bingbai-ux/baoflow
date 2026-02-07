import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/header'
import Link from 'next/link'

export default async function RegistryPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  // Get products
  const { data: products } = await supabase
    .from('product_registry')
    .select(`
      *,
      factories (id, name)
    `)
    .eq('is_active', true)
    .order('product_code')

  const allProducts = products || []

  // Get factories for dropdown
  const { data: factories } = await supabase
    .from('factories')
    .select('id, name')
    .order('name')

  const allFactories = factories || []

  return (
    <div style={{ minHeight: '100vh', background: '#f2f2f0' }}>
      <Header userName={profile?.display_name || user.email || undefined} />

      <div style={{ padding: '24px 26px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: '#bbbbbb',
                fontFamily: "'Fraunces', serif",
                marginBottom: 2,
              }}
            >
              Product Master
            </div>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                margin: 0,
                letterSpacing: '-0.02em',
                fontFamily: "'Fraunces', serif",
                color: '#0a0a0a',
              }}
            >
              品目登録台帳
            </h1>
          </div>
          <Link
            href="/registry/new"
            style={{
              backgroundColor: '#0a0a0a',
              color: '#ffffff',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            新規登録
          </Link>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 8 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: '#888888', marginBottom: 4 }}>登録品目数</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
              {allProducts.length}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: '#888888', marginBottom: 4 }}>カテゴリー数</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
              {new Set(allProducts.map(p => p.category).filter(Boolean)).size}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: '#888888', marginBottom: 4 }}>取扱工場数</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
              {new Set(allProducts.map(p => p.factory_id).filter(Boolean)).size}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={{ fontSize: 11, color: '#888888', marginBottom: 4 }}>平均単価 (CNY)</div>
            <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Fraunces', serif" }}>
              ¥{allProducts.length > 0
                ? (allProducts.reduce((sum, p) => sum + (p.last_price_cny || 0), 0) / allProducts.length).toFixed(2)
                : '0.00'}
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#0a0a0a', fontFamily: "'Fraunces', serif" }}>
              登録品目一覧
            </span>
          </div>

          {allProducts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888888', fontSize: 13 }}>
              登録されている品目がありません
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <th style={thStyle}>品目コード</th>
                  <th style={thStyle}>品目名</th>
                  <th style={thStyle}>カテゴリー</th>
                  <th style={thStyle}>材質</th>
                  <th style={thStyle}>工場</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>最新単価</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>平均単価</th>
                  <th style={thStyle}>最終取引日</th>
                </tr>
              </thead>
              <tbody>
                {allProducts.map((product, i) => (
                  <tr
                    key={product.id}
                    style={{
                      borderBottom: i < allProducts.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    }}
                  >
                    <td style={tdStyle}>
                      <Link
                        href={`/registry/${product.id}`}
                        style={{
                          color: '#bbbbbb',
                          textDecoration: 'none',
                          fontFamily: "'Fraunces', serif",
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {product.product_code}
                      </Link>
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: '#0a0a0a' }}>
                      {product.product_name}
                    </td>
                    <td style={tdStyle}>{product.category || '-'}</td>
                    <td style={tdStyle}>{product.material || '-'}</td>
                    <td style={tdStyle}>{product.factories?.name || '-'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Fraunces', serif" }}>
                      {product.last_price_cny ? `¥${product.last_price_cny}` : '-'}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right', fontFamily: "'Fraunces', serif" }}>
                      {product.average_price_cny ? `¥${product.average_price_cny}` : '-'}
                    </td>
                    <td style={tdStyle}>
                      {product.last_price_date
                        ? new Date(product.last_price_date).toLocaleDateString('ja-JP')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#ffffff',
  borderRadius: 20,
  border: '1px solid rgba(0,0,0,0.06)',
  padding: '20px 22px',
}

const thStyle: React.CSSProperties = {
  padding: '10px 14px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 500,
  color: '#bbbbbb',
}

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: 12,
  color: '#888888',
}
