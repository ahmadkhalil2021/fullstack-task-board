# Implementierungsplan — GitHub Issue #8: Neue Aufgabe hinzufügen

**Status**: Auf Feature-Branch implementiert (noch nicht gemergt)
**Komponenten-Scope**: `client/src/components/AddTaskButton.jsx`, `Column.jsx`, `BoardPage.jsx`, `useBoardStore.js`
**Bugfix enthalten**: `useBoardStore.addTask` hat `parentBoardId` gefehlt — Deployment-blockierend

---

## 1. Zusammenfassung

Es wird ein **"+ Add new task"**-Button am unteren Ende der ersten Spalte des Boards hinzugefügt. Ein Klick erstellt eine neue Aufgabe in `board.statuses[0]`, die neue Aufgabe erscheint oben in dieser Spalte, und das bestehende `TaskForm`-Modal öffnet sich mit fokussiertem und selektiertem Namens-Eingabefeld, sodass der Benutzer sie sofort umbenennen kann. Die Arbeit behebt außerdem einen Deployment-blockierenden Bug in `useBoardStore.addTask`: Die vorherige Implementierung rief `api.createTask({ status })` auf, aber der Server benött `parentBoardId` im Body (`server/routes/tasks.js:21-23`). Alle Änderungen folgen dem Flux-Pattern (UI → Zustand Store → API), nutzen Optimistic Updates mit Rollback und verwenden die etablierte `TaskForm`-Komponente wieder.

---

## 2. Architektur & Design-Entscheidungen

### Offene Entscheidungen — Empfehlungen

1. **Wo lebt der Button?**
   **Empfehlung**: Option A — am unteren Ende der ersten Spalte.
   **Warum**: Issue #8 begrenzt die Erstellung auf "die erste Spalte". Ein pro-Spalte-Button (Option B) oder schwebender Button (Option C) erweitert den Scope und erzeugt UX-Mehrdeutigkeit. Die Platzierung am unteren Ende der ersten Spalte folgt der Kanban-Konvention (z. B. Trello "Add a card") und assoziiert die Aktion eindeutig mit der Zielspalte. Sie wird in `Column.jsx` nur gerendert, wenn `BoardPage` einen `onAddTask`-Callback bereitstellt.

2. **Wie funktioniert Auto-Focus für die Bearbeitung?**
   **Empfehlung**: Option A — das bestehende `TaskForm`-Modal wiederverwenden.
   **Warum**: `TaskForm.jsx:49-52` fokussiert und selektiert das Namens-Eingabefeld bereits beim Mount. Die Wiederverwendung hält die Codebase DRY und konsistent mit den Konventionen aus Issue #9. Das Modal öffnet sich erst, nachdem die API die echte Aufgabe zurückgegeben hat, sodass das fokussierte Eingabefeld die persistierte Aufgabe bearbeitet.

3. **Was ist der Standard-Aufgabenname?**
   **Empfehlung**: `"New Task"`.
   **Warum**: Entspricht dem bestehenden Default in `useBoardStore.js:182` und `Task.js`. Da sich das Modal sofort zur Bearbeitung öffnet, ist der Default nur ein transienter Platzhalter.

4. **Position in der Spalte?**
   **Empfehlung**: Oben in der ersten Spalte.
   **Warum**: Neue Backlog-Einträge sind oben am sichtbarsten und entsprechen dem "newest first"-Mental-Model. Die Implementierung setzt `newOrder = min(existing orders in column) - 1` (Default `0` für leere Spalten), sodass die Aufgabe zuerst sortiert wird. Der bestehende `reorderTasksInColumn`-Flow normalisiert zurück zu `0..n-1`.

5. **Wo gehört der `parentBoardId`-Fix hin?**
   **Empfehlung**: In die Store-Action `addTask`.
   **Warum**: Per Flux-Pattern besitzt der Store die API-Aufrufe und hat Zugriff auf `board._id`. Das Übergeben von `parentBoardId` aus einer Komponente würde API-Vertragsdetails in die UI leaken.

### Action Flow

1. Benutzer klickt den **+ Add new task**-Button am unteren Ende von Spalte 1.
2. `BoardPage` (welches den Modal-State besitzt) deaktiviert den Button und ruft `addTask(board.statuses[0])` auf.
3. `useBoardStore.addTask` speichert `previousBoard`, erstellt eine optimistische Temp-Aufgabe mit `order = min - 1`, hängt sie an `board.tasks` an und ruft `api.createTask({ ..., parentBoardId: board._id })` auf.
4. API erstellt die Aufgabe und gibt die persistierte Aufgabe zurück.
5. Store ersetzt die Temp-Aufgabe durch die echte Aufgabe und gibt die echte Aufgabe zurück.
6. `BoardPage` empfängt die echte Aufgabe und ruft `setEditingTask(realTask)` auf.
7. `TaskForm` mountet, fokussiert auto­matisch das Namens-Eingabefeld und selektiert den Text.

