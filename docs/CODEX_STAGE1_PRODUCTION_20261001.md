# 第1段UI：本番反映記録

2026-10-01。ユーザーのBAO本番反映明示承認により、本人画像添付待ちを公開停止条件から解除。作業中の第2段RFQ・候補migrationは含めない。

- PR: https://github.com/bingbai-ux/baoflow/pull/3 （MERGED）
- 検証済みUI commit: c3e0a026d0094feffcba9d7c615a11725a5c262c
- リモートmain: f5ae38655d54b8eaf3142badbcf4856b20f585ed
- 両commitのtree: 7b0f86c855beb4fa6724900122a225afa760b3ae （一致）
- Vercel本番: dpl_7BBGAEx1nfrL3g7sqBCvp4nReWpL、READY、target production、main SHA一致。
- alias: https://baoflow.vercel.app、aliasError null。
- 本番読取smoke: /login 200、/deals と /deals/new は未認証307。ログイン後の本番業務画面・実取引は未検証。
- 第1段のDB migration/権限/env変更: なし。
- 戻し先: dpl_25F3EMF4JhCvQ5jQrVZEHonAUBWU（main44eb、READY）。通常Vercelのrollbackでapp aliasを戻す。第1段はDB差分なし。

第1段のローカル画面と回帰結果は artifacts/case-workspace/README.md。Library保存と親への画像配信は未完了で、配信済み・本人現物確認済みとは扱わない。本番を開いてユーザー自身が新しいUIを確認できる状態になった。メール設定/本番到達まで合格とは扱わない。
