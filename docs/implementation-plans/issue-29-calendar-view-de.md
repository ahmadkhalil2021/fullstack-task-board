# Issue #29 — Kalenderansicht (Zeitlinie nach dueDate)

## 1. Summary

Eine fünfte, routenbasierte Kalenderansicht soll die gefilterten Board-Aufgaben in einem UTC-sicheren Monatsraster darstellen, Aufgaben ohne `dueDate` in einem Tray für nicht geplante Aufgaben sammeln und das Umplanen per optimistischem Drag-and-drop oder einem Tastatur-Verschiebemodus ermöglichen. Die Ansicht ergänzt Kanban, Grid und Table, ändert den Server-Vertrag nicht, behält die bestehende Navigation zur Aufgabendetailseite bei und bleibt in hellen und dunklen Themes mit vollständiger Tastatur- und Screenreader-Unterstützung nutzbar.

## 2. Architecture & Design Decisions

- **Route und View-Identität:** Die exakte Route `/board/:boardId/calendar` wird in `client/src/App.jsx:13-20` ergänzt und `calendar` in `client/src/lib/useView.js:8-16` zur exakten Pfadzuordnung hinzugefügt. `useView` darf eine Ansicht nicht anhand eines Präfixes ableiten; fehlerhafte Pfade müssen weiterhin `null` zurückgeben.
- **Switcher:** `client/src/components/ViewSwitcher.jsx:7-48` erhält einen fünften Icon-only-Link mit der Beschriftung `Calendar`, wobei `location.search` erhalten bleibt. Die empfohlene Reihenfolge ist Kanban, Grid, Table, Calendar: Sie erhält die bestehende Reihenfolge und hängt die zeitliche Ansicht aus diesem Issue an. Das Inline-SVG wird vor assistiver Technologie verborgen, während der Link `aria-label="Calendar"`, `title="Calendar"` und bei Aktivität `aria-current="page"` bereitstellt.
- **Bestehende Detailnavigation:** Ein Chip muss `BoardPage.openTask` aufrufen, darf kein Modal und keine entfernte `TaskForm` öffnen. `BoardPage.openTask` schreibt bereits `location.pathname + location.search` in `location.state.from` (`client/src/pages/BoardPage.jsx:29-33`), sodass die Rückkehr von `TaskDetailPage` sowohl die Kalenderroute als auch die Filter erhält.
- **Monatsmodell:** Es wird ein Montag–Sonntag-Raster verwendet. Das ist die übliche Planungswoche für ein Task-Board; die Beschriftungen können im bestehenden en-US-Produktkontext weiterhin `Mon` bis `Sun` verwenden. Es werden vollständige Wochen gerendert, die den ersten und letzten Monatstag enthalten, einschließlich visuell gedämpfter Nachbar-Monatszellen. Es wird keine Kalenderbibliothek und keine neue Dependency benötigt.
- **Datumsrichtigkeit:** `dueDate` wird als reiner Datumswert behandelt, der Mitternacht in UTC repräsentiert. In `client/src/lib/dueDate.js` wird ein reiner Helper `toDateKey` ergänzt; gruppiert wird nach UTC-Jahr/Monat/Tag, niemals nach `Date#toDateString()` oder lokaler `getDate()`. Der „heute“-Schlüssel wird aus den lokalen Kalenderbestandteilen (`getFullYear()`, `getMonth() + 1`, `getDate()`) statt aus `toISOString()` abgeleitet, während gespeicherte Due-Dates mit UTC-Bestandteilen gelesen werden. Ein an ein Update übergebener Schlüssel ist `YYYY-MM-DD`; Store/API verwenden weiterhin den bereits von `TaskDetailPage` und `updateTask` unterstützten Vertrag.
- **Abgeleiteter Zustand:** Es wird kein `tasksByDay`-Selector ergänzt, der bei jedem Aufruf eine neue `Map` in Zustand zurückgibt. Zustand-v5-Selectoren müssen stabile Snapshots liefern, und der Code leitet bereits gefilterte Arrays mit `useMemo` ab (`client/src/store/useBoardStore.js:26-37`, `client/src/views/TableView.jsx:84-98`). Die einzige Filterung bleibt `filterTasks`; die View selektiert `board.tasks`, `query` und `filterStatus` und erzeugt danach mit `useMemo` aus einem reinen `groupTasksByDate`-Helper eine `Map`. So gibt es keinen zweiten Filter und keinen instabilen Store-Snapshot.
- **Filterung:** Der Kalender erhält exakt die gefilterte Menge aus #25. Eine nicht geplante Aufgabe erscheint im Tray nur, wenn sie `filterTasks` übersteht; Counts, Chips, Side-Panel-Inhalte und Empty-States verwenden dieselbe Menge. Das gemeinsame BoardPage-Banner „No tasks match“ bleibt maßgeblich, wenn die Filtermenge leer ist.
- **Tray-Reihenfolge:** Nicht geplante Aufgaben werden deterministisch nach Priorität absteigend (`high`, `medium`, `low`, `none`), danach `createdAt` absteigend und danach `_id` aufsteigend sortiert. Sie sind in Zellen ziehbar, aber es gibt keine persistierte manuelle Tray-Reihenfolge, weil das Task-Modell dafür kein Feld besitzt. Diese Regel wird im Tray-Hinweis statt durch einen weiteren State-Slice erklärt.
- **DnD-Modell:** Es wird ein `DndContext` mit `PointerSensor` und kleiner Aktivierungsdistanz sowie `KeyboardSensor` verwendet. Tageszellen nutzen `useDroppable({ id: `day:${dateKey}` })`; Task-Chips und Tray-Elemente nutzen `useDraggable({ id: `task:${task._id}` })`; `DragOverlay` rendert einen kompakten Chip. Bei einem gültigen Drop wird die Aufgabe aus der vollständigen Board-Aufgabenliste aufgelöst, der alte Schlüssel mit dem Ziel verglichen und `updateTask(taskId, { dueDate: targetDateKey })` aufgerufen. Ein Drop in den Tray kann `{ dueDate: null }` unterstützen, wenn der Tray als Dropziel umgesetzt wird; die Pflicht-Richtung ist Tray-zu-Tag.
- **Tastaturalternative:** Der DnD-`KeyboardSensor` bleibt für normale Aktivierung vorhanden; zusätzlich gibt es für jeden Chip eine deterministische Alternative ohne Pointer: Chip fokussieren, `m` drücken, mit `ArrowLeft`/`ArrowRight` einen Kalendertag zurück/vor bewegen (`Home` setzt auf den aktuellen Datumsschlüssel), `Enter` bestätigen und `Escape` abbrechen. Der Chip stellt `aria-keyshortcuts="m"` und eine sichtbare bzw. für Screenreader bestimmte Verschiebeanweisung bereit. Das Commit verwendet dieselbe `updateTask`-Action und denselben Rollback wie Pointer-DnD, sodass keine Maus nötig ist.
- **Side-Panel:** Ein Zellklick öffnet ein Inline-Side-Panel, kein Modal und keine neue Route, mit allen gefilterten Aufgaben dieses Tages. Das Panel besitzt eine beschriftete Überschrift, einen Schließen-Button, Fokus-Rückgabe an die Ursprungzelle und einen normalen DOM-Fokusablauf; beim Öffnen wandert der Fokus auf den Schließen-Button. Eine Chip-Aktivierung im Panel navigiert zur Detailseite.
- **Theme und Styling:** Utility-Klassen sowie bestehende `surface`-, `primary`-, `danger`-, `status`- und `priority`-Tokens aus `client/index.css:6-47` und `client/tailwind.config.js:18-53` verwenden. Es werden keine Component-CSS und keine dynamischen, für Tailwind nicht erkennbaren Klassen hinzugefügt.

