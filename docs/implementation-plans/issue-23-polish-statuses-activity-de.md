# Implementierungsplan — Issue #23: Status-Manager und Activity-Feed polieren

## 1. Zusammenfassung

Das bestehende `StatusManager`-Modal und die `ActivityFeed`-Sidebar werden so poliert, dass beide bewusst gestaltet, lesbar und konsistent mit der vorhandenen Glass-UI wirken. Der Durchgang ersetzt Emoji-Glyphen durch Inline-SVG-Icons, verbessert responsive Abstände und Hierarchie, präzisiert die Bestätigung zum Entfernen eines Status und stärkt Lade-, Leer-, Fehler- und Pagination-Zustände. Es bleibt eine reine Frontend-Quick-Iteration: keine neuen Features, API-Änderungen, Backend-Arbeiten oder Runtime-Abhängigkeiten.

## 2. Architektur- & Design-Entscheidungen

| # | Entscheidung | Empfohlene Option | Begründung |
|---|--------------|-------------------|------------|
| 1 | Icon-Implementierung | **Inline-SVG-Icon-Komponenten in den bestehenden Dateien** | Entfernt die OS-abhängige Emoji-Darstellung, ohne eine Abhängigkeit hinzuzufügen oder einen neuen Pfad zu erfinden. Das Icon-Set bleibt für diesen 30–60-Minuten-Durchgang klein und lokal. |
| 2 | Layout der Statuszeile | **Responsive Zwei-Zonen-Zeile mit flexiblem Namensbereich und gruppierten Aktionen** | Gibt Input und Validierungsinhalt nutzbaren Platz und erhält gleichzeitig 44px-Touch-Ziele. Die Aktionsgruppe kann bei schmalen Ansichten schrumpfen oder umbrechen, ohne das Verhalten zu ändern. |
| 3 | Entfernungsbestätigung | **Ein eigenes, vollbreites Bestätigungs-Panel innerhalb der ausgewählten Zeile** | Trennt die destruktive Entscheidung vom normalen Editieren, bietet der Erklärung ausreichend Platz und vermeidet die irreführende Formulierung „Move tasks“. |
| 4 | Oberfläche des Status-Modals | **TaskForm-artige Modal-Oberfläche mit zurückhaltender Transparenz und stärkerer Hierarchie** | `TaskForm.jsx:100-121` bietet bereits das Modal-Muster des Projekts. Die bestehenden Tokens `glass`, `glass-dark` und `glass-sm` werden verwendet, während der matschige Overlay-Effekt über dem Board-Gradienten reduziert wird. |
| 5 | Breite der Activity-Sidebar | **Desktop-Breite von `w-80` auf eine lesbare `w-96`-Breite mit Viewport-Begrenzung erhöhen** | Ein Inhaltsbereich von 384px gibt Beschreibungen und Zeitstempeln mehr Raum, bleibt aber eine Sidebar. Das mobile Bottom-Sheet-Verhalten bleibt unverändert. |
| 6 | Darstellung der Activity-Einträge | **Gestapelte Glass-Cards mit Abstand statt `border-b`-Trennlinien** | Cards schaffen klare Gruppierung und verbessern die Scanbarkeit, ohne eine neue Interaktion oder ein neues Datenmodell einzuführen. |
| 7 | Lade-, Leer- und Fehler-UX | **Größere Card-förmige Skeletons, ein illustriertes SVG-Empty-State und konsistente Action-Buttons** | Diese Zustände sollen den Panel-Bereich bewusst ausfüllen und dieselbe Hierarchie wie geladene Inhalte nutzen. Bestehende Retry- und Store-Flows bleiben unverändert. |
| 8 | State- und Datenfluss | **Zustand als Single Source of Truth beibehalten und bestehende Actions weiterverwenden** | Der visuelle Durchgang darf `useBoardStore` nicht umgehen, keine lokalen API-Calls hinzufügen und kein Optimistic-Update-Verhalten verändern. |

## 3. State Machine / Flow

### 3.1 Visueller Flow des Status-Managers

