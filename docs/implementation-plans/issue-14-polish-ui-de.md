# Implementierungsplan — Issue #14: Board-UI-Design polieren

## Zusammenfassung

Issue #14 ist ein reines Frontend-Visuell- und Interaktions-Polishing für die bestehende Board-Ansicht. Ziel ist es, die wahrgenommene Qualität der App zu steigern, indem Typografie, Abstände, Farben, Animationen und Fokus-Zustände präziser gestaltet werden; außerdem sollen Skeleton-Platzhalter für Ladezustände, ein responsives Layout und eine saubere Tastatursteuerung hinzugefügt werden. Es ändern sich keine API-Verträge, keine State-Logik und es entstehen keine neuen Features. Alle Arbeiten beschränken sich auf präsentierende Komponenten und die Tailwind-Konfiguration.

## Architektur & Design-Entscheidungen

### 1. Typografie-System
**Empfehlung: Option C — System-Stack beibehalten.**

Die aktuelle UI nutzt Tailwinds Standard-Sans-Stack (`ui-sans-serif, system-ui, sans-serif`). Die Hinzunahme einer Google Font würde eine Netzwerkabhängigkeit, FOIT/FOUT-Behandlung und CSP-Überlegungen für einen Polish-Task einführen. Der System-Stack ist bereits scharf, respektiert die Präferenzen des Nutzer-Betriebssystems und vermeidet einen render-blocking Request. Wir verbessern die *Anwendung* der Typografie (Größe, Gewicht, Zeilenhöhe, Buchstabenabstand) anstatt die Schriftfamilie zu ändern.

### 2. Skeleton-Loader
**Empfehlung: Option A — Pulse-Animation-Platzhalter während `fetchBoard`.**

Das Board zeigt aktuell reinen Text `Loading...` an, solange `isLoading` wahr ist. Wir ersetzen das durch ein Skeleton-Layout, das dem finalen Board entspricht: ein Header-Platzhalter plus drei Spalten-Platzhalter, die jeweils einige pulsierende Task-Card-Formen enthalten. Umgesetzt wird das mit Tailwinds `animate-pulse` und gedämpften Hintergrund-Utilities. Es wird keine externe Bibliothek hinzugefügt; das Skeleton-Markup lebt im bestehenden `BoardPage`-Ladezweig und in einem kleinen, lokalen präsentierenden Helper.

### 3. Responsive Breakpoints
**Empfehlung: Option A — Mobile-first mit `sm`/`md`/`lg`-Breakpoints.**

Das Board ist ein horizontales Kanban, daher bleibt das primäre Mobile-Erlebnis ein horizontaler Scroll (`overflow-x-auto`) mit einer Mindest-Spaltenbreite. Auf größeren Bildschirmen erhöhen wir Padding, Gaps und Spalten-Mindestbreiten. Touch-Targets bleiben mindestens `44px` groß. So bleibt das bestehende Interaktionsmodell erhalten, während die Lesbarkeit auf jedem Viewport verbessert wird.

### 4. Tastatur-Navigations-Scope
**Empfehlung: Option A — Nur Tab, sodass der Browser es nativ behandelt.**

Das bestehende Drag-and-Drop nutzt bereits `@dnd-kit`s `KeyboardSensor`, also ist Umsortieren per Tastatur möglich. Für diesen Polish-Task konzentrieren wir uns darauf, jedes interaktive Element per `Tab`/`Shift+Tab` erreichbar, sichtbar und vorhersehbar zu machen: Task-Cards, Header-Inputs, der Add-Task-Button und der Theme-Toggle. Wir verzichten auf Custom Shortcuts (`j`/`k` etc.), weil diese State, Event-Listener und Dokumentationsaufwand bedeuten würden, die außerhalb eines reinen UI-Polish liegen.

### 5. Animationen/Transitions
**Empfehlung: Option A — Subtil (`transition-colors`, `duration-150`).**

Animationen sollten responsiv wirken, nicht dekorativ. Wir fügen kurze Transitions für Farbe, Border-Farbe, Schatten und Transform-Änderungen hinzu. Entry-Animationen vermeiden wir, damit das Board während optimistischer Updates flüssig bleibt. Alle Animationen respektieren `prefers-reduced-motion`, indem wir Tailwind-Transitions wo angebracht mit `motion-safe:` kombinieren und keine Motion zur Vermittlung von State nutzen.

### 6. Farbpalette
**Empfehlung: `dark:`-Varianten auf spezifische UI-Flächen ausdehnen; bestehende Grau/Blau-Basis beibehalten.**

Wir führen kein neues Farbsystem ein. Stattdessen wenden wir eine bewusstere Hierarchie an: der Header erhält eine dezente Surface-Farbe, Spalten einen konsistenten gedämpften Hintergrund, Task-Cards eine leicht erhöhte Surface, und Hover-/Fokus-Zustände nutzen einen einheitlichen Akzent-Blauton. Spaltenspezifische Farben werden *nicht* hinzugefügt, weil die aktuellen drei Status ("In Progress", "Completed", "Won't do") beliebig sind und eine Farbcodierung falsche Semantik erzeugen könnte. Das Dark-Mode-Palette wird konsolidiert, sodass jede Oberfläche ein definiertes Gegenstück hat.

