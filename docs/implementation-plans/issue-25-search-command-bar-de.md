# Implementierungsplan — Issue #25: Inline-Suche + Statusfilter (Cmd/Ctrl+K-Command-Bar)

## 1. Summary

Eine clientseitige `CommandBar` für `/board/:boardId` bauen, die Task-Namen und -Beschreibungen durchsucht, nach jedem vom Board definierten Status filtert, die effektiven Filter in `?q=` und `?f=` persistiert und die gefilterte Task-Menge an die aktuelle Kanban-Ansicht (und spätere Ansichten) liefert. Das Feature bleibt innerhalb der bestehenden Flux-Grenze: React-Komponenten dispatchen Such-Aktionen an Zustand, der Store leitet `filteredTasks` ab, und keine Komponente ruft `api.js` direkt auf. Die Design-Tokens aus PR #30 sind bereits verfügbar; es ist keine Backend- oder API-Vertragsänderung erforderlich.

## 2. Architecture & Design Decisions

### Zuständigkeit der Command-Bar und Tastaturfokus

- **Empfehlung:** `CommandBar` aus `BoardPage.jsx:161-163` rendern, aber Listener für `Cmd/Ctrl+K`, Öffnungszustand, Input-Ref, Trigger-Ref und Fokus-Lifecycle in `CommandBar.jsx` halten.
- Die Komponente bleibt auch im geschlossenen Zustand gemountet, damit der Shortcut ohne globalen Listener in BoardPage funktioniert. Ein `keydown`-Listener auf `window` wird per Effect angehängt und beim Unmount entfernt; er reagiert auf `event.metaKey || event.ctrlKey` plus `event.key.toLowerCase() === 'k'` und ruft `preventDefault()` auf.
- Die Command-Bar besitzt im geschlossenen Zustand einen sichtbaren Such-Trigger und im geöffneten Zustand ein Panel. Das Öffnen fokussiert per `useEffect` das Input; das Schließen gibt den Fokus an den Trigger zurück. `Esc`, Backdrop und explizite Close/Clear-Steuerelemente verwenden denselben Close-Pfad.
- Da die Bar einen Backdrop und `role="dialog"` hat, wird eine kleine lokale Fokus-Falle statt einer Dependency implementiert: erstes/letztes fokussierbares Element erfassen, `Tab`/`Shift+Tab` zyklisch behandeln und schließen, wenn `focusin` außerhalb des Dialogs landet. Damit wird das geforderte Verhalten „bei Fokusverlust schließen“ erfüllt und der Fokus kann zwischen Input und Pills wechseln. Backdrop-Klicks werden durch `event.target === event.currentTarget` von Panel-Klicks unterschieden.

### URL-Synchronisierung bleibt in der Route-Komponente

- **Empfehlung:** `CommandBar` liest und schreibt `useSearchParams`; der Store darf `react-router-dom` nicht importieren.
- Beim Mount `q` und `f` lesen, gegen `board.statuses` auflösen und den Store initialisieren. Bei Änderungen schreibt `CommandBar` die effektive debouncte Query und den kanonischen Status-Key mit `setSearchParams(next, { replace: true })`; leere Werte werden weggelassen, statt `q=` oder `f=all` zu schreiben.
- `useSearchParams` ist Routing-/View-Zustand. Die Platzierung in `CommandBar` bewahrt die Flux-Regel (UI → Store → API), hält den Store in Router-losen Tests verwendbar und koppelt den wiederverwendbaren Derived Selector nicht an die Browser-History. Browser-Navigation wird durch einen Effect behandelt, der geänderte URL-Werte erneut in den Store schreibt, ohne einen neuen History-Eintrag zu pushen.
- Die initiale URL ist erst maßgeblich, wenn `board` verfügbar ist. Ungültige oder veraltete `f`-Werte werden als kein Statusfilter behandelt und aus der URL entfernt. Leeres oder fehlendes `q` wird zu `''`.

### Such-Debounce

- **Empfehlung:** `client/src/lib/useDebouncedValue.js` mit einer `useEffect`/`setTimeout`-Implementierung und 150 ms Verzögerung anlegen. Keine Dependency hinzufügen.
- Das Input hält den unmittelbaren lokalen Text für direktes Schreibfeedback. Der debouncte Wert aktualisiert den effektiven `query` im Store und die URL. Die Statusauswahl erfolgt sofort und wird mit der zuletzt debouncten Query kombiniert.

