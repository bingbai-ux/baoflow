一覧画面の基本形。フローのピル連結は使わず、状態を列に固定して縦に走査できるようにする。

```jsx
<DataTable
  columns={[{ label: 'スタッフ', width: '120px' }, { label: '取得/付与', align: 'right', numeric: true }, { label: '状態', width: '104px' }]}
  rows={[{ cells: ['高橋 みなみ', '2 / 10日', <Badge tone="hot">要対応</Badge>], alert: true }]}
  footer="21名中 6名を表示" />
```

要対応の行は `alert` で行ごと Orange Tint に。文字色だけで警告を出さない。
