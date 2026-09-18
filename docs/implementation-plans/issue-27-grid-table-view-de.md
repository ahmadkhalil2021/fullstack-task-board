# Implementierungsplan — Issue #27: Grid- und sortierbare Table-Views

## 1. Summary

Fügt URL-erreichbare Grid- und Table-Views zur bestehenden Board-Shell hinzu, damit Nutzer zwischen einer visuellen Kartenwand und einer dichten, sortierbaren Power-User-Tabelle wählen können, ohne den Task-Datenfluss zu ändern. Beide Views verwenden die von Zustand gefilterten Tasks, nutzen `BoardPage.openTask` als einzige Navigationsquelle, erstellen Tasks über die bestehende Store-Action, erhalten Query-Parameter und bleiben mit dem aktuellen Detailseiten-Flow aus #25/#26 kompatibel. Es sind weder Backend-Endpunkte, Schemas noch Dependencies erforderlich.

## 2. Architecture & Design Decisions

### Routing and view identity

- In `client/src/App.jsx:13-19` explizite Routen für `/board/:boardId/grid` und `/board/:boardId/table` vor der generischen `/board/:boardId`-Route ergänzen. React Router hält dadurch unbekannte Board-Subpfade auf `NotFoundPage`, statt stillschweigend Kanban zu rendern.
- `client/src/lib/useView.js:7-13` so erweitern, dass exakt `'kanban' | 'list' | 'grid' | 'table'` nur für die exakten Drei-Segment-Pfade `board/:boardId`, `board/:boardId/list`, `board/:boardId/grid` und `board/:boardId/table` zurückgegeben werden. Ein fehlerhafter Pfad darf nicht als gültige View behandelt werden; der explizite Router bleibt die 404-Autorität.
- `client/src/components/ViewSwitcher.jsx:7-39` auf `Kanban | List | Grid | Table` in dieser Reihenfolge erweitern. Weiterhin `location.search` unverändert verwenden, damit `?q=` und `?f=` bei jedem Wechsel erhalten bleiben. Die Navigation in `BoardPage` rechts ausgerichtet lassen und `aria-current="page"` auf dem aktiven Link beibehalten.

### State and navigation

- Board-Tasks, `query` und `filterStatus` in `useBoardStore` belassen; `visibleTasks` in jeder View mit `filterTasks` ableiten, entsprechend `client/src/views/ListView.jsx:27-30` und `client/src/views/KanbanBoard.jsx:39-42`.
- `BoardPage.openTask` (`client/src/pages/BoardPage.jsx:28-32`) als einzige Navigationsquelle beibehalten. Grid-Karten, Add-Flow und Table-Zeilen rufen `onTaskClick` auf; sie rufen weder `useNavigate` noch die API auf.
- Die bestehende optimistische `addTask`-Action (`client/src/store/useBoardStore.js:332-391`) mit `board.statuses[0]` verwenden und anschließend den zurückgegebenen echten Task an `onTaskClick` übergeben. So bleiben Detail-URL und `location.state.from` erhalten.

### Grid design

- `client/src/views/GridView.jsx` mit `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4` erstellen.
- Eine kopierte gefilterte Liste nach `createdAt` absteigend sortieren; ungültige oder fehlende Daten hinter gültige Daten sortieren und `_id` als stabilen Tie-Breaker verwenden.
- `TaskCard` unverändert für Kartenverhalten und Drag-Attribute wiederverwenden. Einen gemeinsamen `StatusBadge` in einem positionierten Grid-Wrapper oben rechts platzieren, wodurch keine zweite Statusfarben-Implementierung und keine Änderung am Kanban-Drag-Verhalten entsteht.
- `AddTaskButton` oben links wiederverwenden. Seine Präsentations-API nur bei Bedarf erweitern (zum Beispiel um ein optionales `className`), ohne die bestehende Spalten-Darstellung zu verändern.

### Table design and icon decision

