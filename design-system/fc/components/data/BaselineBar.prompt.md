「線に対してどこにいるか」を1本で見せる。人件費の予算、有給5日の義務など。

```jsx
<BaselineBar value={78} baseline={100} tone="now" />   {/* 予算内 */}
<BaselineBar value={20} baseline={50} tone="warn" />   {/* 義務5日に未達 */}
```

必ず「黒線＝予算 ¥530,000」のような説明を添える。バー単独では意味が伝わらない。
