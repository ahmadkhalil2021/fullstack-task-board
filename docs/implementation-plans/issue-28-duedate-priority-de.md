# Issue #28 — Task-Schema um dueDate und priority erweitern

## 1. Zusammenfassung

Fügt jedem Task optionale Felder `dueDate` und `priority` hinzu, validiert und serialisiert sie über die Express-API, füllt bestehende MongoDB-Dokumente sicher nach und stellt beide Felder auf der Odoo-ähnlichen Task-Detailseite und auf Task-Karten dar. Die Änderung behält den bestehenden Flux-Ablauf (`UI → Zustand store → API`), Optimistic Updates, den serverless-fähigen Einstiegspunkt und die aktuellen Oberflächen `kanban`, `grid` und `table` bei. Es werden keine Dependencies, Kalenderansicht, Erinnerungen oder `TaskForm.jsx` eingeführt.

## 2. Architektur- und Designentscheidungen

- **Schema:** `dueDate: { type: Date, default: null, index: true }` und `priority: { type: String, enum: ['none', 'low', 'medium', 'high'], default: 'none' }` in `server/models/Task.js:8-41` ergänzen. MongoDB speichert Daten als BSON-Dates; Mongoose serialisiert sie in JSON als ISO-Strings. `null` ist der ausdrückliche Wert für kein Datum.
- **Validierungsgrenze:** Request-Typen und die Parsebarkeit des ISO-Datums in `server/routes/tasks.js:18-55` und `:64-134` vor der Speicherung validieren. Die `priority`-Enum sowohl in der Route (für die etablierte `VALIDATION_ERROR`/400-Antwort) als auch im Schema (`runValidators: true` als zweite Absicherung) beibehalten. Nur Strings akzeptieren, die ein endliches `Date` ergeben; `null` akzeptieren; leere Strings, Zahlen und ungültige Daten ablehnen.
- **Semantik partieller Updates:** Bei PUT ein fehlendes `dueDate` von `dueDate: null` unterscheiden; ersteres lässt den Wert unverändert, letzteres löscht ihn. `dueDate` und `priority` exakt in der gespeicherten Form zurückgeben.
- **Migration:** `server/scripts/migrate-task-fields.js` als importierbare Funktion `migrateTaskFields` plus CLI-Einstiegspunkt ergänzen. Rohe Task-Dokumente iterieren und nur für fehlende Felder `$set` ausführen, jede geänderte `_id` und die Gesamtsumme loggen und beim zweiten Lauf null Änderungen melden. `server/dev.js:10-30` nicht ändern: Die MongoMemoryServer-Datenbank ist prozesslokal und ihre Daten verschwinden beim Stoppen des Dev-Prozesses. Der Befehl ist für `MONGODB_URI` gedacht; für Produktion sind eine echte Datenbank sowie Backup-/Wartungsentscheidung zu dokumentieren.
- **Client-Vertrag:** `client/src/lib/api.js:35-49` schlank und generisch halten, aber JSDoc ergänzen, das `dueDate` als `YYYY-MM-DD`/ISO-Eingabe oder `null` und `priority` als Vier-Werte-Enum beschreibt. `useBoardStore` bleibt der einzige Aufrufer aus der UI; das bestehende Snapshot-/Rollback-Verhalten in `client/src/store/useBoardStore.js:121-184` und `:332-391` bewahren.
- **Detailformular:** `client/src/pages/TaskDetailPage.jsx:40-101` um lokalen `dueDate`- und `priority`-State erweitern. `<input type="date">` mit leerem Wert, der zu `null` wird, verwenden; reine Datumswerte ohne Zeitzonenumwandlung senden. Ein zugängliches `radiogroup` mit per Tastatur fokussierbaren Buttons für Priorität verwenden. Der bestehende Save-/Discard-Flow speichert diese Felder; Statusbar-Änderungen bleiben sofortig.
- **Darstellung:** `client/src/lib/priority.js` mit gemeinsamer `priorityColor`-Token-Zuordnung und sicherem Fallback erstellen. `TaskCard` erhält einen Datums-Chip und einen nicht nur farbabhängigen Prioritätsindikator. Empfehlung: Sortierbare Spalten `Priority` und `Due date` in `TableView` ergänzen, weil das Issue-Ziel „was ist wann fällig/wichtig“ ohne Öffnen jeder Karte nutzbar sein muss; Created/Updated beibehalten und null-Daten in beiden Richtungen ans Ende sortieren. Dies ist eine Produktentscheidung (siehe Abschnitt 11).
- **Datumsrichtlinie:** Mit `Intl.DateTimeFormat` und einer festen, dokumentierten Locale-Strategie (`en-US`, `month: 'short', day: 'numeric'`) formatieren, damit `2026-08-30` konsistent als `Aug 30` erscheint; nur gültige Werte parsen und für `null` oder ungültige Legacy-Werte keinen Chip/keine Zelle anzeigen. Überfällig bedeutet ein gültiges Fälligkeitsdatum vor dem lokalen Kalendertag; zusätzlich zum Danger-Token einen Text-/ARIA-Hinweis verwenden.
- **Sicherheit und Kompatibilität:** Task-Werte weiterhin als React-Text rendern (kein `dangerouslySetInnerHTML`), alle neuen Eingaben serverseitig validieren, keine Query-String-Ausführung ermöglichen und Defaults für alte sowie neu erstellte Tasks erhalten. Keine neue Dependency ist nötig.