```js
// useDebouncedValue.js — Delay a value without adding a runtime dependency.
import { useEffect, useState } from 'react'

export const useDebouncedValue = (value, delay = 150) => {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedValue(value), delay)
    return () => window.clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}
```

### Status-Keys und beliebige Board-Statuses

- Niemals exakt drei Status voraussetzen. Eine `All`-Pill plus eine Pill je Eintrag in `board.statuses` rendern, Board-Reihenfolge bewahren und `statusColor(status)` für den visuellen Token verwenden.
- Für jeden Status einen deterministischen URL-Key verwenden: trimmen, Unicode-normalisieren, kleinschreiben, Diakritika entfernen, Folgen nicht alphanumerischer Zeichen durch `-` ersetzen und `-` am Rand entfernen. Der Key für `In Progress` ist `in-progress`; der Key für `Won't do` ist `won-t-do` (der Apostroph wird absichtlich normalisiert).
- `f` zuerst über den generierten Key auflösen. Zusätzlich explizite semantische Aliase für rückwärtskompatible Links akzeptieren: `progress` matcht `in-progress`, `inprogress` oder `progress`; `completed` matcht `completed` oder `done`; `wont-do` matcht `wont-do`, `won-t-do` oder `wontdo`. Alias-Matching erfolgt nach Normalisierung und wählt nur einen existierenden Board-Status.
- Wenn zwei Status denselben Key erzeugen, deterministisch (`key-2`, `key-3`) für generierte Links unterscheiden und einen mehrdeutigen eingehenden Key als ungültig behandeln, statt den falschen Status zu filtern. Ein umbenannter oder entfernter Status löscht damit sicher einen veralteten Filter.

### Store-abgeleitete Filterung und Counts

- In `client/src/store/useBoardStore.js:36-47` einen `searchSlice` mit `query`, `filterStatus`, `setSearchQuery`, `setFilterStatus`, `clearSearch` und einem `filteredTasks`-Selector/Action ergänzen.
- `filteredTasks` muss aus den aktuellen `board.tasks` abgeleitet und nicht separat gespeichert werden. Die Suche ist ein case-insensitives Substring-Matching über `task.name` ODER `task.description`; fehlende Felder werden als leere Strings behandelt. Der Statusfilter ist ein exakter Vergleich mit dem Board-Statusnamen.
- Den Selector als stabile Store-Action wie `getFilteredTasks: () => { ... }` nur dann bereitstellen, wenn die bestehende Zustand-Nutzung es erfordert; Komponenten sollten bevorzugt über einen Selector abonnieren, der aus `s.board`, `s.query` und `s.filterStatus` berechnet. `board.tasks` nicht für die Filterung mutieren.
- `BoardPage` verwendet die abgeleitete Menge je `Column` (aktuell `BoardPage.jsx:174-177`), sodass Header-Counts schrumpfen und leere Spalten mit Count `0` sichtbar bleiben. Drag-/Reorder-Auflösung muss weiterhin die vollständige Board-Task-Liste verwenden, nicht die gefilterte Liste, damit Filter keine Task-Drag-Identitäten unbrauchbar macht.
- Pill-Counts werden aus der durch die Query gematchten Menge vor Anwendung des ausgewählten Status berechnet: `All` ist die Query-Match-Anzahl und jede Status-Pill zählt diesen Status. Dadurch bleiben Counts bei ausgewähltem Status nützlich und aktualisieren sich live beim Ändern der Query.

### Accessibility und Tokens

- `role="dialog"`, `aria-modal="true"`, eine zugängliche Überschrift, beschriftetes Input, `aria-pressed` auf Pills und `aria-live="polite"` für Ergebnis-/Count-Änderungen verwenden. Trigger mit zugänglichem Namen und Tastatur-Fokus-Stil versehen.
- Vorhandene Utilities `surface-*`, `status-*` und `ring-primary` aus PR #30 verwenden. Kein CSS und keine hartcodierten Farben ergänzen. In diesem Issue keine axe-Dependency hinzufügen: Das Repository hat kein axe-Paket; der Acceptance-Scan kann manuell mit Browser-Axe-DevTools/Extension erfolgen. `axe-core` oder `@axe-core/react` würden Dependency- und Test-Setup ohne Produktionsnutzen erweitern und sind ausdrücklich Out of Scope; manuelle Scan-Evidenz ist erforderlich.

