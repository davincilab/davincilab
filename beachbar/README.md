# ⛱️ Strandbar-Bestell-App — Prototyp

Prototyp eines QR-basierten Bestellsystems für eine Strandbar. Gäste scannen den
Code an ihrem Sonnenschirm, bestellen von der Liege, bezahlen mit hinterlegter
(Fake-)Karte und bekommen die Rechnung per (Fake-)E-Mail. Die Bar sieht jede
Bestellung live, kann selbst manuell erfassen und hat ein Dashboard mit Zahlen.

Alles läuft **rein im Browser** — kein Server, kein Build, keine Abhängigkeiten.
Einfach `index.html` öffnen (oder den Ordner statisch ausliefern).

---

## Die vier Oberflächen

| Datei | Rolle | Farbe |
|---|---|---|
| `guest.html` | **Gast-App** — Karte, Optionen, Warenkorb, Zahlung, Bestellverfolgung, Musikwunsch | 🔵 blau |
| `bar.html` | **Bar-Station** — eingehende Tickets, Zubereitung, Auslieferung, manuelle Bestellung, Musik | 🔴 rot |
| `dashboard.html` | **Dashboard** — Umsatz, Bestellungen, Top-Produkte, Zubereitungszeit, Schirm-Karte, CSV | 🔴 rot |
| `qr.html` | **QR-Codes** — druckbare, nummerierte Etiketten pro Schirm | 🔵 blau |
| `index.html` | Start / Launcher mit Anleitung | |

### Zwei App-Symbole am Smartphone

Gast-App und Bar-App haben eigene Manifeste, eigene Titel und eigene Icons.
Über „Zum Home-Bildschirm hinzufügen" entstehen damit **zwei getrennte Symbole**:
ein **blauer Sonnenschirm** (Gast) und ein **rotes Cocktailglas** (Bar) — beide
starten im Vollbild ohne Browserleiste.

Die Icons werden erzeugt von `tools/make_icons.py` (reines Python, keine
Bibliotheken):

```bash
python3 tools/make_icons.py
```

---

## Ablauf: Gast

1. **QR scannen** → `guest.html?u=12` öffnet sich, Schirm 12 ist gesetzt.
2. **Kategorie wählen** (Kaffee, Alkoholfrei, Säfte, Bier, Cocktails, Snacks).
3. **Produkt antippen** → Optionen wählen:
   * Kaffee: *ohne Zucker · wenig Zucker · mittel (μέτριος) · sehr süß*, Milchart, Eis
   * Säfte/Limonade: mit/ohne Zucker
   * Toast: Belag, Burger: Extras (Mehrfachauswahl mit Aufpreis)
   * Freitext-Notiz je Position