## 3. State Machine / Flow

### Detailseiten-State

```text
Task geladen
  → local dueDate = task.dueDate ? YYYY-MM-DD : ''
  → local priority = task.priority || 'none'
  → Benutzer bearbeitet Datum/Priorität
  → dirty (Save + Discard aktiviert)
  → Save
      → Store-Snapshot
      → optimistischer Task-Patch
      → PUT /api/tasks/:taskId
          → Erfolg: Task durch Server-Serialisierung ersetzen, Saved-Status
          → Fehler: Snapshot zurückrollen, bestehendes Error-Banner anzeigen, Eingabewerte behalten
  → Discard → Task-Werte wiederherstellen und dirty löschen
```

### Create- und Board-Flow

```text
Task hinzufügen
  → addTask erstellt optimistischen Task mit dueDate: null, priority: 'none'
  → POST /api/tasks
      → Erfolg: temporären Task durch serialisierten Task ersetzen
      → Fehler: Board zurückrollen und Fehler anzeigen
```

### Migrations-Flow

```text
npm run migrate:task-fields
  → dotenv laden + connectDB (MONGODB_URI)
  → Tasks iterieren
  → nur fehlende dueDate/priority-Defaults per $set setzen
  → geänderte IDs und Anzahl loggen
  → Verbindung trennen
```

## 4. API Contract

Referenzimplementierung: `server/routes/tasks.js:18-134`; das Response-Envelope bleibt `docs/api-contract.md:8-32`.

### `POST /api/tasks`

- **Body:** Bestehendes Pflichtfeld `status`, `parentBoardId`; bestehende optionale Felder sowie `dueDate` (ISO-8601-String oder `null`) und `priority` (`none | low | medium | high`).
- **Erfolg:** `201 { data: { task } }`; `task.dueDate` ist ein ISO-JSON-Datumsstring oder `null`, und `task.priority` ist immer einer der Enum-Werte.
- **Fehler:** `400 VALIDATION_ERROR` mit `dueDate must be a valid ISO date or null` oder `priority must be one of: none, low, medium, high`; bestehende Meldungen für fehlendes Board/Status/Order sowie `404 NOT_FOUND` für ein fehlendes Parent-Board beibehalten.

### `PUT /api/tasks/:taskId`