---

## 3. State Machine / Flow

```
[Idle] ──click Add new task──> [Creating]
  ↑                               │
  │                               ▼
[Error] <────API failure──── [API in flight]
  │  (rollback board to previousBoard)
  │
  └──user can retry────────> [Idle]

[API in flight] ──success──> [Editing]
  │                            │
  │                            ▼
  │                    TaskForm modal open
  │                    name input focused
  │                            │
  │                            ▼
  │                    [Idle] after Save/Cancel
  └───API error────> [Error]
```

### Optimistic Update & Rollback

- Beim Klick hängt der Store sofort eine Temp-Aufgabe mit `_id = temp-${Date.now()}-${rand}` an `board.tasks` an.
- Bei API-Fehler stellt `set({ board: previousBoard, error: err.message })` den vorherigen Zustand wieder her.
- Der geworfene Fehler propagiert zu `BoardPage`, welches das Modal geschlossen hält und den Button wieder aktiviert.

### Focus Management After Creation

- Focus wird von `TaskForm.jsx:49-52` via `nameRef.current?.focus()` und `.select()` in einem Mount-`useEffect` gehandhabt.
- `BoardPage` öffnet das Modal erst, nachdem die echte Aufgabe zurückgegeben wurde, sodass `TaskForm` eine stabile persistierte Aufgabe erhält.

---

## 4. API-Vertrag

### `POST /api/tasks`

- **Pfad**: `/api/tasks`
- **Methode**: `POST`
- **Pflicht-Body-Felder**: `status`, `parentBoardId` (`server/routes/tasks.js:21-26`)
- **Optionale Body-Felder**: `name`, `description`, `icon`, `order`
- **Request-Body-Beispiel**:
  ```json
  {
    "name": "New Task",
    "description": "",
    "icon": "⏰",
    "status": "Backlog",
    "order": -1,
    "parentBoardId": "64b2f1a..."
  }
  ```
- **Erfolgs-Response `201`**:
  ```json
  {
    "data": {
      "task": {
        "_id": "64b2f1e...",
        "name": "New Task",
        "description": "",
        "icon": "⏰",
        "status": "Backlog",
        "order": -1,
        "parentBoardId": "64b2f1a...",
        "createdAt": "...",
        "updatedAt": "..."
      }
    }
  }
  ```
- **Validierung** (`server/routes/tasks.js:21-38`): erfordert `parentBoardId` und `status`, verifiziert, dass das Parent-Board existiert, prüft, dass `status` in `board.statuses` enthalten ist, und (seit der Implementierung) verifiziert, dass `order` eine finite Zahl ist, falls angegeben.

### Enthaltene Server-seitige Änderung

`POST /api/tasks` akzeptiert und persistiert jetzt **`order`** (`server/routes/tasks.js:27-29,41`). Die ursprüngliche Implementierung hat `order` stillschweigend verworfen, was dazu geführt hätte, dass neue Aufgaben auf `order: 0` defaulten und die "erscheint oben"-Anforderung gebrochen hätten.

---

## 5. Datei-Änderungen

**Modify**

- `client/src/store/useBoardStore.js` — `addTask` fixen: `parentBoardId` hinzufügen, Top-`order` berechnen, erstellte Aufgabe zurückgeben, werfen wenn kein Board geladen.
- `client/src/components/Column.jsx` — `AddTaskButton` am unteren Ende rendern wenn `onAddTask` Prop vorhanden; `isAddingTask` für Disabled-State akzeptieren.
- `client/src/pages/BoardPage.jsx` — `handleAddTask` hinzufügen, `onAddTask`/`isAddingTask` nur an die erste `Column` übergeben, gegen Doppelklicks via `hasStarted` Ref absichern.
- `server/routes/tasks.js` — `order` in `POST /api/tasks` akzeptieren und validieren.
- `server/__tests__/tasks.test.js` — Tests für `order`-Persistenz und -Validierung hinzufügen.
- `docs/api-contract.md` — `POST /api/tasks`-Sektion hinzufügen.

**Create**

- `client/src/components/AddTaskButton.jsx` — Präsentational Button mit gestrichelter Border.
- `client/src/__tests__/add-task.test.jsx` — 8 Unit-Tests für den kompletten Flow.

---

## 6. Implementierungs-Schritte

1. **Store-Action fixen.**
   - Edit `client/src/store/useBoardStore.js:165-217`.
   - `newOrder` so berechnen, dass die Aufgabe oben in der Zielspalte sortiert wird.
   - `parentBoardId: previousBoard._id` an `api.createTask` übergeben.
   - Die persistierte Aufgabe aus der Action zurückgeben.

