# Issue #26 — Implementation-Plan für View-Switcher + Listenansicht

## 1. Summary

Ein URL-gesteuerter Kanban/Listen-View-Switcher für Board-Nutzer wird gebaut. `/board/:boardId` bleibt die standardmäßige Kanban-Route und `/board/:boardId/list` rendert eine nach Status gruppierte, einklappbare Listenansicht. Der bestehende `useBoardStore`-State, der `filterTasks`-Helper, optimistische Task-Aktionen, `TaskForm` und Design Tokens bleiben die einzige Quelle der Wahrheit; es werden weder Backend-Endpunkte noch Dependencies benötigt. Das Refactoring extrahiert die bestehende Drag-and-Drop-Fläche nach `KanbanBoard`, hält gemeinsamen Header/Suche/Filter-Leerzustand in `BoardPage` und macht Deep Links sowie Browser-History natürlich nutzbar.

## 2. Architecture & Design Decisions

### Routing und aktiver View

- In `client/src/App.jsx:12-16` wird `{ path: '/board/:boardId/list', element: <BoardPage /> }` vor der bestehenden Route `/board/:boardId` ergänzt. Die Routen bleiben flach gemäß `docs/route-design.md:48-54`; die spezifischere Route muss zuerst deklariert werden.
- `client/src/lib/useView.js` wird mit `useLocation()` als kanonischer Quelle erstellt. Für die exakte Pfadform `/board/:boardId/list` wird nur `'list'` zurückgegeben; für `/board/:boardId` wird `'kanban'` zurückgegeben. Ein kleiner Hook ist besser, als die Pfad-Ermittlung in `BoardPage` und `ViewSwitcher` zu duplizieren; `ViewSwitcher` darf weiterhin `useParams()` für Links sowie `useLocation()`/`useView()` für den aktiven Zustand verwenden.
- `<Link>` statt imperativer Navigation verwenden. Das erhält Deep-Link-Fähigkeit und Browser-Back/Forward-Einträge und behält `location.search` (`q`/`f`) beim Ändern nur des Pfades bei.
- Unbekannte Pfade matchen weiterhin `NotFoundPage`. `/board/:boardId/unknown` darf nicht stillschweigend zu Kanban werden; nur die exakt unterstützten zwei Routen rendern `BoardPage`.

### Komposition und State-Verantwortung

- `BoardPage` bleibt verantwortlich für Board-Laden, globale Error/Loading-Zustände, den gemeinsamen `BoardHeader` (der `CommandBar` bereits in `client/src/components/BoardHeader.jsx:62-122` besitzt), `ViewSwitcher`, den Filter-Banner und das `TaskForm`-Modal.
- Die aktuelle `DndContext`, Sensor-Konfiguration, Drag-Handler, Auflösung von Drag-Zielen anhand der vollständigen Task-Liste, `SortableContext`s und `AddTaskButton`-Logik werden aus `client/src/pages/BoardPage.jsx:45-229` nach `client/src/views/KanbanBoard.jsx` verschoben. Die Seite wählt danach `KanbanBoard` oder `ListView`, ohne Task-Laden oder Modal-Logik zu duplizieren.
- Eine Callback-Übergabe an der Kompositionsgrenze (`onTaskClick`) von `BoardPage` an den aktiven View bleibt bestehen, damit das vorhandene Modal gemeinsam genutzt wird. Das ist kein mehrstufiges Prop-Drilling; View-Komponenten lesen Board/Filter/Aktionen direkt aus Zustand.
- Beide Views leiten sichtbare Tasks mit dem bestehenden `filterTasks(board?.tasks, query, filterStatus)` aus `client/src/store/useBoardStore.js:26-37` ab. Keine zweite Filter-Implementierung oder Store-Slice hinzufügen. Der Filter-Banner bleibt in `BoardPage` und gilt dadurch identisch für beide Views.
- Der Kanban-Drag-Resolver muss immer `board.tasks`, niemals die gefilterte Liste untersuchen. Filtern ändert nur gerenderte `SortableContext`-Items; `findColumnOfTask` und `findColumnFromOver` lösen weiterhin gegen die vollständige Liste auf.