## 3. State Machine / Flow

```text
URL /board/:boardId/calendar?q=...&f=...
  -> BoardPage lädt Board und leitet filterTasks(board.tasks, query, filterStatus) ab
  -> CalendarView setzt sichtbaren Monat = aktueller Monat
  -> useMemo: gefilterte Aufgaben -> UTC-Datumsschlüssel-Map + nicht geplante Liste
  -> Raster, Counts, Chips und Tray rendern

Zellklick -> selectedDay = dateKey -> Side-Panel öffnet sich -> Fokus auf Schließen-Button
Chip-Klick/Enter -> BoardPage.openTask(task) -> /task/:taskId mit exakter from-URL
View-Link-Klick -> dieselbe Query-String wird in die Zielansicht kopiert

Pointer-Drag oder Tastaturverschiebung
  -> Aufgabe + Zieldatumsschlüssel identifizieren
  -> updateTask(taskId, { dueDate: targetDateKey })
  -> optimistisches Store-Update -> neu gruppieren und sofort rendern
  -> API-Erfolg: Aufgabe durch Serverantwort ersetzen
  -> API-Fehler: vorheriges Board + Error-Banner wiederherstellen + Ansage
```

Die Monatsnavigation ändert nur den lokalen `visibleMonth`; `<` und `>` verschieben um einen Monat und `Heute` setzt den aktuellen Monat. Wenn heute außerhalb des sichtbaren Monats liegt, behält der Header eine `Today`-Aktion bzw. ein Badge; beim Durchsuchen der Historie darf nicht stillschweigend gesprungen werden.

