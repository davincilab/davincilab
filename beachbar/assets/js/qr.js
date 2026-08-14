/*
 * qr.js — printable QR labels, one per umbrella.
 *
 * Every code encodes <base>/guest.html?u=<number>, so the scanned umbrella is
 * known before the guest touches anything. The base URL is editable: put in the
 * address the phones can actually reach (LAN IP during a test, the real domain
 * later) and reprint.
 */
(function () {
  'use strict';

  var el = UI.el, t = UI.t;
  var view = UI.$('#view');

  function defaultBase() {
    // single file: the page itself is the app; pages: the folder holding them
    if (UI.single) return location.href.split('#')[0];
    return location.href.replace(/[^/]*$/, '').replace(/\/$/, '');
  }

  var base = localStorage.getItem('bb.qrbase') || defaultBase();
  var from = 1;
  var to = Store.settings.umbrellaCount;

  function urlFor(number) {
    if (UI.single) return base.split('#')[0] + '#guest?u=' + number;
    return base.replace(/\/$/, '') + '/guest.html?u=' + number;
  }

  function card(number) {
    var wrap = el('div.qr-card', {}, [
      el('div.qr-card__bar', { text: Store.settings.barName }),
      el('div', { html: QR.svg(urlFor(number), { quiet: 2 }) }),
      el('div.qr-card__no', { text: '⛱️ ' + number }),
      el('div.qr-card__label', { text: UI.lang() === 'el'
        ? 'Σαρώστε & παραγγείλτε' : 'Scan & order' })
    ]);
    return wrap;
  }

  function downloadSvg(number) {
    var markup = QR.svg(urlFor(number), { quiet: 2 });
    var blob = new Blob([markup], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var link = el('a', { href: url, download: 'umbrella-' + number + '.svg' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function render() {
    var baseInput, fromInput, toInput;
    var grid = el('div.qr-grid');

    function refreshGrid() {
      var cards = [];
      for (var n = from; n <= to; n++) cards.push(card(n));
      UI.mount(grid, cards);
    }

    UI.mount(view, [
      el('div.card.no-print', {}, [
        el('h1', { style: 'font-size:1.15rem;margin-bottom:4px',
          text: UI.lang() === 'el' ? 'Κωδικοί QR ομπρελών' : 'Umbrella QR codes' }),
        el('p.small.muted', { text: UI.lang() === 'el'
          ? 'Ο κωδικός ανοίγει την εφαρμογή με τον αριθμό της ομπρέλας.'
          : 'Each code opens the guest app with its umbrella number pre-selected.' }),
        el('div.field', {}, [
          el('label.field__label', { text: 'Base URL' }),
          (baseInput = el('input', { type: 'text', value: base,
            placeholder: 'https://bar.example.com/beachbar' }))
        ]),
        el('div.row', {}, [
          el('div.field', { style: 'flex:1' }, [
            el('label.field__label', { text: 'From' }),
            (fromInput = el('input', { type: 'number', min: '1', value: String(from) }))
          ]),
          el('div.field', { style: 'flex:1' }, [
            el('label.field__label', { text: 'To' }),
            (toInput = el('input', { type: 'number', min: '1', value: String(to) }))
          ])
        ]),
        el('div.row.row--wrap', {}, [
          el('button.btn.btn--primary', {
            type: 'button', text: UI.lang() === 'el' ? 'Δημιουργία' : 'Generate',
            onclick: function () {
              base = baseInput.value.trim() || defaultBase();
              localStorage.setItem('bb.qrbase', base);
              from = Math.max(1, Number(fromInput.value) || 1);
              to = Math.max(from, Math.min(200, Number(toInput.value) || from));
              refreshGrid();
              UI.toast((to - from + 1) + ' QR', 'good');
            }
          }),
          el('button.btn.btn--ghost', { type: 'button', text: '🖨 Print',
            onclick: function () { window.print(); } }),
          el('button.btn.btn--ghost', { type: 'button', text: '⬇ SVG (⛱️ ' + from + ')',
            onclick: function () { downloadSvg(from); } })
        ]),
        el('p.small.muted', { style: 'margin-top:8px', text: urlFor(from) })
      ]),
      grid
    ]);

    refreshGrid();
  }

  UI.applyLang();
  UI.mount(UI.$('#langHost'), [UI.langToggle(render)]);
  render();
})();
