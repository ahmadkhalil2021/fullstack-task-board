# Implementierungsplan — Issue #9: Auto-create board on first visit

> **Status:** In PR #15 umgesetzt und gemerged (Merge-Commit `0688eab`)  
> **Sprache:** Deutsch  
> **Verwandt:** `docs/route-design.md`, `docs/state-management.md`, `docs/error-handling.md`

---

## 1. Zusammenfassung

Issue #9 führt einen Landing-Page-Flow ein, der beim Besuch des Root-Pfads `/` automatisch ein neues Task-Board erstellt. Die `HomePage`-Komponente löst beim Mount die bestehende `createBoard`-Zustand-Aktion aus, wartet auf die Antwort des Backends und leitet den Browser dann zu `/board/:boardId` mit `replace: true` weiter. Falls die Erstellung fehlschlägt, zeigt die Komponente die rohe Fehlermeldung und einen **Try again**-Button. Der Board-State wird in `useBoardStore` gehalten, sodass `BoardPage` beim Ankommen nicht neu fetchen muss.

---

## 2. Architektur & Design-Entscheidungen

| Entscheidung | Begründung |
|--------------|------------|
| **Landing Page bei `/` erstellt das Board** | Hält die öffentliche URL einfach (`/`) und gibt jedem Besucher trotzdem ein eigenes Board unter `/board/:boardId`. Entspricht der Produktanforderung „auto-creates a board on first visit“. |
| **Weiterleitung mit `replace: true`** | Entfernt `/` aus dem Browser-History-Stack, sodass *Zurück* vom Board die Erstellung nicht erneut auslöst. Dies war eine festgelegte Entscheidung. |
| **Flux-Pattern: Komponente → Store → API** | `HomePage` ruft `useBoardStore.createBoard()` auf, das wiederum `api.createBoard()` aufruft. Die UI berührt `fetch` nie direkt — so bleibt die Architekturregel aus `docs/state-management.md` gewahrt. |
| **Auf Zustand-Store vertrauen, kein Re-fetch in `BoardPage`** | `createBoard` speichert das vollständige Board im Store. `BoardPage` liest `board` beim ersten Render aus dem Store und vermeidet so einen redundanten `GET /api/boards/:boardId`. Festgelegte Entscheidung. |
| **Lokaler `status` + `error`-State in `HomePage`** | Der Store hat zwar bereits `isLoading`/`error`, aber eine lokale State Machine gibt der Seite präzise Kontrolle über den `creating \| error`-UI-Zustand und die Retry-Logik, ohne den globalen State zu verschmutzen. |
| **Rohe `err.message` wird dem Nutzer angezeigt** | Das Error-Code-Mapping in `api.js` wurde für dieses Issue als out of scope erklärt. Der Fallback-String wird nur angezeigt, wenn der Fehler keine Message hat. |

---

## 3. State Machine / Flow

`HomePage` tracked ihren eigenen Lifecycle mit den folgenden Zuständen:

```
┌──────┐   mount/useEffect   ┌───────────┐
│ idle │ ──────────────────► │ creating  │
└──────┘                     └─────┬─────┘
                                   │
              createBoard resolves │
                                   ▼
                    ┌──────────────────────┐
                    │       success        │ ──► navigate(`/board/${id}`, { replace: true })
                    └──────────────────────┘
                                   │
              createBoard rejects  │
                                   ▼
                              ┌─────────┐
                              │  error  │ ──► render error + "Try again" button
                              └────┬────┘
                                   │
              user clicks retry    │
              hasStarted = false   │
                                   ▼
                              ┌───────────┐
                              │ creating  │ (loop)
                              └───────────┘
```

*Hinweise:*
- `idle` ist nur ein instant nach dem initialen Render; `useEffect` wechselt sofort zu `creating`.
- `success` ist transient: die Weiterleitung unmounted die Komponente, bevor der Nutzer sie sieht.
- Ein `hasStarted` Ref schützt vor doppelter Ausführung unter React 18 StrictMode.

---

## 4. API-Vertrag

### `POST /api/boards`

| | |
|---|---|
| **Method** | `POST` |
| **Path** | `/api/boards` |
| **Body** | `{}` (leeres Objekt — Defaults werden serverseitig gesetzt) |
| **Response** | `201 Created`  
```json
{
  "data": {
    "board": {
      "_id": "...",
      "name": "My Task Board",
      "description": "",
      "statuses": ["Backlog", "Ready", "In progress", "In review", "Done"],
      "tasks": [ /* one default task per status */ ],
      "createdAt": "...",
      "updatedAt": "..."
    }
  }
}
``` |

