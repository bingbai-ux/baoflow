Input / Select / Textarea を包むラベル枠。

```jsx
<Field label="メールアドレス" required error help="「@」以降を確認してください。">
  <Input value={v} invalid onChange={...} />
</Field>
```

エラー文は原因ではなく直し方を書く（「形式が不正です」→「@以降を確認してください」）。