```
Status-Manager wird geöffnet
        │
        ▼
Draft-Statuses werden mit SVG-Controls gerendert
        │
        ├─ Name bearbeiten ──► validieren ──► bei Blur / Enter übernehmen
        │
        ├─ Entfernen auswählen ──► Bestätigungs-Panel
        │                              │
        │                              ├─ Cancel ──► normale Zeile
        │                              └─ Remove ──► aus lokalem Draft entfernen
        │
        └─ Status hinzufügen ──► neue editierbare Zeile
                                      │
                                      ▼
                              über updateTask/updateBoard speichern
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
                   Erfolg: schließen       Fehler: Fehler anzeigen,
                                            Draft wiederherstellen,
                                            geöffnet bleiben
```

### 3.2 Visueller Flow des Activity-Feeds

```
Sidebar wird geöffnet
      │
      ▼
Activity-State aus useBoardStore lesen
      │
      ├─ Laden ohne Einträge ──► Card-Skeleton-Stack
      ├─ Fehler ───────────────► Fehler-Panel + Retry-Button
      ├─ Leer ─────────────────► SVG-Empty-State + Hinweis
      └─ Einträge ─────────────► SVG-Icon-Cards + relative Zeit
                                      │
                                      └─ Load more ──► bestehender Cursor-Fetch
```

Keine State-Transitions, Store-Actions oder API-Sequenzen werden in diesem Plan geändert.

## 4. API Contract

Keine API-Änderungen.

`StatusManager` verwendet weiterhin die bestehenden Store-Actions, die letztlich `PUT /api/boards/:boardId` und bei Bedarf die Task-Update-Route aufrufen. `ActivityFeed` verwendet weiterhin `useBoardStore.fetchActivity`, das `GET /api/boards/:boardId/activity` mit dem bestehenden `limit`- und `before`-Cursor-Vertrag aus `server/routes/activity.js` und `docs/api-contract.md` konsumiert.

Response-Formate, Fehlerbehandlung, Optimistic Updates und Pagination bleiben unverändert.

## 5. Datei-Änderungen

| Datei | Änderung |
|-------|----------|
| `client/src/components/StatusManager.jsx` | Emoji- und Text-Glyph-Controls durch Inline-SVG-Icons ersetzen; Abstände und Input-Layout der Zeilen ausbalancieren; Validierung in einen stabilen Nachrichtenbereich verschieben; Modal-/Header-Hierarchie und Glass-Oberflächen verfeinern; Inline-Entfernungsformulierung durch ein richtiges Bestätigungs-Panel ersetzen. |
| `client/src/components/ActivityFeed.jsx` | Activity-Emoji-Mapping und Empty-State-Glyph durch Inline-SVG-Icons ersetzen; Desktop-Sidebar verbreitern; Activity-Einträge als Glass-Cards rendern; Skeletons vergrößern; „Load more“-, Empty- und Error-State als bewussten Panel-Inhalt gestalten. |
| `client/src/__tests__/status-manager.test.jsx` | Verhaltenstest-Abdeckungen erhalten und Assertions für Bestätigungstext, SVG-Control-Accessibility und stabile Validierungsdarstellung ergänzen oder aktualisieren. |
| `client/src/__tests__/activity-feed.test.jsx` | Store- und Inhalts-Assertions erhalten und Assertions für SVG-Icon-Accessibility, Card-Zustände und die gestaltete Pagination-Action ergänzen oder aktualisieren. |
| `client/tailwind.config.js` | Keine Änderung; bestehende Tokens `glass`, `glass-dark`, `glass-sm` und `shadow-glass` wiederverwenden. |
| `server/routes/activity.js` | Keine Änderung; bestehende Activity-API bleibt die Datenquelle des Feeds. |

## 6. Implementierungsschritte

1. `client/src/components/StatusManager.jsx` Icon-Definitionen und Modal-/Header-Klassen aktualisieren.
   - Kleine Inline-SVG-Komponenten für Close, Move up, Move down, Remove und einen Status-Management-Header-Akzent hinzufügen.
   - Jedes interaktive SVG mit `aria-hidden="true"` versehen; bestehende Button-`aria-label`-Werte beibehalten, damit das aktuelle Verhalten barrierefrei bleibt.
   - Größenverhältnisse der Modal-Oberfläche und Close-Button-Darstellung aus `TaskForm.jsx:100-121` übernehmen, dabei weniger opake Layer über dem Seiten-Gradienten verwenden.
