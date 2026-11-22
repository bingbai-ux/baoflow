import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAiJson } from '../src/lib/ai/claude'
import { tidyCandidates } from '../src/lib/process/catalog-import'

// AIの返答の読み取りと、カタログ取込の候補の整理（登録済みを外す・形の崩れに耐える）。

test('AIの返答から JSON を取り出す。前後に説明や ``` が付いていても読み、読めなければ例外', () => {
  assert.deepEqual(parseAiJson('以下です。\n```json\n{"a":[1,2]}\n```\n以上'), { a: [1, 2] })
  assert.throws(() => parseAiJson('候補はありません'), /読み取れませんでした/)
  assert.throws(() => parseAiJson('{"a": [1,}'), /読み取れませんでした/)
})

test('カタログの候補: 登録済み・重複・空を外し、形が崩れた返答でも落ちない', () => {
  const existing = { catalog: [{ id: 'b', level: 1, parent_id: null, name: '袋' }, { id: 's', level: 2, parent_id: 'b', name: 'スタンド袋' }, { id: 'z', level: 3, parent_id: 's', name: 'ジップ付きスタンド' }],
    options: [{ kind: 'material', name: 'クラフト紙' }, { kind: 'print_colors', name: '1色' }, { kind: 'accessory', name: 'バルブ' }] }
  const r = tidyCandidates({ categories: [{ l1: '袋', l2: 'スタンド袋', l3: 'ジップ付きスタンド' }, { l1: '袋', l2: 'スタンド袋', l3: null }, { l1: '袋', l2: 'ガゼット袋' }, { l1: '袋', l2: 'ガゼット袋', l3: null },
    { l1: ' カップ ', l2: null, l3: '二重断熱' }, { l1: '', l2: '迷子' }, 'ごみ', null], materials: ['クラフト紙', 'ｸﾗﾌﾄ紙', 'アルミ蒸着', 'アルミ蒸着', 5, ''], print_colors: '1色', accessories: ['バルブ', '窓'] }, existing)
  assert.deepEqual(r.categories, [{ l1: '袋', l2: 'ガゼット袋', l3: null }, { l1: 'カップ', l2: null, l3: null }], '登録済みの階層は外す。形状が無いディテールは捨てる')
  assert.deepEqual([r.materials, r.print_colors, r.accessories], [['アルミ蒸着'], [], ['窓']], '全角半角の違いだけの同じ名前も登録済みとして外す')
  assert.deepEqual(tidyCandidates(null, existing), { categories: [], materials: [], print_colors: [], accessories: [] })
})