### Verhalten der Listenansicht

- `client/src/views/ListView.jsx` liest `board`, `query` und `filterStatus` direkt aus `useBoardStore`, leitet mit `filterTasks` gefilterte Tasks ab und mappt `board.statuses`, ohne diese zu sortieren. So bleibt die vom Server/Nutzer definierte Statusreihenfolge erhalten.
- Für jeden Status mit gefilterten Tasks wird eine Sektion erstellt. Ihr Header ist ein echtes `<button>` mit `aria-expanded` und `aria-controls`; Sektionen starten aufgeklappt und verwalten ein lokales `collapsedStatuses`-Set. Ein Status mit null gefilterten Tasks hat keinen Header und keine Zeilen, behält aber eine minimale Sektion mit seinem statusbezogenen Add-Button, damit ein leerer Status weiterhin seinen ersten Task erhalten kann. Der seitenweite „No tasks match“-Banner behandelt ein insgesamt leeres Filterergebnis.
- Jede Zeile enthält Task-Icon, als React-Text escaped Task-Name, `formatRelativeTime(task.updatedAt ?? task.createdAt, now)` und einen dekorativen Chevron. Ein Zeilenklick ruft den gemeinsamen `onTaskClick(task)` auf und öffnet das vorhandene `TaskForm`. Tastaturaktivierung erfolgt über einen Button (oder eine gleichwertige fokussierbare Zeile mit vollständiger Enter/Space-Behandlung); wegen nativer Semantik wird ein Button bevorzugt.
- `AddTaskButton` wird am Ende jeder gerenderten Statussektion angezeigt und ruft `useBoardStore.addTask(status)` für diese Sektion auf. Den bestehenden optimistischen Create-Flow und den Schutz gegen schnelle Mehrfachklicks beibehalten. Nach erfolgreichem Resolve das Task an den Page-Callback übergeben, damit `TaskForm` öffnet; bei Fehler auf Store-Error-Banner vertrauen und Modal nicht öffnen. Wenn eine Sektion eingeklappt ist, bleibt der Add-Button unterhalb des eingeklappten Inhalts verfügbar.

### Relative Zeit und Tokens

- Den bestehenden Helper aus `client/src/components/ActivityFeed.jsx:8-20` nach `client/src/lib/formatRelativeTime.js` extrahieren und `formatRelativeTime` exportieren. Das bestehende Verhalten von `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` und die Signatur `(iso, now)` bleiben erhalten, damit Tests deterministisch sind. `ActivityFeed` importiert ihn; den Formatter nicht duplizieren.
- Bestehende Tokens wie `bg-surface-raised`, `bg-surface-muted`, `border-surface-border`, `text-surface-text-muted`, `shadow-card` und `focus-visible:ring-primary` verwenden. Keine CSS- oder Token-Änderungen, außer die Umsetzung zeigt einen fehlenden Token. Tailwind-Utility-Klassen liefern Light/Dark-Parität.

### Ausführbare Hook- und Komponentenbeispiele

```js
// client/src/lib/useView.js
import { useLocation } from 'react-router-dom'

export const useView = () => {
  const { pathname } = useLocation()
  const segments = pathname.split('/').filter(Boolean)
  return segments.length === 3 && segments[0] === 'board' && segments[2] === 'list'
    ? 'list'
    : 'kanban'
}
```

