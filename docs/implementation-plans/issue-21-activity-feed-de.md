# Implementierungsplan — Issue #21: Board-Aktivitätsfeed hinzufügen

## 1. Zusammenfassung

Einen persistierten, board-scoped Aktivitätsfeed hinzufügen, der chronologische Ereignisse für Task- und Board-Mutationen aufzeichnet. Der Feed wird über einen neuen `GET /api/boards/:boardId/activity`-Endpoint exponiert, in einer neuen MongoDB-Collection `activities` gespeichert und als Slide-in-Sidebar an der rechten Kante gerendert, die über den `BoardHeader` umgeschaltet wird. Live-Updates erfolgen durch optimistic appends im bestehenden Zustand Store, damit das UI sofort reagiert, ohne Websockets.

---

## 2. Architektur & Designentscheidungen

| # | Entscheidung | Empfohlene Option | Begründung |
|---|--------------|-------------------|------------|
| 1 | Event-Emission-Strategie | **A — Backend emitted intern in jedem Route Handler** | Hält die API-Oberfläche minimal, garantiert, dass Audit-Events unabhängig vom Client erfasst werden, und folgt dem bestehenden API-first / Flux-Pattern. Das Frontend ruft keinen separaten Activity-Creation-Endpoint auf. |
| 2 | Form von `changes` | **A — `old` / `new`-Paar pro geändertem Feld** | z. B. `{ name: { from: 'X', to: 'Y' } }`. Das gibt den Nutzern sinnvollen Kontext („Was hat sich geändert?“), ohne volle Snapshots zu speichern. |
| 3 | Container-Pattern | **Sidebar** | Bewahrt den Board-Kontext, entspricht der Formulierung im Issue und ist einfacher zu animieren als ein Modal. |
| 4 | Sidebar-Position | **A — Rechte Kante** | Standard-Pattern für Detail- / Historien-Panels; am wenigsten störend für das Kanban-Layout. |
| 5 | Live-Update-Mechanismus | **A — Optimistic append in Zustand nach jeder Nutzeraktion** | Konsistent mit ADR-0005. Kein Polling, keine Websockets. Der Store hängt sofort ein lokales Activity-Objekt an; der nächste Hintergrund-API-Call persisted es auf dem Server. |
| 6 | Limit-Defaults | **Default `limit=50`, max `limit=200`, cursor-basierte Pagination über `before` (letzte `_id`)** | `ObjectId` ist zeitlich monoton, daher ist `_id` ein stabiler Cursor. Verhindert Duplikate, wenn neue Events während des Paginierens eintreffen. „Load more" lädt die nächsten 50 älteren Events. |
| 7 | Relative-Time-Library | **A — Manuelle Implementierung mit `Intl.RelativeTimeFormat`** | Vermeidet eine Dependency für einen Formatter. Ein kleines Utility (`formatRelativeTime`) deckt Sekunden/Minuten/Stunden/Tage/Monate/Jahre ab und aktualisiert sich über einen 60-Sekunden-Re-Render-Trigger in `ActivityFeed`. |
| 8 | State-Location | **A — Neuer Slice in `useBoardStore`** | Hält das Board als single source of truth und folgt der bestehenden Regel „ein Store pro Entität". Vermeidet Cross-Store-Synchronisation. |
| 9 | Cascade-Delete beim Board-Löschen | **Ja — bestehenden `Board.pre('deleteOne')`-Hook erweitern** | `await Activity.deleteMany({ boardId: this._id })` zum gleichen Hook hinzufügen, der bereits Tasks löscht. Als bekanntes Pattern dokumentieren. |
| 10 | Initial-Load-Timing | **A — Beim Mount von `BoardPage`** | Das Board wird bereits beim Mount gefetcht; den Activity-Feed parallel zu laden, macht den ersten Sidebar-Toggle sofort. Falls Analytics später zeigen, dass der Feed selten geöffnet wird, ist Lazy Loading eine günstige Optimierung. |

---

## 3. State Machine / Flow

### 3.1 Server-seitiger Activity-Emission-Flow