**Implementierungsdetails aus `server/routes/boards.js`:**
- Akzeptiert optionale `name`, `description` und `statuses`.
- Validiert `statuses`, falls angegeben.
- Erstellt pro Status einen Default-Task via `Task.insertMany`.
- Erstellt das Board mit den neuen Task-IDs.
- Fetched das Board mit `populate('tasks')` neu, bevor es die Antwort zurückgibt.

---

## 5. Datei-Änderungen

```
client/src/pages/HomePage.jsx                 # neu — Landing Page + Auto-Create-Flow
client/src/__tests__/home-page.test.jsx       # neu — 5 Unit-Tests für HomePage
client/src/__tests__/routing.test.jsx         # aktualisiert — Route-Test für "/"-Redirect hinzugefügt
client/src/App.jsx                            # aktualisiert — HomePage bei "/" registriert
client/src/store/useBoardStore.js             # bestehende createBoard-Aktion wiederverwendet
client/src/lib/api.js                         # bestehende createBoard()-Helper wiederverwendet
server/routes/boards.js                       # bestehendes POST /api/boards wiederverwendet
server/models/Board.js                        # bestehende Defaults wiederverwendet
```

---

## 6. Implementierungsschritte

1. **Route in `client/src/App.jsx` hinzufügen.**
   - `{ path: '/', element: <HomePage /> }` als erste Route registrieren.

2. **`client/src/pages/HomePage.jsx` erstellen.**
   - `useNavigate`, `useBoardStore` und React-Hooks importieren.
   - Lokalen State initialisieren: `status = 'creating'`, `error = null`.
   - `hasStarted` Ref (`false`) und `isMounted` Ref (`true`) hinzufügen.
   - `create`-Callback definieren:
     - Mit `hasStarted.current` guarden.
     - Status auf `'creating'` setzen und Fehler löschen.
     - `createBoard()` aus dem Store aufrufen.
     - Bei Erfolg `isMounted.current` prüfen, dann `navigate(`/board/${boardId}`, { replace: true })`.
     - Bei Fehler `isMounted.current` prüfen, dann `status = 'error'` und `error = err?.message \|\| fallback` setzen.
   - In `useEffect`:
     - `isMounted.current = true` neu setzen (erforderlich für React 18 StrictMode; siehe Deviation-Note unten).
     - `create()` aufrufen.
     - Cleanup setzt `isMounted.current = false`.
   - Render:
     - `status === 'error'`: Fehlermeldung + **Try again**-Button.
     - Sonst: Spinner + "Creating your board…".

3. **Store-Aktion anschließen.**
   - `useBoardStore.createBoard` ruft bereits `api.createBoard({})` und speichert das Board.
   - Keine Änderungen an `client/src/store/useBoardStore.js` nötig.

4. **Backend-Endpoint verifizieren.**
   - `POST /api/boards` existiert bereits und gibt das populate Board zurück.
   - Keine Änderungen an `server/routes/boards.js` oder `server/models/Board.js` nötig.

5. **Unit-Tests in `client/src/__tests__/home-page.test.jsx` hinzufügen.**
   - `react-router-dom/useNavigate` mocken.
   - `../lib/api.js` mocken.
   - Zustand-Store vor jedem Test zurücksetzen.
   - Abdecken: Loading-State, Success-Redirect, Error-UI, Retry, StrictMode Single Creation.

6. **`client/src/__tests__/routing.test.jsx` aktualisieren.**
   - Test hinzufügen, der `/` besucht, `createBoard` mockt und prüft, dass `BoardPage` mit dem neuen Board-Namen rendert.

---

## 7. Edge Cases & Error Handling

