# Implementierungsplan — GitHub Issue #12: Light/Dark-Modus-Unterstützung hinzufügen

## 1. Zusammenfassung

Dieser Plan fügt dem Task Board einen persistierenden, barrierefreien Theme-Schalter für hell/dunkel/system hinzu. Der Schalter wird in `BoardHeader` platziert, der Zustand wird im bestehenden Zustand-Store gehalten und das aktive Theme wird vor dem Mounten von React über ein Inline-Skript in `client/index.html` angewendet, um einen Flash of Unstyled Content (FOUC) zu vermeiden. `tailwind.config.js` verwendet bereits `darkMode: 'class'` und die Komponenten enthalten bereits `dark:`-Varianten, sodass es sich bei diesem Issue vorrangig um das Verdrahten der fehlenden Laufzeitlogik handelt.

## 2. Architektur & Designentscheidungen

### 2.1 Wo wird der Schalter platziert? — **Option A: BoardHeader**

Issue #12 fordert den Schalter explizit "im Board-Header". `BoardHeader.jsx` existiert bereits und ist der natürliche Ort für Board-level-Chrome. Die Komponente dort zu belassen vermeidet neue globale Layout-Komponenten und folgt der bestehenden Seitenstruktur.

### 2.2 Theme-Werte? — **Option A: 3 Zustände (light/dark/system)**

Ein dreistufiger Wert ist der flexibelste und zukunftssicherste Standard:
- **light** — erzwingt den hellen Modus.
- **dark** — erzwingt den dunklen Modus.
- **system** — folgt `prefers-color-scheme` und aktualisiert sich automatisch, wenn sich das Betriebssystem ändert.

Zwei Zustände würden die Möglichkeit entfernen, auf die OS-Präferenz zurückzufallen, ohne die explizite Benutzerauswahl zu verlieren.

### 2.3 FOUC-Präventionsmechanismus? — **Option A: Inline-`<script>` in `index.html`**

Ein kleines, blockierendes Inline-Skript in `client/index.html` liest `localStorage` und wendet die `dark`-Klasse auf `<html>` vor dem ersten Paint an. Das ist der einzige Mechanismus, der garantiert keinen FOUC verursacht, da er vor React, Vite oder dem Parsen eines Stylesheets läuft. Ein rein CSS-basiertes `@media`-Fallback würde mit `darkMode: 'class'` kollidieren und könnte `localStorage` nicht lesen.

### 2.4 Zustandsort? — **Option A: Zustand-Store**

Entsprechend dem Flux-Pattern lesen UI-Komponenten aus einer einzigen Wahrheitsquelle. Wir ergänzen `useBoardStore` um einen kleinen `theme`-Slice, der:
- `theme` und `setTheme` bereitstellt,
- in `localStorage` persistiert,
- die `dark`-Klasse auf `<html>` umschaltet,
- auf `prefers-color-scheme` hört, wenn `theme === 'system'` ist.

Das Inline-Skript in `index.html` fungiert als *initiale* Wahrheitsquelle für den allerersten Paint; React hydratisiert beim Mounten gegen denselben `localStorage`-Wert.

### 2.5 Schalter-UI? — **Option B: Einzelner Button, der durch die Zustände wechselt**

Ein einzelner, barrierefreier Button wechselt `system → light → dark → system` und verwendet ein `aria-label`, das den aktuellen und nächsten Zustand ansagt. Das hält den Header kompakt und vermeidet die Layout-Verschiebungen und Fokus-Probleme eines Dropdowns. Die Icons (`☀ / 🌙 / 💻`) ändern sich mit dem Zustand.

## 3. Zustandsmaschine / Ablauf

```text
                    ┌─────────────────┐
        ┌──────────►│     system      │◄──────────┐
        │           │ (prefers-color  │           │
        │           │  scheme wins)   │           │
        │           └────────┬────────┘           │
        │                    │                    │
   setTheme('light')   mediaQuery change           │
        │              (recompute class)           │
        │                    │                    │
        │           ┌────────▼────────┐           │
        │           │     light       │           │
        │           │ (html.light)    │           │
        │           └────────┬────────┘           │
        │                    │ setTheme('dark')   │
        │                    ▼                    │
        │           ┌─────────────────┐           │
        └───────────┤      dark       ├───────────┘
   setTheme('system')│ (html.dark)     │
                    └─────────────────┘
```

