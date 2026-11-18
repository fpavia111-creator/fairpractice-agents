# Fairpractice (Fairpractice)

*Traduzido por Claude; revisão por falante nativo pendente. O [README](README.md) em inglês é o que vale.*

30 pequenos agentes MCP para consultórios médicos, agências de atendimento domiciliar, hospices e clínicas de terapia nos EUA: administração, faturamento e conformidade. Cada agente tem **uma única tarefa**, lê os arquivos que seus sistemas já exportam e escreve relatórios e rascunhos no seu computador.

Licença MIT · Node 20 ou mais recente · apenas arquivos locais · sem credenciais · apenas dados de teste fictícios

Implantação com preço fixo: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Experimente

```bash
npm install
npm test
node packages/fairpractice-exclusion-screening/bin/fairpractice-exclusion-screening.js demo
node packages/fairpractice-provider-pay/bin/fairpractice-provider-pay.js demo
```

Cada agente tem uma `demo` com arquivos fictícios, um `eval` com seus próprios casos e um servidor MCP (`<agente> mcp --root <pasta>`).

## Os agentes

**Pacote de conformidade:** [`fairpractice-exclusion-screening`](packages/fairpractice-exclusion-screening), [`fairpractice-staff-licenses`](packages/fairpractice-staff-licenses), [`fairpractice-staff-health`](packages/fairpractice-staff-health), [`fairpractice-records-requests`](packages/fairpractice-records-requests), [`fairpractice-breach-deadlines`](packages/fairpractice-breach-deadlines), [`fairpractice-business-associates`](packages/fairpractice-business-associates), [`fairpractice-security-risk-analysis`](packages/fairpractice-security-risk-analysis), [`fairpractice-compliance-training`](packages/fairpractice-compliance-training), [`fairpractice-review-replies`](packages/fairpractice-review-replies), [`fairpractice-physician-contracts`](packages/fairpractice-physician-contracts)

**Faturamento de especialidades:** [`fairpractice-aba-therapy`](packages/fairpractice-aba-therapy), [`fairpractice-therapy-billing`](packages/fairpractice-therapy-billing), [`fairpractice-hospice-billing`](packages/fairpractice-hospice-billing), [`fairpractice-home-health`](packages/fairpractice-home-health), [`fairpractice-behavioral-health`](packages/fairpractice-behavioral-health), [`fairpractice-wound-products`](packages/fairpractice-wound-products), [`fairpractice-injury-liens`](packages/fairpractice-injury-liens)

**Gestão de cuidados e cuidado baseado em valor:** [`fairpractice-care-management`](packages/fairpractice-care-management), [`fairpractice-remote-monitoring`](packages/fairpractice-remote-monitoring), [`fairpractice-primary-care-apcm`](packages/fairpractice-primary-care-apcm), [`fairpractice-attribution-roster`](packages/fairpractice-attribution-roster), [`fairpractice-capitation`](packages/fairpractice-capitation)

**Atendimento domiciliar:** [`fairpractice-evv-claims`](packages/fairpractice-evv-claims), [`fairpractice-caregiver-hours`](packages/fairpractice-caregiver-hours), [`fairpractice-care-plan-hours`](packages/fairpractice-care-plan-hours)

**Recuperação de valores e finanças da clínica:** [`fairpractice-surprise-billing-disputes`](packages/fairpractice-surprise-billing-disputes), [`fairpractice-secondary-claims`](packages/fairpractice-secondary-claims), [`fairpractice-recoupments`](packages/fairpractice-recoupments), [`fairpractice-code-updates`](packages/fairpractice-code-updates), [`fairpractice-provider-pay`](packages/fairpractice-provider-pay)

## Como eles se mantêm seguros

- **Apenas arquivos locais.** Sem login no software da clínica, em portais de operadoras, bancos ou órgãos; sem rede, sem telemetria.
- **Mascarado antes de o modelo ver.** Nomes de pacientes, residentes e funcionários viram pseudônimos (`PT-3f9a1c2e`).
- **Pessoas enviam.** Cada agente recusa enviar, pagar, declarar ou protocolar; os rascunhos esperam o clique de uma pessoa nomeada.
- **Configurações, não regras fixas.** Tarifas, limites e prazos são configurações JSON que você confirma.

## Limites

Não é aconselhamento jurídico, fiscal, de faturamento ou médico. O mascaramento é uma escolha de projeto, não uma determinação da HIPAA. Os nomes de colunas ainda não foram verificados em exportações reais; a primeira implantação os confirma com você. Arquivos de nove idiomas são lidos (codificações, números, datas, nomes de colunas); resultados e CSV ficam em inglês.

## Licença

MIT. Detalhes no README em inglês.