4. **Warenkorb** → Notiz für die Bar, Musikwunsch, Zahlungsart.
5. **Bezahlen**:
   * *Jetzt mit Karte* — hinterlegte Karte, simulierte Autorisierung (1,4 s Spinner, immer „genehmigt")
   * *Auf meinen Deckel* — offener Betrag, Sammelzahlung am Ende
   * *Bar am Schirm*
6. **Rechnung per E-Mail** (simuliert): Beleg mit Netto/USt-Aufteilung, landet im
   Dashboard unter „Gesendete Rechnungen".
7. **Statusverfolgung**: Empfangen → In Zubereitung → Unterwegs → Geliefert,
   mit Zeitstempeln und ETA. Aktualisiert sich live, sobald die Bar weiterklickt.

## Ablauf: Bar

* **Tickets in vier Spalten** (Neu / In Zubereitung / Unterwegs / Geliefert),
  ein Klick pro Statuswechsel, Wartezeit-Timer, rote Pulsierung ab 6 Minuten.
* **Ton + Toast** bei neuer Bestellung (abschaltbar über 🔔).
* **Filter** nach Schirm und nach Station (Bar / Cocktails / Küche).
* **Manuelle Bestellung**: Schirm wählen, Produkte antippen, Optionen setzen,
  Zahlungsart (bar / Karte / Deckel) — für Gäste ohne Handy.
* **Musikwünsche** annehmen oder ablehnen.
* **Schirm-Übersicht**: Raster aller Schirme, eingefärbt nach Umsatz, Klick
  filtert die Bestellungen dieses Schirms.

## Dashboard

Kennzahlen (Umsatz heute, Bestellungen, Ø-Bon, offene Bestellungen, aktive
Schirme, Ø-Zubereitungszeit, offene Deckel), Umsatz je Stunde, Top-Produkte,
Umsatz je Kategorie, Umsatz je Schirm, offene Deckel, Musikwünsche, gesendete
Rechnungen. Dazu **Tabellenansicht** für jedes Diagramm und **CSV-Export** aller
Positionen.

---

## Sortiment

20 Artikel in sechs Kategorien, **zweisprachig Englisch / Griechisch**, Preise
vom Aushang der Bar:

Ελληνικός καφές 3,50 · Εσπρέσσο 3,50 · Φρέντο Εσπρέσσο 5,00 · Φρέντο Καπουτσίνο 5,50 ·
Νερό 0,5 λ 1,00 · Ανθρακούχο νερό 4,00 · Κόκα Κόλα 4,00 · Τσάι κρύο 4,00 ·
Φυσικός χυμός πορτοκάλι 6,00 · Σπιτική λεμονάδα 6,00 · Σμούθι 6,50 ·
Άμστελ 5,00 · Χάινεκεν 5,00 · Βαρέλι μεγάλο 7,00 ·
Μοχίτο 10,00 · Καϊπιρίνια 10,00 · Τεκίλα Σανράιζ 10,00 ·
Τοστ 4,00 · Φρουτοσαλάτα 7,00 · Τσίζμπεργκερ 8,50

Sprache jederzeit über **EN / ΕΛ** oben rechts umschaltbar; die Einstellung wird
pro Gerät gemerkt (Standard: Browsersprache).

---

## QR-Codes

`qr.html` erzeugt pro Schirm ein Etikett mit `<Basis-URL>/guest.html?u=<Nummer>`.

1. **Basis-URL** eintragen — die Adresse, die die Handys erreichen (im Test die
   LAN-IP des Laptops, später die echte Domain).
2. Bereich **von/bis** setzen, **Generieren**, **Drucken** (3 Etiketten pro Zeile,
   Bedienoberfläche wird nicht mitgedruckt) oder einzeln als SVG herunterladen.

Der QR-Encoder (`assets/js/qrcode.js`) ist selbst geschrieben — Byte-Modus,
Fehlerkorrektur M, Versionen 1–10, keine externe Bibliothek und keine
Internetverbindung nötig. Die Ausgabe wurde modulweise gegen eine
Referenzimplementierung geprüft und mit einem echten Decoder gegengelesen.

---

## Lokal testen (auch am Handy)

```bash
cd beachbar
python3 -m http.server 8000
```

* Laptop: <http://localhost:8000>
* Handy im selben WLAN: `http://<IP-des-Laptops>:8000` — diese Adresse in
  `qr.html` als Basis-URL eintragen, dann sind die Codes scannbar.

> Hinweis: „Zum Home-Bildschirm hinzufügen" und der Kamera-Scan funktionieren
> zuverlässig erst über **HTTPS** oder `localhost`. Für einen Feldtest den Ordner
> auf eine beliebige statische HTTPS-Adresse legen (GitHub Pages, Netlify …).

---

## Technik & Grenzen des Prototyps

* **Kein Backend.** Der Zustand liegt in `localStorage`; Fenster auf demselben
  Gerät/Browser synchronisieren sich sofort über `BroadcastChannel`. Gast-App,
  Bar-Station und Dashboard laufen also live gegeneinander — aber **nur auf einem
  Gerät**. Für echten Mehrgeräte-Betrieb muss `Store.commit()` in `store.js`
  gegen einen API-/WebSocket-Aufruf getauscht werden; alles darüber bleibt gleich.
* **Zahlung ist Attrappe.** Kartendaten werden nicht validiert, nichts wird
  übertragen, jede Autorisierung „gelingt". Kein PSP, keine PCI-Relevanz.
* **Rechnungen sind Attrappe.** Es wird keine E-Mail verschickt; der Beleg wird
  angezeigt und im Dashboard protokolliert.
* **Demo-Daten**: Beim ersten Start werden die letzten Stunden mit plausiblen
  Bestellungen befüllt (deterministischer Zufall), plus vier offene Tickets.
  Zurücksetzen im Dashboard über „Demo-Daten zurücksetzen".

### Dateien

```
beachbar/
├── index.html              Launcher
├── guest.html              Gast-App (blau)
├── bar.html                Bar-Station (rot)
├── dashboard.html          Dashboard
├── qr.html                 QR-Etiketten
├── manifest-guest.webmanifest
├── manifest-bar.webmanifest
├── assets/
│   ├── css/app.css         gesamtes Design, hell + dunkel
│   ├── icons/              generierte App-Icons (blau/rot)
│   └── js/
│       ├── data.js         Sortiment, Optionsgruppen, Übersetzungen
│       ├── store.js        Zustand, Persistenz, Sync, Bestell-Logik
│       ├── ui.js           gemeinsame UI-Helfer (Sheets, Toasts, i18n)
│       ├── guest.js        Gast-Flow
│       ├── bar.js          Bar-Flow
│       ├── dashboard.js    Kennzahlen & Diagramme
│       ├── qr.js           QR-Etikettenseite
│       └── qrcode.js       QR-Encoder
└── tools/make_icons.py     erzeugt die App-Icons
```

Bedienung: Touch-Ziele ≥ 44 px, Dunkelmodus, Tastaturfokus, Diagramme zusätzlich
als Tabelle, Farbpalette auf Farbfehlsichtigkeit geprüft.

---

## Ein-Datei-Version (zum Verschicken / Hosten)

```bash
python3 tools/build_single.py              # dist/beachbar-demo.html
python3 tools/build_single.py --fragment   # ohne <html>/<head>/<body>, für Hosts mit eigenem Gerüst
```

Alles inline (CSS, JS, Icons) — läuft vom USB-Stick, aus dem Mail-Anhang oder von
jedem statischen Host. Die Seiten werden zu Rollen hinter dem Hash:
`#index`, `#guest`, `#bar`, `#dashboard`, `#qr`; ein QR-Code zeigt dann auf
`…/beachbar-demo.html#guest?u=12`. Rollenwechsel lädt die Seite neu, damit jede
App exakt wie im Mehrseiten-Build startet.
