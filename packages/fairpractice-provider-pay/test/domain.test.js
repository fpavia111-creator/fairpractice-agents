// Domain checks: provider pay by work RVU.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkProviderPay, tieredPay } from '../src/logic.js';

const C = (provider, cpt, o = {}) => ({ provider, dos: o.dos || '2026-08-01', cpt, modifiers: o.mod || '', units: o.units ?? 1 });
const RV = [{ code: '99213', work_rvu: 1.3 }, { code: '20610', work_rvu: 0.8 }, { code: '20610', modifier: '50', work_rvu: 1.0 }, { code: '27447', work_rvu: 20 }];
const st = (r) => r.items.map((i) => i.status);

test('tiered pay is marginal', () => {
  const t = [{ up_to: 1000, rate: 45 }, { up_to: null, rate: 52 }];
  assert.equal(tieredPay(500, t), 22500);
  assert.equal(tieredPay(1000, t), 45000);
  assert.equal(tieredPay(1200, t), 55400);
  assert.equal(tieredPay(0, t), 0);
});

test('units multiply and modifier percentages apply', () => {
  const r = checkProviderPay([C('Ann Ay', '99213', { units: 2 }), C('Ann Ay', '27447', { mod: '50' }), C('Ann Ay', '27447', { mod: '80' })], RV);
  assert.equal(r.providers[0].wrvu, 35.8);
});

test('a modifier row in the RVU file wins over the percentage', () => {
  const r = checkProviderPay([C('Ann Ay', '20610', { mod: '50' })], RV);
  assert.equal(r.providers[0].wrvu, 1);
});

test('from and to filter by date of service', () => {
  const r = checkProviderPay([C('Ann Ay', '99213', { dos: '2026-06-30' }), C('Ann Ay', '99213'), C('Ann Ay', '99213', { dos: '2026-10-01' })], RV, { from: '2026-07-01', to: '2026-09-30' });
  assert.equal(r.providers[0].lines, 1);
});

test('missing codes and missing providers are flagged once each', () => {
  const r = checkProviderPay([C('Ann Ay', '99417'), C('Ann Ay', '99417', { units: 3 }), C('', '99213'), C(' ', '99213')], RV);
  assert.deepEqual(st(r), ['no_provider', 'no_rvu']);
  assert.equal(r.items[0].lines, 2); assert.equal(r.items[0].wrvu, 2.6);
  assert.equal(r.items[1].units, 4); assert.equal(r.items[1].lines, 2);
});

test('true-up and over-draw against draws; providers without draws are not flagged', () => {
  const ch = [...Array(10)].map(() => C('Rhea Lin MD', '27447')).concat([C('Sam Otto', '99213'), C('Nia Free', '99213')]);
  const r = checkProviderPay(ch, RV, { tiers: [{ up_to: null, rate: 50 }], providers: { 'Rhea Lin MD': { draws: 5000 }, 'sam otto': { draws: 1000 } } });
  assert.deepEqual(r.items.map((i) => [i.status, i.provider, i.amount]), [['draw_over_earned', 'Sam Otto', 935], ['true_up_owed', 'Rhea Lin MD', 5000]]);
  assert.equal(r.providers.length, 3);
});

test('a provider can have their own tiers', () => {
  const r = checkProviderPay([C('Ann Ay', '27447'), C('Bo Bee', '27447')], RV, { tiers: [{ up_to: null, rate: 10 }], providers: { 'Bo Bee': { tiers: [{ up_to: null, rate: 20 }] } } });
  assert.deepEqual(r.providers.map((p) => p.earned).sort(), [200, 400]);
  assert.equal(r.total_earned, 600);
});

test('the CMS RVU file layout: title rows, a STATUS "CODE" column and two "RVU" columns read as HCPCS and work RVU', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs'); const { join } = await import('node:path'); const { tmpdir } = await import('node:os');
  const { AgentRuntime } = await import('fairclaim-core'); const { manifest } = await import('../src/index.js');
  const dir = mkdtempSync(join(tmpdir(), 'pp-cms-'));
  try {
    writeFileSync(join(dir, 'rvu.csv'), [',,2026 National Physician Fee Schedule Relative Value File,,,,,', ',,,,,,,', ',,,STATUS,,WORK,NON-FAC,MP', 'HCPCS,MOD,DESCRIPTION,CODE,PAYMENT,RVU,PE RVU,RVU', '99213,,Office visit,A,,1.30,1.46,0.09', '99214,,Office visit,A,,1.92,2.00,0.14', ''].join('\n'));
    writeFileSync(join(dir, 'charges.csv'), 'Rendering Provider,Date of Service,CPT,Modifier,Units\nAna Ruiz,2026-07-01,99213,,1\nAna Ruiz,2026-07-02,99214,,1\n');
    writeFileSync(join(dir, 'plan.json'), JSON.stringify({ tiers: [{ rate: 50 }], providers: { 'Ana Ruiz': { draws: 161 } } }));
    const r = await new AgentRuntime(manifest, { root: dir, stateDir: null, audit: false, phi: 'off' }).call('providerpay_check', { charges: 'charges.csv', rvus: 'rvu.csv', settings: 'plan.json', from: '2026-07-01', to: '2026-07-31' });
    assert.equal(r.status, 'executed'); assert.equal(r.result.total_wrvu, 3.22); assert.deepEqual(r.result.items, []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