## 3. State Machine / Flow

```text
Closed
  ├─ click Search trigger ───────────────► Open (focus input)
  ├─ Cmd/Ctrl+K ─────────────────────────► Open (focus input)
  └─ URL q/f on board load ──────────────► Open only if a valid filter exists

Open
  ├─ input change ─► local draft ──150 ms──► store.query + URL q ─► filteredTasks
  ├─ status pill ─► store.filterStatus + URL f ───────────────────► filteredTasks
  ├─ All/Clear ──► query='' and filterStatus=null + remove q/f ───► all tasks
  ├─ Esc/backdrop/focus outside ────────────────────────────────► Closed + restore trigger focus
  └─ board/status change ─► re-resolve f ─► canonical URL or clear stale filter

BoardPage render flow:
board.tasks + store.query/filterStatus
          └─► filteredTasks
                └─► each status column (including empty columns)
```

## 4. API Contract

Dieses Feature führt **keinen Backend-Request** aus und ändert keine Methode, keinen Pfad, keinen Body und keine Response. Der bestehende Board-Fetch bleibt Quelle von `statuses` und `tasks`:

| Method | Path | Body | Response | Reference |
|---|---|---|---|---|
| GET | `/api/boards/:boardId` | none | `200 { data: { board: { statuses, tasks, ... } } }` | `server/routes/boards.js`; client wrapper `client/src/lib/api.js:24-25` |

Der URL-Zustand ist ausschließlich clientseitiger Routing-Zustand: `/board/:boardId?q=login&f=in-progress`. `q` ist das debouncte Substring und `f` ein kanonischer Status-Key; beides wird nicht an den Server gesendet. Für `client/src/lib/api.js`, `server/routes/boards.js` oder Mongoose-Schemas sind keine Änderungen geplant.

## 5. File Changes

- **Create** `client/src/components/CommandBar.jsx` — Trigger, Dialog, Shortcut-Listener, URL-Synchronisierung, Such-Input, Status-Pills, Counts, Clear-/Empty-State, Fokusverwaltung und Tailwind-Darstellung.
- **Create** `client/src/lib/useDebouncedValue.js` — Dependency-freier 150-ms-Hook.
- **Modify** `client/src/store/useBoardStore.js:36-47` — Search-State, Actions und abgeleitete Filter-Helfer ergänzen; API-Actions und Optimistic-Update-Verhalten bewahren.
- **Modify** `client/src/pages/BoardPage.jsx:6-24, 141-205` — `CommandBar` rendern, gefilterte Tasks für Spalten verwenden, Dragging auf vollständigen Tasks belassen und den State `No tasks match` über Bar-/Page-Integration darstellen.
- **Modify** `client/src/components/Column.jsx:10-47` — nur falls eine ausdrückliche Empty-Column-Darstellung erforderlich ist; bestehenden `0`-Count und Drop-Target bewahren.
- **Create** `client/src/__tests__/command-bar.test.jsx` — Komponenten-, URL-, Tastatur-, Debounce-, Accessibility-Interaktions- und Filter-Coverage.
- **Create** `client/src/__tests__/search-store.test.js` — reines Store-Filtering, Status-Mapping/Count-Helper und Reset-Coverage, falls Helpers für Tests exportiert werden.
- **Do not modify** `client/src/lib/api.js`, `client/tailwind.config.js`, `client/src/index.css` oder Backend-Dateien; bestehende Design-Tokens reichen aus.

## 6. Implementation Steps