- `client/src/views/TableView.jsx` mit semantischem `<table>`, `<thead>`, `<tbody>` und sortierbaren Headern für `Name`, `Status`, `Created` und `Updated` erstellen.
- Das Issue nennt `Name · Status · Icon · Created · Updated`. Empfehlung: Das Task-Icon in der `Name`-Zelle rendern, genau wie die etablierte List-View (`client/src/views/ListView.jsx:98-108`), statt eine schmale separate Icon-Spalte hinzuzufügen. Das Icon ist visueller Kontext zum Namen, eine eigene Spalte erzeugt doppelte visuelle Unruhe und die integrierte Zelle ist auf schmalen Bildschirmen besser nutzbar. Dies bleibt eine Produktentscheidung (siehe Abschnitt 11); falls Product eine separate Icon-Spalte verlangt, wird sie zwischen Status und Created eingefügt, ohne Sortier- oder Navigationsverhalten zu ändern.
- Lokales `useState` für `sortKey` und `sortDir`, `useMemo` für gefilterte/sortierte Zeilen und einen `sessionStorage`-Key pro Board wie `board-view-table:${boardId}` verwenden. Nur validierte Werte persistieren; bei fehlerhaftem JSON, unbekanntem Key oder ungültiger Richtung deterministisch auf (`createdAt`, `desc`) zurückfallen. Der Storage-Zugriff muss abgesichert werden, weil Browser-Storage Fehler werfen kann.
- Ein Klick auf den aktiven Header wechselt die Richtung; ein Klick auf einen anderen sortierbaren Header startet aufsteigend. Einen echten `button` in jedem sortierbaren `<th>` verwenden, `aria-sort="ascending"`/`"descending"` nur am aktiven Header und `aria-sort="none"` an den übrigen setzen und `▲`/`▼` nur für den aktiven Key anzeigen.
- Jede Datenzeile mit `tabIndex={0}`, `aria-keyshortcuts="Enter"` und einem `onKeyDown`-Handler tastaturerreichbar machen, der bei Enter `onTaskClick(task)` ausführt. Verschachtelte interaktive Controls in einer Zeile vermeiden; Header-Sortierbuttons liegen außerhalb der Datenzeilen-Interaktion.

### Shared status presentation

- `client/src/components/StatusBadge.jsx` mit `StatusBadge({ status })` erstellen. Die Komponente rendert den Statusnamen und einen dekorativen Punkt mit `statusColor(status)` (`client/src/lib/statusColor.js:12-19`), Tailwind-Token-Klassen und `aria-hidden="true"` am Punkt.
- In Grid und Table verwenden. List nur refactoren, wenn gerendertes Markup und Verhalten gleichwertig bleiben; andernfalls List unverändert lassen, um Regressionsrisiko zu reduzieren. Die Komponente muss beliebige Board-Statusstrings und die vorhandenen hellen/dunklen Tokens unterstützen.

## 3. State Machine / Flow

### View selection

```text
URL pathname
    │
    ├── /board/:boardId          → useView() = kanban
    ├── /board/:boardId/list     → useView() = list
    ├── /board/:boardId/grid     → useView() = grid
    ├── /board/:boardId/table    → useView() = table
    └── any unknown path          → router wildcard → NotFoundPage (404)
```

```text
User clicks ViewSwitcher link
        │
        ├── path changes, ?q=/?f= retained
        ▼
BoardPage reads useView()
        │
        ├── renders KanbanBoard / ListView / GridView / TableView
        └── keeps shared filter banner and BoardPage.openTask
```

### Grid add and task opening

```text
AddTaskButton
  → guard duplicate click
  → store.addTask(board.statuses[0])
  → optimistic task appears
  → API POST through store
  ├── success → real task replaces temporary task → openTask(realTask)
  └── failure → rollback + existing ErrorBanner; remain on board
```

### Table sorting and navigation

```text
mount(boardId)
  → read board-view-table:${boardId}
  → validate { sortKey, sortDir } or use { createdAt, desc }
  → filterTasks(board.tasks, query, filterStatus)
  → sort with useMemo

header click
  ├── active key → toggle asc/desc
  └── new key    → set asc
  → update aria-sort + ▲/▼ + sessionStorage

row click or Enter → onTaskClick(task) → /board/:boardId/task/:taskId
```

