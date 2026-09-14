ピル形の主要ボタン。画面の「次にやること」1つだけ `tone="main"`（Wasabi）にし、他は ghost にする。

```jsx
<Button tone="main" size="lg">この申請を承認する</Button>
<Button tone="ghost">下書き保存</Button>
<Button tone="danger">取り下げ</Button>
<Button disabled>承認する</Button>
```

- `tone`: main / dark / ghost / danger
- `size`: sm(6/16) / md(10/20) / lg(13/26)
- スマホの主要操作は `size="lg" fullWidth`（タップ44px確保）
