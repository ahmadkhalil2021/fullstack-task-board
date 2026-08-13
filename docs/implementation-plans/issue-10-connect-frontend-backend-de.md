# Implementierungsplan: Issue #10 — Frontend mit Backend-API verbinden

## Zusammenfassung

Issue #10 schließt die verbleibenden Lücken zwischen dem React-Frontend und dem Express-Backend. Der API-Wrapper (`client/src/lib/api.js`) und die Zustand-Store-Actions (`useBoardStore.js`) kümmern sich bereits um Tasks und das Laden von Boards; die verbleibende Arbeit besteht darin, den Board-Namen und die Beschreibung in `BoardHeader.jsx` über die bestehende `updateBoard`-Action zu persistieren, die API-Base-URL für die Produktion über eine Vite-Umgebungsvariable konfigurierbar zu machen und API-Fehler sichtbar in der UI anzuzeigen, anstatt sie als stille Promise-Ablehnungen zu hinterlassen.

## Architektur- & Designentscheidungen

### 1. Wann sollen Board-Name/Beschreibung gespeichert werden? — **Option A: onBlur**

**Entscheidung:** Board-Name und -Beschreibung werden persistiert, wenn das Eingabefeld den Fokus verliert (`onBlur`).

**Begründung:**
- Es ist der einfachste Upgrade-Schritt von der aktuellen rein lokalen State-Implementierung in `BoardHeader.jsx`.
- Es vermeidet die Einführung eines Debounce-Timers und zusätzlicher Cleanup-Logik.
- Es schafft einen klaren "Commit"-Moment für den Nutzer, der dem nativen Formularverhalten entspricht.
- Es minimiert den API-Traffic im Vergleich zu Speicherungen bei jedem Tastenanschlag.

### 2. Mechanismus für die Produktions-API-Base-URL? — **Option A: `import.meta.env.VITE_API_URL`**

**Entscheidung:** Die API-Base-URL wird aus `import.meta.env.VITE_API_URL` gelesen und fällt auf `/api` zurück.

**Begründung:**
- Das Projekt wird mit Vite gebaut, daher ist `import.meta.env.VITE_*` die idiomatische Konvention.
- Ein Fallback auf `/api` bewahrt die aktuelle Dev-Erfahrung und unterstützt Vercel-Same-Origin-Rewrites ohne zusätzliche Konfiguration.
- Entwickler können das Frontend so auf ein anderes Backend zeigen lassen (z. B. ein Preview-Deployment oder einen lokalen Server auf einem benutzerdefinierten Port), indem sie nur `.env` ändern.

### 3. Fehleranzeige in der UI? — **Option A: Banner am oberen Rand der Board-Seite**

**Entscheidung:** Ein schließbares Fehler-Banner wird am oberen Rand von `BoardPage.jsx` gerendert und liest `error` aus dem Zustand-Store.

**Begründung:**
- Der Store pflegt bereits einen `error`-String für jeden fehlgeschlagenen API-Aufruf, sodass ein Banner diese Single Source of Truth wiederverwendet.
- Es ist barrierefrei und erfordert keine Toast-Library.
- Fehler bleiben sichtbar, bis der Nutzer sie schließt oder eine spätere erfolgreiche Action sie löscht.

### 4. Zurücksetzverhalten bei Validierungsfehlern? — **Option B: Nutzertext behalten, Fehler anzeigen**

**Entscheidung:** Bei einem fehlgeschlagenen Save bleibt der bearbeitete Text im Eingabefeld erhalten und der Fehler wird angezeigt. Der Eingabewert wird nicht zurückgesetzt.

**Begründung:**
- Das Beibehalten des Nutzertextes verhindert Datenverlust und erlaubt es dem Nutzer, das Problem (z. B. einen zu langen Namen) zu beheben, ohne alles neu tippen zu müssen.
- Der Zustand-Store setzt weiterhin den *serverseitigen* optimistischen Update zurück, sodass das persistierte Modell konsistent bleibt.
- Dadurch wird der optimistische Server-State vom laufenden Draft-UI-State getrennt.

## State Machine / Flow

```text
[Nutzer tippt in Name/Beschreibung-Input]
            |
            v
[Lokaler Draft-State aktualisiert sich (draftName / draftDescription)]
            |
            v
[Eingabe verliert Fokus -> onBlur]
            |
            v
[Aufruf von useBoardStore.getState().updateBoard({ name, description })]
            |
            +---> [Optimistisches Update: board.name/board.description im Store aktualisiert]
            |
            v
[PUT /api/boards/:boardId]
            |
            +---> Erfolg: Store wird durch Board vom Server ersetzt (idempotent)
            |
            +---> Fehler: Store wird auf previousBoard zurückgesetzt, error-State gesetzt
            |
            v
[BoardPage liest error-State und rendert Banner]
            |
            v
[Nutzer schließt Banner -> clearError()-Action löscht error-State]
```

