一覧を絞り込むためのチップ。画面見出しの右に横一列で置く。

```jsx
<div style={{ display: 'flex', gap: 'var(--fc-sp-1)' }}>
  <FilterChip active>すべて</FilterChip>
  <FilterChip>シフト</FilterChip>
  <FilterChip>休暇</FilterChip>
</div>
```

中身そのものを切り替えるなら FileTabs を使う（D80）。
