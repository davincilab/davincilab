/*
 * diag.js — the launcher's environment readout.
 *
 * Display problems in an unknown host (an in-app file viewer, a preview pane)
 * cannot be reproduced from the outside. This panel prints what the page can
 * measure about the host, so one screenshot replaces a round of guessing.
 */
(function () {
  'use strict';

  var el = UI.el;
  var host = document.getElementById('diagBody');
  if (!host) return;

  function facts() {
    var doc = document.documentElement;
    var framed = 'yes';
    try { framed = window.top !== window.self ? 'yes' : 'no'; } catch (err) { framed = 'blocked'; }
    var storage = 'yes';
    try {
      localStorage.setItem('bb.diag', '1');
      localStorage.removeItem('bb.diag');
    } catch (err) { storage = 'no (memory only)'; }

    return [
      ['window', window.innerWidth + ' × ' + window.innerHeight],
      ['screen', screen.width + ' × ' + screen.height],
      ['document', doc.clientHeight + ' visible / ' + doc.scrollHeight + ' total'],
      ['body height', document.body.scrollHeight + ''],
      ['content longer than window', doc.scrollHeight > window.innerHeight + 24 ? 'yes' : 'no'],
      ['window scrolls', UI.canScrollWindow() ? 'yes' : 'no'],
      ['scroll mode', UI.scrollMode()],
      ['in a frame', framed],
      ['host sizes the frame', UI.isFlowHost() ? 'yes' : 'no'],
      ['fragment navigation', location.hash === UI.hash() ? 'ok' : 'blocked (internal)'],
      ['storage', storage],
      ['pixel ratio', String(window.devicePixelRatio || 1)],
      ['address', location.protocol + '//' + (location.host || '(none)')],
      ['browser', navigator.userAgent]
    ];
  }

  function render() {
    var rows = facts();
    UI.mount(host, [
      el('div.table-wrap', {}, [
        el('table.data', {}, [
          el('tbody', {}, rows.map(function (row) {
            return el('tr', {}, [
              el('td', { text: row[0] }),
              el('td', { style: 'word-break:break-word', text: row[1] })
            ]);
          }))
        ])
      ]),
      el('div.row.row--wrap', { style: 'margin-top:10px' }, [
        el('button.btn.btn--ghost.btn--sm', {
          type: 'button', text: '↻ Neu messen',
          onclick: function () { UI.probeScrolling(); render(); }
        }),
        el('button.btn.btn--ghost.btn--sm', {
          type: 'button', text: '⇩ Scroll-Ersatz erzwingen',
          onclick: function () {
            document.body.classList.add('is-dragscroll');
            UI.forceDragScroll();
            render();
            UI.toast('Scroll-Ersatz aktiv — mit dem Finger ziehen', 'good');
          }
        })
      ]),
      el('p.small.muted', { style: 'margin-top:8px',
        text: 'Diese Werte helfen beim Einordnen von Anzeigeproblemen — '
          + 'einfach abfotografieren und schicken.' })
    ]);
  }

  render();
  setTimeout(render, 1500);
})();