2. `client/src/components/StatusManager.jsx` Statuszeilen und Bestätigungs-Panel aktualisieren.
   - Dem editierbaren Namensbereich und der Task-Count-Metadaten eine klare Hierarchie geben und Controls in einer gruppierten Aktionsfläche mit 44px-Zielen halten.
   - Validierungstext in einem eigenen Block unter dem Input rendern und den Character-Counter unabhängig ausrichten.
   - „Move tasks to X?“ durch eindeutigen Entfernungstext ersetzen, zum Beispiel „Remove ‘X’?“ und „Tasks in this stage will be reassigned when you save.“ Die bestehende Task-Count-Sperre bleibt maßgeblich, daher bleiben Status mit Tasks nicht entfernbar.
   - Add-, Rename-, Reorder-, Save-, Rollback- und Focus-Verhalten beibehalten.
3. `client/src/components/ActivityFeed.jsx` Icons und Sidebar-Shell aktualisieren.
   - `ICONS`-Emoji-Werte durch ein kleines SVG-Icon-Mapping oder typisierte Icon-Komponenten für alle bestehenden Activity-Typen sowie einen neutralen Fallback ersetzen.
   - `ActivityIcon` und `CloseIcon` an die neuen Icon-Größen und Farbdarstellungen angleichen.
   - Nur die Desktop-Breitenbegrenzung auf eine lesbare `w-96`-/Viewport-begrenzte Entsprechung ändern; mobiles Bottom-Sheet und Slide-Transitions beibehalten.
4. `client/src/components/ActivityFeed.jsx` Inhaltszustände und Tests aktualisieren.
   - Listenzeilen in getrennte Glass-Cards mit konsistentem Padding, Icon-Containern, Text-Wrapping sowie Hover-/Focus-Zuständen umwandeln.
   - Kleine Skeleton-Zeilen durch größere Card-Skeletons ersetzen, die die Geometrie geladener Einträge abbilden.
   - Emoji-Empty-State durch eine SVG-Illustration und unterstützenden Text ersetzen; „Load more“ als vollbreiten, klar umrandeten oder gefüllten Button mit bestehenden Tailwind-Tokens gestalten.
   - `client/src/__tests__/status-manager.test.jsx` und `client/src/__tests__/activity-feed.test.jsx` nur aktualisieren, wenn Selektoren oder neue State-Assertions es erfordern; bestehende Verhaltensabdeckung nicht abschwächen.
5. Fokussierte Component-Tests ausführen und einen manuellen Responsive-Light-/Dark-Mode-Smoke-Test durchführen.
   - Prüfen, dass durch die Implementierung keine Backend-, Store- oder API-Dateien geändert werden.

## 7. Edge Cases & Error Handling

| Szenario | Handling |
|----------|----------|
| Schmaler Viewport in `StatusManager` | Flexibles Layout, notwendiges Wrapping und 44px-Controls verwenden; Input oder Bestätigungsaktionen dürfen nicht horizontal abgeschnitten werden. |
| Langer Statusname oder Validierungstext | `maxLength` und bestehende Validierung beibehalten; Nachricht unter dem Input platzieren, damit sie Counter oder Aktionsgruppe nicht überlappt. |
| Status-Entfernung mit Tasks | Remove-Button deaktiviert lassen und bestehenden Task-Count-Titel beibehalten. Das Bestätigungs-Panel ist nur für entfernbar Status erreichbar. |
| Letzter Status | Entfernen mit bestehendem Last-Status-Titel deaktiviert lassen und keinen neuen destruktiven Pfad hinzufügen. |
| Speicherfehler | Fehlerbehandlung, Rollback, Inline-Fehlersichtbarkeit und Offenbleiben des Modals von `updateTask`/`updateBoard` beibehalten. |
| Activity-Beschreibung ist lang | Normales Wrapping innerhalb der breiteren Card erlauben; aussagekräftigen Activity-Text nicht abschneiden. |
| Unbekannter Activity-Typ | Neutralen SVG-Fallback und bestehenden `describeActivity`-Fallback-Text rendern, statt ein defektes Icon oder Emoji zu verwenden. |
| Laden während ältere Einträge vorhanden sind | Bestehende Liste sichtbar lassen und nicht durch das Initial-Skeleton ersetzen; das größere Skeleton gilt nur bei `activity.length === 0`. |
| Leere oder fehlgeschlagene Activity-Anfrage | Bestehende Empty- und Retry-Zweige beibehalten; nur die Darstellung verbessern und `clearActivityError`/`fetchActivity`-Verknüpfung unverändert lassen. |
| Keine weiteren Activity-Seiten | „Load more“ ausblenden, wenn `activityHasMore` false ist. |
| Dark Mode | Jede neue Oberfläche, jedes Icon, jeden Focus- und Textstil mit den bestehenden `dark:`-Varianten paaren; nicht auf Emoji-Farben angewiesen sein. |