- **Body:** Beliebige bestehende partielle Felder sowie optional `dueDate` und `priority`; `dueDate: null` löscht das Datum.
- **Erfolg:** `200 { data: { task } }` mit derselben Serialisierung.
- **Fehler:** `400 VALIDATION_ERROR` für ungültige neue Werte oder ein leeres Update; `404 NOT_FOUND` für fehlenden Task/Parent-Board. Mongoose-Validierungsfehler müssen weiterhin über die bestehende Error-Middleware als `VALIDATION_ERROR`/400 laufen.

Vorgeschlagener Route-Validierungshelper (kopierbar, keine neue Dependency):

```js
const PRIORITIES = ['none', 'low', 'medium', 'high']

const validateTaskFields = ({ dueDate, priority }) => {
  if (dueDate !== undefined && dueDate !== null) {
    if (typeof dueDate !== 'string' || Number.isNaN(new Date(dueDate).getTime())) {
      throw validationError('dueDate must be a valid ISO date or null')
    }
  }
  if (priority !== undefined && !PRIORITIES.includes(priority)) {
    throw validationError('priority must be one of: none, low, medium, high')
  }
}
```

Die Route muss diesen Helper für POST und PUT aufrufen, die Felder in `Task.create`/`update` aufnehmen und mit `res.json({ data: { task } })` serialisieren.

## 5. Dateiänderungen

- **Modify** `server/models/Task.js:8-41` — nullable, indexiertes Datum und Priority-Defaults ergänzen.
- **Modify** `server/routes/tasks.js:18-134` — Felder für POST/PUT validieren und weiterreichen; Feldänderungen in Activity-Metadaten aufnehmen, wo die bestehende Route Updates protokolliert.
- **Create** `server/scripts/migrate-task-fields.js` — exportierte idempotente Migration und ausführbare CLI.
- **Modify** `server/package.json:7-10` — `"migrate:task-fields": "node scripts/migrate-task-fields.js"` ergänzen.
- **Modify** `client/src/lib/api.js:35-49` — JSDoc und expliziten Vertrag für `createTask`/`updateTask` ergänzen.
- **Modify** `client/src/store/useBoardStore.js:121-184,332-391` — Defaults/neue Felder durch optimistischen Create/Update, Rollback und Server-Replacement führen.
- **Modify** `client/src/pages/TaskDetailPage.jsx:40-101,236-280` — Datumseingabe, Priority-Segmented-Control, Dirty-/Discard-/Save-Verhalten und zugänglichen Validierungsstatus ergänzen.
- **Create** `client/src/lib/priority.js` — Enum-Labels, `priorityColor` und sichere Anzeige-/Datumshelper.
- **Modify** `client/src/components/TaskCard.jsx:37-73` — Datums-Chip, Overdue-State und Priority-Dot mit zugänglichen Labels.
- **Modify** `client/src/views/TableView.jsx:11-81,140-201` — produktbestätigte Priority-/Due-date-Spalten und null-/invalid-sicheres Sortieren/Rendern.
- **Modify** `client/tailwind.config.js:29-105` — Safelist nur, falls gewählte Priority-Tokens dynamisch sind; vorhandene Tokens möglichst wiederverwenden.
- **Modify** `server/__tests__/tasks.test.js` — Endpoint-Validierung und Round-Trip-Abdeckung.
- **Create** `server/__tests__/migrate-task-fields.test.js` — Migrations-Defaults, Logging, Idempotenz und Testbarkeit per Injection.
- **Modify** `client/src/__tests__/task-detail.test.jsx` — Datum/Priority-Controls sowie Save-/Discard-/Fehlerfälle.
- **Create** `client/src/__tests__/use-board-store.test.js` — optimistischer Round-Trip und Rollback.
- **Create** `client/src/__tests__/task-card.test.jsx` — Chip/Dot/Overdue und null/invalid Rendering.
- **Modify** `client/src/__tests__/table-view.test.jsx` — bestätigte Spalten, Sortierung und sessionStorage-Kompatibilität.

## 6. Implementierungsschritte