1. `client/src/lib/useDebouncedValue.js` und reine Search-/Status-Helfer in `client/src/store/useBoardStore.js` (oder einem dortigen Utility-Abschnitt) anlegen, einschließlich Normalisierung, Alias-Auflösung, Collision-Handling und Query-/Status-Matching.
2. `client/src/store/useBoardStore.js` um `searchSlice`, reset-sichere Defaults, Setter und abgeleitete Task-/Count-Berechnungen erweitern, ohne Router-Imports oder API-Calls einzuführen.
3. `client/src/components/CommandBar.jsx` mit geschlossenem Trigger, `Cmd/Ctrl+K`-Listener, 150-ms-Hook, `useSearchParams`-Hydration/Write-back, Pills, Counts und Clear-Verhalten erstellen.
4. `client/src/pages/BoardPage.jsx` ändern, die Command-Bar mounten und im Render-Pfad `board.tasks.filter` durch die abgeleitete gefilterte Menge ersetzen, während Drag-Handler `board.tasks` verwenden.
5. `client/src/components/Column.jsx` nur für eine bewusst implementierte Empty-Column-Nachricht bzw. zugängliche Count-Behandlung anpassen; vorhandene Tailwind-Tokens verwenden und das Drop-Target aktiv lassen.
6. Neue Vitest-/Testing-Library-Tests ergänzen, bestehende gemockte Store-Zustände nur bei Bedarf um Search-Felder erweitern, anschließend die vollständige Client-Test-Suite, `npm run build --workspace=client` und `npm run lint --workspace=client` ausführen.
7. Einen manuellen axe-Scan in hellem und dunklem Theme sowie auf Desktop und engem Viewport durchführen, null kritische/schwere Verstöße dokumentieren und URL-Reload/Deep-Link-Verhalten prüfen.

## 7. Edge Cases & Error Handling

- `board` ist null oder lädt noch: Command-Bar nicht rendern; `statuses` und URL-Werte erst bei vorhandenem Board lesen.
- Leere `statuses`: keine statusbezogenen Pills außer `All` rendern und bestehende Kanban-Empty-Columns-Nachricht beibehalten.
- Leerer Task-Name/-Beschreibung oder fehlende Felder: sicher als `''` matchen; kein Raw-HTML rendern, damit React-Escaping XSS-sicher bleibt.
- Query-Whitespace: Input-Draft für Nutzerfeedback bewahren, aber fürs Matching und die URL-Serialisierung nur trimmen; reine Whitespace-Query löscht `q`.
- URL-Encoding: `URLSearchParams` verwenden; Querystrings nie manuell zusammenfügen. Malformed Percent-Encoding über Router-API behandeln und bei Bedarf auf leere Werte zurückfallen.
- Unbekanntes, veraltetes, mehrdeutiges oder entferntes `f`: `All` anzeigen, Store-Filter löschen und `f` per `replace: true` entfernen; keinen Status erfinden oder nach einem ähnlich benannten Status filtern.
- Status wird umbenannt, während er gefiltert ist: Der exakte Status existiert nicht mehr; Filter löschen und URL kanonisieren, statt Tasks unerwartet zu verstecken.
- Neuer Status/Task durch optimistisches Store-Update: abgeleitete Ergebnisse und Pill-Counts berechnen sich automatisch neu; kein API-Request für Suche erforderlich.
- Task wird gefiltert gezogen: vollständige Task-Liste für Quell-/Zielauflösung nutzen und Filter nach Optimistic Update erhalten; bei Statuswechsel kann die Task aus der sichtbaren Menge verschwinden.
- Debounce-Cleanup: Timeout bei Unmount und folgendem Tastendruck abbrechen; keine Updates an unmounted Komponenten.
- Shortcut in editierbarem Kontext: `Cmd/Ctrl+K` ist absichtlich für die Board-Command-Bar reserviert, `preventDefault()` verhindert Browser-Lesezeichen-/Suchverhalten. `Esc` schließt zuerst die Command-Bar und darf kein Task-Formular absenden oder mutieren.
- Fokus-Falle und Backdrop: Klicks/Fokus im Dialog schließen nicht; Backdrop-Klick und `focusin` außerhalb schließen und geben Fokus an Trigger zurück. Ist der Trigger nicht mehr gemountet, sicher `document.body` fokussieren.
- Keine Treffer: alle Board-Spalten sichtbar lassen, `No tasks match` und `Clear filters` anzeigen und Clear auf Store- und URL-Werte anwenden.
- Kein neuer Backend-Fehlerpfad. Bestehende Board-Fetch-Fehler laufen weiter über den aktuellen `role="alert"`-Banner von `BoardPage` und die dokumentierte Frontend-Error-Strategie.

