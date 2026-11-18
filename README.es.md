# Fairpractice (Fairpractice)

*Traducido por Claude; pendiente de revisión por un hablante nativo. El [README](README.md) en inglés es el que vale.*

30 pequeños agentes MCP para consultas médicas, agencias de atención domiciliaria, hospicios y clínicas de terapia en EE. UU.: administración, facturación y cumplimiento. Cada agente tiene **una sola tarea**, lee los archivos que sus sistemas ya exportan y escribe informes y borradores en su computadora.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · solo datos de prueba ficticios

Instalación a precio fijo: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Pruébelo

```bash
npm install
npm test
node packages/fairpractice-exclusion-screening/bin/fairpractice-exclusion-screening.js demo
node packages/fairpractice-provider-pay/bin/fairpractice-provider-pay.js demo
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos y un servidor MCP (`<agente> mcp --root <carpeta>`).

## Los agentes

**Paquete de cumplimiento:** [`fairpractice-exclusion-screening`](packages/fairpractice-exclusion-screening), [`fairpractice-staff-licenses`](packages/fairpractice-staff-licenses), [`fairpractice-staff-health`](packages/fairpractice-staff-health), [`fairpractice-records-requests`](packages/fairpractice-records-requests), [`fairpractice-breach-deadlines`](packages/fairpractice-breach-deadlines), [`fairpractice-business-associates`](packages/fairpractice-business-associates), [`fairpractice-security-risk-analysis`](packages/fairpractice-security-risk-analysis), [`fairpractice-compliance-training`](packages/fairpractice-compliance-training), [`fairpractice-review-replies`](packages/fairpractice-review-replies), [`fairpractice-physician-contracts`](packages/fairpractice-physician-contracts)

**Facturación de especialidades:** [`fairpractice-aba-therapy`](packages/fairpractice-aba-therapy), [`fairpractice-therapy-billing`](packages/fairpractice-therapy-billing), [`fairpractice-hospice-billing`](packages/fairpractice-hospice-billing), [`fairpractice-home-health`](packages/fairpractice-home-health), [`fairpractice-behavioral-health`](packages/fairpractice-behavioral-health), [`fairpractice-wound-products`](packages/fairpractice-wound-products), [`fairpractice-injury-liens`](packages/fairpractice-injury-liens)

**Gestión de cuidados y atención basada en valor:** [`fairpractice-care-management`](packages/fairpractice-care-management), [`fairpractice-remote-monitoring`](packages/fairpractice-remote-monitoring), [`fairpractice-primary-care-apcm`](packages/fairpractice-primary-care-apcm), [`fairpractice-attribution-roster`](packages/fairpractice-attribution-roster), [`fairpractice-capitation`](packages/fairpractice-capitation)

**Atención domiciliaria:** [`fairpractice-evv-claims`](packages/fairpractice-evv-claims), [`fairpractice-caregiver-hours`](packages/fairpractice-caregiver-hours), [`fairpractice-care-plan-hours`](packages/fairpractice-care-plan-hours)

**Recuperación de dinero y finanzas de la consulta:** [`fairpractice-surprise-billing-disputes`](packages/fairpractice-surprise-billing-disputes), [`fairpractice-secondary-claims`](packages/fairpractice-secondary-claims), [`fairpractice-recoupments`](packages/fairpractice-recoupments), [`fairpractice-code-updates`](packages/fairpractice-code-updates), [`fairpractice-provider-pay`](packages/fairpractice-provider-pay)

## Cómo se mantienen seguros

- **Solo archivos locales.** Sin inicio de sesión en el software de la consulta, portales de pagadores, bancos ni organismos; sin red ni telemetría.
- **Enmascarado antes de que lo vea el modelo.** Los nombres de pacientes, residentes y personal se convierten en seudónimos (`PT-3f9a1c2e`).
- **Las personas envían.** Cada agente se niega a presentar, pagar, declarar o enviar; los borradores esperan el clic de una persona con nombre.
- **Ajustes, no reglas fijas.** Tarifas, límites y plazos son ajustes JSON que usted confirma.

## Límites

No es asesoría legal, fiscal, de facturación ni médica. El enmascaramiento es una decisión de diseño, no una determinación de HIPAA. Los nombres de columna aún no se han comprobado con exportaciones reales; la primera instalación los confirma con usted. Se leen archivos de nueve idiomas (codificaciones, números, fechas, nombres de columna); los resultados y los CSV quedan en inglés.

## Licencia

MIT. Detalles en el README en inglés.
