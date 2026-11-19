import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, AMOUNT, PRACTICE_LIMITS, today } from 'fairpractice-core';
import { checkAssociates, PHI_SERVICE_WORDS } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const VENDOR = t(['Vendor', 'Vendor Name', 'Supplier', 'Payee', 'Company', 'Business Associate'], { required: true });

export const VENDOR_FIELDS = Object.freeze({
  vendor: VENDOR, service: t(['Service', 'What They Do', 'Category', 'Description', 'Service Type']),
  touches_phi: t(['Touches PHI', 'PHI', 'Handles PHI', 'Patient Data', 'Access to PHI', 'PHI Access']),
  baa_signed: t(['BAA Signed', 'BAA Date', 'BAA', 'BAA Effective'], { type: 'date' }),
  baa_expires: t(['BAA Expires', 'BAA End', 'BAA Expiration', 'Contract End'], { type: 'date' }),
  last_review: t(['Last Review', 'Security Review', 'Last Security Review', 'Assessment Date', 'Questionnaire Date'], { type: 'date' }),
  owner: t(['Owner', 'Vendor Owner', 'Department', 'Contact Owner']),
});
export const PAYMENT_FIELDS = Object.freeze({ vendor: VENDOR, date: t(['Date', 'Payment Date', 'Check Date', 'Paid On'], { type: 'date' }), amount: { ...AMOUNT, required: true }, category: t(['GL Account', 'Category', 'Expense Type', 'Account']) });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  review_days: { type: 'integer', minimum: 30, maximum: 1095, description: 'Days between vendor security reviews; default 365' },
  warn_days: { type: 'integer', minimum: 0, maximum: 365, description: 'Days ahead to warn about a BAA ending; default 60' },
  min_paid: { type: 'number', minimum: 0, description: 'Smallest total paid to list a vendor missing from the inventory; default 0' },
  not_business_associates: { type: 'array', maxItems: 2000, items: { type: 'string' }, description: 'Vendors you have decided are not business associates (utilities, food, janitorial with no record access)' },
  phi_service_words: { type: 'array', maxItems: 200, items: { type: 'string' }, description: 'Words in a service description that suggest patient data (replaces the built-in list)' },
} };

const args = {
  vendors: fileArg('Business associate or vendor inventory under --root: vendor, service, handles patient data (yes/no), BAA signed and end dates, last security review and owner'),
  payments: fileArg('Optional accounts payable export: vendor, date and amount (finds vendors paid but not on the inventory)'),
  settings: fileArg('Optional settings JSON: review_days, warn_days, min_paid, not_business_associates, phi_service_words'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => {
  const s = a.settings ? ctx.readJson(a.settings, 'baa_settings') : {};
  return checkAssociates(ctx.records(a.vendors, 'vendors'), a.payments ? ctx.records(a.payments, 'payments') : [], { asOf: a.as_of || today(), reviewDays: s.review_days ?? 365, warnDays: s.warn_days ?? 60, minPaid: s.min_paid ?? 0, notBa: s.not_business_associates || [], phiWords: s.phi_service_words || PHI_SERVICE_WORDS });
};
const summary = (o) => `${o.vendors} vendor(s), ${o.business_associates} handle patient data${o.payments_checked ? `, ${o.payments_checked} payments checked` : ''}. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'baa', title: 'Fairpractice Business Associates',
  description: 'Keeps the business associate inventory honest: vendors that handle patient data with no signed BAA, BAAs expired or ending, security reviews never done or overdue, vendors whose service usually involves patient data but have no yes/no recorded, and vendors paid in accounts payable that are missing from the inventory.',
  args, required: ['vendors'],
  sources: { vendors: { label: 'Vendor inventory', args: ['vendors'], fields: VENDOR_FIELDS }, payments: { label: 'Vendor payments', args: ['payments'], fields: PAYMENT_FIELDS } },
  configSchemas: { baa_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check business associates', description: 'List BAA gaps, overdue security reviews and vendors paid but missing from the inventory.' },
  report: {
    title: { en: 'Business associate inventory check', es: 'Revisión de asociados comerciales', de: 'Prüfung der Auftragsverarbeiter', fr: 'Contrôle des sous-traitants (BAA)', pt: 'Verificação de associados de negócios', it: 'Verifica dei business associate', ja: '業務提携先（BAA）点検', zh: '业务伙伴清单检查', ko: '업무 제휴사(BAA) 점검' },
    base: 'baa-associates',
    rows: (o) => o.items.map((i) => ({ status: i.status, vendor: i.vendor, service: i.service || '', vendor_owner: i.owner || '', baa_signed: i.baa_signed || '', baa_expires: i.baa_expires || '', amount: i.amount || 0, message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'vendor', 'service', 'vendor_owner', 'baa_expires', 'amount', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [PRACTICE_LIMITS.files, 'Whether a vendor is a business associate depends on what it actually does with patient data; the service words are only a hint.', PRACTICE_LIMITS.advice],
  },
  refused: [
    { name: 'vendor_email_send', category: 'binding_send', description: 'Fairpractice Business Associates never contacts vendors or sends BAAs.' },
    { name: 'contract_sign', category: 'binding_send', description: 'Fairpractice Business Associates never signs or accepts a contract or BAA.' },
  ],
  prompt: { title: 'Business associate review', description: 'Walks the host model through a quarterly BAA review with Fairpractice Business Associates.', text: `You are helping a privacy or compliance officer with fairpractice-business-associates.

Rules: Fairpractice Business Associates only reads files. It never contacts vendors or signs anything.

1. Call baa_check with the vendor inventory, accounts payable payments, settings and as_of.
2. Lead with baa_missing and baa_expired, then vendors paid but not on the list.
3. For phi_unknown, ask the owner one question: does this vendor see, store or send patient data?
4. Call baa_write_report for the compliance committee.` },
});
