管理画面（店長・本社）の左ナビ。項目が15を超えるときだけ sub を足す。

```jsx
<Sidebar hub="HR HUB" roleLabel="本社・人事" activeId="leave" onSelect={setId}
  items={[
    { kind: 'category', label: '法令・勤怠' },
    { kind: 'item', id: 'leave', label: '有給5日ダッシュボード', badge: '3' },
    { kind: 'item', id: 'closing', label: '月次締めフロー', badge: '4' },
  ]}
  footer={<UserChip name="森田 かおり" role="本社 人事" face="森" />} />
```

Cassis面の上では文字は Cassis Tint、補助は Cassis Soft。白文字は使わない。