## 4. API Contract

Es ist kein Backend und kein neuer Endpoint erforderlich. Der bestehende Store/API-Vertrag bleibt die Grenze:

| Method | Path | Body | Response | Referenz |
|---|---|---|---|---|
| `PUT` | `/api/tasks/:taskId` | `{ "dueDate": "2026-09-03" }` oder `{ "dueDate": null }` | Bestehende Task-Antwort, von `client/src/lib/api.js` entpackt | Bestehendes `updateTask` aus `client/src/store/useBoardStore.js:121-197`; Serverroute unter `server/routes/tasks.js` |
| `GET` | `/api/boards/:boardId` | keiner | Bestehendes Board mit `tasks[]` einschließlich `dueDate` | `client/src/store/useBoardStore.js:64-73`; Boardroute unter `server/routes/boards.js` |

Die UI darf niemals `fetch` oder `api.js` direkt aufrufen. Sie ruft `useBoardStore(s => s.updateTask)` auf, entsprechend `docs/state-management.md:3-27`. Ungültige Daten, fehlende Task-IDs und Fehler bei Autorisierung/Validierung werden über das bestehende Error-Banner und Rollback-Verhalten sichtbar; Serveränderungen sind nicht Teil des Plans.

UTC-Helper für `client/src/lib/dueDate.js`:

```js
export const toDateKey = (iso) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'))
    .join('-')
}
```

Dasselbe Format wird beim Erzeugen eines Drop-Datums aus UTC-Kalenderteilen verwendet; keine lokale Mitternacht in ISO umwandeln und danach lokale Bestandteile extrahieren.

## 5. File Changes

- **Modify** `client/src/App.jsx:13-20` — `/board/:boardId/calendar` vor der Board-Root-Route registrieren.
- **Modify** `client/src/lib/useView.js:8-16` — das exakte Segment `calendar` erkennen.
- **Modify** `client/src/components/ViewSwitcher.jsx:7-79` — Calendar-Icon/Link in vereinbarter Reihenfolge ergänzen und Query-Strings erhalten.
- **Modify** `client/src/pages/BoardPage.jsx:5-15,108-115` — `CalendarView` importieren und rendern; `openTask` als Navigations-Callback beibehalten.
- **Create** `client/src/views/CalendarView.jsx` — Monatsraster, Navigation, Filterableitung, Chips, Tray, Side-Panel, DnD, Tastaturmodus und Ansagen.
- **Modify** `client/src/lib/dueDate.js:1-40` — `toDateKey` exportieren und bestehende UTC-sichere Helper behalten.
- **Do not modify** `client/src/store/useBoardStore.js` — `filterTasks` und optimistisches `updateTask` wiederverwenden; kein zweiter Selector/Filter.
- **Do not modify** `client/src/pages/TaskDetailPage.jsx:395-472` — bestehendes `from`-Verhalten funktioniert bereits für die Kalender-URL.
- **Modify** `client/src/__tests__/use-view.test.jsx` und `client/src/__tests__/routing.test.jsx` — Kalenderroute/View abdecken.
- **Modify** `client/src/__tests__/view-switcher.test.jsx` — fünftes Icon, Reihenfolge, Query-Erhalt und Accessible Name abdecken.
- **Modify** `client/src/__tests__/due-date.test.js` — UTC-Datumsschlüssel-Fälle ergänzen.
- **Create** `client/src/__tests__/calendar-view.test.jsx` — mindestens 15 fokussierte UI-/Interaktionstests.
- **Modify** `client/src/__tests__/use-board-store.test.js` nur falls eine gesonderte Due-Date-Fehlerassertion nötig ist; bestehendes Rollback soll wiederverwendet werden.
- **No changes** an `server/`, `client/package.json`, `client/index.css` oder `client/tailwind.config.js`, außer eine bereits vorhandene Token-Lücke wird bei der Umsetzung entdeckt; keine neue Dependency.