*Transitionsregeln*

- Ein Klick auf den Button wechselt `system → light → dark → system`.
- `light` entfernt `dark` von `<html>`.
- `dark` fügt `dark` zu `<html>` hinzu.
- `system` fügt `dark` hinzu oder entfernt es basierend auf `window.matchMedia('(prefers-color-scheme: dark)').matches`.
- Beim Mounten wird, wenn der gespeicherte Wert `system` ist, ein `change`-Listener registriert und die Klasse bei jeder Änderung der OS-Präferenz neu berechnet.

## 4. API-Vertrag

**N/A.** Dieser Issue ist rein clientseitig. Keine Backend-Endpunkte, Modelle oder Datenbankänderungen sind erforderlich.

## 5. Dateiänderungen

- `client/index.html`
- `client/src/store/useBoardStore.js`
- `client/src/components/BoardHeader.jsx`
- `client/src/components/ThemeToggle.jsx` *(neu)*

## 6. Implementierungsschritte

1. **Das FOUC-Präventionsskript in `client/index.html` hinzufügen.**
   - Ein kleines Inline-`<script>` in `<head>` sofort ausführen lassen.
   - Es liest `localStorage.getItem('task-board-theme')`, fällt auf `'system'` zurück und wendet bei Bedarf die `dark`-Klasse auf `<html>` an.
2. **`useBoardStore` um einen Theme-Slice erweitern.**
   - Initialen Zustand um `theme: 'system'` ergänzen.
   - Eine `setTheme`-Action hinzufügen, die Zustand aktualisiert, `localStorage` beschreibt und die `dark`-Klasse umschaltet.
   - Beim Initialisieren des Stores `localStorage` lesen, bei Wert `system` auf `prefers-color-scheme` horchen und den Listener beim Zerstören des Stores aufräumen (optional, da die App langlebig ist).
3. **`client/src/components/ThemeToggle.jsx` erstellen.**
   - `const`-Arrow-Function-Komponente verwenden.
   - `theme` und `setTheme` über Selektoren aus `useBoardStore` lesen.
   - Einen einzelnen `<button>` mit Tailwind-Klassen und `aria-label` rendern.
   - Bei Klick durch die Zustände wechseln.
4. **`ThemeToggle` in `BoardHeader.jsx` importieren.**
   - In die Flex-Reihe des Headers setzen, rechts neben dem bearbeitbaren Titel/Beschreibungs-Block.
   - Bestehende Input-Felder unverändert lassen.
5. **Ende-zu-Ende-Verhalten der Tailwind-Dark-Varianten prüfen.**
   - Sicherstellen, dass bereits vorhandene `dark:`-Klassen in `BoardHeader`, `Column`, `TaskCard` usw. auf die `dark`-Klasse auf `<html>` reagieren.
6. **Manuelles QA und, falls Zeit vorhanden, Unit-Test für den Store-Slice hinzufügen.**

## 7. Edge Cases & Fehlerbehandlung

- **localStorage nicht verfügbar oder wirft Fehler** (Private Browsing, deaktivierter Speicher, `SecurityError`).
  - Jeden `localStorage`-Zugriff in `try/catch` einbetten.
  - Lautlos auf `'system'` zurückfallen.
  - Auch das FOUC-Skript muss in `try/catch` eingebettet sein.
- **Gespeicherter Wert ist ungültig.**
  - Gegen `['light', 'dark', 'system']` validieren; Standardwert `'system'`.
- **OS-Präferenz ändert sich, während `theme === 'system'`.**
  - Einen `MediaQueryList`-Listener halten und die `dark`-Klasse sofort neu berechnen.
