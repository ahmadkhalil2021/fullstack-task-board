# Implementierungsplan — Issue #13: Board-Status in der UI verwalten

## 1. Zusammenfassung

Ein Status-Management-UI zu `BoardHeader` hinzufügen, damit Board-Besitzer board-level Status hinzufügen, umbenennen und entfernen können. Änderungen werden über die bestehende `updateBoard` Store-Action persistiert, die `PUT /api/boards/:boardId` aufruft. Das Entfernen wird blockiert, solange noch Tasks diesen Status verwenden, und die Schema-Beschränkung, dass mindestens ein Status verbleiben muss, wird im UI durchgesetzt.

## 2. Architektur- & Design-Entscheidungen

| # | Entscheidung | Empfohlene Option | Begründung |
|---|--------------|-------------------|------------|
| 1 | UI-Container | **B — Modal/Dialog, geöffnet über einen Button** | Hält `BoardHeader` übersichtlich; Status-Management ist eine seltene Power-User-Aktion. Ein Dialog bietet außerdem Platz für Validierungsmeldungen, ohne die Board-Ansicht zu überladen. |
| 2 | Neuen Status hinzufügen | **A — "Add status"-Button unterhalb der Statusliste** | Klarer, Ein-Klick-Mechanismus. Einfacher als ein immer sichtbares Inline-Input und vermeidet versehentliche leere Zeilen. |
| 3 | Status umbenennen | **A — Klick auf Statusnamen → Inline-Edit** | Direkte Manipulation; entspricht dem bestehenden Board-Namen-Edit-Muster in `BoardHeader`. |
| 4 | Status entfernen | **B — Trash-Icon-Button + Modal-Bestätigung** | Explizit und sicher. Verhindert versehentliches Löschen besser als ein rein tooltip-basierter ×-Button. |
| 5 | Validierung | **Inline-Meldung + deaktiviertes Entfernen** | Wenn ein Status Tasks enthält, "Move X tasks before removing" anzeigen und den Trash-Button deaktivieren. Wenn es der letzte Status ist, Entfernen deaktivieren (Schema erfordert ≥1). Leere/doppelte Namen sind ungültig. |
| 6 | Reorder-Support | **Für Issue #13 überspringen** | Außerhalb des Scopes; kann später hinzugefügt werden, ohne das Datenmodell zu ändern, da `statuses` bereits ein geordnetes Array ist. |

## 3. State Machine / Flow

```
User öffnet den Status-Manager
        │
        ▼
Local draftStatuses wird aus board.statuses initialisiert
        │
        ▼
┌─────────────────────────────────────┐
│ Hinzufügen / Umbenennen / Entfernen │
│ (lokal)                             │
│ • Duplikate & Leerwerte validieren  │
│ • Entfernen blockieren, falls Tasks │
│   existieren                        │
│ • Entfernen blockieren, falls letzter│
│   Status                            │
└─────────────────────────────────────┘
        │
        ▼
On blur (Umbenennen) oder confirm (Entfernen/Hinzufügen)
        │
        ▼
useBoardStore.updateBoard({ statuses: draftStatuses }) aufrufen
        │
        ▼
┌─────────────────────────────────────┐
│ Optimistic Update in Zustand        │
│ Rollback bei API-Fehler             │
└─────────────────────────────────────┘
        │
        ▼
Inline-Fehler anzeigen oder Dialog bei Erfolg schließen
```

## 4. API Contract

Der bestehende Endpoint wird verwendet:

```
PUT /api/boards/:boardId
Content-Type: application/json

Body: { statuses: string[] }

Response 200:
{
  "data": {
    "board": {
      "_id": "...",
      "name": "...",
      "statuses": [...],
      "tasks": [...]
    }
  }
}
```

Die Validierung existiert bereits in `server/routes/boards.js`:

- `statuses` muss ein nicht-leeres Array sein
- Jeder Status muss ein nicht-leerer String sein

Für dieses Issue sind keine Backend-Änderungen erforderlich.

## 5. Datei-Änderungen

| Datei | Änderung |
|-------|----------|
| `client/src/components/BoardHeader.jsx` | Gear/Settings-Button hinzufügen, der den Status-Manager-Dialog öffnet |
| `client/src/components/StatusManager.jsx` | **Neue Komponente** — Dialog mit Add/Rename/Remove UI |
| `client/src/store/useBoardStore.js` | Keine Änderung; bestehende `updateBoard`-Action wiederverwenden |
| `server/routes/boards.js` | Keine Änderung; Endpoint unterstützt bereits `{ statuses }` |
| `server/models/Board.js` | Keine Änderung; Schema unterstützt bereits custom Statuses |
| `docs/adr/0007-board-level-statuses.md` | Keine Änderung; ADR empfiehlt bereits das Blockieren von Entfernen |

## 6. Implementierungsschritte

