# Kestrel (Fairpractice)

*Traducido por Claude; pendiente de revisión por un hablante nativo. El [README](README.md) en inglés es el que vale.*

30 pequeños agentes MCP para consultas médicas, agencias de atención domiciliaria, hospicios y clínicas de terapia en EE. UU.: administración, facturación y cumplimiento. Cada agente tiene **una sola tarea**, lee los archivos que sus sistemas ya exportan y escribe informes y borradores en su computadora.

Licencia MIT · Node 20 o posterior · solo archivos locales · sin credenciales · solo datos de prueba ficticios

Instalación a precio fijo: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Pruébelo

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

Cada agente tiene una `demo` con archivos ficticios, un `eval` con sus propios casos y un servidor MCP (`<agente> mcp --root <carpeta>`).

## Los agentes

**Paquete de cumplimiento:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**Facturación de especialidades:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**Gestión de cuidados y atención basada en valor:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**Atención domiciliaria:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**Recuperación de dinero y finanzas de la consulta:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## Cómo se mantienen seguros

- **Solo archivos locales.** Sin inicio de sesión en el software de la consulta, portales de pagadores, bancos ni organismos; sin red ni telemetría.
- **Enmascarado antes de que lo vea el modelo.** Los nombres de pacientes, residentes y personal se convierten en seudónimos (`PT-3f9a1c2e`).
- **Las personas envían.** Cada agente se niega a presentar, pagar, declarar o enviar; los borradores esperan el clic de una persona con nombre.
- **Ajustes, no reglas fijas.** Tarifas, límites y plazos son ajustes JSON que usted confirma.

## Límites

No es asesoría legal, fiscal, de facturación ni médica. El enmascaramiento es una decisión de diseño, no una determinación de HIPAA. Los nombres de columna aún no se han comprobado con exportaciones reales; la primera instalación los confirma con usted. Se leen archivos de nueve idiomas (codificaciones, números, fechas, nombres de columna); los resultados y los CSV quedan en inglés.

## Licencia

MIT. Detalles en el README en inglés.