2. **Button-Komponente erstellen.**
   - `client/src/components/AddTaskButton.jsx` hinzufügen.
   - `onClick` und `disabled` Props akzeptieren.
   - Mit Tailwind als Full-Width Dashed-Button stylen.

3. **Button in die erste Spalte einbinden.**
   - Edit `client/src/components/Column.jsx`.
   - Optionale `onAddTask` und `isAddingTask` Props akzeptieren.
   - `<AddTaskButton ... />` nach der Task-Liste rendern, nur wenn `onAddTask` definiert ist.

4. **BoardPage verbinden.**
   - Edit `client/src/pages/BoardPage.jsx`.
   - `isAddingTask` State und `hasStarted` Ref für Doppelklick-Schutz hinzufügen.
   - `handleAddTask` implementieren: `addTask(board.statuses[0])` awaiten, dann `setEditingTask` aufrufen.
   - `onAddTask={handleAddTask}` und `isAddingTask={isAddingTask}` nur an die erste Spalte übergeben (`index === 0`).

5. **Server `order` akzeptieren lassen.**
   - Edit `server/routes/tasks.js:19,27-29,41` zum Parsen und Validieren von `order`.

6. **API-Vertrag dokumentieren.**
   - Edit `docs/api-contract.md` und `POST /api/tasks`-Sektion hinzufügen.

7. **Unit-Tests hinzufügen.**
   - `client/src/__tests__/add-task.test.jsx` mit 8 Tests erstellen.
   - 2 Server-Tests in `server/__tests__/tasks.test.js` hinzufügen.

8. **Verifizieren.**
   ```bash
   npm run test --workspace=client
   npm run test --workspace=server
   npm run lint --workspace=client
   npm test
   ```

---

## 7. Edge Cases & Fehlerbehandlung