## 4. API Contract

Es ist kein neuer API-Vertrag und keine Serveränderung erforderlich. Die Views verwenden das bereits von `BoardPage` geladene Board über `client/src/store/useBoardStore.js:64-73` und `client/src/lib/api.js`.

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| `GET` | `/api/boards/:boardId` | none | `200 { data: { board: { statuses, tasks, ... } } }` | `server/routes/boards.js`; contract `docs/api-contract.md:38-87` |
| `POST` | `/api/tasks` | `{ name, description, icon, status: board.statuses[0], order, parentBoardId: board._id }` | `201 { data: { task } }` | `server/routes/tasks.js`; contract `docs/api-contract.md:178-222` |

Die UI ruft keinen dieser Endpunkte direkt auf. `BoardPage` ruft über den Store `fetchBoard` auf, und Grid/Table verwenden die Store-Action `addTask`; dadurch bleiben UI → Zustand → API sowie bestehendes optimistisches Rollback-/Fehlerverhalten erhalten (`docs/state-management.md:3-27`, `docs/error-handling.md:45-59`).

## 5. File Changes

- **Modify** `client/src/App.jsx:13-19` — exakte Grid/Table-Routen vor der Board-Root-Route registrieren.
- **Modify** `client/src/lib/useView.js:7-13` — exakte Pfade auf die Vier-View-Union abbilden, ohne 404-Verhalten zu schwächen.
- **Modify** `client/src/components/ViewSwitcher.jsx:7-39` — zwei Pills hinzufügen, Querystrings und `aria-current` erhalten.
- **Modify** `client/src/pages/BoardPage.jsx:1-119` — Grid/Table importieren und auswählen, gemeinsamen Banner und `openTask` behalten.
- **Modify** `client/src/components/AddTaskButton.jsx:1-14` — nur falls ein optionaler Positionierungs-/Style-Prop benötigt wird; bestehende Aufrufer behalten.
- **Create** `client/src/components/StatusBadge.jsx` — gemeinsame Status-Token-/Namensdarstellung.
- **Create** `client/src/views/GridView.jsx` — responsive, gefilterte, neueste-zuerst Kartenwand sowie Add-/Empty-States.
- **Create** `client/src/views/TableView.jsx` — gefilterte sortierbare Tabelle, Tastaturzeilen und Session-Persistenz.
- **Optionally modify** `client/src/views/ListView.jsx:98-117` — `StatusBadge` nur verwenden, wenn Ausgabe und Verhalten unverändert bleiben.
- **Create** `client/src/__tests__/grid-view.test.jsx` — mindestens 10 Grid-Fälle.
- **Create** `client/src/__tests__/table-view.test.jsx` — mindestens 10 Table-Fälle.
- **Modify** `client/src/__tests__/routing.test.jsx:34-109` — `/grid` und `/table` sowie 404-Abdeckung unbekannter Subpfade testen.
- **Modify** `client/src/__tests__/view-switcher.test.jsx:8-41` — vier Links, aktiven Status, Reihenfolge und Query-Erhalt testen.
- **Optionally modify** `client/src/__tests__/list-view.test.jsx` — nur für eine Regression-Prüfung beim `StatusBadge`-Refactor.

## 6. Implementation Steps

