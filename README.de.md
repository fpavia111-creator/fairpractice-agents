# Fairpractice (Fairpractice)

*Von Claude übersetzt; Prüfung durch Muttersprachler steht aus. Die englische [README](README.md) ist maßgeblich.*

30 kleine MCP-Agenten für Arztpraxen, Pflegedienste, Hospize und Therapiepraxen in den USA: Verwaltung, Abrechnung und Compliance. Jeder Agent hat **eine Aufgabe**, liest die Dateien, die Ihre Systeme bereits exportieren, und schreibt Berichte und Entwürfe auf Ihrem Rechner.

MIT-Lizenz · Node 20 oder neuer · nur lokale Dateien · keine Zugangsdaten · nur fiktive Testdaten

Einrichtung als Festpreis-Paket: [Fairpractice](https://fair-agents.com/fairpractice.html).

## Ausprobieren

```bash
npm install
npm test
node packages/fairpractice-exclusion-screening/bin/fairpractice-exclusion-screening.js demo
node packages/fairpractice-provider-pay/bin/fairpractice-provider-pay.js demo
```

Jeder Agent hat eine `demo` mit fiktiven Dateien, ein `eval` mit eigenen Testfällen und einen MCP-Server (`<agent> mcp --root <ordner>`).

## Die Agenten

**Compliance-Paket:** [`fairpractice-exclusion-screening`](packages/fairpractice-exclusion-screening), [`fairpractice-staff-licenses`](packages/fairpractice-staff-licenses), [`fairpractice-staff-health`](packages/fairpractice-staff-health), [`fairpractice-records-requests`](packages/fairpractice-records-requests), [`fairpractice-breach-deadlines`](packages/fairpractice-breach-deadlines), [`fairpractice-business-associates`](packages/fairpractice-business-associates), [`fairpractice-security-risk-analysis`](packages/fairpractice-security-risk-analysis), [`fairpractice-compliance-training`](packages/fairpractice-compliance-training), [`fairpractice-review-replies`](packages/fairpractice-review-replies), [`fairpractice-physician-contracts`](packages/fairpractice-physician-contracts)

**Fachabrechnung:** [`fairpractice-aba-therapy`](packages/fairpractice-aba-therapy), [`fairpractice-therapy-billing`](packages/fairpractice-therapy-billing), [`fairpractice-hospice-billing`](packages/fairpractice-hospice-billing), [`fairpractice-home-health`](packages/fairpractice-home-health), [`fairpractice-behavioral-health`](packages/fairpractice-behavioral-health), [`fairpractice-wound-products`](packages/fairpractice-wound-products), [`fairpractice-injury-liens`](packages/fairpractice-injury-liens)

**Care-Management und wertbasierte Versorgung:** [`fairpractice-care-management`](packages/fairpractice-care-management), [`fairpractice-remote-monitoring`](packages/fairpractice-remote-monitoring), [`fairpractice-primary-care-apcm`](packages/fairpractice-primary-care-apcm), [`fairpractice-attribution-roster`](packages/fairpractice-attribution-roster), [`fairpractice-capitation`](packages/fairpractice-capitation)

**Häusliche Pflege:** [`fairpractice-evv-claims`](packages/fairpractice-evv-claims), [`fairpractice-caregiver-hours`](packages/fairpractice-caregiver-hours), [`fairpractice-care-plan-hours`](packages/fairpractice-care-plan-hours)

**Geld zurückholen und Praxisfinanzen:** [`fairpractice-surprise-billing-disputes`](packages/fairpractice-surprise-billing-disputes), [`fairpractice-secondary-claims`](packages/fairpractice-secondary-claims), [`fairpractice-recoupments`](packages/fairpractice-recoupments), [`fairpractice-code-updates`](packages/fairpractice-code-updates), [`fairpractice-provider-pay`](packages/fairpractice-provider-pay)

## Wie sie sicher bleiben

- **Nur lokale Dateien.** Keine Anmeldung bei Praxissoftware, Kostenträgerportalen, Banken oder Behörden; kein Netzwerk, keine Telemetrie.
- **Maskiert, bevor das Modell es sieht.** Namen von Patienten, Bewohnern und Personal werden zu Pseudonymen (`PT-3f9a1c2e`).
- **Menschen senden.** Einreichen, Zahlen, Melden und Versenden verweigert jeder Agent; Entwürfe warten auf den Klick einer namentlich genannten Person.
- **Einstellungen statt fester Regeln.** Sätze, Grenzen und Fristen sind JSON-Einstellungen, die Sie bestätigen.

## Grenzen

Keine Rechts-, Steuer-, Abrechnungs- oder medizinische Beratung. Maskierung ist eine Designentscheidung, keine HIPAA-Feststellung. Spaltennamen wurden noch nicht an echten Exporten geprüft; die erste Einrichtung bestätigt sie mit Ihnen. Dateien aus neun Sprachen werden gelesen (Kodierungen, Zahlen, Daten, Spaltennamen); Ergebnisse und CSV bleiben auf Englisch.

## Lizenz

MIT. Details in der englischen README.