```
Nutzer-Request → Route Handler
                    │
                    ▼
            Primärer DB-Write durchführen
            (Task/Board Update/Create/Delete)
                    │
                    ▼
            Altes vs. neues Dokument vergleichen
            (bei Updates nötig)
                    │
                    ▼
            Activity-Payload aufbauen
            { boardId, type, taskId?, taskName?, changes }
                    │
                    ▼
            await Activity.create(payload)
            in try/catch gewrappt, damit ein Fehler
            die Nutzer-Anfrage NICHT failen lässt
                    │
                    ▼
            Originale Response zurückgeben
```

### 3.2 Client-seitiger Sidebar-Flow

```
BoardPage mounted
   ├─ fetchBoard(boardId)
   └─ fetchActivity(boardId) ──► GET /api/boards/:boardId/activity?limit=50
                                          │
                                          ▼
                               store.activity wird befüllt
                                          │
Nutzer klickt Activity-Icon im BoardHeader
                                          │
                                          ▼
                           setIsActivityOpen(true)
                                          │
                                          ▼
                           <ActivityFeed> rendert Slide-in-Sidebar
                           liest activity[] aus useBoardStore
                                          │
Nutzer mutiert einen Task / das Board ────┘
   ├─ Store-Action updated das Board optimistically
   └─ Store-Action hängt passendes Activity-Objekt optimistically an
        API-Call persisted die Mutation + Server emitted das echte Activity
        (Server ist source of truth; Client rendert nur)
```

---

## 4. API-Vertrag

### `GET /api/boards/:boardId/activity`

| Aspekt | Detail |
|--------|--------|
| Methode | `GET` |
| Pfad | `/api/boards/:boardId/activity` |
| Query-Parameter | `limit` (Zahl, optional, Default `50`, max `200`)<br>`before` (ObjectId-String, optional, Cursor für Pagination) |
| Erfolgsresponse | `200 OK`<br>`{ data: { activities: Activity[], hasMore: boolean } }` |
| Fehlerresponses | `400 Bad Request` — ungültiges `limit` oder malformed `before`<br>`404 Not Found` — Board existiert nicht<br>`500 Internal Server Error` — Datenbankfehler |
| Sortierung | Neueste zuerst (`{ _id: -1 }`) |

### `Activity` JSON-Shape

```json
{
  "_id": "507f1f77bcf86cd799439011",
  "boardId": "507f1f77bcf86cd799439010",
  "type": "task_moved",
  "taskId": "507f1f77bcf86cd799439012",
  "taskName": "Fix login bug",
  "changes": {
    "status": { "from": "In progress", "to": "In review" }
  },
  "createdAt": "2026-08-13T10:00:00.000Z"
}
```

#### Unterstützte `type`-Werte

- `task_created`
- `task_updated`
- `task_moved`
- `task_deleted`
- `board_updated`
- `status_added`
- `status_renamed`
- `status_removed`

---

## 5. Dateiänderungen

### Erstellen

| Datei | Zweck |
|-------|-------|
| `server/models/Activity.js` | Mongoose-Schema + Model für persistierte Activity-Events |
| `server/lib/activityEmitter.js` | Dünner Helper, um aus Route Handlern Activity-Dokumente zu bauen und einzufügen |
| `server/routes/activity.js` | `GET /api/boards/:boardId/activity`-Route (unter `/boards` gemounted) |
| `client/src/components/ActivityFeed.jsx` | Slide-in-Sidebar-Komponente an der rechten Kante |
| `client/src/lib/formatRelativeTime.js` | Relative-Time-Formatter mit `Intl.RelativeTimeFormat` |

### Ändern

