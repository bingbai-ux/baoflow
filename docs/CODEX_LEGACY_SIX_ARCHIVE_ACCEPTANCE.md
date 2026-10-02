# 指定旧6案件の除外・標準復元（2026-10-02）

ユーザーが旧データ削除を許可。親が範囲をPF-202602-001/003/004/005/006/007と専用関連データに限定し、標準復元可能なarchiveを優先する指示。全DB wipe、共有顧客/工場マスタ削除、仕様推測移行は対象外。

## 方式
既存archive_deal_safely(deal_id,true,'other',note)を既存営業/管理者の通常ログイン操作で呼ぶ。archived_at/by/reason/noteと履歴だけを更新し、仕様/見積/共有マスタは保持。状態を納品完了・取消に変換しない。現在案件一覧の「概要」→「アーカイブ・復元可能」へ既存modalを接続し、otherを初期理由にした。
通常復元は/archiveの「解除」→同じ既存RPCのfalse。バックアップRestoreを通常復元とは呼ばない。元工程・仕様・見積・金額が残る。再開履歴も追加される。営業管理者以外の実行は既存RPCが拒否。新role/RLS/grant/table/migration追加0。

## 除外の修正
通常案件一覧と顧客portalは既にarchived_at null限定。売上分析の採用見積金額/顧客別/工程別/月別がarchiveを含めていたためactive案件だけへ修正。dashboard平均粗利もactive案件ID集合で限定（全quote×全caseの走査を避ける）。archive/解除後にdashboard・analyticsをrevalidate。アーカイブした案件から発注は既存create_factory_order_atomicが拒否。
共有在庫・顧客/工場マスタや他案件は変更しない。アーカイブ一覧では保全した金額/履歴を閲覧・標準解除できる。old quote variantの欠損は補完せず、通常業務から対象案件ごと除外する。

## 実行前read-only依存確認
本番6件すべてactive、関連採用見積6、旧仕様6、既存status履歴18、共有顧客4。発注/帳票/RFQ/design filesは0。scopeは6codeの完全一致でありPF-202602-002/008や共有マスタを含めない。
本番変更は未実施。fresh backup/復元・以降書込差分gate確認後に、同tested候補のアプリを公開し、上記6件だけ通常機能でarchive、active対象0/archive対象6/旧quote6/spec6/元履歴18保全＋archive履歴6を確認する。重複archiveは既存RPCが履歴追加せずreturnする。archiveでは関連履歴を削除しない。

## ローカル受入
- SQL:6ケースarchive→標準RPC解除、quote/spec/master/status不変、archive/reopen履歴12、非staff拒否1 focused PASS。
- SQL:archiveされたケースの発注拒否→解除後の既存確認済見積から発注可能、拒否時quote不変1 focused PASS。
- 既存status/archive原子性・ロール・再試行1 focused PASS。
- 390px browser1 PASS:現行一覧→archive→一覧除外/analytics39600→0→/archive標準解除→一覧復帰/analytics39600、quote/client/factory不変。fixture browserと実SQLの役割を区別。本番受入ではない。
- lint/typecheck/build PASS。初回typecheckのテストquery結果型だけ修正し、最終版で再確認。

④のローカル実装/保全/復元受入は完了。本人の旧仕様原資料探し/初期データ分類判断はもう公開条件ではない。本番④の除外実行はbackup gate後に残る。永久deleteは行わず、新たな権限承認は不要。
