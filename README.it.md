# Kestrel (Fairpractice)

*Tradotto da Claude; revisione di un madrelingua in attesa. Fa fede il [README](README.md) inglese.*

30 piccoli agenti MCP per studi medici, servizi di assistenza domiciliare, hospice e studi di terapia negli USA: amministrazione, fatturazione e conformità. Ogni agente ha **un solo compito**, legge i file che i vostri sistemi già esportano e scrive report e bozze sul vostro computer.

Licenza MIT · Node 20 o successivo · solo file locali · nessuna credenziale · solo dati di prova fittizi

Installazione a prezzo fisso: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Provatelo

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

Ogni agente ha una `demo` su file fittizi, un `eval` con i propri casi e un server MCP (`<agente> mcp --root <cartella>`).

## Gli agenti

**Pacchetto conformità:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**Fatturazione specialistica:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**Gestione delle cure e cure basate sul valore:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**Assistenza domiciliare:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**Recupero crediti e finanze dello studio:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## Come restano sicuri

- **Solo file locali.** Nessun accesso al software dello studio, ai portali dei pagatori, alle banche o agli enti; niente rete, niente telemetria.
- **Mascherato prima che il modello lo veda.** I nomi di pazienti, ospiti e personale diventano pseudonimi (`PT-3f9a1c2e`).
- **Sono le persone a inviare.** Ogni agente rifiuta di presentare, pagare, dichiarare o inviare; le bozze aspettano il clic di una persona indicata per nome.
- **Impostazioni, non regole fisse.** Tariffe, limiti e scadenze sono impostazioni JSON che confermate voi.

## Limiti

Nessuna consulenza legale, fiscale, di fatturazione o medica. Il mascheramento è una scelta di progettazione, non una determinazione HIPAA. I nomi delle colonne non sono ancora stati verificati su esportazioni reali; la prima installazione li conferma con voi. Si leggono file in nove lingue (codifiche, numeri, date, nomi di colonna); risultati e CSV restano in inglese.

## Licenza

MIT. Dettagli nel README inglese.
