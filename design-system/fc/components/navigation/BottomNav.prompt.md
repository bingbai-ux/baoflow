スタッフ用スマホの固定ナビ。5タブ固定、Wasabiは使わない（作業エリアの1点を奪わないため）。

```jsx
<BottomNav activeId="home" onSelect={setScreen}
  items={[{ id: 'home', label: 'ホーム' }, { id: 'shift', label: 'シフト' },
    { id: 'punch', label: '打刻' }, { id: 'apply', label: '申請', badge: '1' }, { id: 'menu', label: 'メニュー' }]} />
```
