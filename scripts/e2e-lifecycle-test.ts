import { createClient } from '@supabase/supabase-js';

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test results
const results: { step: string; status: 'PASS' | 'FAIL'; detail: string }[] = [];

function log(step: string, status: 'PASS' | 'FAIL', detail: string) {
  results.push({ step, status, detail });
  console.log(`${status === 'PASS' ? '✅' : '❌'} ${step}: ${detail}`);
}

async function setup() {
  // 1. Test client
  let { data: client } = await supabase.from('clients').select('*').limit(1).single();
  if (!client) {
    const { data, error } = await supabase.from('clients').insert({
      company_name: 'テスト株式会社',
      contact_name: '田中太郎',
      email: 'test@example.com',
    }).select().single();
    if (error) {
      log('Setup Client', 'FAIL', error.message);
      throw new Error('Failed to create client');
    }
    client = data;
  }
  log('Setup Client', 'PASS', `${client.company_name} (${client.id})`);

  // 2. Test factory
  let { data: factory } = await supabase.from('factories').select('*').limit(1).single();
  if (!factory) {
    const { data, error } = await supabase.from('factories').insert({
      factory_name: '深圳テスト工場',
      address: '深圳市',
    }).select().single();
    if (error) {
      log('Setup Factory', 'FAIL', error.message);
      throw new Error('Failed to create factory');
    }
    factory = data;
  }
  log('Setup Factory', 'PASS', `${factory.factory_name} (${factory.id})`);

  // 3. Test profile
  let { data: profile } = await supabase.from('profiles').select('*').limit(1).single();
  log('Setup Profile', profile ? 'PASS' : 'FAIL', `${profile?.display_name || 'NOT FOUND (will use null)'}`);

  return { client, factory, profile };
}

async function updateAndVerify(dealId: string, status: string, label: string) {
  const { error } = await supabase.from('deals')
    .update({ master_status: status, updated_at: new Date().toISOString() })
    .eq('id', dealId);

  if (error) {
    log(`${status} ${label}`, 'FAIL', `Update error: ${error.message}`);
    return false;
  }

  const { data } = await supabase.from('deals').select('master_status').eq('id', dealId).single();
  if (data?.master_status === status) {
    log(`${status} ${label}`, 'PASS', 'Status updated correctly');
    return true;
  } else {
    log(`${status} ${label}`, 'FAIL', `Expected ${status}, got ${data?.master_status}`);
    return false;
  }
}

