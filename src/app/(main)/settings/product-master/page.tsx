import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { listCatalog } from '@/lib/actions/catalog'
import { listOptionItems } from '@/lib/actions/product-master'
import { ProductMaster } from '@/components/process/product-master'

// 再設計 工程2: 設定 > 商品マスター。商品登録で「押して選ぶ」選択肢をここで作る。

export default async function ProductMasterPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const [catalog, options] = await Promise.all([listCatalog(), listOptionItems()])
  return (
    <div className="mx-auto max-w-[920px] space-y-4 py-4">
      <Link href="/settings" className="inline-flex min-h-[44px] items-center text-[12.5px] text-[#84787D] no-underline hover:text-[#351E28]">← 設定にもどる</Link>
      <div><h1 className="text-[21px] font-extrabold">商品マスター</h1>
        <p className="mt-1 text-[12.5px] text-[#84787D]">商品登録の画面で選べる選択肢です。ここで足した項目は、すぐに商品登録で選べるようになります。</p></div>
      <ProductMaster catalog={catalog} options={options} />
    </div>
  )
}