1. `client/src/App.jsx:13-19` und `client/src/lib/useView.js:7-13` ändern, um die beiden exakten Routen zu registrieren und zu erkennen, während Wildcard-404 erhalten bleibt.
2. `client/src/components/ViewSwitcher.jsx:7-39` und `client/src/pages/BoardPage.jsx:1-119` ändern, um alle vier Views anzubieten, den Switcher rechts ausgerichtet zu lassen und die View-Auswahl über `useView` zu führen.
3. `client/src/components/StatusBadge.jsx` erstellen und `client/src/components/AddTaskButton.jsx:1-14` nur bei Bedarf für wiederverwendbare Grid-Platzierung ändern; Tailwind-only-Styling und dekorative, für Screenreader verborgene Icons beibehalten.
4. `client/src/views/GridView.jsx` erstellen, mit Store-Selektoren, `filterTasks`, `TaskCard`, `StatusBadge`, `AddTaskButton`, Neueste-zuerst-Sortierung, abgesichertem Add-Flow sowie Filter-/Empty-States.
5. `client/src/views/TableView.jsx` erstellen, mit validiertem boardbezogenem Session Storage, `useMemo`-Sortierung, Headerbuttons, `aria-sort`, `▲`/`▼`, Fokusstyles und Enter-Navigation über `onTaskClick`.
6. `client/src/views/ListView.jsx:98-117` optional ändern, um `StatusBadge` erst nach Bestätigung ohne Markup-/Verhaltensregression zu verwenden.
7. `client/src/__tests__/routing.test.jsx:34-109` und `client/src/__tests__/view-switcher.test.jsx:8-41` für Routing, aktive Pills, Reihenfolge, Query und 404 erweitern.
8. `client/src/__tests__/grid-view.test.jsx` und `client/src/__tests__/table-view.test.jsx` erstellen, anschließend bestehende Testsuite und `vite build` ausführen.

## 7. Edge Cases & Error Handling

- **Unbekannter Board-Subpfad:** Nur die vier expliziten Board-Pfade matchen; `/board/:boardId/unknown` bleibt `NotFoundPage`.
- **Trailing Slash oder zusätzliches Segment:** `useView` nicht erweitern; das exakte React-Router-Verhalten bleibt maßgeblich. Falls der Router Trailing-Slash-Normalisierung benötigt, diese explizit testen, statt beliebige Segmente als Kanban zu behandeln.
- **Board-Laden/nicht gefunden/keine Status:** Bestehende Loading-, `ErrorBanner`- und `EmptyBoard`-Branches in `BoardPage` behalten. Views geben bei fehlendem Board `null` zurück und werden bei leeren Status nicht gerendert.
- **Keine Tasks:** Grid zeigt zentriert `Add your first task`; Table zeigt eine zugängliche Empty-Zeile und behält ihre Add-Möglichkeit. Ein gefiltertes Ergebnis von null ersetzt den gemeinsamen `No tasks match`-Banner in `BoardPage` nicht.
- **Filteränderungen:** Beide Views berechnen aus `filterTasks` neu; Sortierung erfolgt nach Filterung. Das Leeren des gemeinsamen Filters stellt Zeilen/Karten sofort wieder her.
- **Schnelle Add-Klicks/API-Fehler:** Synchronen Ref plus Disabled-State wie in List (`client/src/views/ListView.jsx:17-25`, `43-57`) verwenden; auf Store-Rollback und `ErrorBanner` vertrauen.
- **Fehlende/ungültige Daten:** Stabile Fallback-Reihenfolge verwenden und `formatRelativeTime`'s `recently`-Fallback (`client/src/lib/formatRelativeTime.js:7-17`) anzeigen. Nie beim Rendern werfen.
- **Unbekannte Statusnamen:** `statusColor` liefert `todo`; `StatusBadge` rendert den ursprünglichen Namen trotzdem.
- **Fehlerhafter oder nicht verfügbarer Session Storage:** Lese-/Schreibzugriffe abfangen, Keys und Richtungen validieren und mit Default-Sortierung weiter rendern.
- **Gleiche Sortierwerte:** `_id` als deterministischen Tie-Breaker verwenden, damit sich die Reihenfolge zwischen Renders nicht zufällig ändert.
- **Tastaturinteraktion:** Enter öffnet exakt einmal; Sortierbuttons stoppen ihre eigene Zeilenöffnung. Dekorative Task-/Status-Icons verwenden `aria-hidden="true"`.
- **Hell-/Dunkelmodus:** Bestehende `surface-*`, `status-*`, `primary`- und `shadow-card`-Tokens verwenden; keine hardcodierten Farben oder neue CSS-Dependency einführen.

## 8. Testing Strategy

### Grid tests — `client/src/__tests__/grid-view.test.jsx` (minimum 10)

