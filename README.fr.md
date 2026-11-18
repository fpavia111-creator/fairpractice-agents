# Kestrel (Fairpractice)

*Traduit par Claude ; relecture par un locuteur natif en attente. Le [README](README.md) anglais fait foi.*

30 petits agents MCP pour les cabinets médicaux, les services de soins à domicile, les hospices et les cabinets de thérapie aux États-Unis : administration, facturation et conformité. Chaque agent a **une seule tâche**, lit les fichiers que vos systèmes exportent déjà et écrit des rapports et des brouillons sur votre ordinateur.

Licence MIT · Node 20 ou plus récent · fichiers locaux uniquement · aucun identifiant · données de test fictives

Mise en place à prix fixe : [Fairpractice](https://fair-agents.com/fairpractice.html).

## Essayer

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

Chaque agent a une `demo` sur des fichiers fictifs, un `eval` avec ses propres cas et un serveur MCP (`<agent> mcp --root <dossier>`).

## Les agents

**Pack conformité:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**Facturation de spécialité:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**Gestion des soins et soins fondés sur la valeur:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**Soins à domicile:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**Récupération et finances du cabinet:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## Comment ils restent sûrs

- **Fichiers locaux uniquement.** Aucune connexion au logiciel du cabinet, aux portails des payeurs, aux banques ou aux administrations ; pas de réseau, pas de télémétrie.
- **Masqué avant que le modèle ne le voie.** Les noms des patients, résidents et employés deviennent des pseudonymes (`PT-3f9a1c2e`).
- **Ce sont les personnes qui envoient.** Chaque agent refuse de soumettre, payer, déclarer ou envoyer ; les brouillons attendent le clic d'une personne nommée.
- **Des réglages, pas des règles figées.** Tarifs, limites et délais sont des réglages JSON que vous confirmez.

## Limites

Aucun conseil juridique, fiscal, de facturation ou médical. Le masquage est un choix de conception, pas une détermination HIPAA. Les noms de colonnes n'ont pas encore été vérifiés sur de vrais exports ; la première mise en place les confirme avec vous. Les fichiers de neuf langues sont lus (encodages, nombres, dates, noms de colonnes) ; les résultats et les CSV restent en anglais.

## Licence

MIT. Détails dans le README anglais.