| Datei | Zweck |
|-------|-------|
| `server/models/Board.js` | `pre('deleteOne')`-Hook erweitern, um Activities cascade-zu-löschen |
| `server/routes/boards.js` | `board_updated`, `status_added`, `status_renamed`, `status_removed` nach `PUT` emitten |
| `server/routes/tasks.js` | `task_created`, `task_updated`, `task_moved`, `task_deleted` nach Mutationen emitten |
| `server/index.js` | Neue Activity-Route importieren und mounten |
| `client/src/lib/api.js` | `fetchActivity(boardId, { limit, before })` hinzufügen |
| `client/src/store/useBoardStore.js` | Activity-Slice + `fetchActivity` / `addOptimisticActivity`-Actions hinzufügen |
| `client/src/components/BoardHeader.jsx` | Activity-Feed-Toggle-Button + Sidebar-Render hinzufügen |

---

## 6. Implementierungsschritte

### Schritt 1 — Model + Persistence-Helpers

1. `server/models/Activity.js` mit Schema erstellen:
   - `boardId: ObjectId, ref: 'Board', required, index`
   - `type: String, enum`
   - `taskId: ObjectId, ref: 'Task'` (optional)
   - `taskName: String` (optionaler Snapshot für gelöschte Tasks)
   - `changes: mongoose.Schema.Types.Mixed` (optional)
   - `timestamps: true` (liefert `createdAt`)
2. `server/lib/activityEmitter.js` erstellen und exportieren:
   - `emitActivity(payload)` — wrappt `Activity.create` in try/catch und logged Fehler ohne zu werfen.
3. `server/models/Board.js` `pre('deleteOne')`-Hook aktualisieren, um auch Activities des Boards zu löschen.

### Schritt 2 — Backend-Routes

1. `server/routes/activity.js` erstellen mit `GET /api/boards/:boardId/activity`:
   - `boardId` und Board-Existenz validieren.
   - `limit` parsen (clamp 1–200, Default 50).
   - Optionalen `before`-Cursor parsen.
   - Query: `Activity.find({ boardId, _id: { $lt: before } }).sort({ _id: -1 }).limit(limit + 1)`.
   - `{ data: { activities, hasMore } }` zurückgeben.
2. `server/routes/boards.js` `PUT /:boardId` anpassen:
   - Vor dem Update das bestehende Board-Dokument laden.
   - Nach `findByIdAndUpdate` altes vs. neues `name`, `description` und `statuses` vergleichen.
   - Pro geändertem Skalarfeld ein `board_updated`-Event emitten.
   - Durch Differenzbildung der `statuses`-Arrays `status_added`, `status_renamed` und `status_removed`-Events emitten.
3. `server/routes/tasks.js` anpassen:
   - `POST /` → `task_created` emitten.
   - `PUT /:taskId` → alten Task laden, Update anwenden, dann `task_moved` emitten, falls sich `status` geändert hat, oder `task_updated` für andere Feldänderungen (oder beides).
   - `DELETE /:taskId` → `taskName` sichern, löschen, dann `task_deleted` emitten.
4. `server/routes/activity.js` in `server/index.js` mounten.

### Schritt 3 — API-Layer

1. `fetchActivity(boardId, { limit = 50, before } = {})` zu `client/src/lib/api.js` hinzufügen.

### Schritt 4 — Store-Slice

1. `useBoardStore`-State erweitern:
   - `activity: []`
   - `activityLoading: false`
   - `activityError: null`
   - `activityHasMore: true`
2. Actions hinzufügen:
   - `fetchActivity(boardId, { limit, before })` — ersetzt oder appended basierend auf `before`.
   - `addOptimisticActivity(activity)` — hängt ein client-seitiges Activity-Objekt vorne an.
   - `clearActivityError()`.
3. Optimistic appends in bestehende Actions (`updateTask`, `deleteTask`, `addTask`, `updateBoard`) einbauen, sodass jede Mutation auch ein passendes lokales Activity-Objekt erzeugt.

### Schritt 5 — UI-Komponenten

1. `client/src/components/ActivityFeed.jsx` erstellen:
   - Akzeptiert `isOpen` und `onClose` Props.
   - Liest `activity`, `activityLoading`, `activityError`, `activityHasMore` aus dem Store.
   - Rendert ein fixed right-side Panel, das über Tailwind-Transform-Utilities hereinslide.
   - Listet Activity-Items mit Icon pro Type, Beschreibungstext und relativem Timestamp.
   - Zeigt Skeleton-Rows beim Laden und einen Empty-State bei `activity.length === 0`.
   - Implementiert „Load more" mit `before`-Cursor.
   - Re-rendered Timestamps einmal pro Minute über `setInterval`.
