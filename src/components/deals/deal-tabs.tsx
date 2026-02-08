'use client'

import { useState } from 'react'

interface Tab {
  id: string
  label: string
}

interface DealTabsProps {
  tabs: Tab[]
  defaultTab?: string
  children: (activeTab: string) => React.ReactNode
}

export function DealTabs({ tabs, defaultTab, children }: DealTabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              borderRadius: '9999px',
              fontSize: '13px',
              border: 'none',
              cursor: 'pointer',
              fontFamily: activeTab === tab.id
                ? "'Fraunces', serif"
                : "'Zen Kaku Gothic New', system-ui, sans-serif",
              fontWeight: activeTab === tab.id ? 600 : 400,
              backgroundColor: activeTab === tab.id ? '#0a0a0a' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : '#888888',
              transition: 'all 0.15s ease',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {children(activeTab)}
      </div>
    </div>
  )
}