## API-Vertrag

### `PUT /api/boards/:boardId`

**Methode:** `PUT`

**Pfad:** `/api/boards/:boardId`

**Body:**

```json
{
  "name": "string | undefined",
  "description": "string | undefined"
}
```

**Validierungsregeln (serverseitig):**
- Mindestens ein Feld muss übergeben werden (`name`, `description` oder `statuses`).
- `name` und `description` müssen Strings sein, sofern angegeben.
- Leere Strings sind erlaubt (die UI behandelt sie als "Wert löschen").

**Antwort (200 OK):**

```json
{
  "data": {
    "board": {
      "_id": "ObjectId",
      "name": "string",
      "description": "string",
      "statuses": ["string"],
      "tasks": [...]
    }
  }
}
```

**Fehlerantworten:**
- `400 Bad Request` — fehlende Felder oder Validierungsfehler.
- `404 Not Found` — Board-ID existiert nicht.
- `500 Internal Server Error` — Datenbank- oder unerwarteter Serverfehler.

## Dateiänderungen

- `client/src/lib/api.js`
  - Hartcodiertes `const BASE = '/api'` durch umgebungsabhängige Base-URL ersetzen.
- `client/src/store/useBoardStore.js`
  - `clearError`-Action hinzufügen, um den `error`-State zurückzusetzen.
  - Sicherstellen, dass `updateBoard` partielle Updates korrekt normalisiert (bereits implementiert).
- `client/src/components/BoardHeader.jsx`
  - `onBlur`-Handler an `updateBoard` binden.
  - Lokalen Draft-State für die Eingabe beibehalten, aber beim Blur mit dem Store synchronisieren.
- `client/src/pages/BoardPage.jsx`
  - Fehler-Banner mit dem `error`-State aus dem Store rendern.
  - Schließen-Button bereitstellen, der `clearError` aufruft.
- `client/.env.example`
  - `VITE_API_URL=/api` als Standardwert hinzufügen.
- `client/.env` (falls lokal versioniert)
  - `VITE_API_URL=/api` für die Entwicklung hinzufügen.

## Implementierungsschritte

1. **API-Base-URL aktualisieren**
   - In `client/src/lib/api.js` ändern:
     ```js
     const BASE = '/api'
     ```
     zu:
     ```js
     const BASE = import.meta.env.VITE_API_URL || '/api'
     ```

2. **`clearError`-Action zum Store hinzufügen**
   - In `client/src/store/useBoardStore.js` hinzufügen:
     ```js
     clearError: () => set({ error: null }),
     ```

3. **Board-Header-Felder persistieren**
   - In `client/src/components/BoardHeader.jsx`:
     - `updateBoard` aus `useBoardStore` lesen.
     - Jedem Input einen `onBlur`-Handler hinzufügen, der `updateBoard` mit `{ name: draftName }` bzw. `{ description: draftDescription }` aufruft.
     - Die API nur aufrufen, wenn der Draft-Wert vom aktuellen Store-Wert abweicht, um No-Op-Requests zu vermeiden.

4. **API-Fehler anzeigen**
   - In `client/src/pages/BoardPage.jsx`:
     - `error` aus `useBoardStore` lesen.
     - Ein Banner rendern, wenn `error` truthy ist.
     - Einen Schließen-Button hinzufügen, der `clearError` aufruft.

5. **Umgebungsvariable dokumentieren**
   - `VITE_API_URL=/api` in `client/.env.example` hinzufügen.

6. **Manueller Smoke-Test**
   - Board-Name/Beschreibung bearbeiten, Blur auslösen und Netzwerk-Request sowie persistiertes Neuladen prüfen.
   - Offline-/Fehlerzustand simulieren und prüfen, ob das Banner erscheint.
   - Verifizieren, dass ein `VITE_API_URL`-Override funktioniert, indem auf einen anderen Port gezeigt wird.