## 8. Teststrategie

1. **Fokussierte Component-Tests**
   - `client/src/__tests__/status-manager.test.jsx` und `client/src/__tests__/activity-feed.test.jsx` mit dem bestehenden Vitest-Befehl ausführen.
   - Bestehende Assertions für Add, Rename, Validierung, Remove-Bestätigung, Save, Rollback, Store-Pagination, Beschreibungen, Loading und Empty States beibehalten.
2. **Ergänzungen oder Selektor-Updates für den Status-Manager**
   - Prüfen, dass das Bestätigungs-Panel Entfernungs-/Reassignment-Text statt „Move tasks to“ verwendet.
   - Prüfen, dass Icon-Buttons ihre Accessible Names behalten und SVG-Elemente enthalten, ohne Emoji-Glyphen für Controls vorauszusetzen.
   - Prüfen, dass Validierung in einer eigenen Alert-Region sichtbar bleibt und das bestehende Verhalten bei doppelten Namen nicht verhindert.
3. **Ergänzungen oder Selektor-Updates für den Activity-Feed**
   - Prüfen, dass Activity-Einträge den erwarteten Text sowie ein SVG-Icon/Fallback mit `aria-hidden="true"` rendern.
   - Prüfen, dass Loading-, Empty-, Error- und „Load more“-Zustände über Role und Accessible Name auffindbar bleiben.
4. **Manueller Responsive- und Accessibility-Smoke-Test**
   - Beide Komponenten bei mobiler und Desktop-Breite in Light und Dark Mode prüfen.
   - Focus-Rings, Button-Labels, Modal-/Sidebar-Escape-Verhalten, Wrapping und horizontales Clipping prüfen.
   - Prüfen, dass bestehende `useBoardStore`-Aufrufe und Netzwerk-Requests unverändert sind.

## 9. Akzeptanzkriterien

- [ ] `StatusManager` enthält keine Emoji- oder Text-Glyph-Move-/Remove-Controls; Aktionen verwenden konsistente Inline-SVG-Icons.
- [ ] `StatusManager`-Zeilen bieten bei schmalen und Desktop-Breiten ausreichend Platz für Name/Input, Metadaten und Aktionsgruppe.
- [ ] Validierungstext hat ein stabiles eigenes Layout und kollidiert nicht mit dem Character-Counter.
- [ ] Das Status-Modal besitzt einen klaren Header-Akzent bzw. ein Icon, eine klare Hierarchie und eine zurückhaltende Glass-Oberfläche im Stil von `TaskForm.jsx`.
- [ ] Status-Entfernung verwendet ein eigenes Bestätigungs-Panel mit Text, der Entfernung und Reassignment beim Speichern korrekt beschreibt.
- [ ] Bestehendes Status-Add-, Rename-, Reorder-, Validierungs-, Task-Reassignment-, Save-, Rollback-, Focus- und Accessibility-Verhalten bleibt intakt.
- [ ] `ActivityFeed` verwendet SVG-Icons für alle unterstützten Activity-Typen, Header, Close-Action und Empty State.
- [ ] Die Desktop-Activity-Sidebar ist für lesbare Beschreibungen breit genug, während das mobile Verhalten als Bottom-Sheet erhalten bleibt.
- [ ] Activity-Einträge erscheinen als visuell verbundene Glass-Cards statt als reine `border-b`-Zeilen.
- [ ] Loading-Skeletons vermitteln Größe und Struktur der Activity-Cards.
- [ ] „Load more“ ist ein klarer vollbreiter Button und behält das bestehende Cursor-Verhalten.
- [ ] Empty- und Error-States besitzen klare Hierarchie, lesbaren Text und funktionierendes Retry-Verhalten.
- [ ] Light/Dark Mode, Focus-Zustände, Accessible Labels und bestehende Tests bleiben unterstützt.
- [ ] Es werden keine Backend-, API-Contract-, Store-Verhaltens- oder neuen Runtime-Dependency-Änderungen eingeführt.