1. `server/models/Task.js` und `server/routes/tasks.js` mit Feldern, gemeinsamem Validator, POST/PUT-Weitergabe, serialisierten Antworten und Activity-Felddiffs aktualisieren.
2. `server/scripts/migrate-task-fields.js` erstellen und `server/package.json` aktualisieren; Migration für Tests injizierbar sowie mit `MONGODB_URI` und dem Hinweis zur In-Memory-Dev-Datenbank sicher machen.
3. `server/__tests__/tasks.test.js` erweitern und `server/__tests__/migrate-task-fields.test.js` erstellen; die vollständige Server-Suite vor der Client-Arbeit ausführen.
4. `client/src/lib/api.js` und `client/src/store/useBoardStore.js` aktualisieren; JSDoc, Defaults für optimistische Creates, feldbewahrende optimistische Updates, Rollback und Server-Replacement ergänzen.
5. `client/src/lib/priority.js` hinzufügen und `client/src/pages/TaskDetailPage.jsx` aktualisieren; Datumsnormalisierung, Priority-Control, Tastatur-/Fokusverhalten, Dirty-State, Save/Discard und Fehlerbehandlung implementieren.
6. `client/src/components/TaskCard.jsx` und nach Produktbestätigung `client/src/views/TableView.jsx` sowie `client/tailwind.config.js` aktualisieren; Grid/Kanban über `TaskCard` wiederverwenden und keine separate View-Komponente hinzufügen.
7. `client/src/__tests__/task-detail.test.jsx` erweitern, Store-/Card-Tests hinzufügen und Table-Tests aktualisieren; die vollständigen 168-Client-/50-Server-Baselines plus neue Tests und `vite build` ausführen.

## 7. Sonderfälle und Fehlerbehandlung

- Fehlende Felder alter Dokumente werden auch vor der Migration als `null`/`none` dargestellt; die Migration macht diese Werte explizit.
- `dueDate: null` löscht ein Datum; ein fehlendes `dueDate` ändert es nicht; `''`, fehlerhafte ISO-Strings, Nicht-Strings und nicht-endliche Daten liefern `400 VALIDATION_ERROR`.
- HTML-Dateinputs liefern `YYYY-MM-DD`; diesen reinen Datumswert stabil halten und für den Form-State nicht `new Date('YYYY-MM-DD').toISOString()` verwenden, da Zeitzonen den Tag verschieben können.
- `priority` ist case-sensitive und an die Enum gebunden; ungültige Werte werden vor dem Update abgewiesen, zusätzlich bleibt die Schema-Validierung aktiv.
- Ungültige/null Legacy-Daten dürfen Rendering, Sortierung oder `Intl.DateTimeFormat` nicht zum Absturz bringen; Chip/Zelle ausblenden und null/ungültige Due-Dates ans Ende sortieren.
- Overdue wird gegen den lokalen Kalendertag geprüft, schließt heute aus und wird zusätzlich zu einem Danger-Token mit Text/ARIA (`Overdue`) vermittelt.
- Bestehendes Task-Anlegen behält `dueDate: null` und `priority: 'none'`; kein API-Aufrufer soll auf undefined-Werte angewiesen sein.
- Fehler beim Speichern folgen `docs/error-handling.md:45-59`: vorherigen Board-Snapshot wiederherstellen, bestehendes Error-Banner setzen und Controls reaktivieren. Das Detailformular darf bei Fehlern nicht Saved anzeigen.
- Schnelle Save-/Status-Interaktionen bleiben durch `isSaving`/`isStatusSaving` blockiert; Discard stellt alle vier lokalen editierbaren Werte wieder her.
- Die Migration ist idempotent und loggt beim zweiten Lauf null Änderungen. Sie darf nicht stillschweigend die ephemere MongoMemoryServer-Datenbank treffen; bei fehlendem `MONGODB_URI` klar fehlschlagen und Zielkontext loggen.
- React-Text-Rendering bleibt XSS-sicher; kein Raw HTML und keine neue Client-Dependency.