## State Machine / Flow

N/A — Issue #14 fügt keinen State hinzu, entfernt keinen und ändert auch keine State-Logik. Der Zustand-Store-Vertrag bleibt identisch.

## API-Vertrag

N/A — Issue #14 fügt keine Endpunkte oder Payloads hinzu, entfernt keine und ändert auch keine.

## Datei-Änderungen

- `client/tailwind.config.js`
- `client/src/pages/BoardPage.jsx`
- `client/src/pages/HomePage.jsx`
- `client/src/components/Column.jsx`
- `client/src/components/TaskCard.jsx`
- `client/src/components/BoardHeader.jsx`
- `client/src/components/EmptyBoard.jsx`

## Implementierungsschritte

1. **Aktuelle UI-Oberflächen auditieren.** Jede oben gelistete Datei öffnen und Typografie, Abstände, Farben, Fokus und Animationen auf Inkonsistenzen prüfen.
2. **Tailwind-Theme erweitern.** Einen kleinen `extend`-Block für konsistente Border-Radius, Box-Shadow und Transition-Timing hinzufügen, falls nötig. Benutzerdefinierte Werte minimal halten; Standard-Tailwind-Utilities bevorzugen.
3. **Skeleton-Platzhalter bauen.** In `BoardPage.jsx` den `isLoading`-Zweig durch ein Skeleton-Layout ersetzen, das der Board-Struktur entspricht. Optional wiederholte Card-/Column-Skeleton-Formen in einen lokalen Helper innerhalb derselben Datei auslagern, um das JSX lesbar zu halten.
4. **`BoardHeader` polieren.**
   - Visuelle Trennung durch dezente Hintergrundfarbe oder stärkere Border erhöhen.
   - Sicherstellen, dass Inputs sichtbare `focus-visible`-Rings und ausreichend Padding haben.
   - Übergang für den Saving-State (Opazität des "Saving..."-Textes) hinzufügen.
5. **`Column` polieren.**
   - Padding- und Gap-Skala verfeinern (`p-4`, `gap-3`).
   - Drop-Target-Feedback verbessern (Ring + Hintergrundfarbe mit Transition).
   - Task-Count-Badge lesbarer gestalten.
   - Sicherstellen, dass die Spalte auf ihrer eigenen Achse scrollbar ist, ohne Fokus-Rings abzuschneiden.
6. **`TaskCard` polieren.**
   - Typografie straffen (`leading-snug`, `text-sm` für Beschreibung).
   - `focus-visible`-Ring für Tastatur-Nutzer hinzufügen.
   - Hover-Shadow/Border-Transitions glätten.
   - Drag-Overlay-Erscheinungsbild beibehalten.
7. **`EmptyBoard` und `HomePage` polieren.**
   - `EmptyBoard`: Icon-/Illustrations-Platzhalter und freundlichere vertikale Abstände hinzufügen.
   - `HomePage`: Einfache Spinner-Zentrierung durch dieselbe Surface-Stilisierung ersetzen, die auf `BoardPage` genutzt wird, und einen Skeleton-fähigen Container hinzufügen.
8. **Responsiver Durchlauf.**
   - Mobile-first Breakpoints zum `BoardPage`-Main-Bereich hinzufügen.
   - Prüfen, ob horizontaler Scroll auf 320px breiten Viewports nutzbar ist.
   - Prüfen, dass Spalten nicht unter ihre minimale Lesbarkeitsbreite zusammenschrumpfen.
9. **Accessibility-Durchlauf.**
   - Mit Tab durch jedes interaktive Element navigieren und einen sichtbaren Fokus-Ring bestätigen.
   - Mit macOS/Windows Reduced-Motion-Einstellungen testen.
   - Kurzen Lighthouse-Audit für Kontrast und Fokus durchführen.
10. **Visuelle Regression / manuelles QA.**
    - Light- und Dark-Mode nebeneinander vergleichen.
    - Sicherstellen, dass das Skeleton-Layout nicht springt, wenn echte Daten es ersetzen.
    - Bestätigen, dass Drag-and-Drop nach den Style-Änderungen weiterhin funktioniert.

## Edge Cases & Fehlerbehandlung

