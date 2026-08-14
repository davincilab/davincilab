/*
 * bar.js — the station behind the counter: incoming tickets, preparation,
 * delivery, music requests, umbrella overview and manual orders.
 */
(function () {
  'use strict';

  var el = UI.el, t = UI.t, tx = UI.tx, money = UI.money;
  var view = UI.$('#view');
  var tabsHost = UI.$('#tabs');

  var LATE_AFTER_MS = 6 * 60000;   // a ticket older than this shouts for help
  var tab = 'orders';
  var umbrellaFilter = 'all';
  var stationFilter = 'all';
  var lastSeenOrderId = null;

  var TABS = [
    { id: 'orders', icon: '🧾', label: function () { return t('orders'); } },
    { id: 'music', icon: '🎵', label: function () { return t('music'); } },
    { id: 'umbrellas', icon: '⛱️', label: function () { return t('umbrellas'); } }
  ];

  var STATIONS = [
    { id: 'all', name: { en: 'All stations', el: 'Όλοι οι σταθμοί' } },
    { id: 'bar', name: { en: 'Bar', el: 'Μπαρ' } },
    { id: 'cocktail', name: { en: 'Cocktails', el: 'Κοκτέιλ' } },
    { id: 'kitchen', name: { en: 'Kitchen', el: 'Κουζίνα' } }
  ];

  // --- shell ---------------------------------------------------------------

  function renderShell() {
    UI.$('#barName').textContent = Store.settings.barName;
    UI.$('#topSub').textContent = t('appBar');
    UI.mount(UI.$('#langHost'), [UI.langToggle(function () { renderShell(); render(); })]);

    var soundBtn = UI.$('#btnSound');
    soundBtn.textContent = Store.device.sound ? '🔔' : '🔕';
    soundBtn.onclick = function () {
      Store.saveDevice({ sound: !Store.device.sound });
      soundBtn.textContent = Store.device.sound ? '🔔' : '🔕';
      if (Store.device.sound) UI.beep();
    };

    UI.mount(tabsHost, TABS.map(function (entry) {
      return el('button.tab', {
        type: 'button', role: 'tab',
        'aria-selected': tab === entry.id ? 'true' : 'false',
        onclick: function () { tab = entry.id; renderShell(); render(); }
      }, [entry.icon + '  ' + entry.label()]);
    }));
  }

  // --- orders board --------------------------------------------------------

  function matchesFilters(order) {
    if (umbrellaFilter !== 'all' && order.umbrella !== Number(umbrellaFilter)) return false;
    if (stationFilter !== 'all') {
      var hit = order.lines.some(function (line) {
        var item = DATA.MENU_BY_ID[line.itemId];
        return item && item.station === stationFilter;
      });
      if (!hit) return false;
    }
    return true;
  }

  function viewOrders() {
    var orders = Store.state.orders.filter(matchesFilters);
    var columns = [
      { status: 'new', title: t('newOrders'), next: t('accept') },
      { status: 'preparing', title: t('inPreparation'), next: t('markReady') },
      { status: 'ready', title: t('ready'), next: t('markServed') },
      { status: 'served', title: t('done'), next: null }
    ];

    var board = el('div.board', {}, columns.map(function (column) {
      var list = orders.filter(function (order) { return order.status === column.status; });
      if (column.status === 'served') list = list.slice(0, 8);
      return el('div.column', {}, [
        el('div.column__head', {}, [
          el('span.column__title', { text: column.title }),
          el('span.column__count', { text: String(list.length) })
        ]),
        el('div.column__list', {}, list.length
          ? list.map(function (order) { return ticket(order, column.next); })
          : [el('p.small.muted', { style: 'padding:6px 4px',
              text: column.status === 'served' ? t('noData') : t('noOpenOrders') })])
      ]);
    }));

    UI.mount(view, [toolbar(), board]);
  }

  function toolbar() {
    var umbrellaSelect = el('select', {
      'aria-label': t('umbrella'),
      style: 'width:auto;min-width:150px',
      onchange: function (event) { umbrellaFilter = event.target.value; render(); }
    }, [el('option', { value: 'all', text: '⛱️ ' + t('allUmbrellas'),
      selected: umbrellaFilter === 'all' })].concat(
      Array.from({ length: Store.settings.umbrellaCount }, function (_, i) {
        return el('option', { value: String(i + 1), text: t('umbrella') + ' ' + (i + 1),
          selected: String(i + 1) === String(umbrellaFilter) });
      })
    ));

    var stationSeg = el('div.seg.seg--plain', { role: 'group' }, STATIONS.map(function (station) {
      return el('button.seg__btn', {
        type: 'button',
        'aria-pressed': stationFilter === station.id ? 'true' : 'false',
        text: tx(station.name),
        onclick: function () { stationFilter = station.id; render(); }
      });
    }));

    var open = Store.openOrders().length;

    return el('div.row.row--wrap', { style: 'margin-bottom:14px;gap:10px' }, [
      el('button.btn.btn--primary', { type: 'button', text: '＋ ' + t('manualOrder'),
        onclick: openManualOrder }),
      umbrellaSelect,
      stationSeg,
      el('span.spacer'),
      el('span.pill', { text: t('openOrders') + ': ' + open })
    ]);
  }

  function ticket(order, nextLabel) {
    var since = Date.now() - (order.acceptedAt || order.createdAt);
    var late = order.status !== 'served' && since > LATE_AFTER_MS;

    return el('article.ticket.ticket--' + order.status + (late ? '.ticket--late' : ''), {}, [
      el('div.ticket__head', {}, [
        el('span.ticket__umbrella', { text: '⛱️ ' + order.umbrella }),
        el('span.ticket__id', { text: order.id }),
        el('span.spacer'),
        el('span.ticket__timer' + (late ? '.is-late' : ''), { text: UI.timeAgo(order.createdAt) })
      ]),
      el('div.ticket__lines', {}, order.lines.map(function (line) {
        var summary = UI.optionSummary(line);
        return el('div.ticket__line', {}, [
          el('b', { text: line.qty + '×' }),
          el('span', {}, [
            el('span', { text: UI.itemName(line.itemId) }),
            summary ? el('span.small.muted', { text: ' — ' + summary }) : null
          ])
        ]);
      })),
      order.note ? el('div.ticket__note', { text: '📝 ' + order.note }) : null,
      el('div.row.row--between.small.muted', {}, [
        el('span', { text: UI.clock(order.createdAt) + ' · ' + (order.channel === 'manual' ? '👤' : '📱') }),
        el('span', {}, [
          el('span.pill.pill--' + (order.payment.status === 'paid' ? 'paid' : 'open'), {
            text: (order.payment.status === 'paid' ? t('paid') : t('open')) +
              (order.payment.card ? ' · ' + order.payment.card : '')
          }),
          document.createTextNode(' '),
          el('b.tabular', { text: money(order.total) })
        ])
      ]),
      el('div.ticket__foot', {}, [
        nextLabel ? el('button.btn.btn--primary.btn--sm', {
          type: 'button', text: nextLabel, style: 'flex:1',
          onclick: function () { Store.advanceOrder(order.id); }
        }) : el('span.small.muted', { text: UI.statusLabel(order.status), style: 'flex:1' }),
        order.status !== 'served' ? el('button.btn.btn--ghost.btn--sm', {
          type: 'button', text: '✕', 'aria-label': t('cancel'),
          onclick: function () {
            UI.confirmSheet(t('cancel') + ' ' + order.id,
              UI.lang() === 'el' ? 'Ακύρωση αυτής της παραγγελίας;' : 'Cancel this order?',
              t('cancel'), function () { Store.cancelOrder(order.id); });
          }
        }) : null,
        order.payment.status !== 'paid' && order.status !== 'served' ? el('button.btn.btn--ghost.btn--sm', {
          type: 'button', text: '💶', 'aria-label': t('paid'),
          onclick: function () {
            Store.markPaid([order.id], { mode: 'cash' });
            UI.toast(t('paid') + ' · ' + order.id, 'good');
          }
        }) : null
      ])
    ]);
  }

  // --- manual order --------------------------------------------------------

  function openManualOrder() {
    var lines = [];
    var umbrella = umbrellaFilter !== 'all' ? Number(umbrellaFilter) : null;
    var payMode = 'cash';
    var category = 'all';
    var cartHost = el('div.card', { style: 'margin-top:12px' });
    var totalLabel = el('span');
    var umbrellaSelect;

    function refreshCart() {
      var total = Store.cartTotal(lines);
      totalLabel.textContent = money(total);
      UI.mount(cartHost, lines.length ? lines.map(function (line, index) {
        return el('div.line', {}, [
          el('div.line__qty', { text: line.qty + '×' }),
          el('div.line__body', {}, [
            el('div.line__name', { text: UI.itemName(line.itemId) }),
            el('div.line__opts', { text: UI.optionSummary(line) })
          ]),
          el('div.line__price', { text: money(Store.lineTotal(line)) }),
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: '✕',
            'aria-label': t('cancel'),
            onclick: function () { lines.splice(index, 1); refreshCart(); } })
        ]);
      }) : [el('p.small.muted', { text: t('emptyCart') })]);
    }

    function itemButton(item) {
      return el('button.item', { type: 'button', onclick: function () {
        var options = {};
        (item.options || []).forEach(function (groupId) {
          var group = DATA.OPTION_GROUPS[groupId];
          options[groupId] = group.type === 'single' ? [group.choices[0].id] : [];
        });
        if ((item.options || []).length) {
          openOptionPicker(item, options, function (chosen, note) {
            pushLine(item, chosen, note);
          });
        } else {
          pushLine(item, {}, '');
        }
      } }, [
        el('span.item__emoji', { text: item.emoji }),
        el('span.item__body', {}, [
          el('span.item__name', { text: tx(item.name) }),
          el('span.item__desc', { text: money(item.price) })
        ]),
        el('span.item__add', { 'aria-hidden': 'true' }, ['+'])
      ]);
    }

    function pushLine(item, options, note) {
      var line = { itemId: item.id, qty: 1, options: options, note: note || '' };
      var key = Store.lineKey(line);
      var existing = lines.find(function (l) { return Store.lineKey(l) === key; });
      if (existing) existing.qty++; else lines.push(line);
      refreshCart();
    }

    var menuHost = el('div.menu-list');
    function refreshMenu() {
      UI.mount(menuHost, DATA.MENU
        .filter(function (item) { return category === 'all' || item.cat === category; })
        .map(itemButton));
    }

    var catChips = el('div.row.row--wrap', { style: 'gap:6px;margin:10px 0' },
      [{ id: 'all', icon: '🌴', name: { en: 'All', el: 'Όλα' } }].concat(DATA.CATEGORIES)
        .map(function (cat) {
          return el('button.chip', {
            type: 'button', 'aria-pressed': category === cat.id ? 'true' : 'false',
            text: cat.icon + ' ' + tx(cat.name),
            onclick: function () {
              category = cat.id;
              UI.$$('.chip', catChips).forEach(function (chip) {
                chip.setAttribute('aria-pressed', 'false');
              });
              this.setAttribute('aria-pressed', 'true');
              refreshMenu();
            }
          });
        }));

    var paySeg = el('div.seg.seg--plain', { role: 'group' }, [
      { id: 'cash', label: t('payCash') },
      { id: 'card', label: t('card') },
      { id: 'tab', label: t('payTab') }
    ].map(function (choice) {
      return el('button.seg__btn', {
        type: 'button', text: choice.label,
        'aria-pressed': payMode === choice.id ? 'true' : 'false',
        onclick: function () {
          payMode = choice.id;
          UI.$$('.seg__btn', paySeg).forEach(function (btn) { btn.setAttribute('aria-pressed', 'false'); });
          this.setAttribute('aria-pressed', 'true');
        }
      });
    }));

    var ref = UI.sheet({
      wide: true,
      title: '＋ ' + t('manualOrder'),
      content: [
        el('div.field', {}, [
          el('label.field__label', { text: t('umbrella') }),
          (umbrellaSelect = el('select', {
            onchange: function (event) { umbrella = Number(event.target.value) || null; }
          }, [el('option', { value: '', text: '—' })].concat(
            Array.from({ length: Store.settings.umbrellaCount }, function (_, i) {
              return el('option', { value: String(i + 1), text: t('umbrella') + ' ' + (i + 1),
                selected: umbrella === i + 1 });
            })
          )))
        ]),
        catChips,
        menuHost,
        el('h3.section-title', { text: t('cart') }),
        cartHost,
        el('div.row', { style: 'margin-top:12px' }, [
          el('span.field__label', { text: t('paymentMethod') }), paySeg
        ])
      ],
      footer: [
        el('button.btn.btn--ghost', { type: 'button', text: t('cancel'),
          onclick: function () { ref.close(); } }),
        el('button.btn.btn--primary', {
          type: 'button',
          onclick: function () {
            if (!umbrella) { UI.toast(t('umbrella') + '?', 'danger'); umbrellaSelect.focus(); return; }
            if (!lines.length) { UI.toast(t('emptyCart'), 'danger'); return; }
            Store.placeOrder({
              umbrella: umbrella, lines: lines, channel: 'manual', staff: 'bar',
              payment: {
                mode: payMode,
                status: payMode === 'tab' ? 'open' : 'paid',
                card: payMode === 'card' ? '•••• 4242' : null,
                paidAt: payMode === 'tab' ? null : Date.now()
              }
            });
            ref.close();
            UI.toast(t('orderPlaced') + ' · ⛱️ ' + umbrella, 'good');
          }
        }, [el('span', { text: t('orderNow') }), el('span.spacer'), totalLabel])
      ]
    });

    refreshMenu();
    refreshCart();
  }

  function openOptionPicker(item, options, done) {
    var noteInput;
    var body = [];
    (item.options || []).forEach(function (groupId) {
      var group = DATA.OPTION_GROUPS[groupId];
      var list = el('div.opt-list');
      group.choices.forEach(function (choice) {
        list.appendChild(el('label.opt', {}, [
          el('input', {
            type: group.type === 'single' ? 'radio' : 'checkbox',
            name: 'mopt-' + groupId,
            checked: options[groupId].indexOf(choice.id) >= 0,
            onchange: function (event) {
              if (group.type === 'single') options[groupId] = [choice.id];
              else if (event.target.checked) options[groupId].push(choice.id);
              else options[groupId] = options[groupId].filter(function (id) { return id !== choice.id; });
            }
          }),
          el('span.opt__label', { text: tx(choice.name) }),
          choice.delta ? el('span.opt__delta', { text: '+' + money(choice.delta) }) : null
        ]));
      });
      body.push(el('div.opt-group', {}, [
        el('div.opt-group__head', {}, [el('span.opt-group__name', { text: tx(group.name) })]),
        list
      ]));
    });
    body.push(el('div.field', {}, [
      el('label.field__label', { text: t('note') }),
      (noteInput = el('input', { type: 'text', placeholder: t('notePlaceholder') }))
    ]));

    var ref = UI.sheet({
      title: tx(item.name),
      content: body,
      footer: [el('button.btn.btn--primary.btn--block', {
        type: 'button', text: t('add'),
        onclick: function () { ref.close(); done(options, noteInput.value.trim()); }
      })]
    });
  }

  // --- music ---------------------------------------------------------------

  function viewMusic() {
    var requests = Store.state.music;
    UI.mount(view, [
      el('h1', { style: 'font-size:1.2rem;margin-bottom:12px', text: '🎵 ' + t('music') })
    ].concat(requests.length ? requests.map(function (request) {
      return el('div.card', { style: 'margin-bottom:10px' }, [
        el('div.row.row--between', {}, [
          el('div', {}, [
            el('div.card__title', { text: request.text }),
            el('div.small.muted', { text: '⛱️ ' + request.umbrella + ' · ' + UI.clock(request.createdAt) })
          ]),
          el('div.row', {}, request.status === 'new' ? [
            el('button.btn.btn--good.btn--sm', { type: 'button', text: '▶ ' + t('played'),
              onclick: function () { Store.setMusicStatus(request.id, 'played'); } }),
            el('button.btn.btn--ghost.btn--sm', { type: 'button', text: t('decline'),
              onclick: function () { Store.setMusicStatus(request.id, 'declined'); } })
          ] : [el('span.pill', { text: request.status === 'played' ? t('played') : t('decline') })])
        ])
      ]);
    }) : [el('div.empty', {}, [
      el('span.empty__emoji', { text: '🎧' }), el('p', { text: t('noData') })
    ])]));
  }

  // --- umbrellas -----------------------------------------------------------

  function viewUmbrellas() {
    var count = Store.settings.umbrellaCount;
    var byUmbrella = {};
    Store.state.orders.forEach(function (order) {
      if (order.status === 'cancelled') return;
      var entry = byUmbrella[order.umbrella] || (byUmbrella[order.umbrella] = { total: 0, open: 0, tab: 0 });
      entry.total += order.total;
      if (order.status !== 'served') entry.open++;
      if (order.payment.status !== 'paid') entry.tab += order.total;
    });

    var grid = el('div.umb-grid', {}, Array.from({ length: count }, function (_, index) {
      var no = index + 1;
      var entry = byUmbrella[no];
      return el('button.umb' + (entry && entry.open ? '.is-active' : ''), {
        type: 'button',
        dataset: { heat: entry ? String(Math.min(4, Math.ceil(entry.total / 25))) : '0' },
        onclick: function () { umbrellaFilter = String(no); tab = 'orders'; renderShell(); render(); }
      }, [
        el('span', { text: String(no) }),
        entry ? el('span.umb__sub', { text: money(entry.total) }) : null,
        entry && entry.open ? el('span.umb__sub', { text: '● ' + entry.open }) : null
      ]);
    }));

    UI.mount(view, [
      el('h1', { style: 'font-size:1.2rem;margin-bottom:6px', text: '⛱️ ' + t('umbrellas') }),
      el('p.small.muted', { text: UI.lang() === 'el'
        ? 'Πατήστε μια ομπρέλα για τις παραγγελίες της. Το χρώμα δείχνει τον τζίρο.'
        : 'Tap an umbrella to filter its orders. Colour shows revenue.' }),
      el('div.card', {}, [grid]),
      el('div.row.row--wrap', { style: 'margin-top:10px;gap:12px' }, [
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:var(--surface-2)' }), t('noData')]),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#cde2fb' }), '< 25 €']),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#5598e7' }), '< 75 €']),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#256abf' }), '≥ 75 €'])
      ])
    ]);
  }

  // --- router --------------------------------------------------------------

  function render() {
    if (tab === 'music') viewMusic();
    else if (tab === 'umbrellas') viewUmbrellas();
    else viewOrders();
  }

  function boot() {
    UI.applyLang();
    Store.seedDemo();
    var newest = Store.state.orders[0];
    lastSeenOrderId = newest ? newest.id : null;

    renderShell();
    render();

    Store.subscribe(function (state, reason) {
      if (reason === 'order:new' || reason === 'remote') {
        var latest = state.orders[0];
        if (latest && latest.id !== lastSeenOrderId && latest.status === 'new') {
          lastSeenOrderId = latest.id;
          UI.beep();
          UI.toast('⛱️ ' + latest.umbrella + ' · ' + t('newOrders'), 'good');
        }
      }
      render();
    });

    // keep the waiting timers moving
    setInterval(function () { if (tab === 'orders') render(); }, 15000);
  }

  boot();
})();