## 8. Teststrategie

### Server (mindestens 6 neue Tests; Ziel 9)

In `server/__tests__/tasks.test.js`:

1. Das `Task`-Model setzt bei einem neuen Task `dueDate: null` und `priority: 'none'` als Defaults.
2. POST akzeptiert ein gültiges ISO-`dueDate` und jede gültige Priorität und gibt beide Felder zurück.
3. POST akzeptiert `dueDate: null` und setzt den Priority-Default bei Auslassung.
4. POST weist fehlerhafte/nicht-stringige Due-Dates mit `400 VALIDATION_ERROR` ab.
5. POST weist eine ungültige Priority mit `400 VALIDATION_ERROR` ab.
6. PUT führt Datum und Priority per Round-Trip zurück, danach löscht ein zweites PUT mit `dueDate: null` das Datum.
7. PUT weist fehlerhafte Daten und ungültige Priority ab, ohne den Task zu ändern.

In `server/__tests__/migrate-task-fields.test.js`:

8. Ein injiziertes Model migriert Dokumente mit fehlenden Feldern, loggt IDs/Anzahl und lässt bestehende Werte unverändert.
9. Ein zweiter Migrationslauf ergibt null Änderungen.

Den bestehenden Node-Test-Runner, `mongodb-memory-server` und `supertest`-Aufbau verwenden. Die exportierte Migrationsfunktion mit Model-/Collection-Injection testen statt einen Prozess zu starten; die CLI bei Bedarf separat nur auf Exit-/Connect-Verhalten testen.

### Client (mindestens 4 neue Tests; Ziel 8+)

- `client/src/__tests__/task-detail.test.jsx`: Datumseingabe und vier Priority-Radios rendern; Änderungen machen dirty; Save sendet `YYYY-MM-DD` und gewählte Priority; Leeren sendet `dueDate: null`; Tastatur/Fokus und `aria-checked` funktionieren; ein fehlgeschlagenes Save behält Fehler bei und zeigt nicht Saved.
- `client/src/__tests__/use-board-store.test.js`: Update-Round-Trip bewahrt Datum/Priority aus der API; optimistisches Update ist sofort sichtbar; abgelehnte API stellt den exakten vorherigen Task wieder her und setzt den Fehler; addTask sendet `null`/`none`-Defaults.
- `client/src/__tests__/task-card.test.jsx`: gültiger Datums-Chip nutzt `Intl`-Ausgabe; null/ungültige Daten rendern sicher; Overdue besitzt Text/ARIA und Danger-Token; Priority-Dot erscheint nur bei nicht `none` und stellt sein Label bereit.
- `client/src/__tests__/table-view.test.jsx`: bestätigte Spalten rendern, gültige Werte sortieren, null/ungültige Daten ans Ende setzen, bestehendes `aria-sort` bewahren und alten sessionStorage-Sort-State wiederherstellen.

Die bestehenden 168 Client- und 50 Server-Tests ohne unnötige Änderung ihrer Erwartungen ausführen, danach `npm test` in jedem Workspace sowie `npm run build --workspace=client`/den bestehenden `vite build`-Befehl des Repositories ausführen.

## 9. Acceptance Criteria