2. `client/src/lib/formatRelativeTime.js` erstellen.
3. `client/src/components/BoardHeader.jsx` anpassen:
   - Activity-Toggle-Button neben dem Status-Manager-Gear hinzufügen.
   - Lokalen `isActivityOpen`-State verwalten.
   - `<ActivityFeed isOpen={isActivityOpen} onClose={...} />` rendern.

---

## 7. Edge Cases & Fehlerbehandlung

| Szenario | Behandlung |
|----------|------------|
| Netzwerkfehler beim initialen Activity-Load | Store setzt `activityError`. `ActivityFeed` zeigt einen Retry-Button, der `fetchActivity` erneut aufruft. |
| Leerer Aktivitätsfeed | Freundlichen Empty-State mit Text anzeigen: „Noch keine Aktivität — mach einen Move!" |
| Navigation weg, während Sidebar offen | Sidebar wird mit der Route unmounted. Der nächste Board-Fetch resettet `activity` im Store. |
| Board gelöscht | Der bestehende `pre('deleteOne')`-Hook löscht nun auch Activities und verhindert verwaiste Dokumente. |
| Activity-Insert auf dem Server fehlgeschlagen | In try/catch gewrappt; die Nutzeraktion gelingt trotzdem. Fehler wird server-seitig geloggt. |
| Ungültiges `limit` / `before`-Query | API gibt `400` mit klarer Meldung zurück. Client clamped `limit` vor dem Senden. |
| Activity-Event für einen gelöschten Task | Bei `task_deleted` wird ein `taskName`-Snapshot gespeichert; ältere Task-Events behalten `taskId`, benötigen aber keinen Join. |
| Status-Rename vs. Add/Remove mehrdeutig | Diff-Algorithmus behandelt Änderungen am gleichen Index als Rename, angehängte Items als Added, entfernte als Removed. Heuristik dokumentieren. |
| Sehr lange Activity-Liste | Cursor-Pagination (`before`) hält Queries schnell; max `limit=200` verhindert riesige Payloads. |
| Schnelle aufeinanderfolgende Aktionen | Optimistic appends sind günstig und reihenfolgetreu, da `_id` zum Append-Zeitpunkt generiert wird; Server-Events werden für einen einzelnen Client übereinstimmen. |

---

## 8. Teststrategie

### Server

1. **Model-Test** — `Activity` validiert required `boardId` und `type`-Enum.
2. **Endpoint-Test** — `GET /api/boards/:boardId/activity`:
   - Gibt Activities neueste-zuerst zurück.
   - Respektiert `limit` und `before`.
   - Gibt `404` für unbekanntes Board.
3. **Route-Integrationstests** — nach jedem Mutation-Endpoint prüfen, ob das erwartete Activity-Dokument in der Datenbank existiert:
   - `POST /api/tasks` → `task_created`
   - `PUT /api/tasks/:id` (Status-Änderung) → `task_moved`
   - `PUT /api/tasks/:id` (Name-Änderung) → `task_updated`
   - `DELETE /api/tasks/:id` → `task_deleted` mit `taskName`
   - `PUT /api/boards/:id` (Name/Beschreibung) → `board_updated`
   - `PUT /api/boards/:id` (Statuses) → Status-Events
   - `DELETE /api/boards/:id` → Activities werden entfernt

### Client

1. **Store-Tests** — `addOptimisticActivity` hängt vorne an `activity` an; `fetchActivity` appended und setzt `activityHasMore`.
2. **Komponenten-Tests** — `ActivityFeed`:
   - Rendert Skeleton, wenn `activityLoading` true und `activity` leer ist.
   - Rendert Empty-State, wenn keine Activities vorhanden.
   - Rendert List-Items mit korrekten Beschreibungen.
   - Ruft `fetchActivity` mit `before`-Cursor bei „Load more" auf.
