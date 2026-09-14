中身を切り替えるタブ。パネルと一体（左上だけ角が立つ）。

```jsx
<FileTabs tabs={['評価シート', '給与テーブル', '改訂の遍歴']} value={tab} onChange={setTab}>
  <KVTable rows={rows} />
</FileTabs>
```

絞り込みは FilterChip。