## 10. Out of Scope

- Activity-Filter, Suche oder Gruppierung nach Tagen.
- Keyboard-Navigation über bestehendes Escape-, Focus- und Button-Verhalten hinaus.
- Drag-to-Reorder oder andere neue Status-Management-Features.
- Echtzeit-Subscriptions, WebSockets, Polling oder Änderungen an Activity-Daten.
- Backend-, MongoDB-, Route-, API- oder Zustand-Action-Änderungen.
- Neue Icon-Pakete, Design-System-Komponenten, Localization-Infrastruktur oder Runtime-Abhängigkeiten.
- Breiter visueller Redesign des Boards, von `TaskForm.jsx` oder nicht beteiligten Komponenten.

## 11. Risiken & Offene Fragen

| Risiko | Auswirkung | Mitigation |
|--------|------------|------------|
| Inline-SVG-Ergänzungen vergrößern die Komponenten | Niedrig | Icon-Set auf Controls und bestehende Activity-Typen begrenzen; für diesen Quick-Pass keine neue Abstraktion oder Dependency einführen. |
| Breitere Sidebar reduziert sichtbare Board-Fläche | Mittel | Breite nur am bestehenden Desktop-Breakpoint anwenden, mit Viewport begrenzen und mobiles Sheet-Layout erhalten. |
| Visuelle Selektor-Änderungen brechen Tests | Niedrig | Accessible Names und semantische Rollen stabil halten; nur Selektoren aktualisieren, die bewusst die neue Darstellung prüfen. |
| Bestätigungstext verspricht ein anderes Verhalten als die Save-Logik | Mittel | Status mit Tasks deaktiviert lassen und Reassignment nur als bestehendes Save-Time-Verhalten für passende Entfernungen beschreiben. |
| Glass-Oberflächen bleiben über dem Board-Gradienten matschig | Mittel | Opacity-/Backdrop-Layer reduzieren, bestehende Shadow-Tokens verwenden und beide Themes vor dem tatsächlichen Board-Hintergrund prüfen. |
| Scope wächst über die Timebox hinaus | Mittel | Arbeit auf die zwei Komponenten und ihre fokussierten Tests begrenzen; gemeinsame Icon-Extraktion und breiteres Redesign verschieben. |

### Offene Fragen

1. Sollen die User-facing Strings jetzt lokalisiert werden? **Empfehlung: nein.** Die aktuellen englischen test-facing Strings beibehalten und vermerken, dass UI-Copy bei Einführung einer Localization später im Code re-localized wird.
2. Soll bei entfernbaren Status mit null Tasks ausdrücklich erwähnt werden, dass keine Tasks verschoben werden? **Empfehlung: ja.** Kurzen Text verwenden, der erklärt, dass die Entfernung lokal vorgemerkt und mit Save persistiert wird, ohne automatisches Verschieben von Tasks zu suggerieren.
3. Soll die Desktop-Breite exakt `w-96` oder eine nahe Custom-Breite sein? **Empfehlung: die bestehende Tailwind-Skala mit `w-96` plus aktueller Viewport-Begrenzung verwenden; `client/tailwind.config.js` nicht ändern.**