- **Hydration-Mismatch.**
  - Da Inline-Skript und React denselben `localStorage`-Key lesen, stimmen serverseitig gerendertes HTML (falls vorhanden) und Client-Markup nach der Hydratation überein. Heute gibt es kein SSR, daher ist dies eine zukunftssichernde Maßnahme.
- **Benutzer setzt `theme` und löscht `localStorage` manuell.**
  - Beim nächsten Laden fällt die App auf `'system'` zurück, was der erwartete Standard ist.

## 8. Teststrategie

### Unit-Tests (Zustand-Store-Slice)

- `setTheme('dark')` schreibt `'dark'` in `localStorage` und fügt `<html>` die Klasse `dark` hinzu.
- `setTheme('light')` entfernt `dark` von `<html>`.
- `setTheme('system')` löst die korrekte Klasse anhand eines gemockten `matchMedia`-Werts auf.
- Ungültige gespeicherte Werte fallen auf `'system'` zurück.
- `localStorage`-Fehler werden abgefangen und lassen den Store nicht abstürzen.

### Manuelle Test-Checkliste

- [ ] Erster Besuch mit OS-Dark-Mode: Board wird sofort dunkel gerendert, kein Flash.
- [ ] Erster Besuch mit OS-Light-Mode: Board wird sofort hell gerendert, kein Flash.
- [ ] Schalter wechselt `system → light → dark → system`.
- [ ] Seiten-Reload behält den gewählten Modus.
- [ ] OS-Modus wechseln bei `theme === 'system'` aktualisiert die UI automatisch.
- [ ] Button hat korrektes `aria-label` und ist per Tastatur fokussierbar.
- [ ] Bereits vorhandene `dark:`-Utility-Klassen in `BoardHeader`, `Column`, `TaskCard` usw. rendern korrekt.
- [ ] `npm run dev` baut ohne Fehler.

## 9. Akzeptanzkriterien

- [ ] `ThemeToggle`-Komponente existiert in `client/src/components/ThemeToggle.jsx`.
- [ ] Schalter ist in `BoardHeader` sichtbar.
- [ ] Gewähltes Theme überlebt Seiten-Reloads via `localStorage`.
- [ ] `system`-Theme respektiert und folgt `prefers-color-scheme`.
- [ ] Kein FOUC beim harten Reload in hell oder dunkel.
- [ ] Alle bestehenden `dark:`-Varianten funktionieren weiterhin.
- [ ] Code folgt den AGENTS.md-Konventionen (`const`-Arrow-Komponenten, einfache Anführungszeichen, keine Semikolons, trailing commas, 2-Space-Einrückung).

## 10. Nicht im Scope

- Synchronisieren der Theme-Präferenz mit dem Backend oder Benutzerkonto.
- Animierter Übergang zwischen Themes.
- Zusätzliche Farbthemes neben hell/dunkel.
- Theme-Vorschau auf einer Einstellungsseite.
- Änderungen an `tailwind.config.js` (bereits korrekt konfiguriert).

## 11. Risiken & offene Fragen

- **Risiko:** Das Inline-FOUC-Skript dupliziert Logik mit dem Zustand-Store. Wenn sich die Theme-Logik weiterentwickelt, müssen beide Stellen gepflegt werden. Abschwächung: Das Inline-Skript auf ein Minimum beschränken (nur lesen + anwenden) und die Entscheidungslogik zentral im Store halten.
- **Risiko:** Fremdbibliotheken oder Komponenten respektieren die `dark`-Klasse auf `<html>` möglicherweise nicht. Abschwächung: Alle aktuellen Komponenten verwenden Tailwind `dark:`-Varianten, die diese Klasse respektieren.
- **Offene Frage:** Sollte `ThemeToggle` auch über ein Tastaturkürzel erreichbar sein? Nicht vom Issue gefordert, aber ein mögliches Follow-up.
- **Offene Frage:** Sollten wir das Theme unter einem namespaced Key wie `task-board-theme` speichern, um Kollisionen zu vermeiden? Empfohlen: ja, `task-board-theme` verwenden.