## 8. Testing Strategy

Mindestens 12 neue Tests mit Vitest, `@testing-library/react`, `@testing-library/user-event`, Fake Timers und Memory Router ergänzen. Empfohlenes Minimum (14 Fälle):

1. Geschlossener Trigger wird mit zugänglichem Namen gerendert.
2. `Cmd+K` öffnet die Bar und fokussiert das Input.
3. `Ctrl+K` öffnet die Bar bei einem Nicht-Mac-Event.
4. `Escape` schließt und gibt Fokus an den Trigger zurück.
5. Backdrop-Klick schließt; Panel-Klick nicht.
6. Fokus kann bei geöffneter Bar nicht aus dem Dialog herausgetabbt werden.
7. Tippen matcht Task-Namen case-insensitiv nach exakt 150 ms.
8. Tippen matcht Beschreibung und aktualisiert vor Ablauf des Debounce nicht.
9. Schnelles Tippen bricht den vorherigen Debounce-Timer ab.
10. Status-Pills stammen aus beliebigen `board.statuses`, nicht aus einer festen Drei-Pills-Liste.
11. Statusauswahl filtert exakt und aktualisiert `?f=` mit dem kanonischen Key.
12. `All` entfernt `f`; `Clear filters` entfernt `q` und `f`.
13. Initiales `?q=...&f=...` hydratisiert Store und sichtbare Tasks nach Board-Load.
14. Unbekannte/Alias-Status-Keys werden sicher aufgelöst, URL-Sync nutzt `replace`, und kombinierter Query- plus Statusfilter liefert erwartetes Ergebnis/Counts.

Zusätzlich Store-Tests in `client/src/__tests__/search-store.test.js` für Name/Description-ODER-Matching, fehlende Felder, leere Statuslisten, gefilterte Spalten-Counts und abgeleitete Neuberechnung nach optimistischen Task-/Statusänderungen ergänzen. Bestehende `BoardPage`-/Routing-Fixtures nur bei Bedarf erweitern. Alle bestehenden Tests (Issue nennt 71), `npm test --workspace=client` und `npm run build --workspace=client` ausführen. Da axe nicht installiert ist, manuell Axe DevTools/Extension auf den offenen Dialog in beiden Themes verwenden; `axe-core` oder `@axe-core/react` in diesem Issue nicht hinzufügen.

## 9. Acceptance Criteria

- [ ] `Cmd/Ctrl+K` öffnet die Command-Bar und fokussiert ihr Input.
- [ ] `Esc`, Backdrop-Klick und Fokus außerhalb schließen sie; Fokus kehrt zum Trigger zurück.
- [ ] Suche matcht `task.name` oder `task.description` case-insensitiv nach einem 150-ms-Debounce ohne Dependency.
- [ ] Pills enthalten `All` und jeden Board-definierten Status, auch beliebige Status-Arrays.
- [ ] `?q=` und kanonische `?f=`-Werte überstehen Reload, Deep Links und Browser-Navigation ohne Router-Kopplung in Zustand.
- [ ] Status-Counts sind live und auf die aktuelle Query-Match-Menge bezogen; Spalten-Counts schrumpfen mit sichtbaren gefilterten Tasks.
- [ ] `filteredTasks` wird in Zustand abgeleitet und von Kanban konsumiert; vollständige Tasks bleiben für Dragging verfügbar.
- [ ] Empty-State sagt `No tasks match` und bietet einen funktionierenden `Clear filters`-Button.
- [ ] Dialog-Semantik, `aria-*`, Tastaturverhalten, Fokusverwaltung und vorhandene `surface-*`/`status-*`/`ring-primary`-Tokens sind umgesetzt.
- [ ] Mindestens 12 neue Tests (Ziel 14) decken Shortcut, Debounce, Statusfilter, URL-Sync, Clear und Kombinationen ab; alle bestehenden Tests bestehen.
- [ ] `vite build` und Client-Lint bestehen.
- [ ] Manueller axe-Scan meldet keine kritischen oder schweren Verstöße; keine axe-Dependency wird hinzugefügt.
- [ ] Keine Backend-, API-Wrapper-, Schema- oder Serverless-Deployment-Änderung ist erforderlich.

