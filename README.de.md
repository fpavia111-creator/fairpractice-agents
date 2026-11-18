# Kestrel (Fairpractice)

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

30 kleine MCP-Agenten für Arztpraxen, Pflegedienste, Hospize und Therapiepraxen in den USA: Verwaltung, Abrechnung und Compliance. Jeder Agent hat **eine Aufgabe**, liest die Dateien, die Ihre Systeme bereits exportieren, und schreibt Berichte und Entwürfe auf Ihrem Rechner.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · nur fiktive Testdaten

Einrichtung als Festpreis-Paket: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Ausprobieren

```bash
npm install
npm test
node packages/heron-of-exclusions/bin/heron-of-exclusions.js demo
node packages/condor-of-provider-pay/bin/condor-of-provider-pay.js demo
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`<agent> mcp --root <ordner>`).

## Die Agenten

**Compliance-Paket:** [`heron-of-exclusions`](packages/heron-of-exclusions), [`finch-of-licenses`](packages/finch-of-licenses), [`robin-of-staff-health`](packages/robin-of-staff-health), [`owl-of-access-requests`](packages/owl-of-access-requests), [`hawk-of-breaches`](packages/hawk-of-breaches), [`swift-of-associates`](packages/swift-of-associates), [`plover-of-risk-analysis`](packages/plover-of-risk-analysis), [`lark-of-training`](packages/lark-of-training), [`wren-of-reviews`](packages/wren-of-reviews), [`crane-of-physician-contracts`](packages/crane-of-physician-contracts)

**Fachabrechnung:** [`magpie-of-aba`](packages/magpie-of-aba), [`swallow-of-therapy`](packages/swallow-of-therapy), [`dove-of-hospice`](packages/dove-of-hospice), [`sparrow-of-home-health`](packages/sparrow-of-home-health), [`jay-of-behavioral-health`](packages/jay-of-behavioral-health), [`ibis-of-wound-products`](packages/ibis-of-wound-products), [`raven-of-liens`](packages/raven-of-liens)

**Care-Management und wertbasierte Versorgung:** [`egret-of-care-management`](packages/egret-of-care-management), [`tern-of-remote-monitoring`](packages/tern-of-remote-monitoring), [`linnet-of-primary-care`](packages/linnet-of-primary-care), [`stork-of-attribution`](packages/stork-of-attribution), [`pelican-of-capitation`](packages/pelican-of-capitation)

**Häusliche Pflege:** [`oriole-of-evv`](packages/oriole-of-evv), [`thrush-of-caregiver-hours`](packages/thrush-of-caregiver-hours), [`warbler-of-care-plans`](packages/warbler-of-care-plans)

**Geld zurückholen und Praxisfinanzen:** [`falcon-of-disputes`](packages/falcon-of-disputes), [`osprey-of-secondary-claims`](packages/osprey-of-secondary-claims), [`gull-of-recoupments`](packages/gull-of-recoupments), [`curlew-of-code-updates`](packages/curlew-of-code-updates), [`condor-of-provider-pay`](packages/condor-of-provider-pay)

## Wie sie sicher bleiben

- **Nur lokale Dateien.** Keine Anmeldung bei Praxissoftware, Kostenträgerportalen, Banken oder Behörden; kein Netzwerk, keine Telemetrie.
- **Maskiert, bevor das Modell es sieht.** Namen von Patienten, Bewohnern und Personal werden zu Pseudonymen (`PT-3f9a1c2e`).
- **Menschen senden.** Einreichen, Zahlen, Melden und Versenden verweigert jeder Agent; Entwürfe warten auf den Klick einer namentlich genannten Person.
- **Einstellungen statt fester Regeln.** Sätze, Grenzen und Fristen sind JSON-Einstellungen, die Sie bestätigen.

## Grenzen

Keine Rechts-, Steuer-, Abrechnungs- oder medizinische Beratung. Maskierung ist eine Designentscheidung, keine HIPAA-Feststellung. Spaltennamen wurden noch nicht an echten Exporten geprüft; die erste Einrichtung bestätigt sie mit Ihnen. Dateien aus neun Sprachen werden gelesen (Kodierungen, Zahlen, Daten, Spaltennamen); Ergebnisse und CSV bleiben auf Englisch.

## Lizenz

MIT. Details in der englischen README.
