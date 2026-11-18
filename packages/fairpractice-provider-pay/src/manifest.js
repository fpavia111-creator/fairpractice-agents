import { readFileSync } from 'node:fs';
import { medAgent, fileArg, DATE_ARG, PATIENT_ID, PATIENT_NAME, PROVIDER, CPT, MODIFIER_COL, UNITS, DOS, KESTREL_LIMITS } from 'fairpractice-core';
import { checkProviderPay, DEFAULT_MODIFIER_PCT } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });

export const CHARGE_FIELDS = Object.freeze({ provider: PROVIDER, dos: DOS, cpt: { ...CPT, required: true }, modifiers: MODIFIER_COL, units: UNITS, patient_id: PATIENT_ID, patient_name: PATIENT_NAME });
export const RVU_FIELDS = Object.freeze({ code: t(['Code', 'HCPCS', 'CPT', 'CPT/HCPCS'], { translate: false, required: true }), modifier: t(['Modifier', 'Mod'], { translate: false }), work_rvu: t(['Work RVU', 'wRVU', 'Work', 'RVU'], { type: 'number', required: true }) });

const TIERS = { type: 'array', minItems: 1, maxItems: 20, items: { type: 'object', additionalProperties: false, required: ['rate'], properties: { up_to: { type: ['number', 'null'], minimum: 0 }, rate: { type: 'number', minimum: 0 } } } };
const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  tiers: { ...TIERS, description: 'Default pay per wRVU by marginal tier: [{ "up_to": 1000, "rate": 45 }, { "rate": 52 }]' },
  providers: { type: 'object', additionalProperties: { type: 'object', additionalProperties: false, properties: { tiers: TIERS, draws: { type: 'number', minimum: 0, description: 'Draws paid in the period' } } }, description: 'Per-provider tiers and draws paid, by provider name' },
  modifier_pct: { type: 'object', additionalProperties: { type: 'number', minimum: 0, maximum: 300 }, description: 'Percent of the work RVU credited with a modifier, when the RVU file has no row for it; replaces the default (50: 150, 51: 50, 62: 62.5, 80/82/AS: 16)' },
} };
const args = {
  charges: fileArg('Charge lines under --root: rendering provider, date of service, code, modifiers, units'),
  rvus: fileArg('Your RVU file: code, modifier (optional), work RVU (from the CMS file year your plan uses)'),
  settings: fileArg('Settings JSON with the comp plan: tiers, providers (tiers, draws), modifier_pct'),
  from: DATE_ARG('First date of service in the period (YYYY-MM-DD)'),
  to: DATE_ARG('Last date of service in the period (YYYY-MM-DD)'),
};
const run = (a, ctx) => { const s = a.settings ? ctx.readJson(a.settings, 'providerpay_settings') : {}; return checkProviderPay(ctx.records(a.charges, 'charges'), ctx.records(a.rvus, 'rvus'), { tiers: s.tiers || [{ up_to: null, rate: 0 }], providers: s.providers || {}, modifierPct: s.modifier_pct || DEFAULT_MODIFIER_PCT, from: a.from || null, to: a.to || null }); };
const summary = (o) => `${o.providers.length} provider(s), ${o.total_wrvu} wRVUs, ${o.total_earned} earned under the plan. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'providerpay', title: 'Fairpractice Provider Pay',
  description: 'Works out provider pay by work RVU: wRVUs per provider from charges and your RVU file (with modifier adjustments), pay under tiered rates, and the true-up against draws paid, plus codes with no RVU and charges with no rendering provider. Patient names on charges are masked before results reach the model.',
  args, required: ['charges', 'rvus', 'settings'],
  sources: { charges: { label: 'Charges', args: ['charges'], fields: CHARGE_FIELDS }, rvus: { label: 'RVU file', args: ['rvus'], fields: RVU_FIELDS } },
  configSchemas: { providerpay_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Calculate wRVU pay and true-up', description: 'List charges with no provider, codes with no RVU, and each provider\'s true-up against draws.' },
  report: {
    title: { en: 'Provider wRVU pay and true-up', es: 'Pago por wRVU y ajuste de anticipos', de: 'Vergütung nach wRVU und Ausgleich', fr: 'Rémunération par wRVU et régularisation', pt: 'Pagamento por wRVU e ajuste', it: 'Compenso per wRVU e conguaglio', ja: 'wRVU 報酬と精算', zh: 'wRVU 薪酬与结算', ko: 'wRVU 보상 및 정산' },
    base: 'providerpay-provider-pay',
    rows: (o) => o.items.map((i) => ({ status: i.status, provider: i.provider || '', code: i.code || '', wrvu: i.wrvu ?? '', earned: i.earned ?? '', draws: i.draws ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'provider', 'code', 'wrvu', 'earned', 'draws', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Pay by provider' }, rows: o.providers, columns: ['provider', 'lines', 'wrvu', 'earned', 'draws', 'true_up'] }, { title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'Work RVUs come from the RVU file you load; modifier adjustments follow your settings. Comp plans differ (quality bonuses, panel adjustments, minimums); Fairpractice Provider Pay covers tiered wRVU pay and draws only.', 'Paying physicians by wRVU touches Stark and anti-kickback rules; have counsel review the plan itself.', KESTREL_LIMITS.advice, KESTREL_LIMITS.phi],
  },
  refused: [
    { name: 'payroll_submit', category: 'payment', description: 'Fairpractice Provider Pay never runs payroll or pays providers.' },
    { name: 'comp_plan_change', category: 'binding_send', description: 'Fairpractice Provider Pay never changes a compensation plan.' },
  ],
  prompt: { title: 'Quarterly wRVU true-up', description: 'Walks the host model through a quarterly provider pay true-up with Fairpractice Provider Pay.', text: `You are helping a practice administrator with fairpractice-provider-pay at quarter end.

Rules: Fairpractice Provider Pay only reads files. It never runs payroll or changes the comp plan. Patient names in results are pseudonyms.

1. Call providerpay_check with charges, rvus, settings, from and to.
2. Lead with no_provider and no_rvu: fix these first, or the pay is understated.
3. Then each provider's wRVUs, earned pay, draws and true-up.
4. Call providerpay_write_report for the administrator and the medical director.` },
});