## 6. Implementation Steps

1. `client/src/lib/dueDate.js` um `toDateKey` ergänzen, UTC-Grenzfälle in `client/src/__tests__/due-date.test.js` testen und bestehendes `toDateInputValue`, `formatDueDate` sowie `isOverdue` unverändert verifizieren.
2. Exakte Kalenderroute in `client/src/App.jsx` registrieren und `client/src/lib/useView.js` aktualisieren; positive und fehlerhafte Pfade in `client/src/__tests__/use-view.test.jsx` und `client/src/__tests__/routing.test.jsx` ergänzen.
3. Inline-Calendar-SVG ergänzen, Calendar in `VIEWS` anhängen und `client/src/__tests__/view-switcher.test.jsx` um Aktivstatus, Zielpfade, Query-Erhalt, Reihenfolge und Icon-only-Accessibility erweitern.
4. `CalendarView` in `client/src/pages/BoardPage.jsx` importieren und für `view === 'calendar'` mit `onTaskClick={openTask}` wie bei den anderen Ansichten rendern.
5. `client/src/views/CalendarView.jsx` mit reinen Helpern für Monatsgrenzen, Montag-erste-Zellen, UTC-Datumsschlüssel und Gruppierung erstellen; gefilterte Aufgaben einmal mit `useMemo` aus den drei Store-Werten ableiten.
6. In `client/src/views/CalendarView.jsx` Header-Steuerung `<`/`Heute`/`>`, Live-Monats-/Count-Ansage, Today-Hervorhebung, Nachbar-Monat-Styling, Zelllabels, Counts, Drei-Chip-Limit und `+N more` implementieren.
7. In derselben View Side-Panel mit ausgewähltem Tag, Schließen-/Fokus-Rückgabe, vollständiger Aufgabenliste, Chip-zu-`onTaskClick`-Navigation und getrennten Empty-States für keinen Monatsinhalt, keine geplanten Aufgaben und keine Filtertreffer ergänzen.
8. Unscheduled-Tray mit Priorität/createdAt/id-Sortierung und DnD-Kontext ergänzen: Pointer-/Keyboard-Sensoren, `useDraggable`-Chips, `useDroppable`-Tageszellen, vollständige Board-Task-Auflösung, `DragOverlay` und Zielschlüssel-Auflösung.
9. Drops und Tastaturmodus an `updateTask` anschließen; abgelehnte Promises nur abfangen, damit die View stabil bleibt, weil der Store den globalen Fehler setzt und zurückrollt, und Erfolg/Fehler ohne doppelte lokale Rollback-Logik ansagen.
10. `client/src/__tests__/calendar-view.test.jsx` erstellen und Route-/Switcher-Tests anpassen; vollständige Client- und Servertests, `npm run build` im Client und Lint ausführen, ohne unabhängige Dateien zu ändern.

Zentrales Gruppierungs-Snippet für `CalendarView.jsx`:

```js
const groupTasksByDate = (tasks) => {
  const groups = new Map()
  tasks.forEach((task) => {
    const key = toDateKey(task.dueDate)
    if (!key) return
    const dayTasks = groups.get(key) ?? []
    groups.set(key, [...dayTasks, task])
  })
  return groups
}

const filteredTasks = useMemo(
  () => filterTasks(board?.tasks, query, filterStatus),
  [board?.tasks, query, filterStatus]
)
const tasksByDay = useMemo(() => groupTasksByDate(filteredTasks), [filteredTasks])
const unscheduledTasks = useMemo(
  () => filteredTasks
    .filter((task) => !toDateKey(task.dueDate))
    .sort(compareUnscheduledTasks),
  [filteredTasks]
)
```

## 7. Edge Cases & Error Handling

