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
    <>
      <div className="flex justify-between items-center py-[18px]">
        <h1 className="font-display text-[22px] font-semibold text-[#0a0a0a]">
          工場
        </h1>
        <Link
          href="/factories/new"
          className="bg-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[13px] font-medium font-body no-underline"
        >
          + 新規工場
        </Link>
      </div>

      {/* Factories Table */}
      <div className="bg-white rounded-[14px] border border-[rgba(0,0,0,0.06)] overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fafaf9] border-b border-[rgba(0,0,0,0.06)]">
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">工場名</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">都市</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">専門分野</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">評価</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider">連絡先</th>
              <th className="px-[14px] py-[10px] text-left text-[9px] font-medium text-[#b0b0b0] font-body uppercase tracking-wider w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {factories && factories.length > 0 ? (
              factories.map((factory, index) => (
                <tr
                  key={factory.id}
                  className={`${index < factories.length - 1 ? 'border-b border-[rgba(0,0,0,0.06)]' : ''} hover:bg-[#fcfcfb] transition-colors`}
                >
                  <td className="px-[14px] py-[12px]">
                    <Link
                      href={`/factories/${factory.id}`}
                      className="text-[#0a0a0a] no-underline font-medium text-[13px] font-body"
                    >
                      {factory.factory_name}
                    </Link>
                  </td>
                  <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                    {factory.address || '-'}
                  </td>
                  <td className="px-[14px] py-[12px]">
                    {factory.specialties && factory.specialties.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {factory.specialties.slice(0, 3).map((s: string, i: number) => (
                          <span
                            key={i}
                            className="bg-[#f2f2f0] px-2 py-[2px] rounded-full text-[11px] text-[#555] font-body"
                          >
                            {s}
                          </span>
                        ))}
                        {factory.specialties.length > 3 && (
                          <span className="text-[11px] text-[#888]">
                            +{factory.specialties.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-[14px] py-[12px] font-display text-[13px] text-[#0a0a0a] tabular-nums">
                    {factory.rating ? `${factory.rating.toFixed(1)}` : '-'}
                  </td>
                  <td className="px-[14px] py-[12px] text-[13px] text-[#0a0a0a] font-body">
                    {factory.contact_name || '-'}
                  </td>
                  <td className="px-[14px] py-[12px]">
                    <Link
                      href={`/factories/${factory.id}/edit`}
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
                  工場がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