## Edge Cases & Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| **Netzwerkfehler / Offline** | `updateBoard` fängt den Fehler ab, setzt den Store zurück, setzt `error` und wirft erneut, sodass die Komponente optional reagieren kann. Banner erscheint. |
| **Validierungsfehler (400)** | Server-Nachricht wird im Banner angezeigt. Input behält den Nutzertext. Store wird zurückgesetzt. |
| **Race Condition: zwei schnelle Edits** | Jedes `onBlur` löst sein eigenes `updateBoard` aus. Da sie unterschiedliche Felder betreffen oder sequentiell erfolgen, gewinnt die letzte erfolgreiche Antwort. Der Store ersetzt das gesamte Board-Objekt, sodass letztliche Konsistenz gewährleistet ist. |
| **Gleichzeitige Edits durch einen anderen Nutzer** | Last Write Wins auf dem Server. Das optimistische Update kann durch den nächsten `fetchBoard` überschrieben werden. Out of Scope für Echtzeit-Sync. |
| **Leerer Name/Beschreibung** | Erlaubt. Der Server akzeptiert leere Strings. Die UI zeigt einen Placeholder, wenn der Wert leer ist. |
| **Board nicht gefunden (404)** | Fehler-Banner zeigt "Board not found". Store wird zurückgesetzt. |

## Teststrategie

### Unit-Tests

- `useBoardStore.updateBoard`:
  - Wendet sofortiges optimistisches Update an.
  - Ruft `api.updateBoard` mit korrektem Payload auf.
  - Setzt auf Fehler zurück und setzt den Fehler-Status.
- `api.js`:
  - Verwendet `import.meta.env.VITE_API_URL`, wenn vorhanden.
  - Fällt auf `/api` zurück, wenn die Variable fehlt.

### Manuelle Test-Checkliste

- [ ] Board-Namen ändern, Tab drücken/außerhalb klicken → `PUT /api/boards/:boardId` wird mit `{ name: "..." }` ausgelöst.
- [ ] Beschreibung ändern, Blur → `PUT` wird mit `{ description: "..." }` ausgelöst.
- [ ] Seite neu laden → Änderungen sind weiterhin vorhanden.
- [ ] Netzwerk trennen, Namen bearbeiten, Blur → Fehler-Banner erscheint, Input behält bearbeiteten Text.
- [ ] Banner schließen → Banner verschwindet.
- [ ] `VITE_API_URL=http://localhost:4000/api` setzen, Dev-Server neu starten → Requests gehen an Port 4000.

## Akzeptanzkriterien

- [ ] Das Bearbeiten von Board-Name und -Beschreibung in `BoardHeader.jsx` bleibt nach dem Seiten-Neuladen erhalten.
- [ ] Die Persistenz verwendet die bestehende `updateBoard`-Zustand-Action und `PUT /api/boards/:boardId`.
- [ ] Die API-Base-URL ist über `VITE_API_URL` konfigurierbar und standardmäßig `/api`.
- [ ] API-Fehler werden über ein schließbares Banner in der UI angezeigt.
- [ ] Fehlgeschlagene Saves verwerfen den Nutzertext nicht stillschweigend.
- [ ] Kein Prop Drilling: `BoardHeader` und `BoardPage` lesen direkt aus dem Zustand-Store.
- [ ] Keine Komponente ruft `api.js` oder `fetch` direkt auf.

## Out of Scope

- Echtzeit-Kollaboration oder Konfliktlösung bei gleichzeitigen Edits.
- Validierungsregeln über das hinaus, was der Server bereits erzwingt.
- Inline-Fehlermeldungen auf Feldebene (nur globales Fehler-Banner).
- Debounced Auto-Save (zukünftige Erweiterung).
- Ändern der Board-Status-Spalten im Header (Status werden weiterhin anders verwaltet).

## Risiken & offene Fragen

| Risiko | Mitigation |
|---|---|
| **Mehrere schnelle `onBlur`-Aufrufe könnten Race Conditions erzeugen** | Akzeptabel, da jeder Aufruf unabhängig ist und der Server die Source of Truth ist; falls später nötig, Request-Deduplizierung oder einen Loading-Flag in `updateBoard` hinzufügen. |
| **Umgebungsvariable in Produktion nicht gesetzt** | Der Fallback auf `/api` stellt sicher, dass die App auf Vercel mit Same-Origin-Rewrites weiterhin funktioniert. |
| **Fehler-Banner könnte das Layout verschieben** | Banner kompakt halten und absolut positionieren oder mit minimaler Höhe, um Layout-Shift zu reduzieren. |
| **Offene Frage:** Soll der Header einen Loading-Indicator während des Speicherns anzeigen? | Nicht für das MVP erforderlich; `updateBoard` ist optimistisch und schnell. Kann später hinzugefügt werden, wenn UX-Tests einen Bedarf zeigen. |