1. `client/src/components/StatusManager.jsx` erstellen
   - Props: `isOpen`, `onClose`, `board`, `onSave`
   - `draftStatuses` aus `board.statuses` initialisieren
   - Jeden Status als inline editierbare Zeile rendern
   - Tasks pro Status aus `board.tasks` zählen
   - Validierungsfehler pro Zeile anzeigen
   - Add/Remove-Handler implementieren
2. Einen Settings/Gear-Button zu `BoardHeader.jsx` neben `ThemeToggle` hinzufügen
3. Button mit Öffnen von `StatusManager` verknüpfen
4. In `StatusManager` bei Speichern/Blur `updateBoard({ statuses })` aufrufen
5. Bei API-Fehler: Fehler inline anzeigen und Dialog geöffnet halten; Store-Rollback stellt den vorherigen Zustand wieder her
6. Grundlegendes Styling mit Tailwind utility classes im bestehenden Theme

## 7. Edge Cases & Error Handling

| Szenario | Handling |
|----------|----------|
| Umbenennen erzeugt Duplikat | Zeile als ungültig markieren, Speichern deaktivieren, "Status names must be unique" anzeigen |
| Umbenennen zu leerem String | Ungültig markieren, bei Blur zurücksetzen oder "Status name is required" anzeigen |
| Letzten Status entfernen | Remove-Button deaktivieren mit Tooltip "A board must have at least one status" |
| Status mit Tasks entfernen | Remove-Button deaktivieren, "Move N task(s) before removing" anzeigen |
| API schlägt fehl | Rollback über bestehende `updateBoard`-Logik; Dialog zeigt Fehler und bleibt offen |
| User schließt Dialog mit ungespeicherten Änderungen | Bestätigungs-Prompt, wenn lokaler Draft vom persistierten Zustand abweicht (optional, kann verschoben werden) |

## 8. Teststrategie

- **Manueller Smoke-Test**: Status hinzufügen, umbenennen, entfernen auf einem frischen Board
- **Validierungs-Test**: Versuch, einen Status mit Tasks zu entfernen; Button muss deaktiviert sein
- **API-Failure-Test**: Netzwerk-Request blockieren und prüfen, ob Rollback die vorherigen Status wiederherstellt
- **Regressionstest**: Sicherstellen, dass `addTask` weiterhin neue Tasks in `board.statuses[0]` platziert
- **Accessibility-Check**: Dialog fängt Fokus, Buttons haben `aria-label`, Inputs haben Labels

## 9. Akzeptanzkriterien

- [ ] Ein Button in `BoardHeader` öffnet den Status-Manager-Dialog
- [ ] User können einen neuen Status zum Board hinzufügen
- [ ] User können einen bestehenden Status inline umbenennen
- [ ] User können einen bestehenden Status nach Modal-Bestätigung entfernen
- [ ] Das Entfernen eines Status wird blockiert, wenn Tasks in diesem Status existieren
- [ ] Das Entfernen des letzten Status wird blockiert
- [ ] Doppelte oder leere Statusnamen werden im UI abgelehnt
- [ ] Änderungen werden via `PUT /api/boards/:boardId` persistiert
- [ ] API-Fehler rollen das UI in den vorherigen Zustand zurück
- [ ] Bestehende Tasks werden auch nach Status-Änderungen weiterhin in der korrekten Spalte angezeigt

## 10. Out of Scope

- Drag-and-Drop-Reihenfolge von Status
- Cascading-Änderung von Task-Status beim Entfernen eines Status
- Berechtigungen / Read-only-Modus für Nicht-Besitzer
- Animationen oder aufwendige Transitionen im Dialog

## 11. Risiken & Offene Fragen

| Risiko | Mitigation |
|--------|------------|
| Umbenennen eines Status verschiebt bestehende Tasks visuell, da Spalten nach Status-String gerendert werden | Erwartetes Verhalten; Tasks behalten ihren `status`-Wert, die Spaltenüberschrift ändert sich. Ggf. im UI-Text dokumentieren. |
| Dialog-Zustand kann nach Rollback vom Store abweichen | Bei `updateBoard`-Fehler `draftStatuses` aus `board.statuses` neu synchronisieren (gleiches Muster wie `draftName` in `BoardHeader`). |
| Mehrere schnelle Umbenennungen lösen viele API-Requests aus | Blur-Saves um ~300 ms debouncen oder bis zum expliziten Speichern batching. Für die erste Iteration ist einfaches Blur-Save akzeptabel. |

### Offene Fragen

1. Soll das Umbenennen eines Status auch das `status`-Feld aller zugehörigen Tasks aktualisieren? **Empfehlung: nein.** Der Board-Level-Status ist ein Label; Tasks referenzieren ihn als String. Ein Label-Wechsel ändert den Spaltennamen, erhält aber den Task-Zustand.
2. Soll sich der Dialog nach erfolgreichem Speichern automatisch schließen? **Empfehlung: nein.** Er bleibt geöffnet, damit User mehrere Bearbeitungen vornehmen können; schließen nur über expliziten Close- oder Cancel-Button.