## 10. Out of Scope

- Backend-Endpunkte, Server-Routen, Mongoose-Schemas, Datenbank-Indizes oder serverseitige Suche.
- Gespeicherte Ansichten, benannte Filter, Cross-Board-Suche, Archiv-Board-Suche und Activity-Feed-Filterung (Follow-up #21).
- Alternative List-/Grid-/Table-Ansichten aus #26/#27; dieser Plan stellt den gemeinsamen Store-abgeleiteten Filter zur späteren Nutzung bereit.
- Search-Highlighting, Fuzzy Matching, Ranking, Pagination oder History-Einträge für jeden Tastendruck.
- Hinzufügen von `axe-core` oder `@axe-core/react`; Accessibility wird für dieses Issue manuell geprüft.
- Neue Design-Tokens, Stylesheet oder Änderungen an `client/src/lib/api.js`.

## 11. Risks & Open Questions

- **Status-URL-Kompatibilität:** Product sollte bestätigen, ob die dokumentierten Beispiele `f=progress` und `f=completed` auch bei Custom-Labels akzeptiert bleiben müssen. Empfehlung: die genannten Aliase akzeptieren, aber board-spezifische kanonische Slugs serialisieren.
- **Fokusverhalten:** Product sollte bestätigen, dass die Command-Bar modal-artig mit Backdrop und Fokus-Falle sein soll. Empfehlung: ja, weil das Issue Backdrop-Close und Fokus-Rückgabe ausdrücklich verlangt; Fokus außerhalb schließt sie.
- **Count-Semantik:** Product sollte bestätigen, dass jede Pill auf die Text-Query, aber nicht auf den aktuell ausgewählten Status eingeschränkt wird. Empfehlung: so bleiben alternative Status sichtbar und Counts nützlich.
- **Verhalten beim Tippen in URL:** Product sollte bestätigen, dass `q` nach 150 ms mit `replace: true` aktualisiert wird, nicht bei jedem Tastendruck. Empfehlung: debounced replace verhindert History-Verschmutzung und hält den sharebaren Zustand aktuell.
- **Dynamische Status-Kollisionen:** Zwei Labels können denselben Slug normalisieren. Empfehlung: generierte Links unterscheiden und mehrdeutige eingehende Keys ablehnen, statt still einen Status zu wählen.
- **Zukünftige Ansichten:** #26/#27 müssen denselben Store-abgeleiteten `filteredTasks`-Vertrag verwenden und Suche nicht in Komponenten neu implementieren.
- **Accessibility-Tooling:** Der Acceptance-Text verlangt einen axe-Scan, aber keine axe-Dependency ist vorhanden. Empfehlung: jetzt manuelle Axe DevTools/Extension; automatisierte axe-Integration als separates Qualitäts-Issue planen, falls CI-Erzwingung erforderlich ist.

---

## Addendum — 2026-09-18 (Re-Scope nach UI-Review)

Die Suchinteraktion wurde vom oben beschriebenen modalen Command-Bar auf eine Odoo-artige Inline-Filterleiste umgestellt:

- Das Eingabefeld ist immer im Header sichtbar und öffnet ein Dropdown statt eines Modals (kein Backdrop, kein Focus-Trap, kein Auto-Open bei Deep-Links).
- Text wird als Quick-Search-Facet (`Name or description contains "..."`) angewendet statt live mit 150-ms-Debounce zu filtern; `client/src/lib/useDebouncedValue.js` wurde entfernt.
- Status-Filter werden aus dem Dropdown angewendet und als entfernbare Facet-Chips angezeigt; `Backspace` im leeren Feld entfernt den letzten Chip.
- Das No-Results-Banner wanderte von `CommandBar` nach `BoardPage`, damit das Header-Layout intakt bleibt.
- Der URL-Vertrag (`?q=`, `?f=`, Alias-Kanonisierung, Kollisions-Ablehnung) bleibt unverändert.
- Status-Facets bleiben Einzelauswahl; Mehrfachauswahl ist out of scope.

