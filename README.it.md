# Fairpractice (Fairpractice)

*Tradotto da Claude; revisione di un madrelingua in attesa. Fa fede il [README](README.md) inglese.*

30 piccoli agenti MCP per studi medici, servizi di assistenza domiciliare, hospice e studi di terapia negli USA: amministrazione, fatturazione e conformità. Ogni agente ha **un solo compito**, legge i file che i vostri sistemi già esportano e scrive report e bozze sul vostro computer.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · solo dati di prova fittizi

Installazione a prezzo fisso: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Provatelo

```bash
npm install
npm test
node packages/fairpractice-exclusion-screening/bin/fairpractice-exclusion-screening.js demo
node packages/fairpractice-provider-pay/bin/fairpractice-provider-pay.js demo
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi e un server MCP (`<agente> mcp --root <cartella>`).

## Gli agenti

**Pacchetto conformità:** [`fairpractice-exclusion-screening`](packages/fairpractice-exclusion-screening), [`fairpractice-staff-licenses`](packages/fairpractice-staff-licenses), [`fairpractice-staff-health`](packages/fairpractice-staff-health), [`fairpractice-records-requests`](packages/fairpractice-records-requests), [`fairpractice-breach-deadlines`](packages/fairpractice-breach-deadlines), [`fairpractice-business-associates`](packages/fairpractice-business-associates), [`fairpractice-security-risk-analysis`](packages/fairpractice-security-risk-analysis), [`fairpractice-compliance-training`](packages/fairpractice-compliance-training), [`fairpractice-review-replies`](packages/fairpractice-review-replies), [`fairpractice-physician-contracts`](packages/fairpractice-physician-contracts)

**Fatturazione specialistica:** [`fairpractice-aba-therapy`](packages/fairpractice-aba-therapy), [`fairpractice-therapy-billing`](packages/fairpractice-therapy-billing), [`fairpractice-hospice-billing`](packages/fairpractice-hospice-billing), [`fairpractice-home-health`](packages/fairpractice-home-health), [`fairpractice-behavioral-health`](packages/fairpractice-behavioral-health), [`fairpractice-wound-products`](packages/fairpractice-wound-products), [`fairpractice-injury-liens`](packages/fairpractice-injury-liens)

**Gestione delle cure e cure basate sul valore:** [`fairpractice-care-management`](packages/fairpractice-care-management), [`fairpractice-remote-monitoring`](packages/fairpractice-remote-monitoring), [`fairpractice-primary-care-apcm`](packages/fairpractice-primary-care-apcm), [`fairpractice-attribution-roster`](packages/fairpractice-attribution-roster), [`fairpractice-capitation`](packages/fairpractice-capitation)

**Assistenza domiciliare:** [`fairpractice-evv-claims`](packages/fairpractice-evv-claims), [`fairpractice-caregiver-hours`](packages/fairpractice-caregiver-hours), [`fairpractice-care-plan-hours`](packages/fairpractice-care-plan-hours)

**Recupero crediti e finanze dello studio:** [`fairpractice-surprise-billing-disputes`](packages/fairpractice-surprise-billing-disputes), [`fairpractice-secondary-claims`](packages/fairpractice-secondary-claims), [`fairpractice-recoupments`](packages/fairpractice-recoupments), [`fairpractice-code-updates`](packages/fairpractice-code-updates), [`fairpractice-provider-pay`](packages/fairpractice-provider-pay)

## Come restano sicuri

- **Solo file locali.** Nessun accesso al software dello studio, ai portali dei pagatori, alle banche o agli enti; niente rete, niente telemetria.
- **Mascherato prima che il modello lo veda.** I nomi di pazienti, ospiti e personale diventano pseudonimi (`PT-3f9a1c2e`).
- **Sono le persone a inviare.** Ogni agente rifiuta di presentare, pagare, dichiarare o inviare; le bozze aspettano il clic di una persona indicata per nome.
- **Impostazioni, non regole fisse.** Tariffe, limiti e scadenze sono impostazioni JSON che confermate voi.

## Limiti

Nessuna consulenza legale, fiscale, di fatturazione o medica. Il mascheramento è una scelta di progettazione, non una determinazione HIPAA. I nomi delle colonne non sono ancora stati verificati su esportazioni reali; la prima installazione li conferma con voi. Si leggono file in nove lingue (codifiche, numeri, date, nomi di colonna); risultati e CSV restano in inglese.

## Licenza

MIT. Dettagli nel README inglese.