- **API-Fehler → Optimistic Rollback**: `addTask` speichert `previousBoard`, wendet das Optimistic Update an und stellt `previousBoard` bei jedem API-Fehler wieder her. `BoardPage` fängt den geworfenen Fehler und öffnet das Modal nicht. Der `error` des Stores wird von der bestehenden Error-UI in `BoardPage` angezeigt.
- **Doppelklick / schnelle Klicks**: `hasStarted` Ref in `BoardPage` (analog zum Pattern aus Issue #9) kombiniert mit `isAddingTask` State, der den Button deaktiviert. Frühzeitiger Return aus `handleAddTask`, falls bereits in Flight.
- **Benutzer navigiert während der Erstellung weg**: Zustand `set` ist sicher unabhängig vom Mount-State. `setEditingTask` auf einer unmounted Komponente ist harmlos in React 18.
- **React StrictMode Doppel-Invocation**: Die `hasStarted` Ref verhindert, dass derselbe Handler zweimal gleichzeitig läuft. Die Ref wird in `finally` nach Abschluss der Async-Operation zurückgesetzt.
- **Modal ohne Speichern geschlossen**: Die persistierte Aufgabe behält den Default-Namen. Akzeptabel; der Benutzer kann sie über die Aufgaben-Karte erneut öffnen.
- **Server-Validierungsfehler (fehlendes `parentBoardId` / ungültiger `status` / nicht-numerischer `order`)**: API gibt `400 VALIDATION_ERROR` zurück, Store macht Rollback, `BoardPage` lässt das Modal geschlossen.
- **Leere erste Spalte**: `newOrder` defaulted auf `0`, wenn keine Aufgaben in der Spalte existieren.
- **Temp-ID-Kollision**: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}` verwenden, um Kollisionen zu vermeiden, falls zwei Aufgaben in derselben Millisekunde erstellt werden.

---

## 8. Testing-Strategie

### Unit-Tests (`client/src/__tests__/add-task.test.jsx`)

Mock `../lib/api.js` via `vi.mock`, Zustand-Store in `beforeEach` zurücksetzen.

1. **Button rendert** in der ersten Spalte mit Text "+ Add new task".
2. **Button rendert NICHT** in anderen Spalten (`getAllByText('+ Add new task')` gibt exakt ein Element zurück).
3. **Klick erstellt eine Aufgabe** — `api.createTask` aufgerufen mit `parentBoardId` und `status: 'Backlog'`.
4. **Position in der Spalte** — `order = min(existing) - 1`, Aufgabe erscheint zuerst wenn nach `order` sortiert.
5. **Default bei leerer Spalte** — `order = 0` wenn keine Aufgaben existieren.
6. **Focus öffnet Edit-Modal** — nach Klick ist `document.activeElement` das Namens-Eingabefeld.
7. **API-Fehler macht Rollback** — Task-Listen-Länge unverändert, `error` gesetzt, Modal nicht offen.
8. **Doppelklick-Schutz** — `fireEvent.click()` zweimal mit nie-auflösendem Promise; `api.createTask` genau einmal aufgerufen.

### Server-Tests (`server/__tests__/tasks.test.js`)

1. **Persistiert das `order`-Feld** wenn in `POST /api/tasks` angegeben.
2. **Weist nicht-numerisches `order` zurück** mit `400 VALIDATION_ERROR`.

### Manuelle Test-Checkliste

1. Lade ein Board. Verifiziere, dass die erste Spalte **+ Add new task** zeigt.
2. Verifiziere, dass die anderen Spalten den Button **nicht** zeigen.
3. Klicke den Button. Eine neue Aufgaben-Karte erscheint sofort oben in der ersten Spalte.
4. Nach dem API-Aufruf öffnet sich das `TaskForm`-Modal mit fokussiertem und selektiertem Namens-Feld.
5. Tippe einen neuen Namen und speichere. Das Modal schließt sich und die Karte zeigt den neuen Namen.
6. Schließe das Modal ohne Speichern. Die Karte bleibt mit dem Default-Namen `"New Task"`.
7. Drossle das Netzwerk auf "Slow 3G" und klicke den Button wiederholt. Nur ein API-Aufruf wird gemacht und der Button ist während des Ladens deaktiviert.
8. Erzwinge, dass `POST /api/tasks` `400` zurückgibt. Die Temp-Karte verschwindet und das Board kehrt zum vorherigen Zustand zurück.

---

## 9. Akzeptanzkriterien

- [ ] Ein "+ Add new task"-Button ist sichtbar am unteren Ende der ersten Spalte.
- [ ] Klick auf den Button erstellt eine neue Aufgabe in der ersten Spalte (`board.statuses[0]`).
- [ ] Die neue Aufgabe erscheint oben in der ersten Spalte.
- [ ] Nachdem die Aufgabe persistiert ist, öffnet sich das `TaskForm`-Modal mit dem Aufgabennamen auto-fokussiert und selektiert.
- [ ] Die Aufgabe wird via `POST /api/tasks` in MongoDB persistiert.
- [ ] `useBoardStore.addTask` übergibt `parentBoardId` an `api.createTask` und fixt damit den Deployment-blockierenden Bug.
- [ ] Server akzeptiert und persistiert das `order`-Feld in `POST /api/tasks`.
- [ ] Optimistic Update wird sofort angewendet; API-Fehler macht Rollback des Stores.
- [ ] Schnelle Klicks werden abgefangen und erzeugen keine doppelten Aufgaben.
- [ ] Alle Unit-Tests (8 Client + 2 Server) bestehen.
- [ ] Linter besteht.
- [ ] Keine Komponente ruft `api.js` oder `fetch` direkt auf; jeder API-Zugriff geht durch `useBoardStore`.

---

## 10. Out of Scope

- Inline-Bearbeitung von Aufgabennamen auf der Karte.
- "Add new task"-Buttons auf anderen Spalten oder ein schwebender Board-Level-Button.
- Drag-and-Drop-Verhalten für Aufgaben, die gerade erstellt werden.
- Server-seitige Normalisierung von `order`-Werten über das Board hinweg.
- Persistierung von Board-Name oder -Beschreibung (getrackt in Issue #10).
- Neue a11y-Features (separat als Follow-ups getrackt).
- Dark-Mode-Verbesserungen (bestehende Tailwind `dark:`-Klassen sind ausreichend).
- Änderungen an der Default-Board-Erstellungslogik oder den Spaltennamen.

---

## 11. Risiken & offene Fragen

### Risiken

- **`order`-Feld-Semantik**: Der Client sendet jetzt `order` (potenziell negativ) an den Server. Vom Task-Modell unterstützt, führt aber negative Werte ein, bis eine Reorder-Operation sie normalisiert. **Mitigation**: Sortier- und Reorder-Tests verifizieren.
- **Modal-Race auf Temp-Karten**: Falls der Benutzer die optimistische Temp-Karte vor der API-Antwort anklickt, öffnet er möglicherweise ein Modal für eine Temp-ID, die bald ersetzt wird. **Mitigation**: Das Modal öffnet sich erst nach API-Erfolg, daher ist diese Race-Bedingung derzeit selten. Das Deaktivieren von `TaskCard`-Klicks für Temp-IDs als Follow-up in Betracht ziehen.
- **Focus in Tests**: `document.activeElement`-Checks können mit StrictMode flaky sein. **Mitigation**: `@testing-library/user-event` und `waitFor` verwenden.

### Offene Fragen

- Soll die neue Aufgabe oben oder unten in der ersten Spalte eingefügt werden? **Entscheidung**: oben (Newest-First-Kanban-Konvention).
- Soll der Default-Name `"New Task"` oder etwas anderes sein? **Entscheidung**: `"New Task"` (entspricht bestehenden Defaults).