1. Rendert eine Karte pro Board-Task und die responsive Grid-Klasse.
2. Sortiert das neueste `createdAt` zuerst.
3. Verwendet stabile Fallback-Reihenfolge für fehlende/ungültige Daten.
4. Rendert `StatusBadge` mit Task-Status oben rechts an der Karte.
5. Ruft `onTaskClick` bei Kartenaktivierung auf.
6. Filtert über die gemeinsame Store-Query.
7. Filtert über `filterStatus`.
8. Zeigt `Add your first task` bei ungefiltert leerem Board.
9. Zeigt den gefilterten Empty-State ohne den `No tasks match`-Banner von BoardPage zu duplizieren/ersetzen.
10. Fügt im `board.statuses[0]` hinzu, ruft die gemockte API über den Store auf und öffnet den zurückgegebenen Detailtask.
11. Deaktiviert/sichert die Add-Aktion während eines laufenden Requests.
12. Rollt den optimistischen Add zurück und zeigt den Store-Fehler bei Ablehnung.

### Table tests — `client/src/__tests__/table-view.test.jsx` (minimum 10)

1. Rendert die semantische Tabelle und die vereinbarten Spaltenheader.
2. Prüft, dass das Icon in der Name-Zelle dekorativ ist (oder in der freigegebenen separaten Icon-Spalte, falls Product diese Option wählt).
3. Verwendet standardmäßig `createdAt desc`.
4. Ein Klick auf den aktiven Header wechselt die Richtung.
5. Ein Klick auf einen neuen sortierbaren Header startet aufsteigend.
6. Rendert `▲`/`▼` nur für den aktiven Key.
7. Setzt `aria-sort="ascending"` und `"descending"` korrekt sowie `"none"` auf inaktiven Headern.
8. Persistiert den Sortierstatus unter dem boardspezifischen `sessionStorage`-Key.
9. Stellt gültigen persistierten Status wieder her und fällt bei fehlerhaftem/ungültigem Status zurück.
10. Hält Sortierstatus von Board A und Board B getrennt.
11. Wendet Query- und Statusfilter vor der Sortierung an.
12. Öffnet die Detailroute per Mausklick und Enter aus einer fokussierten Zeile.
13. Stellt `aria-keyshortcuts="Enter"` und sichtbaren Fokusstyle bereit.
14. Zeigt Empty-State und Add-Möglichkeit für ein leeres Board.

### Existing regression tests

- `client/src/__tests__/routing.test.jsx:34-109` für beide Routen, aktive gerenderte Views und 404-Verhalten unbekannter Subpfade erweitern.
- `client/src/__tests__/view-switcher.test.jsx:8-41` für vier Links, exakte hrefs, Reihenfolge, aktives `aria-current` und `?q=`/`?f=`-Erhalt erweitern.
- Alle bestehenden Tests behalten (Issue-Baseline: 71 Tests), einschließlich List-Navigations-/Filtertests in `client/src/__tests__/list-view.test.jsx:132-175`.
- `npm test` (oder den konfigurierten Vitest-Befehl) und `npm run build --workspace=client` ausführen; sicherstellen, dass `vite build` sauber ist.

## 9. Acceptance Criteria

- [ ] `/board/:id/grid` rendert eine gefilterte responsive Kartenwand mit 1/2/3/4 Spalten an den angegebenen Breakpoints.
- [ ] Grid-Karten sind neueste-zuerst sortiert, zeigen oben rechts einen `StatusBadge`, verwenden `TaskCard` wieder und stellen oben links `AddTaskButton` bereit.
- [ ] Der Grid-Empty-State lautet `Add your first task` und erstellt/öffnet Tasks im ersten Board-Status.
- [ ] `/board/:id/table` rendert eine semantische sortierbare Tabelle mit der freigegebenen Icon-Spaltenentscheidung.
- [ ] Table-Sortierung unterstützt neues-Spalte-aufsteigend, Richtungswechsel der aktiven Spalte, `▲`/`▼` und korrektes `aria-sort`.
- [ ] Table-Sortierstatus wird pro Board-ID in `sessionStorage` persistiert und fällt bei ungültigen Werten sicher zurück.
- [ ] Table-Zeilen sind per Tastatur erreichbar; Enter und Pointer verwenden `BoardPage.openTask` und öffnen die Detailseite.
- [ ] Beide Views respektieren Query-/Statusfilter und den gemeinsamen `No tasks match`-Banner.
- [ ] ViewSwitcher bietet exakt `Kanban | List | Grid | Table`, erhält Query-Parameter, markiert die aktive View mit `aria-current` und bleibt rechts ausgerichtet.
- [ ] Unbekannte Board-Subpfade rendern weiterhin 404; Browser Back/Forward bewegt sich natürlich zwischen Views.
- [ ] Helle und dunkle Themes sind gleichwertig; dekorative Icons verwenden `aria-hidden="true"` und Fokuszustände sind sichtbar.
- [ ] Keine Backend-Dateien oder neuen Dependencies werden hinzugefügt.
- [ ] Mindestens 10 Grid- und 10 Table-Tests werden hinzugefügt; alle bestehenden Tests bestehen und `vite build` ist sauber.

