import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Header } from '@/components/layout/header'
import { PageHeader } from '@/components/layout/page-header'
import { formatDate } from '@/lib/utils/format'

export default async function ClientsPage() {
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

  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[#f2f2f0]">
      <Header userName={profile?.display_name || user.email || undefined} />

      <main className="px-[26px] pb-10">
        <div className="flex justify-between items-center py-[18px]">
          <PageHeader title="Clients" />
          <Link
            href="/clients/new"
            className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
          >
            + 新規顧客
          </Link>
        </div>

        {/* Clients Table */}
        <div className="bg-white rounded-[20px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.06)]">
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">会社名</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">担当者</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">メール</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">電話</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body">登録日</th>
                <th className="px-[14px] py-[10px] text-left text-[11px] font-medium text-[#bbb] font-body w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {clients && clients.length > 0 ? (
                clients.map((client, index) => (
                  <tr
                    key={client.id}
                    className={`${index < clients.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors`}
                  >
                    <td className="px-[14px] py-[12px]">
                      <Link
                        href={`/clients/${client.id}`}
                        className="text-[#0a0a0a] no-underline font-medium text-[13px] font-body"
                      >
                        {client.company_name}
                      </Link>
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {client.contact_name || '-'}
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {client.email || '-'}
                    </td>
                    <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                      {client.phone || '-'}
                    </td>
                    <td className="px-[14px] py-[12px] font-display text-[13px] text-[#0a0a0a] tabular-nums">
                      {formatDate(client.created_at)}
                    </td>
                    <td className="px-[14px] py-[12px]">
                      <Link
                        href={`/clients/${client.id}/edit`}
                        className="text-[#888] text-[12px] no-underline font-body"
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
                    className="px-[14px] py-[40px] text-center text-[13px] text-[#888] font-body"
                  >
                    顧客がありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