- **Focus visible auf Custom-Elementen.** Task-Cards sind `div`s mit `onClick`. Sicherstellen, dass sie `tabIndex={0}`, einen `onKeyDown`-Handler für Enter/Space und einen `focus-visible`-Ring haben. Ohne das können Tastatur-Nutzer Tasks nicht öffnen.
- **Reduced motion.** Alle Transitions sind rein präsentativ; State-Änderungen hängen nicht von Animation ab. `motion-safe:`-Präfixe hinzufügen, wo Entry-/Exit-Motion eingeführt wird, und kein automatisch abspielendes Motion verwenden.
- **Layout-Kollaps auf kleinen Bildschirmen.** Spalten haben `min-w-[280px]`. Auf sehr kleinen Viewports scrollt das Board horizontal, anstatt Spalten zu quetschen. Prüfen, dass `overflow-x-auto` auf dem Scroll-Container vorhanden ist und `flex-shrink-0` nicht versehentlich entfernt wurde.
- **Skeleton-Flackern.** Wenn `fetchBoard` schnell auflöst, kann das Skeleton kurz flackern. Keine künstlichen Delays hinzufügen; stattdessen sicherstellen, dass das Skeleton die finale Geometrie spiegelt, damit der Übergang als sofortig wahrgenommen wird.
- **Dark-Mode-Härtung.** Jedes neue Farb-Token muss ein `dark:`-Gegenstück haben. Mit dem Theme-Toggle und mit `<html class="dark">` beim Laden testen.

## Teststrategie

- **Manuelle Checkliste (erforderlich):**
  - [ ] Light Mode sieht auf Desktop- und Mobile-Breiten aufgeräumt aus.
  - [ ] Dark Mode sieht auf Desktop- und Mobile-Breiten aufgeräumt aus.
  - [ ] Skeleton erscheint während des initialen Board-Ladens.
  - [ ] Jedes klickbare Element zeigt beim Tabben einen sichtbaren Fokus-Ring.
  - [ ] Task-Cards können mit Enter/Space geöffnet werden.
  - [ ] Drag-and-Drop sortiert und verschiebt Tasks weiterhin korrekt.
  - [ ] Reduced-Motion-Präferenz bricht keine Funktionalität.
- **Visuelle Regression (optional):**
  - Falls Storybook oder ein Screenshot-Tool im Repo existiert, Board-, Empty- und Skeleton-Zustände vorher und nachher erfassen. Dieses Projekt hat aktuell keine Storybook-Konfiguration, daher ist dieser Schritt optional.
- **Lighthouse / axe:**
  - Kurzen Accessibility-Scan laufen lassen, um Kontrast- oder Fokus-Rezessionen zu finden.

## Akzeptanzkriterien

- [ ] Typografie, Abstände, Farben, Animationen und Fokus-Rings sind konsistent über `BoardPage`, `Column`, `TaskCard`, `BoardHeader`, `EmptyBoard` und `HomePage`.
- [ ] Ein Skeleton-Ladezustand wird angezeigt, während das Board lädt.
- [ ] Das Board-Layout ist von 320px bis 4K nutzbar, ohne horizontales Clipping oder unleserliche Spalten.
- [ ] Alle interaktiven Elemente sind per Tastatur (`Tab`/`Shift+Tab`) erreichbar und visuell erkennbar.
- [ ] Es werden keine State-Logik, API-Calls oder Datenformen geändert.
- [ ] Es werden keine neuen Abhängigkeiten hinzugefügt.
- [ ] Dark Mode bleibt voll funktionsfähig.

## Out of Scope

- Neue Features (Filter, Suche, Verantwortliche, Fälligkeitsdaten etc.).
- Neue funktionale Komponenten über kleine, lokale präsentierende Skeleton-Helper hinaus.
- Backend-Änderungen jeglicher Art.
- Theme-Toggle-Implementierung (bereits in Issue #12 erledigt).
- Custom Keyboard Shortcuts jenseits der Standard-Tab-Reihenfolge.
- Neue Schriftfamilie oder Design-System-Überarbeitung.

## Risiken & Offene Fragen

- **Fragmentierung des Design-Systems.** Da dies ein einmaliger Polish-Durchlauf ist, besteht die Gefahr, dass Farben/Abstände von zukünftigen Komponenten abweichen. Abschwächung: Die gewählten Tokens in Code-Kommentaren innerhalb von `tailwind.config.js` dokumentieren und Werte an Tailwinds Standard-Skala ausrichten.
- **Rezessionsrisiko bei Drag-and-Drop.** Das Umgestalten von `TaskCard` oder `Column` kann Hit-Areas, Cursor-Behandlung oder das Drag-Overlay versehentlich verändern. Abschwächung: dnd-kit-Verhalten nach jeder Style-Änderung testen und die DOM-Struktur innerhalb sortierbarer Nodes nicht ändern.
- **Reduced-Motion-Testing.** Nicht alle Team-Umgebungen bieten `prefers-reduced-motion`-Schalter. Abschwächung: DevTools-Rendering-Emulation nutzen und Motion strikt kosmetisch halten.
- **Offene Frage:** Soll das Skeleton dieselbe Spaltenanzahl wie das geladene Board nutzen? Da die Spaltenliste erst nach Auflösung von `fetchBoard` bekannt ist, wird ein festes Drei-Spalten-Skeleton empfohlen. Falls Boards eine variable Anzahl an Status haben können, erwäge ein generisches 3-Spalten-Skeleton, das das häufigste Layout approximiert.