- **Kein Board/Laden:** `null` zurückgeben, während die bestehende BoardPage-Lade-/Empty-Hülle die Darstellung kontrolliert; `board` nie vor Existenz dereferenzieren.
- **Überhaupt keine Aufgaben:** Freundlichen Kalender-Empty-State und „Drag tasks here to schedule them“-Hinweis im/nahe dem Tray zeigen; ohne aktiven Filter keine irreführende No-Match-Meldung zeigen.
- **Keine Filtertreffer:** BoardPage zeigt „No tasks match“; CalendarView darf keine ungefilterten, veralteten Chips zeigen.
- **Kein Inhalt im sichtbaren Monat:** Monatsraster und Empty-Hinweis zeigen, aber gefilterte nicht geplante Tray-Aufgaben weiter darstellen.
- **Keine geplanten Aufgaben:** Leeres Raster und „No scheduled tasks yet — drag tasks here to schedule them“ zeigen; der Tray bleibt verfügbar.
- **Nur nicht geplante Filtertreffer:** Tray und leere Tageszellen rendern; Counts bleiben null.
- **Vergangene/zukünftige Monate:** Jede durch JavaScript darstellbare Monatsnavigation ist erlaubt; vergangene Aufgaben bleiben sichtbar und Today erscheint nur, wenn der aktuelle Datumsschlüssel im sichtbaren Raster liegt.
- **Nachbar-Monatszellen:** Für Wochenkontinuität sichtbar, aber keine gültigen Dropziele und ohne Panel-Öffnung; zum Bearbeiten muss navigiert werden.
- **Ungültiges/null `dueDate`:** `toDateKey` liefert `null`; die Aufgabe landet im Tray und nie unter „Invalid“.
- **Zeitzone:** Gruppierung und erzeugte Schlüssel verwenden UTC-Bestandteile. Monatslabels dürfen einen festen en-US-Formatter verwenden, müssen aber auf explizitem UTC-Datum oder numerischem Jahr/Monat beruhen, nicht auf lokalem Parsing von `YYYY-MM-DD`.
- **Drop am selben Tag:** Kein API-Aufruf und höchstens die Ansage „Task already scheduled for this day.“
- **Drop bei Filter:** `active.id` aus `board.tasks` auflösen, nicht nur aus sichtbaren Aufgaben; nur sichtbare Chips dürfen draggable sein, damit ein Filter keine andere Aufgabe verändert.
- **Fehlerhaftes Update:** `updateTask` stellt bereits das vorige Board wieder her und setzt `error` (`client/src/store/useBoardStore.js:182-197`). Im Drop-/Move-Handler abwarten, die View aus dem zurückgerollten Store ableiten und „Could not reschedule task; change reverted.“ ansagen.
- **Schnelle wiederholte Verschiebungen:** Chip-Move-Steuerungen während eines laufenden Updates deaktivieren oder die Task-ID in einer lokalen Pending-Menge verfolgen, um veraltete Antworten zu vermeiden. Pointer- und Tastaturhandler dürfen keine doppelten Commits erzeugen.
- **Side-Panel-Lebenszyklus:** Escape und Schließen geben den Fokus an die ausgewählte Zelle zurück; falls sie nach Navigation unmountet, den Kalender-Heading fokussieren. Kein Fokus-Trap, da es kein Modal ist.
- **Lange Namen/Counts:** Chips visuell abschneiden, aber den vollständigen Namen im Accessible Label ausgeben; `+N more` ist ein Button mit explizitem Count.
- **XSS/Sicherheit:** Task-Namen als React-Text rendern, niemals `dangerouslySetInnerHTML`; bestehende Store-Validierung/API-Grenze verwenden und keine direkte URL-Interpolation außer der vorhandenen Task-ID-Route einführen.
- **Dark Mode/responsiv:** Token-Utilities verwenden, Side-Panel auf schmalen Screens unter dem Raster stapeln und sichtbare Fokus-Ringe in beiden Themes behalten.

## 8. Testing Strategy

`client/src/__tests__/calendar-view.test.jsx` mit mindestens diesen 20 Fällen erstellen (die genaue Anzahl darf wachsen):

