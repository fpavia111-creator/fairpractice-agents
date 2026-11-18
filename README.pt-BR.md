# Kestrel (Fairpractice)

*Traduzido por Claude; revisão por falante nativo pendente. O [README](README.md) em inglês é o que vale.*

30 pequenos agentes MCP para consultórios médicos, agências de atendimento domiciliar, hospices e clínicas de terapia nos EUA: administração, faturamento e conformidade. Cada agente tem **uma única tarefa**, lê os arquivos que seus sistemas já exportam e escreve relatórios e rascunhos no seu computador.

Licença MIT · Node 20 ou mais recente · apenas arquivos locais · sem credenciais · apenas dados de teste fictícios

Implantação com preço fixo: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Experimente

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos e um servidor MCP (`<agente> mcp --root <pasta>`).

## Os agentes

**Pacote de conformidade:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**Faturamento de especialidades:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**Gestão de cuidados e cuidado baseado em valor:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**Atendimento domiciliar:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**Recuperação de valores e finanças da clínica:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## Como eles se mantêm seguros

- **Apenas arquivos locais.** Sem login no software da clínica, em portais de operadoras, bancos ou órgãos; sem rede, sem telemetria.
- **Mascarado antes de o modelo ver.** Nomes de pacientes, residentes e funcionários viram pseudônimos (`PT-3f9a1c2e`).
- **Pessoas enviam.** Cada agente recusa enviar, pagar, declarar ou protocolar; os rascunhos esperam o clique de uma pessoa nomeada.
- **Configurações, não regras fixas.** Tarifas, limites e prazos são configurações JSON que você confirma.

## Limites

Não é aconselhamento jurídico, fiscal, de faturamento ou médico. O mascaramento é uma escolha de projeto, não uma determinação da HIPAA. Os nomes de colunas ainda não foram verificados em exportações reais; a primeira implantação os confirma com você. Arquivos de nove idiomas são lidos (codificações, números, datas, nomes de colunas); resultados e CSV ficam em inglês.

## Licença

MIT. Detalhes no README em inglês.
