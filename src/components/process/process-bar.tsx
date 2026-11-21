import { PROCESS_STAGES, clampStage, stageLabel, type DaysLeft } from '@/lib/process/stages'

// 9工程の進み具合。過去=Cool Blue / 現在=Wasabi / 未来=Line（F&C D78）。
// 色だけに頼らず、必ず「3/9 工場見積」の語を添える。

export function ProcessDots({ stage }: { stage: number }) {
  const current = clampStage(stage)
  return (
    <span role="img" aria-label={`9工程中 ${current}番目: ${stageLabel(current)}`} className="inline-flex items-center gap-[3px] align-middle">
      {PROCESS_STAGES.map(s => (
        <span key={s.n} className={'h-[6px] w-[14px] rounded-full ' + (s.n < current ? 'bg-[#D7EFFF]' : s.n === current ? 'bg-[#E9F056]' : 'bg-[#E2E1DA]')} />
      ))}
    </span>
  )
}

export function ProcessCell({ stage }: { stage: number }) {
  const current = clampStage(stage)
  return (
    <span className="block">
      <ProcessDots stage={current} />
      <span className="block mt-1 text-[11px] text-[#351E28]"><span className="tabular-nums">{current} / 9</span> {stageLabel(current)}</span>
    </span>
  )
}

export function DaysLeftBadge({ value }: { value: DaysLeft }) {
  const cls = value.tone === 'over' ? 'bg-[#FFD8C2] text-[#B03616] border border-[#FF5C34]'
    : value.tone === 'soon' ? 'bg-[#FFD8C2] text-[#B03616]'
    : value.tone === 'ok' ? 'bg-[#D7EFFF] text-[#33566F]'
    : 'bg-[#EFEFEA] text-[#351E28] border border-[#E2E1DA]'
  return <span className={'inline-block whitespace-nowrap rounded-full px-2 py-[3px] text-[11px] font-bold tabular-nums ' + cls}>{value.text}</span>
}

/** 案件ヘッダー用の大きい版。工程名を全部並べる。 */
export function ProcessBar({ stage }: { stage: number }) {
  const current = clampStage(stage)
  return (
    <ol aria-label="工程の進み具合" className="grid grid-cols-9 gap-1">
      {PROCESS_STAGES.map(s => {
        const state = s.n < current ? 'past' : s.n === current ? 'now' : 'future'
        return (
          <li key={s.n} aria-current={state === 'now' ? 'step' : undefined} className="min-w-0">
            <span className={'block h-[6px] rounded-full ' + (state === 'past' ? 'bg-[#D7EFFF]' : state === 'now' ? 'bg-[#E9F056]' : 'bg-[#E2E1DA]')} />
            <span className={'mt-1 block truncate text-[11px] ' + (state === 'now' ? 'font-extrabold text-[#351E28]' : state === 'past' ? 'text-[#351E28]' : 'text-[#84787D]')}>
              <span className="tabular-nums">{s.n}</span><span className="hidden sm:inline"> {s.short}</span>
            </span>
            <span className="sr-only">{state === 'past' ? '完了' : state === 'now' ? '現在の工程' : 'これから'}</span>
          </li>
        )
      })}
    </ol>
  )
}