1. Rendert standardmäßig den aktuellen Monat mit sieben Montag-ersten Wochentagsüberschriften.
2. Erzeugt vollständige Kalenderwochen über eine Monatsgrenze hinweg.
3. Gruppiert UTC-Mitternachts-Due-Dates ohne lokalen Zeitzonenversatz am richtigen Tag.
4. Zeigt Tagescount und höchstens drei Chips.
5. Zeigt `+N more` und öffnet das Side-Panel mit allen Aufgaben dieses Tages.
6. Das Zell-`aria-label` enthält formatiertes Datum und Task-Count.
7. Klick/Enter auf einen Chip ruft den übergebenen Task-Navigationscallback auf.
8. Monatsnavigation bewegt vorherigen/nächsten Monat und aktualisiert die `aria-live`-Ansage.
9. `Heute` kehrt zum aktuellen Monat zurück und heute hat Highlight/Badge.
10. Ein Monat außerhalb des heutigen Monats hat kein Today-Highlight, behält aber die Today-Aktion.
11. Filter entfernt Aufgaben aus Zellen, Counts, Panel und Tray mit demselben `filterTasks`-Ergebnis.
12. No-Match- und No-scheduled-task-Empty-States sind verschieden.
13. Tray enthält nur null/ungültige Due-Dates und folgt der dokumentierten Priorität/createdAt/id-Reihenfolge.
14. Pointer-Drag aus dem Tray in einen Tag ruft `updateTask(taskId, { dueDate: 'YYYY-MM-DD' })` auf.
15. Drag eines geplanten Chips auf einen anderen Tag nutzt vollständige Board-Aufgabe und Zielschlüssel.
16. Drop am selben Tag ruft `updateTask` nicht auf.
17. Ein abgelehntes Update lässt die Aufgabe am ursprünglichen Tag und sagt Rollback/Fehler an.
18. Tastaturmodus unterstützt `m`, ArrowLeft/ArrowRight, Enter-Commit und Escape-Abbruch einschließlich `aria-live`-Ansage.
19. Side-Panel-Schließen gibt Fokus an die ausgewählte Zelle zurück.
20. `DragOverlay` wird bei aktivem Chip gerendert und Nachbar-Monatszellen sind keine Dropziele.

`client/src/__tests__/use-view.test.jsx`, `routing.test.jsx` und `view-switcher.test.jsx` um Route-/Switcher-Verhalten aktualisieren sowie `due-date.test.js` für `toDateKey` mit validen, nullen, ungültigen und Zeitzonen-Grenzwerten ergänzen. Die aktuelle Basis von 184 Client- und 61 Servertests bleibt erhalten; `npm test` in den relevanten Workspaces, `npm run build --workspace=client` und Lint ausführen. `useBoardStore`/`updateTask` mit Testing Library `userEvent` mocken; keine Echtzeitabhängigkeit verwenden, sondern ein fixes „Heute“ injizieren oder Fake-Timer nutzen.

## 9. Acceptance Criteria

- [ ] `/board/:boardId/calendar` rendert `CalendarView`, unbekannte Board-Unterpfade bleiben 404.
- [ ] `useView` erkennt nur den exakten Kalenderpfad und `ViewSwitcher` zeigt Kanban, Grid, Table, Calendar in dieser Reihenfolge als zugängliche Icon-only-Links.
- [ ] Jeder Switcher-Link erhält `location.search`, und Task-Detailnavigation kehrt zur exakten Kalender-URL einschließlich Filter zurück.
- [ ] Der aktuelle Monat erscheint standardmäßig mit Montag–Sonntag-Zellen, vollständigen Wochen, Vorher/Heute/Nächster-Steuerung und Today-Hervorhebung.
- [ ] Aufgaben werden nach UTC-sicherem `YYYY-MM-DD`-Due-Date gruppiert; vergangene und navigierte Monate bleiben sichtbar.
- [ ] Jeder Tag zeigt Count und höchstens drei Chips plus `+N more`; Zellklicks zeigen alle gefilterten Aufgaben in einem zugänglichen Side-Panel.
- [ ] Chips navigieren zu `TaskDetailPage`, nicht zu Modal oder `TaskForm`.
- [ ] Null/ungültige Due-Dates erscheinen in „Unscheduled · N“, folgen der dokumentierten deterministischen Regel und können in einen Tag gezogen werden.
- [ ] DnD verwendet ausschließlich vorhandenes dnd-kit mit PointerSensor, KeyboardSensor, `useDraggable`, `useDroppable` und `DragOverlay`.
- [ ] Pointer-Drops und Tastaturmodus rufen optimistisches `updateTask` mit Zieldatum auf und erholen sich sichtbar bei Rollback.
- [ ] Filter #25 beeinflusst Zellen, Counts, Side-Panel, Tray und Empty-States exakt einmal.
- [ ] Tastatur-Rasternavigation, Chip-Verschiebung, Fokus-Rückgabe, Zelllabels, Live-Ansagen, sichtbarer Fokus und Light/Dark-Parität sind umgesetzt.
- [ ] Mindestens 15 neue Kalender-Tests bestehen; alle bestehenden 184 Client- und 61 Servertests bleiben grün; Client-Build und Lint sind sauber.
- [ ] Keine Backend-Dateien oder Dependencies werden ergänzt oder geändert.

