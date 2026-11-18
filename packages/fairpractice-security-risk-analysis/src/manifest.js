import { readFileSync } from 'node:fs';
import { medAgent, fileArg, AS_OF_ARG, KESTREL_LIMITS, today } from 'fairpractice-core';
import { checkRisks } from './logic.js';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const t = (aliases, extra = {}) => ({ aliases, ...extra });
const ASSET = t(['Asset', 'System', 'Application', 'Device', 'Asset Name', 'System Name']);

export const RISK_FIELDS = Object.freeze({
  risk_id: t(['Risk ID', 'Risk #', 'ID', 'Ref'], { translate: false }), asset: ASSET,
  threat: t(['Threat', 'Vulnerability', 'Risk', 'Description', 'Threat/Vulnerability']),
  likelihood: t(['Likelihood', 'Probability', 'L']), impact: t(['Impact', 'Severity', 'I']),
  rating: t(['Rating', 'Risk Level', 'Risk Rating', 'Level', 'Score']),
  owner: t(['Owner', 'Risk Owner', 'Assigned To', 'Responsible']),
  plan: t(['Plan', 'Treatment', 'Mitigation', 'Action Plan', 'Remediation']),
  due: t(['Due', 'Due Date', 'Target Date', 'Target'], { type: 'date' }),
  status: t(['Status', 'State']), accepted_by: t(['Accepted By', 'Sign-off', 'Approved By', 'Risk Accepted By']),
});
export const ASSET_FIELDS = Object.freeze({ asset: { ...ASSET, required: true }, holds_phi: t(['Holds PHI', 'PHI', 'ePHI', 'Contains PHI', 'Patient Data'], { required: true }) });
export const EVIDENCE_FIELDS = Object.freeze({ item: t(['Item', 'Evidence', 'Control', 'Requirement', 'Checklist Item'], { required: true }), done_on: t(['Done', 'Date', 'Completed', 'Last Done', 'Date Completed'], { type: 'date' }), required: t(['Required', 'Mandatory']) });

const SETTINGS = { type: 'object', additionalProperties: false, properties: {
  last_analysis: { type: 'string', format: 'date', description: 'Date the last full security risk analysis was finished' },
  interval_days: { type: 'integer', minimum: 30, maximum: 1095, description: 'Days between full risk analyses and between evidence refreshes; default 365' },
  warn_days: { type: 'integer', minimum: 0, maximum: 180, description: 'Days ahead to show risks coming due; default 30' },
  high_score: { type: 'integer', minimum: 2, maximum: 25, description: 'Likelihood x impact score (1-5 scales) that counts as high; default 12' },
} };

const args = {
  risks: fileArg('Risk register under --root: risk id, asset, threat, likelihood and impact (or rating), owner, plan, due date, status and who accepted it'),
  assets: fileArg('Optional asset list: system or device and whether it holds patient data (finds systems missing from the register)'),
  evidence: fileArg('Optional evidence checklist: item, date last done and whether it is required'),
  settings: fileArg('Optional settings JSON: last_analysis, interval_days, warn_days, high_score'),
  as_of: AS_OF_ARG,
};
const run = (a, ctx) => {
  const s = a.settings ? ctx.readJson(a.settings, 'risk_settings') : {};
  return checkRisks(ctx.records(a.risks, 'risks'), a.assets ? ctx.records(a.assets, 'assets') : [], a.evidence ? ctx.records(a.evidence, 'evidence') : [], { asOf: a.as_of || today(), lastAnalysis: s.last_analysis || null, intervalDays: s.interval_days ?? 365, warnDays: s.warn_days ?? 30, highScore: s.high_score ?? 12 });
};
const summary = (o) => `${o.risks} risk(s), ${o.open_risks} open, ${o.high_open} high. ${o.assets_with_phi} system(s) hold patient data. Last full analysis: ${o.last_analysis || 'not recorded'}. ${o.items.length} finding(s): ${Object.entries(o.by_status).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}.`;

export const manifest = medAgent({
  pkg, prefix: 'risk', title: 'Fairpractice Security Risk Analysis',
  description: 'Tracks the HIPAA security risk analysis: the yearly analysis overdue, high risks with no owner or plan, open risks past their due date, accepted risks nobody signed off, systems that hold patient data but are missing from the register, and evidence items missing or stale. It does not scan systems.',
  args, required: ['risks'],
  sources: { risks: { label: 'Risk register', args: ['risks'], fields: RISK_FIELDS }, assets: { label: 'Asset list', args: ['assets'], fields: ASSET_FIELDS }, evidence: { label: 'Evidence checklist', args: ['evidence'], fields: EVIDENCE_FIELDS } },
  configSchemas: { risk_settings: SETTINGS }, memoryKinds: {},
  run, summary,
  check: { title: 'Check the risk analysis', description: 'List gaps in the risk analysis, register, asset coverage and evidence.' },
  report: {
    title: { en: 'Security risk analysis tracker', es: 'Seguimiento del análisis de riesgos', de: 'Risikoanalyse: Nachverfolgung', fr: 'Suivi de l\'analyse des risques', pt: 'Acompanhamento da análise de riscos', it: 'Monitoraggio dell\'analisi dei rischi', ja: 'セキュリティリスク分析の追跡', zh: '安全风险分析跟踪', ko: '보안 위험 분석 추적' },
    base: 'risk-analysis',
    rows: (o) => o.items.map((i) => ({ status: i.status, risk_id: i.risk_id || '', asset: i.asset || '', level: i.level ?? '', risk_owner: i.owner || '', due: i.due || '', days: i.days ?? '', message: i.message, fix: i.fix })),
    htmlColumns: ['status', 'risk_id', 'asset', 'level', 'risk_owner', 'due', 'message', 'fix'],
    sections: (o) => [{ title: { en: 'Findings by type' }, rows: Object.entries(o.by_status).map(([status, count]) => ({ status, count })), columns: ['status', 'count'] }],
    limits: [KESTREL_LIMITS.files, 'It tracks the register you keep; it does not test systems, find vulnerabilities or certify compliance.', KESTREL_LIMITS.advice],
  },
  refused: [
    { name: 'system_scan', category: 'production_deploy', description: 'Fairpractice Security Risk Analysis never scans, probes or changes systems.' },
    { name: 'risk_accept', category: 'binding_send', description: 'Fairpractice Security Risk Analysis never accepts a risk on anyone\'s behalf.' },
  ],
  prompt: { title: 'Risk analysis review', description: 'Walks the host model through a quarterly security risk review with Fairpractice Security Risk Analysis.', text: `You are helping a security officer with fairpractice-security-risk-analysis.

Rules: Fairpractice Security Risk Analysis only reads the register and lists. It never scans systems or accepts risks.

1. Call risk_check with the register, asset list, evidence checklist, settings and as_of.
2. Lead with sra_overdue, then high risks with no owner or plan, then past_due.
3. For asset_not_assessed, suggest adding the system with its threats.
4. Call risk_write_report for the security committee.` },
});
