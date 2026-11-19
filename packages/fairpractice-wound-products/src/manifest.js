import { readFileSync } from 'node:fs';
import { medAgent, fileArg, PATIENT_ID, PATIENT_NAME, CPT, MODIFIER_COL, UNITS, DOS, PAID, PRACTICE_LIMITS } from 'fairpractice-core';
import { checkWound } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const PRODUCT = t(['Product', 'Product Code', 'HCPCS', 'Q Code', 'Code', 'Item Code'], { translate: false });
const LOT = t(['Lot', 'Lot #', 'Lot Number', 'Serial', 'Serial #', 'Graft ID'], { translate: false });

export const CLAIM_FIELDS = Object.freeze({ patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, cpt: { ...CPT, required: true }, modifiers: MODIFIER_COL, units: UNITS, paid: PAID });
export const USAGE_FIELDS = Object.freeze({
  patient_id: PATIENT_ID, patient_name: PATIENT_NAME, date: { ...DOS, required: true }, product: { ...PRODUCT, required: true }, lot: LOT,
  opened: t(['Opened', 'Opened sq cm', 'Size Opened', 'Product Size', 'Graft Size'], { type: 'number' }),
  applied: t(['Applied', 'Applied sq cm', 'Used', 'Used sq cm', 'Size Applied'], { type: 'number' }),
  wound_area: t(['Wound Area', 'Wound Area sq cm', 'Area', 'Surface Area', 'Wound Size'], { type: 'number' }),
});
export const INVOICE_FIELDS = Object.freeze({
  product: PRODUCT, lot: LOT, invoice: t(['Invoice', 'Invoice #', 'Invoice Number', 'PO', 'PO #'], { translate: false }),
  size: t(['Size', 'Size sq cm', 'Sq Cm', 'Units'], { type: 'number' }), cost: t(['Cost', 'Unit Cost', 'Price', 'Amount', 'Invoice Amount'], { type: 'money' }),
});

const args = {
  claims: fileArg('Claim lines under --root: patient, date, code, modifiers, units, paid'),
  usage: fileArg('Product usage log: patient, date, product code, lot, sq cm opened, sq cm applied, wound area'),
  invoices: fileArg('Product invoices: product code, lot, invoice number, size in sq cm, cost'),
};
const run = (a, ctx) => checkWound(ctx.records(a.claims, 'claims'), ctx.records(a.usage, 'usage'), ctx.records(a.invoices, 'invoices'));
const summary = (o) => `${o.claim_lines} claim line(s), ${o.product_lines} product line(s), ${o.patients} patient(s). ${o.dollars_at_risk} at risk. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'wound', title: 'Fairpractice Wound Products',
  description: 'Checks skin substitute and wound product billing: products billed with no purchase invoice, units over the product opened, JW and JZ waste modifiers against the waste recorded, application codes against the wound area, and products paid below what they cost. Patient names are masked before results reach the model.',
  args, required: ['claims', 'usage', 'invoices'],
  sources: { claims: { label: 'Claim lines', args: ['claims'], fields: CLAIM_FIELDS }, usage: { label: 'Product usage', args: ['usage'], fields: USAGE_FIELDS }, invoices: { label: 'Invoices', args: ['invoices'], fields: INVOICE_FIELDS } },
  configSchemas: {}, memoryKinds: {},
  run, summary,
  check: { title: 'Check wound product billing', description: 'List products with no invoice, unit and waste modifier problems, application code mismatches and products paid below cost.' },
  report: {
    title: { en: 'Wound product billing check', es: 'Revisión de productos para heridas', de: 'Wundprodukte: Abrechnungsprüfung', fr: 'Produits pour plaies : contrôle', pt: 'Produtos para feridas: revisão', it: 'Prodotti per ferite: verifica', ja: '創傷製品の請求チェック', zh: '伤口产品计费检查', ko: '상처 제품 청구 점검' },
    base: 'wound-products',
    rows: (o) => o.items.map((i) => ({ status: i.status, patient_id: i.patient_id, patient_name: i.patient_name || '', date: i.date, cpt: i.cpt || '', units: i.units ?? '', amount: i.amount, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'patient_name', 'date', 'cpt', 'units', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'One billing unit is taken as one square centimetre, the usual unit for skin substitute codes; check each product\'s descriptor. Coverage rules for skin substitutes change often (local coverage determinations); Fairpractice Wound Products does not judge coverage.', PRACTICE_LIMITS.advice, PRACTICE_LIMITS.phi],
  },
  refused: [
    { name: 'claim_submit', category: 'binding_send', description: 'Fairpractice Wound Products never submits or changes claims.' },
    { name: 'product_order', category: 'payment', description: 'Fairpractice Wound Products never orders or pays for products.' },
  ],
  prompt: { title: 'Wound product billing review', description: 'Walks the host model through a wound product billing review with Fairpractice Wound Products.', text: `You are helping a wound clinic's billing lead with fairpractice-wound-products.

Rules: Fairpractice Wound Products only reads files. It never submits claims or orders products, and it does not judge coverage or medical need. Patient names in results are pseudonyms.

1. Call wound_check with claims, usage and invoices.
2. Lead with no_invoice and units_over_opened: these are the audit findings that cost most.
3. Then waste modifier problems (JW and JZ) and application code mismatches.
4. Then products paid below cost, for the contract or purchasing lead.
5. Call wound_write_report for the clinic manager.` },
});