## 10. Out of Scope

- Backend-Schema-, Routen-, Controller- oder API-Änderungen.
- Neue npm-Dependencies oder eine Kalenderkomponenten-Bibliothek.
- Mehrmonats- oder Wochen-/Zeitfensteransichten, Tageszeitplanung, iCal-Export, wiederkehrende Aufgaben oder Zusammenarbeit.
- Persistierte individuelle Sortierung des Unscheduled-Trays.
- Ersetzen der bestehenden TaskDetailPage durch ein Modal oder Wiedereinführen von `TaskForm.jsx`.
- Verschieben per Klick auf Nachbar-Monatszellen ohne Navigation in diesen Monat.

## 11. Risks & Open Questions

- **Risiko — DnD-Hit-Testing:** Kleine Zellen und dichte Chips können Pointer-Drops unzuverlässig machen. Mit vollflächigen Dropzielen, `closestCenter`/`rectIntersection`, sichtbarem Over-State und DragOverlay mitigieren.
- **Risiko — Tastaturparität:** dnd-kit-Koordinaten bilden ein zweidimensionales Kalenderfeld nicht natürlich ab. Mit explizitem `m`-Move-Modus mitigieren und separat testen; KeyboardSensor für den nativen DnD-Pfad behalten.
- **Risiko — Zeitzonenregressionen:** Lokales Parsing kann Tage verschieben. Mit `toDateKey`, UTC-only-Gruppierung und möglichst Tests in einer Nicht-UTC-Zeitzone in CI mitigieren.
- **Risiko — Zustand-v5-Schleifen:** Ein Selector, der eine neue `Map` zurückgibt, kann instabile Snapshots erzeugen. Gruppierung in `useMemo` der View halten und keinen `tasksByDay`-Store-Selector ergänzen.
- **Risiko — konkurrierende optimistische Antworten:** Zwei schnelle Verschiebungen können in falscher Reihenfolge fertig werden. Wiederholte Commits für die aktive Aufgabe deaktivieren oder Pending-Guard pro Task ergänzen; mit Deferred-Promise-Test prüfen.
- **Risiko — Abweichung der Testbasis:** Der Issue-Text nennt 71 bestehende Tests, das aktuelle Repository jedoch 184 Client- und 61 Servertests. Die aktuelle Repository-Basis muss erhalten bleiben; Tests dürfen nicht entfernt werden, um die Issue-Angabe zu erreichen.
- **Produktentscheidung:** Ist Montag–Sonntag für den en-US-Produktkontext akzeptabel? Empfehlung: Montag zuerst wegen Planungssemantik.
- **Produktentscheidung:** Ist die dokumentierte Tray-Sortierung (Priorität absteigend, createdAt absteigend, `_id` aufsteigend) statt einer benutzerwählbaren Sortierung akzeptabel? Empfehlung: deterministische feste Sortierung für diesen Scope.
- **Produktentscheidung:** Sind Tastaturkürzel `m` und ArrowLeft/ArrowRight gewünscht? Empfehlung: beibehalten, da sie auffindbar und testbar sind und keinen zweidimensionalen Tastatur-Drag vortäuschen.
- **Produktentscheidung:** Soll Ziehen in den Tray zum Entplanen unterstützt werden? Empfehlung: zunächst Tray-zu-Tag umsetzen und Tag-zu-Tray nur als optionale symmetrische Erweiterung bei Produktbedarf ergänzen.