3. **Integrationstest** — Das Triggern von `updateTask` updated das Board und hängt ein passendes Activity-Objekt an.

---

## 9. Akzeptanzkriterien

- [ ] Neues `Activity`-Mongoose-Model mit dem benötigten Schema und Indexes existiert.
- [ ] `GET /api/boards/:boardId/activity?limit=N` gibt eine paginierte Liste von Activity-Events neueste-zuerst zurück.
- [ ] Task-Create/Update/Move/Delete-Endpoints emitten jeweils den korrekten Activity-Type.
- [ ] Board-Update-Endpoint emitted `board_updated`, `status_added`, `status_renamed` und/oder `status_removed` wie passend.
- [ ] Beim Löschen eines Boards werden alle seine Activity-Dokumente gelöscht.
- [ ] `client/src/lib/api.js` exponiert `fetchActivity`.
- [ ] `useBoardStore` hat einen `activity`-Slice und Optimistic-Append-Logik.
- [ ] `BoardHeader` hat einen Button, der die Activity-Sidebar toggled.
- [ ] `ActivityFeed` slide von rechts herein und zeigt Events mit relativen Timestamps.
- [ ] Empty- und Skeleton-States sind implementiert.
- [ ] „Load more" lädt ältere Events mittels Cursor-Pagination.
- [ ] Keine direkten `fetch`-Aufrufe aus Komponenten; das Flux-Pattern bleibt erhalten.
- [ ] Keine neuen Runtime-Dependencies für Relative-Time-Formatting werden hinzugefügt.
- [ ] Out-of-scope-Items (Auth, Websockets, Retention, Kommentare, E-Mail) werden nicht implementiert.

---

## 10. Out of Scope

- User authentication / actor attribution
- Real-time websockets oder Server-Sent Events
- Activity-Retention-Policies oder automatisches Löschen alter Events
- Kommentare zu Activity-Items
- E-Mail / Push-Notifications
- Full event-sourcing pattern
- Filtern von Activity nach Event-Type oder Datumsbereich
- Exportieren der Activity-History

---

## 11. Risiken & offene Fragen

| Risiko | Impact | Mitigation |
|--------|--------|------------|
| Status-Diff-Algorithmus klassifiziert Renames falsch | Medium | Heuristik einfach halten; Verhalten dokumentieren. Werden Statuses stark umgeordnet, stattdessen ein generisches `status_updated`-Event emitten. |
| Activity-Collection wächst ungebunden | Medium | Out of scope für dieses Issue, aber Backlog-Item für Retention / Archiving hinzufügen. |
| Optimistic client activities können von Server-Events abweichen, wenn der Request fehlschlägt | Low | Activity ist nur informativ; bei fehlgeschlagenen Mutationen rollt der Board-State zurück, und die optimistic activity bleibt harmlos (sie spiegelt die versuchte Aktion wider). Eine zukünftige Erweiterung könnte sie ebenfalls rollbacken. |
| Cursor-Pagination über `_id` setzt monotonische Creation-Time voraus | Low | Für MongoDB ObjectId in einem Cluster gegeben. Annahme dokumentieren. |
| Extra Write pro Request erhöht Latenz | Low | Activity-Creation ist relativ zur Response fire-and-forget; in Staging messen. |

### Produktklärungen nötig

1. Soll `task_moved` emittet werden, wenn ein Task innerhalb der gleichen Column neu sortiert wird, oder nur bei `status`-Änderung? **Empfehlung:** nur bei `status`-Änderung; Sortieren erzeugt Noise. Entscheidung dokumentieren.
2. Soll das Erstellen eines Boards ein `board_created`-Event emitten? **Empfehlung:** laut Issue-Zusammenfassung nicht erforderlich; bei Bedarf separat im Backlog aufnehmen.
3. Sollen eigene Aktionen im Feed anders angezeigt werden (z. B. „Du hast verschoben...")? **Empfehlung:** neutrale Formulierung („Task verschoben...") beibehalten, da es keine Auth / Actor gibt.