```jsx
// client/src/components/ViewSwitcher.jsx
import { Link, useLocation, useParams } from 'react-router-dom'
import { useView } from '../lib/useView.js'

const ViewSwitcher = () => {
  const { boardId } = useParams()
  const { search } = useLocation()
  const view = useView()
  const items = [
    { key: 'kanban', label: 'Kanban', to: `/board/${boardId}${search}` },
    { key: 'list', label: 'List', to: `/board/${boardId}/list${search}` },
  ]

  return (
    <nav aria-label="Board view" className="flex gap-1 p-1 bg-surface-muted rounded-card">
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.to}
          aria-current={view === item.key ? 'page' : undefined}
          className={`rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${view === item.key ? 'bg-surface-raised shadow-card text-surface-text' : 'text-surface-text-muted hover:bg-surface-raised'}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

export default ViewSwitcher
```

## 3. State Machine / Flow

```text
URL /board/:boardId or /board/:boardId/list
        │ React Router matches exact route
        ▼
BoardPage → useView()
        ├── board missing → loading / EmptyBoard / error
        └── board loaded
             ├── BoardHeader (includes CommandBar → Zustand query/filterStatus)
             ├── ViewSwitcher (Link changes pathname, keeps q/f)
             ├── filteredTasks = filterTasks(full board.tasks, query, filterStatus)
             ├── filteredTasks empty while filtering → shared No tasks match banner
             ├── kanban → KanbanBoard (render filtered; drag resolve full list)
             └── list → ListView (status order → rows; local collapse state)
                          ├── row click → BoardPage editingTask → TaskForm
                          └── add click → store.addTask(status) → API → TaskForm
