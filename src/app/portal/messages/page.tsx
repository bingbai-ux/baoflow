import Link from 'next/link'
import {PortalShell} from '@/components/external/portal-shell'
import {CaseChat} from '@/components/chat/case-chat'
export default function Messages(){return <PortalShell title="営業との案件別会話" loginPath="/portal/login" userLabel={null}><Link href="/portal" className="underline inline-flex min-h-11 items-center">業務一覧へ戻る</Link><div className="bg-white border border-[#E2E1DA] rounded-card p-4 mt-3"><CaseChat/></div></PortalShell>}