- [ ] `Task` besitzt ein indexiertes nullable `dueDate` und eine Enum-`priority` mit den spezifizierten Defaults.
- [ ] POST und PUT validieren beide Felder mit den etablierten `400 VALIDATION_ERROR`-Envelopes und führen serialisierte Werte zurück.
- [ ] `dueDate: null` löscht ein Datum, ausgelassene Felder bleiben unverändert und ungültige Eingaben können keinen Task mutieren.
- [ ] `npm run migrate:task-fields` verbindet über `MONGODB_URI`, loggt geänderte Dokumente/Anzahl, ist idempotent und über eine exportierte Funktion unit-testbar.
- [ ] Bestehende und neue Tasks rendern sicher mit `null`/`none`-Defaults; das Verhalten der In-Memory-Dev-Datenbank ist dokumentiert.
- [ ] `api.createTask`/`api.updateTask` und `useBoardStore.addTask`/`updateTask` führen die Felder mit JSDoc und optimistischem Rollback weiter.
- [ ] `TaskDetailPage` ersetzt den veralteten `TaskForm`-Umfang durch Dateinput und zugänglichen, per Tastatur bedienbaren Priority-Segmented-Control.
- [ ] Save/Discard, sofortige Status-Saves, Validierung, Netzwerkfehler und Rollback verhalten sich konsistent mit der bestehenden UX.
- [ ] `TaskCard` zeigt sichere Datums-/Priority-Oberflächen einschließlich zugänglichem Overdue-State.
- [ ] Die Produktentscheidung für TableView ist festgehalten; bei Zustimmung sind Priority und Due date sortierbar und null-sicher.
- [ ] Mindestens 6 Server- und 4 Client-Tests sind ergänzt; alle 168 bestehenden Client- und 50 bestehenden Server-Tests bestehen.
- [ ] Keine neue Dependency, Calendar View (#29), Erinnerung, Notification oder Raw-HTML-Darstellung wird ergänzt; der Client-Build ist sauber.

## 10. Out of Scope

- Calendar View (#29), wiederkehrende Tasks, Erinnerungen, Notifications, Filter-UI und serverseitige Reminder-Jobs.
- Änderungen an Authentifizierung/Autorisierung, Board-Status-Redesign, neue Persistenztechnologie oder API-Versionierung.
- Eine `TaskForm.jsx`-Komponente: `TaskDetailPage.jsx` ist der einzige bestehende Task-Editor.
- Das Ableiten historischer Fälligkeitsdaten/Prioritäten; die Migration setzt nur explizite Defaults.
- Neue npm-Dependencies oder ein Transaktions-/Wartungs-Orchestrierungssystem über die Dokumentation der Produktionsentscheidung hinaus.

## 11. Risiken und offene Fragen

### Risiken

- Eine Produktionsmigration kann viele Dokumente und einen Index betreffen; Backup erstellen, gegen die vorgesehene `MONGODB_URI` ausführen, Logs beobachten und bei Bedarf ein Wartungsfenster nutzen. Die dokumentweise Migration ist idempotent, aber keine vollständig atomare Transaktion.
- Reine Datumswerte können sich bei UTC-Konvertierung um einen Tag verschieben; `YYYY-MM-DD` im Client und lokaler Kalendertag für Overdue vermeiden diesen UI-Fehler.
- Dynamische Tailwind-Klassen können entfernt werden; statische/gesafelistete Priority-Tokens verwenden und den Production-Build prüfen.
- Optimistic Activity protokolliert derzeit nur Name-/Beschreibung-/Icon-Diffs; Date-/Priority-Diffs dürfen weder doppelte Server-Aktivitäten noch inkompatible Feed-Konsumenten erzeugen.

### Fragen an Product

- **TableView:** Die Empfehlung für sortierbare Spalten `Priority` und `Due date` freigeben? Vorgeschlagene Reihenfolge: `Name | Status | Priority | Due date | Created | Updated`.
- **Overdue-Styling:** Danger-Styling plus expliziten `Overdue`-Text/ARIA freigeben, wobei heute nicht überfällig ist?
- **Locale:** Feste `en-US`-Ausgabe von `Intl.DateTimeFormat` (`Aug 30`) freigeben oder Browser-/User-Locale verwenden?
- **Migrationsbetrieb:** Welche Umgebung/welches Wartungsfenster soll `npm run migrate:task-fields` ausführen, und ist ein Backup-/Rollback-Verfahren durch Deployment vorgeschrieben?
- **Activity Feed:** Sollen Datums-/Priority-Änderungen als Activity-Einträge angezeigt werden oder nur ohne neuen Activity-Typ gespeichert werden?