```

```text
View link click → URL history entry → BoardPage re-render → active aria-current updates
Browser Back/Forward → location changes → useView updates → same board/filter state renders
```

Der Store bleibt `UI → useBoardStore action → api.js → state update → UI`; View-Auswahl und eingeklappte Sektionen sind URL/lokaler UI-State und kein persistierter Board-State.

## 4. API Contract

Es gibt keine neuen oder geänderten API-Aufrufe. Dies ist ein reines Frontend-Präsentationsfeature.

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| GET | `/api/boards/:boardId` | — | Bestehendes Board-Payload inklusive `statuses` und `tasks` | Bestehender Vertrag, konsumiert von `client/src/store/useBoardStore.js:64-73`; Backend bleibt in `server/routes/boards.js` |
| POST | `/api/tasks` | Bestehendes `addTask`-Payload mit `parentBoardId`, `status`, `name`, `description`, `icon`, `order` | Bestehendes Task-Payload | Bestehender Vertrag, konsumiert von `client/src/store/useBoardStore.js:370-386`; Backend bleibt in `server/routes/tasks.js` |
| PUT | `/api/tasks/:taskId` | Bestehendes `TaskForm`-Update-Payload | Bestehendes Task-Payload | Bestehender Vertrag, konsumiert von `client/src/store/useBoardStore.js:169-183`; Backend bleibt in `server/routes/tasks.js` |

Listenzeilen und View-Links dürfen `fetch` oder `api.js` nicht direkt aufrufen. Es gibt keine Backend-, Mongoose-, Validation-, Authentifizierungs- oder Dependency-Änderungen.

## 5. File Changes

- **Modify** `client/src/App.jsx:12-16` — `/board/:boardId/list` vor `/board/:boardId` ergänzen.
- **Modify** `client/src/pages/BoardPage.jsx:6-240` — Kanban-only-DnD-Code entfernen, `useView` verwenden, `ViewSwitcher` rendern, `KanbanBoard`/`ListView` wählen, Loading/Error/Empty/Filter-Banner und gemeinsamen `TaskForm`-State behalten.
- **Create** `client/src/lib/useView.js` — exakter URL-zu-View-Hook.
- **Create** `client/src/components/ViewSwitcher.jsx` — tokenbasierte Pill-Links und aktiver Accessibility-State.
- **Create** `client/src/views/KanbanBoard.jsx` — extrahierte DnD-Kanban-Implementierung.
- **Create** `client/src/views/ListView.jsx` — gruppierte einklappbare Liste, Zeilen, relative Zeiten und statusbezogene Add-Aktionen.
- **Create** `client/src/lib/formatRelativeTime.js` — gemeinsam genutzter deterministischer Relative-Time-Utility.
- **Modify** `client/src/components/ActivityFeed.jsx:5-20` — gemeinsamen Formatter importieren und lokalen Helper entfernen.
- **Create/modify tests** `client/src/__tests__/view-switcher.test.jsx`, `client/src/__tests__/list-view.test.jsx`, `client/src/__tests__/routing.test.jsx`, `client/src/__tests__/activity-feed.test.jsx` — neue Route/View-Logik und Utility-Import abdecken, ohne die API zu ändern.

## 6. Implementation Steps

1. **Routing-Grundlage (2 Dateien):** Die spezifische List-Route in `client/src/App.jsx` ergänzen; `client/src/lib/useView.js` mit exakter `kanban`/`list`-Zuordnung und sicherem Fallback für die Board-Root erstellen.
2. **Gemeinsamer Formatter (2 Dateien):** `client/src/lib/formatRelativeTime.js` durch unverändertes Verschieben des bestehenden Helpers erstellen; Imports und Verwendung in `client/src/components/ActivityFeed.jsx` aktualisieren.
3. **View-Switcher (1 Datei):** `client/src/components/ViewSwitcher.jsx` mit `<Link>`-Zielen, erhaltenem `location.search`, Token-Klassen für aktiv, `nav`, `aria-current`, sichtbarem Fokus und nativer Tastaturbedienung erstellen.
4. **Kanban-Extraktion (1 Datei):** DnD-Imports, Sensoren, Drag-Start/End-Auflösung, optimistische Add-Behandlung, `SortableContext`, `Column`, `DragOverlay` und Full-List-Resolver nach `client/src/views/KanbanBoard.jsx` verschieben und Verhalten erhalten.
5. **Listenrendering (1 Datei):** `client/src/views/ListView.jsx` erstellen; eine gefilterte Liste über `filterTasks` ableiten, nach `board.statuses` gruppieren, lokale Collapse-UI halten, zugängliche Header/Zeilen rendern, `formatRelativeTime` verwenden und `addTask(status)` über den Store aufrufen.
6. **Seitenkomposition (1 Datei):** `client/src/pages/BoardPage.jsx` refactoren, Fetch/Loading/Error/Empty-Verhalten und gemeinsamen Filter-Banner behalten, `ViewSwitcher` über dem aktiven View platzieren, nach `useView` auswählen und `TaskForm`-Modal an der Page-Grenze halten.
7. **Tests (3-4 Dateien):** View/List-Suites ergänzen, Routing- und ActivityFeed-Tests für neue Route und Formatter erweitern und bestehende BoardPage-Test-Routendefinitionen bei Bedarf anpassen.
8. **Validierung:** Client-Test-Suite und `vite build` ausführen sowie Deep Links, Query/Filter-Links, Back/Forward, unbekannte Pfade, Tastaturbedienung und Light/Dark-Themes manuell prüfen.

## 7. Edge Cases & Error Handling

- **Deep-linked List-Route:** Board einmal mit `boardId` laden; bestehende Loading- und Not-found/Error-UX vor beiden Views rendern.
- **Query/Filter-Deep-Link:** `CommandBar` hydratisiert weiterhin `q`/`f`; beide Views konsumieren dieselben Store-Werte und `filterTasks`. `ViewSwitcher` erhält die Query-Zeichenkette.
- **Keine Treffer:** `BoardPage` prüft dasselbe gefilterte Ergebnis und zeigt exakt den bestehenden „No tasks match“-Banner in beiden Views; die Clear-Aktion ruft `clearSearch` auf.
- **Leeres Board/Statuses:** `EmptyBoard` für kein Board oder keine definierten Statuses behalten. Ein definierter Status ohne gefilterte Tasks erzeugt keinen List-Header und keine Zeilen, behält aber seinen statusbezogenen Add-Button; ein vollständig gefiltertes Ergebnis wird über den Page-Banner behandelt.
- **Unbekannter Task-Status:** Keine Sektion erfinden; der Task bleibt in der statusgeordneten Ansicht abwesend. Bestehendes Kanban-Verhalten bleibt unverändert.
- **Fehlender/ungültiger Timestamp:** `formatRelativeTime` soll bei ungültigem Datum sicher einen verständlichen Fallback zurückgeben (zum Beispiel `Updated recently`), statt `Invalid Date` anzuzeigen; Verhalten definieren und testen.
- **Add-Fehler/Mehrfachklick:** Bestehenden optimistischen `addTask`-Rollback/Error-Flow, synchronen In-Flight-Schutz und Öffnen von `TaskForm` erst nach Erfolg verwenden. Der bestehende Alert der Seite bleibt die Nutzer-Fehleranzeige.
- **Fehler bei Row-Update/Delete:** `TaskForm` und Store behalten aktuellen Rollback- und Error-Flow; die List-Ansicht rendert nach Erfolg oder Rollback erneut aus Zustand.
- **Eingeklappte Sektion und Filter:** Collapse-State lokal und nach Status keyed halten; bei Filterwechsel leiten sichtbare Sektionen neu ab und zeigen nie einen veralteten Task außerhalb des Filters. Add-Buttons bleiben für leere Status verfügbar.
- **Accessibility:** Buttons haben zugängliche Namen, Header exponieren `aria-expanded` und eindeutige `aria-controls`, Zeilen sind tastaturbedienbar, Focus-visible-Ringe verwenden Tokens und dekorative Icons/Chevrons nutzen `aria-hidden`.
- **Unbekannte URL:** Der React-Router-Wildcard rendert weiterhin `NotFoundPage`; keinen permissiven Fallback in `useView` verwenden, der fehlerhafte Routen verdeckt.

## 8. Testing Strategy

Mindestens 10 neue fokussierte Tests ergänzen, während bestehende Tests grün bleiben:

- `client/src/__tests__/view-switcher.test.jsx`: (1) Kanban ist bei `/board/b1` aktiv, (2) List ist bei `/board/b1/list` aktiv, (3) Links zeigen auf beide exakten Pfade, (4) `aria-current` folgt der Route, (5) `?q=docs&f=completed` bleibt erhalten, (6) Tastaturfokus/-aktivierung funktioniert.
- `client/src/__tests__/list-view.test.jsx`: (7) gruppiert Tasks nach Status, (8) folgt nicht-alphabetischer `board.statuses`-Reihenfolge, (9) rendert Icon/Name/relative Zeit/Chevron, (10) leere Sektionen bleiben still, (11) Header-Collapse aktualisiert `aria-expanded` und versteckt Zeilen über `aria-controls`, (12) Row-Klick ruft Page-Callback auf und öffnet `TaskForm` in einem Integrationsrender, (13) Add-Button jeder Sektion ruft `addTask` mit deren Status auf, (14) optimistisches Create öffnet Modal nach Resolve, (15) nur gefilterte Tasks erscheinen, (16) null gefilterte Tasks zeigt gemeinsamen Banner und Clear-Aktion.
- `client/src/__tests__/routing.test.jsx`: beide Routendefinitionen rendern, Kanban/List prüfen, `/board/b1/unknown` bleibt 404 und Memory-Router Back/Forward testen.
- `client/src/__tests__/activity-feed.test.jsx`: Verhalten des extrahierten Formatters für Sekunden/Minuten importieren/testen und sicherstellen, dass ActivityFeed weiterhin relative Zeitstempel rendert.
- Integrations-Setup in `client/src/__tests__/command-bar.test.jsx` bei Bedarf um die List-Route erweitern und beweisen, dass derselbe Filter die List-Ansicht und keinen zweiten Filter einschränkt.

Bestehende Vitest- und Testing-Library-Muster, Store/API-Mocks, `MemoryRouter`/`createMemoryRouter` sowie deterministische `now`-Werte verwenden. Ausführen:

```bash
npm test --workspace=client
npm run build --workspace=client
```

## 9. Acceptance Criteria

- [ ] `/board/:id` rendert Kanban und `/board/:id/list` rendert List.
- [ ] View-Wechsel verwendet `<Link>`, markiert aktiven View, stellt `aria-current` bereit und erhält `q`/`f`.
- [ ] Deep Links und Browser-Back/Forward wählen den korrekten View; unbekannte Board-Unterpfade rendern 404.
- [ ] Kanban-DnD-Verhalten bleibt unverändert und löst Drag-Ziele gegen die vollständige Task-Liste auf, während gefilterte Tasks gerendert werden.
- [ ] List-Sektionen folgen `board.statuses`, sind zugänglich einklappbar, lassen leere Header/Zeilen aus und behalten einen statusbezogenen Add-Button für leere Status.
- [ ] Jede Zeile zeigt Icon, Name, relative Zeit und Chevron; Aktivierung öffnet das bestehende `TaskForm`.
- [ ] Jede sichtbare Sektion besitzt einen Add-Button, der mit deren Status erstellt und nach Erfolg `TaskForm` öffnet.
- [ ] Das `filterTasks`-Verhalten aus #25 und der gemeinsame „No tasks match“-Banner funktionieren identisch in beiden Views.
- [ ] Relative-Time-Logik wird von List-View und ActivityFeed geteilt und Tests sind aktualisiert.
- [ ] Light/Dark-Token-Styling, Fokuszustände und Tastaturbedienung erfüllen Accessibility-Erwartungen.
- [ ] Mindestens 10 neue Tests bestehen, alle bestehenden Tests bestehen und `vite build` ist sauber.
- [ ] Keine Backend-Dateien und keine neuen Dependencies werden eingeführt.

## 10. Out of Scope

- Backend-Routen, Mongoose-Schemas, API-Contract-Änderungen, Authentifizierung oder neue Dependencies.
- Grid- oder Table-Views (#27).
- Drag-and-Drop in der List-Ansicht.
- Persistieren eines bevorzugten Views pro Board oder in Zustand/localStorage; die URL ist Quelle der View-Auswahl.
- Ersetzen der bestehenden `CommandBar`, Ändern der Filtersemantik oder Verschieben aus `BoardHeader`.

## 11. Risks & Open Questions

### Risiken

- Beim Extrahieren von `BoardPage` kann versehentlich der Full-List-Drag-Resolver oder das Kanban-Add-Verhalten nur in der ersten Spalte verändert werden; bestehende Tests erhalten und Drag-Auflösung bei aktivem Filter explizit testen.
- Eine dynamische `status`-Klasse muss die bereits safelisted Status-Tokens verwenden; keine beliebigen Tailwind-Klassen einführen, die der Build nicht erkennt.
- `TaskForm` fokussiert und bearbeitet derzeit den erstellten Task nach `addTask`; temporäre IDs und API-Fehler dürfen kein veraltetes Modal hinterlassen.
- Datumsfelder können zwischen Fixtures/Server-Payload variieren (`updatedAt`, `createdAt`); der Utility braucht einen dokumentierten Fallback.

### Offene Fragen an Product/Review

- Sollen Pill-Labels jetzt lokalisiert werden oder die englischen UI-Labels (`Kanban`, `List`) bleiben?
- Welcher exakte Fallback-Text ist für einen Task ohne gültigen Timestamp gewünscht: `Updated recently`, `Updated just now` oder Auslassen?
- Soll eine eingeklappte List-Sektion beim Filterwechsel eingeklappt bleiben oder sollen neu sichtbare Treffer-Sektionen automatisch aufgeklappt werden?
- Soll der Section-Add-Button sichtbar bleiben, wenn seine Sektion leer und/oder eingeklappt ist? Dieser Plan nimmt für jeden Status ja an, auch für einen leeren Status ohne Header/Zeilen.