| Edge Case | Handling |
|-----------|----------|
| **Netzwerkfehler / Serverfehler** | `createBoard` wirft; `HomePage` fängt ab, setzt `status = 'error'`, zeigt `err.message` und einen Retry-Button. |
| **React 18 StrictMode Double Mount** | `hasStarted` Ref stellt sicher, dass `createBoard` auch bei doppeltem Effect-Run in der Entwicklung nur einmal aufgerufen wird. |
| **Unmount der Komponente während des Requests** | `isMounted` Ref wird vor `navigate` und vor `setState` geprüft, um Updates auf einer ungemounteten Komponente zu verhindern. |
| **StrictMode-simulierter Unmount/Remount** | `isMounted.current = true` wird oben im Effect neu gesetzt. Ohne diesen Schritt würde das Cleanup des simulierten Unmounts `isMounted = false` hinterlassen und die Weiterleitung unterdrücken, wenn das zweite Setup resolved. **Dies ist eine dokumentierte Implementierungsabweichung.** |
| **Nutzer drückt Browser-Zurück vom Board** | `replace: true` entfernt `/` aus der History, sodass Zurück auf die vorherige Seite vor der App landet (oder den Browser-Default). Kein dupliziertes Board wird erstellt. |
| **Retry nach Fehler** | `handleRetry` setzt `hasStarted.current = false` und ruft `create()` erneut auf, sodass ein neuer Request möglich ist. |

---

## 8. Testing Strategy

### Neue Unit-Tests: `client/src/__tests__/home-page.test.jsx`

1. **Loading-State** — solange `createBoard` pending ist, ist der Spinner-Text "Creating your board…" sichtbar.
2. **Success-Redirect** — wenn `createBoard` resolved, wird `navigate('/board/board-123', { replace: true })` aufgerufen.
3. **Error-UI** — wenn `createBoard` mit `new Error('Board creation failed')` rejected, erscheinen die Meldung und ein **Try again**-Button.
4. **Retry-Flow** — ein Klick auf **Try again** ruft `createBoard` ein zweites Mal auf und leitet zum neuen Board weiter.
5. **StrictMode Single Creation** — ein Render innerhalb von `<StrictMode>` ruft `createBoard` trotzdem genau einmal auf und leitet weiter.

### Aktualisierter Routing-Test: `client/src/__tests__/routing.test.jsx`

6. **`/` rendert `HomePage` und leitet zum neuen Board weiter** — `createBoard` mocken, damit es ein Board zurückgibt, bei `/` rendern und prüfen, dass der Board-Name erscheint (was Redirect und Store-Update beweist).

---

## 9. Akzeptanzkriterien

- [ ] Der Besuch von `/` erstellt automatisch ein neues Board.
- [ ] Bei Erfolg wird der Browser zu `/board/:boardId` weitergeleitet.
- [ ] Der Root-Pfad `/` wird in der History ersetzt (`replace: true`).
- [ ] `BoardPage` rendert das neue Board ohne zusätzlichen Network Request.
- [ ] Bei Fehler werden eine Fehlermeldung und ein **Try again**-Button angezeigt.
- [ ] Ein Klick auf **Try again** versucht die Board-Erstellung erneut.
- [ ] Unter React 18 StrictMode wird nur ein einziges Board erstellt.
- [ ] Alle 6 Tests bestehen.

---

## 10. Out of Scope

- **Error-Code-Mapping / Übersetzung in `api.js`** — es wird die rohe `err.message` angezeigt.
- **Optimistische UI für die Board-Erstellung** — die Seite zeigt einen Spinner, bis die API antwortet; es wird kein fake Board gerendert.
- **Offline-Queue / Retry-on-Reconnect** — Retry ist nur manuell möglich.
- **Rate-Limit-Handling** — 429-Responses werden als generische Fehler dargestellt.
- **Analytics / Logging** — es werden keine Events ausgelöst.

---

## 11. Risiken & Offene Fragen

| Risiko | Mitigation / Hinweis |
|--------|----------------------|
| **Komplexität des StrictMode-Guards** | Die Kombination aus `hasStarted` + `isMounted` Refs ist korrekt für die Entwicklung, aber zukünftige Entwickler könnten sie als nicht offensichtlich empfinden. Der Inline-Kommentar erklärt das *Warum*. |
| **History-Replacement versteckt die Landing Page** | Nutzer können nicht über Zurück zu `/` zurückkehren. Das ist beabsichtigt, setzt aber voraus, dass `/board/:boardId` das primäre Ziel ist. |
| **Store-vs.-Re-fetch-Annahme** | Falls `BoardPage` später immer neu fetchen soll, funktioniert der Redirect-Flow weiterhin, aber die Optimierung wird redundant. |
| **Rohe Fehlermeldungen** | Server-Meldungen werden unverändert angezeigt; wenn sie zu technisch sind, leidet die UX. Das Mapping zu benutzerfreundlichem Text wird separat behandelt. |
| **Duplizierte Boards bei schnellen Wiederbesuchen** | Jeder Besuch von `/` erstellt ein Board. Es gibt keine „First Visit"-Erkennung (z. B. via localStorage) — das ist so gewollt. |