## 10. Out of Scope

- Backend-Routen, MongoDB-Schemas, Migrationen oder API-Änderungen.
- Inline-Zellbearbeitung in Table.
- Einstellungen zum Ein-/Ausblenden von Spalten.
- Gespeicherte Views über den boardbezogenen `sessionStorage` hinaus.
- Neue Dependencies, Änderungen am Drag-and-Drop-Verhalten oder Änderungen an der Task-Detailseite.
- Wiedereinführung des entfernten `TaskForm`-Modals.
- Eine separate Icon-Spalte, sofern Product sie nicht ausdrücklich auswählt.

## 11. Risks & Open Questions

### Risks

- Die Wiederverwendung von `TaskCard` bedeutet, dass seine dnd-kit-Sortable-Hooks in Grid aktiv bleiben. Das entspricht dem bestehenden Komponentenvertrag, aber Grid darf keinen zweiten Drag-Kontext einführen oder die Reihenfolge beschädigen.
- Dynamische Statusklassen in Tailwind benötigen die vorhandenen safegelisteten `bg-status-*`-Tokens; `StatusBadge` muss dieselbe begrenzte Token-Zuordnung verwenden und darf keine beliebigen Klassennamen erzeugen.
- `sessionStorage` kann in Privacy-/Test-Umgebungen nicht verfügbar sein oder Fehler werfen; abgesicherter Zugriff und Default-Sortierung sind verpflichtend.
- Der Issue-Text referenziert `TaskForm`, aber #25/#26 haben es durch `TaskDetailPage` ersetzt; der Plan folgt bewusst der aktuellen Detailseiten-Architektur.

### Open questions / decisions for Product

1. Die Empfehlung bestätigen, das Task-Icon in die `Name`-Zelle zu setzen, oder eine separate `Icon`-Spalte zwischen `Status` und `Created` verlangen?
2. Soll die Table-Standardsortierung `Created desc` sein (Empfehlung, konsistent mit Grid/Neueste-zuerst), oder bevorzugt Product zum Scannen `Name asc`?
3. Soll `Add your first task` nur bei einem ungefiltert leeren Board erscheinen und bei gefilterter Leere der bestehende gemeinsame `No tasks match`-Banner gelten (Empfehlung)?
4. Soll Grid das bestehende `TaskCard`-Tastatur-/dnd-kit-Verhalten exakt beibehalten, oder soll Grid in einem späteren Follow-up einen nicht-sortierbaren Präsentations-Wrapper verwenden?

---

## Addendum — 2026-09-18 (List-Ansicht entfernt, Icon-Only-Switcher)

Produkt-Follow-up nach Review:

- Die in diesem Plan referenzierte List-Ansicht wurde entfernt: Die sortierbare Table-Ansicht ersetzt sie. `/board/:boardId/list` fällt auf `NotFoundPage`, `client/src/views/ListView.jsx` und `client/src/__tests__/list-view.test.jsx` sind gelöscht, und `useView` liefert nur noch `kanban | grid | table`.
- Der View-Switcher rendert Icon-Only-Links (Inline-SVG) mit `aria-label` als zugänglichem Namen statt sichtbarer Text-Labels.

