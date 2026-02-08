'use client'

import { useState, useEffect } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
}

export function PageHeader({ title, subtitle }: PageHeaderProps) {
  const [dateStr, setDateStr] = useState('')

  useEffect(() => {
    const now = new Date()
    setDateStr(now.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }))
  }, [])

  return (
    <div className="py-[18px]">
      <div className="text-[11px] text-[#bbb] font-display mb-[2px]">
        {subtitle || dateStr || '\u00A0'}
      </div>
      <h1 className="text-[36px] font-black m-0 tracking-[-0.02em] font-display leading-[1.05] text-[#0a0a0a] flex items-center">
        {title}
        <span className="inline-block w-[80px] h-[2px] bg-[#e8e8e6] ml-3" />
      </h1>
    </div>
  )
}