async function runLifecycleTest() {
  console.log('\n============================');
  console.log('M01→M25 ライフサイクルテスト開始');
  console.log('============================\n');

  const { client, factory, profile } = await setup();

  // ========== M01: 案件作成 ==========
  const dealCode = `TEST-${Date.now()}`;
  const { data: deal, error: dealError } = await supabase.from('deals').insert({
    deal_code: dealCode,
    deal_name: 'E2Eテスト案件',
    client_id: client.id,
    sales_user_id: profile?.id || null,
    master_status: 'M01',
    win_probability: 'medium',
  }).select().single();

  if (dealError || !deal) {
    log('M01 案件作成', 'FAIL', `Error: ${dealError?.message}`);
    return { passed: 0, failed: 1 };
  }
  log('M01 案件作成', 'PASS', `Deal: ${deal.deal_code} (${deal.id})`);

  const dealId = deal.id;

  // deal_specifications を作成
  const { error: specError } = await supabase.from('deal_specifications').insert({
    deal_id: dealId,
    product_category: 'pouch',
    product_name: 'テストパウチ 100g',
  });
  log('M01 仕様作成', specError ? 'FAIL' : 'PASS', specError?.message || 'OK');

  // ========== M02: 営業確認 ==========
  await updateAndVerify(dealId, 'M02', '営業確認');

  // ========== M03: 工場依頼 ==========
  const { error: assignError } = await supabase.from('deal_factory_assignments').insert({
    deal_id: dealId,
    factory_id: factory.id,
    status: 'requesting',
  });
  log('M03 工場割当', assignError ? 'FAIL' : 'PASS', assignError?.message || 'OK');
  await updateAndVerify(dealId, 'M03', '工場依頼');

  // ========== M04: 回答待ち ==========
  await updateAndVerify(dealId, 'M04', '回答待ち');

  // ========== M05: 回答受領 ==========
  const { error: quoteError } = await supabase.from('deal_quotes').insert({
    deal_id: dealId,
    factory_id: factory.id,
    quantity: 5000,
    factory_unit_price_usd: 0.15,
    moq: 3000,
    status: 'drafting',
  });
  log('M05 見積もり回答', quoteError ? 'FAIL' : 'PASS', quoteError?.message || 'OK');
  await updateAndVerify(dealId, 'M05', '回答受領');

  // ========== M06: 見積もり提示 ==========
  const { error: quoteUpdateError } = await supabase.from('deal_quotes')
    .update({
      selling_price_jpy: 50,
      total_billing_jpy: 250000,
      total_billing_tax_jpy: 275000,
      exchange_rate: 153,
      status: 'presented',
    })
    .eq('deal_id', dealId);
  log('M06 見積もり提示', quoteUpdateError ? 'FAIL' : 'PASS', quoteUpdateError?.message || 'OK');
  await updateAndVerify(dealId, 'M06', '見積もり提示');

  // ========== M07-M10: 検討中 ==========
  await updateAndVerify(dealId, 'M07', '検討中');

  // ========== M11: 承認 ==========
  await updateAndVerify(dealId, 'M11', '承認');

  // ========== M12: 請求書発行 ==========
  await updateAndVerify(dealId, 'M12', '請求書発行');

  // ========== M13: 入金待ち ==========
  await updateAndVerify(dealId, 'M13', '入金待ち');

  // ========== M14: 入金確認 ==========
  const { error: txError } = await supabase.from('transactions').insert({
    deal_ids: [dealId],
    direction: 'in',
    amount_jpy: 275000,
    payment_method: 'bank_transfer',
    status: 'completed',
    occurred_at: new Date().toISOString(),
  });
  log('M14 入金記録', txError ? 'FAIL' : 'PASS', txError?.message || 'OK');
  await updateAndVerify(dealId, 'M14', '入金確認');

  // ========== M15: 工場前払い ==========
  const { error: factoryPayError } = await supabase.from('deal_factory_payments').insert({
    deal_id: dealId,
    factory_id: factory.id,
    payment_type: 'advance',
    amount_usd: 375,
    status: 'paid',
  });
  log('M15 工場支払い', factoryPayError ? 'FAIL' : 'PASS', factoryPayError?.message || 'OK');
  await updateAndVerify(dealId, 'M15', '工場前払い');

  // ========== M16-M19: 製造 ==========
  await updateAndVerify(dealId, 'M16', '製造待ち');
  await updateAndVerify(dealId, 'M17', '製造開始');
  await updateAndVerify(dealId, 'M18', '製造中');
  await updateAndVerify(dealId, 'M19', '完了検品');

  // ========== M20: 残金支払い ==========
  const { error: balanceError } = await supabase.from('deal_factory_payments').insert({
    deal_id: dealId,
    factory_id: factory.id,
    payment_type: 'balance',
    amount_usd: 375,
    status: 'paid',
  });
  log('M20 残金支払い', balanceError ? 'FAIL' : 'PASS', balanceError?.message || 'OK');
  await updateAndVerify(dealId, 'M20', '残金支払い');

  // ========== M21: 発送準備 ==========
  const { error: shipError } = await supabase.from('deal_shipping').insert({
    deal_id: dealId,
    delivery_type: 'direct',
  });
  log('M21 出荷レコード', shipError ? 'FAIL' : 'PASS', shipError?.message || 'OK');
  await updateAndVerify(dealId, 'M21', '発送準備');

  // ========== M22: 発送済み ==========
  const { error: trackError } = await supabase.from('deal_shipping')
    .update({
      tracking_number: 'TEST-TRACK-12345',
      tracking_url: 'https://17track.net/en/track#nums=TEST-TRACK-12345',
    })
    .eq('deal_id', dealId);
  log('M22 トラッキング', trackError ? 'FAIL' : 'PASS', trackError?.message || 'OK');
  await updateAndVerify(dealId, 'M22', '発送済み');

  // ========== M23: 輸送中 ==========
  await updateAndVerify(dealId, 'M23', '輸送中');

  // ========== M24: 到着検品 ==========
  await updateAndVerify(dealId, 'M24', '到着検品');

  // ========== M25: 納品完了 ==========
  await updateAndVerify(dealId, 'M25', '納品完了');

  // ========== 最終検証 ==========
  const { data: finalDeal } = await supabase.from('deals')
    .select(`
      *,
      client:clients(*),
      specifications:deal_specifications(*),
      quotes:deal_quotes(*),
      shipping:deal_shipping(*)
    `)
    .eq('id', dealId)
    .single();

  if (finalDeal) {
    log('最終検証', 'PASS', `Status: ${finalDeal.master_status}, Client: ${finalDeal.client?.company_name}`);
    log('最終検証 仕様', finalDeal.specifications?.length > 0 ? 'PASS' : 'FAIL', `${finalDeal.specifications?.length || 0} specs`);
    log('最終検証 見積もり', finalDeal.quotes?.length > 0 ? 'PASS' : 'FAIL', `${finalDeal.quotes?.length || 0} quotes`);
    log('最終検証 出荷', finalDeal.shipping?.length > 0 ? 'PASS' : 'FAIL', `${finalDeal.shipping?.length || 0} shipments`);
  }

  // ========== テスト結果サマリー ==========
  console.log('\n============================');
  console.log('テスト結果サマリー');
  console.log('============================');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`✅ PASS: ${passed}`);
  console.log(`❌ FAIL: ${failed}`);
  console.log(`合計: ${results.length}`);

  if (failed > 0) {
    console.log('\n失敗した項目:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ ${r.step}: ${r.detail}`);
    });
  }

  // テストデータのクリーンアップ
  console.log('\nテストデータのクリーンアップ...');
  await supabase.from('deal_shipping').delete().eq('deal_id', dealId);
  await supabase.from('deal_factory_payments').delete().eq('deal_id', dealId);
  await supabase.from('deal_factory_assignments').delete().eq('deal_id', dealId);
  await supabase.from('deal_quotes').delete().eq('deal_id', dealId);
  await supabase.from('deal_specifications').delete().eq('deal_id', dealId);
  await supabase.from('transactions').delete().contains('deal_ids', [dealId]);
  await supabase.from('deals').delete().eq('id', dealId);
  console.log('クリーンアップ完了');

  return { passed, failed };
}

runLifecycleTest()
  .then(({ passed, failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  })
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
