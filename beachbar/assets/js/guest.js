/*
 * guest.js — the app a visitor gets after scanning the QR code on the umbrella.
 *
 * Routes (hash based): #menu, #cart, #orders, #order/<id>, #account
 */
(function () {
  'use strict';

  var el = UI.el, t = UI.t, tx = UI.tx, money = UI.money;
  var CART_KEY = 'bb.cart.v1';

  var view = UI.$('#view');
  var cartbar = UI.$('#cartbar');
  var chips = UI.$('#chips');

  var cart = loadCart();
  var activeCategory = 'all';

  /* Checkout form state — kept outside the view so a re-render (e.g. after
     saving a card) does not throw away what the guest already typed. */
  var draft = { note: '', music: '', payMode: null, wantsInvoice: null };

  // --- cart persistence ----------------------------------------------------

  function loadCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCartBar();
  }
  function addToCart(line) {
    var key = Store.lineKey(line);
    var existing = cart.find(function (l) { return Store.lineKey(l) === key; });
    if (existing) existing.qty += line.qty;
    else cart.push(line);
    saveCart();
  }
  function cartCount() {
    return cart.reduce(function (n, line) { return n + line.qty; }, 0);
  }

  // --- umbrella ------------------------------------------------------------

  function currentUmbrella() { return Store.device.umbrella; }

  function resolveUmbrella() {
    var fromUrl = UI.param('u');
    if (fromUrl && Number(fromUrl) > 0) {
      var n = Math.min(Number(fromUrl), Store.settings.umbrellaCount);
      if (n !== Store.device.umbrella) Store.saveDevice({ umbrella: n });
    }
  }

  function askUmbrella() {
    var input;
    var ref = UI.sheet({
      title: t('umbrella'),
      content: [
        el('p.muted', { text: UI.lang() === 'el'
          ? 'Σαρώστε τον κωδικό QR στην ομπρέλα σας ή δώστε τον αριθμό της.'
          : 'Scan the QR code on your umbrella, or type its number.' }),
        (input = el('input', { type: 'number', min: '1', max: String(Store.settings.umbrellaCount),
          inputmode: 'numeric', placeholder: '12', value: currentUmbrella() || '' }))
      ],
      footer: [el('button.btn.btn--primary.btn--block', {
        type: 'button', text: t('save'),
        onclick: function () {
          var n = Number(input.value);
          if (!n || n < 1 || n > Store.settings.umbrellaCount) {
            UI.toast(UI.lang() === 'el' ? 'Μη έγκυρος αριθμός' : 'Invalid number', 'danger');
            return;
          }
          Store.saveDevice({ umbrella: n });
          ref.close();
          render();
        }
      })]
    });
    setTimeout(function () { input.focus(); }, 220);
  }

  // --- shell ---------------------------------------------------------------

  function renderShell() {
    UI.$('#barName').textContent = Store.settings.barName;
    UI.$('#topSub').textContent = t('welcome');
    UI.mount(UI.$('#umbrellaBadge'), [
      document.createTextNode('⛱️ '),
      el('b', { text: currentUmbrella() ? String(currentUmbrella()) : '–' })
    ]);
    UI.$('#umbrellaBadge').onclick = askUmbrella;
    UI.mount(UI.$('#langHost'), [UI.langToggle(function () { renderShell(); render(); })]);
    UI.$('#btnOrders').onclick = function () { UI.go('orders'); };
    UI.$('#btnAccount').onclick = function () { UI.go('account'); };
    UI.$('#cartBtn').onclick = function () { UI.go('cart'); };
    renderCartBar();
  }

  function renderCartBar() {
    var count = cartCount();
    var onMenu = UI.route() !== 'cart';
    cartbar.classList.toggle('is-visible', count > 0 && onMenu);
    UI.$('#cartCount').textContent = count + ' ' + (count === 1 ? t('item') : t('items'));
    UI.$('#cartSum').textContent = money(Store.cartTotal(cart));
  }

  function renderChips() {
    var show = UI.route() === '' || UI.route() === 'menu';
    chips.classList.toggle('hidden', !show);
    if (!show) return;
    var all = [{ id: 'all', icon: '🌴', name: { en: 'All', el: 'Όλα' } }].concat(DATA.CATEGORIES);
    UI.mount(chips, all.map(function (cat) {
      return el('button.chip', {
        type: 'button',
        'aria-pressed': activeCategory === cat.id ? 'true' : 'false',
        onclick: function () { activeCategory = cat.id; render(); }
      }, [cat.icon + ' ' + tx(cat.name)]);
    }));
  }

  // --- menu ----------------------------------------------------------------

  function viewMenu() {
    var items = DATA.MENU.filter(function (item) {
      return activeCategory === 'all' || item.cat === activeCategory;
    });
    var groups = [];
    DATA.CATEGORIES.forEach(function (cat) {
      var list = items.filter(function (item) { return item.cat === cat.id; });
      if (!list.length) return;
      groups.push(el('h2.section-title', { text: cat.icon + '  ' + tx(cat.name) }));
      groups.push(el('div.menu-list', {}, list.map(itemRow)));
    });
    UI.mount(view, [
      el('div.notice', { text: UI.lang() === 'el'
        ? 'Παραγγείλτε από την ξαπλώστρα σας — το φέρνουμε στην ομπρέλα ' + (currentUmbrella() || '?') + '.'
        : 'Order from your sunbed — we bring it to umbrella ' + (currentUmbrella() || '?') + '.' })
    ].concat(groups).concat([musicCard()]));
  }

  function itemRow(item) {
    return el('button.item', { type: 'button', onclick: function () { openItem(item); } }, [
      el('span.item__emoji', { text: item.emoji }),
      el('span.item__body', {}, [
        el('span.item__name', { text: tx(item.name) }),
        el('span.item__desc', { text: tx(item.desc) })
      ]),
      el('span.item__price', { text: money(item.price) }),
      el('span.item__add', { 'aria-hidden': 'true' }, ['+'])
    ]);
  }

  function openItem(item) {
    var options = {};
    (item.options || []).forEach(function (groupId) {
      var group = DATA.OPTION_GROUPS[groupId];
      options[groupId] = group.type === 'single' ? [group.choices[0].id] : [];
    });
    var qty = 1;
    var noteInput;
    var priceLabel = el('span');

    function refreshPrice() {
      priceLabel.textContent = money(Store.unitPrice(item.id, options) * qty);
    }

    var body = [];
    body.push(el('p.muted', { text: tx(item.desc) }));

    (item.options || []).forEach(function (groupId) {
      var group = DATA.OPTION_GROUPS[groupId];
      var list = el('div.opt-list');
      group.choices.forEach(function (choice) {
        var input = el('input', {
          type: group.type === 'single' ? 'radio' : 'checkbox',
          name: 'opt-' + groupId,
          checked: options[groupId].indexOf(choice.id) >= 0,
          onchange: function (event) {
            if (group.type === 'single') options[groupId] = [choice.id];
            else if (event.target.checked) options[groupId].push(choice.id);
            else options[groupId] = options[groupId].filter(function (id) { return id !== choice.id; });
            refreshPrice();
          }
        });
        list.appendChild(el('label.opt', {}, [
          input,
          el('span.opt__label', { text: tx(choice.name) }),
          choice.delta ? el('span.opt__delta', { text: '+' + money(choice.delta) }) : null
        ]));
      });
      body.push(el('div.opt-group', {}, [
        el('div.opt-group__head', {}, [
          el('span.opt-group__name', { text: tx(group.name) }),
          el('span.small.muted', { text: group.type === 'multi' ? t('optional') : '' })
        ]),
        list
      ]));
    });

    body.push(el('div.field', {}, [
      el('label.field__label', { text: t('note') + ' (' + t('optional') + ')' }),
      (noteInput = el('input', { type: 'text', placeholder: t('notePlaceholder') }))
    ]));

    var qtyOut = el('output', { text: '1' });
    body.push(el('div.row.row--between', {}, [
      el('span.field__label', { text: t('quantity') }),
      el('div.stepper', {}, [
        el('button', { type: 'button', 'aria-label': '-', onclick: function () {
          qty = Math.max(1, qty - 1); qtyOut.textContent = qty; refreshPrice();
        } }, ['−']),
        qtyOut,
        el('button', { type: 'button', 'aria-label': '+', onclick: function () {
          qty = Math.min(20, qty + 1); qtyOut.textContent = qty; refreshPrice();
        } }, ['+'])
      ])
    ]));

    var ref = UI.sheet({
      title: item.emoji + '  ' + tx(item.name),
      content: body,
      footer: [el('button.btn.btn--primary.btn--block', {
        type: 'button',
        onclick: function () {
          addToCart({ itemId: item.id, qty: qty, options: options, note: noteInput.value.trim() });
          ref.close();
          UI.toast(tx(item.name) + ' → ' + t('cart'), 'good');
        }
      }, [el('span', { text: t('addToCart') }), el('span.spacer'), priceLabel])]
    });
    refreshPrice();
  }

  function musicCard() {
    var input;
    return el('div.card', { style: 'margin-top:22px' }, [
      el('div.row', {}, [
        el('span', { style: 'font-size:1.6rem' }, ['🎵']),
        el('div', {}, [
          el('div.card__title', { text: t('musicWish') }),
          el('div.small.muted', { text: t('musicWishHint') })
        ])
      ]),
      el('div.row', { style: 'margin-top:12px;align-items:stretch' }, [
        (input = el('input', { type: 'text', placeholder: t('musicPlaceholder') })),
        el('button.btn.btn--primary', {
          type: 'button', text: t('sendWish'),
          onclick: function () {
            if (!currentUmbrella()) return askUmbrella();
            var request = Store.addMusicRequest({ umbrella: currentUmbrella(), text: input.value });
            if (!request) return;
            input.value = '';
            UI.toast(t('wishSent'), 'good');
          }
        })
      ])
    ]);
  }

  // --- cart ----------------------------------------------------------------

  function viewCart() {
    if (!cart.length) {
      UI.mount(view, [
        el('div.empty', {}, [
          el('span.empty__emoji', { text: '🛒' }),
          el('h2', { text: t('emptyCart') }),
          el('p.muted', { text: t('emptyCartHint') }),
          el('button.btn.btn--primary', { type: 'button', text: t('menu'),
            onclick: function () { UI.go('menu'); } })
        ])
      ]);
      return;
    }

    var noteInput, musicInput, emailWanted;
    if (!draft.payMode) draft.payMode = Store.device.card ? 'card' : 'tab';
    if (draft.wantsInvoice === null) draft.wantsInvoice = !!Store.device.email;

    var lines = el('div.card', {}, cart.map(function (line, index) {
      return el('div.line', {}, [
        el('div.line__body', {}, [
          el('div.line__name', { text: UI.itemName(line.itemId) }),
          el('div.line__opts', { text: UI.optionSummary(line) }),
          el('div.row', { style: 'margin-top:6px' }, [
            el('div.stepper', {}, [
              el('button', { type: 'button', 'aria-label': '-', onclick: function () {
                if (line.qty > 1) line.qty--; else cart.splice(index, 1);
                saveCart(); render();
              } }, ['−']),
              el('output', { text: String(line.qty) }),
              el('button', { type: 'button', 'aria-label': '+', onclick: function () {
                line.qty++; saveCart(); render();
              } }, ['+'])
            ])
          ])
        ]),
        el('div.line__price', { text: money(Store.lineTotal(line)) })
      ]);
    }));

    var total = Store.cartTotal(cart);

    var payChoices = el('div.opt-list');
    [
      { id: 'card', label: Store.device.card
          ? t('payNow') + ' · ' + Store.device.card.last4Label
          : t('payNow'), hint: Store.device.card ? '' : t('addCard') },
      { id: 'tab', label: t('payTab'), hint: t('payTabHint') },
      { id: 'cash', label: t('payCash'), hint: '' }
    ].forEach(function (choice) {
      payChoices.appendChild(el('label.opt', {}, [
        el('input', {
          type: 'radio', name: 'pay', checked: draft.payMode === choice.id,
          onchange: function () { draft.payMode = choice.id; }
        }),
        el('span.opt__label', {}, [
          el('div', { text: choice.label }),
          choice.hint ? el('div.small.muted', { text: choice.hint }) : null
        ])
      ]));
    });

    UI.mount(view, [
      el('div.row.row--between', {}, [
        el('h1', { style: 'font-size:1.3rem', text: t('cart') }),
        el('button.link-btn', { type: 'button', text: '＋ ' + t('menu'),
          onclick: function () { UI.go('menu'); } })
      ]),
      lines,
      el('div.card', {}, [
        el('div.field', {}, [
          el('label.field__label', { text: t('note') + ' (' + t('optional') + ')' }),
          (noteInput = el('textarea', { placeholder: t('notePlaceholder'), text: draft.note,
            oninput: function () { draft.note = this.value; } }))
        ]),
        el('div.field', {}, [
          el('label.field__label', { text: '🎵 ' + t('musicWish') + ' (' + t('optional') + ')' }),
          (musicInput = el('input', { type: 'text', placeholder: t('musicPlaceholder'),
            value: draft.music,
            oninput: function () { draft.music = this.value; } }))
        ])
      ]),
      el('h2.section-title', { text: t('paymentMethod') }),
      el('div.card', {}, [
        payChoices,
        Store.device.card ? null : el('button.btn.btn--ghost.btn--block', {
          type: 'button', text: '＋ ' + t('addCard'), style: 'margin-top:10px',
          onclick: function () {
            openCardSheet(function () { draft.payMode = 'card'; render(); });
          }
        }),
        el('label.opt', { style: 'margin-top:10px' }, [
          (emailWanted = el('input', { type: 'checkbox', checked: draft.wantsInvoice,
            onchange: function () { draft.wantsInvoice = this.checked; } })),
          el('span.opt__label', {}, [
            el('div', { text: '✉️ ' + t('invoiceEmail') }),
            el('div.small.muted', { text: Store.device.email || t('emailPlaceholder') })
          ])
        ])
      ]),
      el('div.card', {}, [
        el('div.totals', {}, [
          el('div.totals__row.totals__row--big', {}, [
            el('span', { text: t('total') }), el('span', { text: money(total) })
          ]),
          el('div.totals__row.small.muted', {}, [
            el('span', { text: t('vatIncluded') }),
            el('span', { text: money(total - total / (1 + Store.settings.vat)) })
          ])
        ]),
        el('button.btn.btn--primary.btn--block', {
          type: 'button', style: 'margin-top:14px',
          text: t('orderNow') + ' · ' + money(total),
          onclick: function () {
            submitOrder({
              payMode: draft.payMode,
              note: noteInput.value,
              music: musicInput.value,
              wantsInvoice: emailWanted.checked
            });
          }
        }),
        el('p.small.muted.center', { style: 'margin:10px 0 0', text: t('demoNotice') })
      ])
    ]);
  }

  // --- checkout ------------------------------------------------------------

  function submitOrder(options) {
    if (!currentUmbrella()) return askUmbrella();
    if (!cart.length) return;

    var total = Store.cartTotal(cart);

    if (options.payMode === 'card' && !Store.device.card) {
      return openCardSheet(function () { submitOrder(options); });
    }

    var finish = function (paymentInfo) {
      var order = Store.placeOrder({
        umbrella: currentUmbrella(),
        lines: cart,
        note: options.note,
        guestName: Store.device.guestName,
        channel: 'qr',
        payment: paymentInfo
      });
      if (options.music && options.music.trim()) {
        Store.addMusicRequest({ umbrella: currentUmbrella(), text: options.music });
      }
      cart = [];
      saveCart();
      draft = { note: '', music: '', payMode: null, wantsInvoice: null };
      if (options.wantsInvoice) {
        openInvoiceSheet([order.id], order.total, function () { UI.go('order/' + order.id); });
      } else {
        UI.go('order/' + order.id);
      }
      UI.toast(t('orderPlaced'), 'good');
    };

    if (options.payMode === 'card') {
      runFakePayment(total, function () {
        finish({ mode: 'card', status: 'paid', card: Store.device.card.last4Label, paidAt: Date.now() });
      });
    } else {
      finish({ mode: options.payMode, status: 'open' });
    }
  }

  /* Fake card processing — a spinner, a delay, always approved. */
  function runFakePayment(amount, done) {
    var ref = UI.sheet({
      title: t('payment'),
      content: [
        el('div.center', { style: 'padding:22px 0' }, [
          el('div', { style: 'font-size:2.2rem' }, ['💳']),
          el('h3', { style: 'margin:10px 0 4px', text: money(amount) }),
          el('p.muted', { text: t('paying') }),
          el('div', { style: 'margin-top:14px' }, [el('span.spinner', { style: 'border-top-color:var(--brand)' })])
        ]),
        el('p.small.muted.center', { text: t('demoNotice') })
      ]
    });
    setTimeout(function () {
      ref.close();
      done();
    }, 1400);
  }

  function openCardSheet(done) {
    var holder, number, expiry, cvc;
    var ref = UI.sheet({
      title: t('addCard'),
      content: [
        el('div.card-visual', {}, [
          el('div.card-visual__num', { text: '•••• •••• •••• 4242' }),
          el('div.card-visual__row', {}, [
            el('span', { text: Store.device.guestName || 'YOUR NAME' }),
            el('span', { text: '12/29' })
          ])
        ]),
        el('div.field', { style: 'margin-top:14px' }, [
          el('label.field__label', { text: t('cardHolder') }),
          (holder = el('input', { type: 'text', placeholder: 'Maria Papadopoulou',
            value: Store.device.guestName || '' }))
        ]),
        el('div.field', {}, [
          el('label.field__label', { text: t('cardNumber') }),
          (number = el('input', { type: 'tel', inputmode: 'numeric', placeholder: '4242 4242 4242 4242' }))
        ]),
        el('div.row', {}, [
          el('div.field', { style: 'flex:1' }, [
            el('label.field__label', { text: t('expiry') }),
            (expiry = el('input', { type: 'text', placeholder: '12/29' }))
          ]),
          el('div.field', { style: 'flex:1' }, [
            el('label.field__label', { text: t('cvc') }),
            (cvc = el('input', { type: 'tel', inputmode: 'numeric', placeholder: '123' }))
          ])
        ]),
        el('p.small.muted', { text: t('demoNotice') })
      ],
      footer: [el('button.btn.btn--primary.btn--block', {
        type: 'button', text: t('save'),
        onclick: function () {
          var digits = (number.value || '4242424242424242').replace(/\D/g, '');
          var last4 = digits.slice(-4) || '4242';
          Store.saveDevice({
            guestName: holder.value.trim() || Store.device.guestName,
            card: {
              holder: holder.value.trim(),
              last4: last4,
              last4Label: '•••• ' + last4,
              brand: digits[0] === '5' ? 'Mastercard' : 'Visa',
              expiry: expiry.value.trim() || '12/29'
            }
          });
          ref.close();
          UI.toast(t('cardStored'), 'good');
          if (done) done();
        }
      })]
    });
  }

  function openInvoiceSheet(orderIds, total, done) {
    var emailInput;
    var orders = orderIds.map(Store.getOrder).filter(Boolean);
    var net = total / (1 + Store.settings.vat);

    var receipt = el('div.card.card--flat', { style: 'background:var(--surface-2)' }, [
      el('div.row.row--between', {}, [
        el('b', { text: Store.settings.barName }),
        el('span.small.muted', { text: UI.clock(Date.now()) })
      ]),
      el('div.small.muted', { text: t('umbrella') + ' ' + (currentUmbrella() || '–') })
    ].concat(orders.map(function (order) {
      return el('div', { style: 'margin-top:10px' }, [
        el('div.small.muted', { text: order.id })
      ].concat(order.lines.map(function (line) {
        return el('div.row.row--between.small', {}, [
          el('span', { text: line.qty + '× ' + UI.itemName(line.itemId) }),
          el('span.tabular', { text: money(Store.lineTotal(line)) })
        ]);
      })));
    })).concat([
      el('hr', { style: 'border:0;border-top:1px solid var(--border);margin:10px 0' }),
      el('div.row.row--between.small', {}, [
        el('span', { text: 'Netto' }), el('span.tabular', { text: money(net) })
      ]),
      el('div.row.row--between.small', {}, [
        el('span', { text: 'VAT 24%' }), el('span.tabular', { text: money(total - net) })
      ]),
      el('div.row.row--between', { style: 'font-weight:700' }, [
        el('span', { text: t('total') }), el('span.tabular', { text: money(total) })
      ])
    ]));

    var ref = UI.sheet({
      title: t('invoiceEmail'),
      content: [
        receipt,
        el('div.field', { style: 'margin-top:14px' }, [
          el('label.field__label', { text: 'E-Mail' }),
          (emailInput = el('input', { type: 'email', placeholder: t('emailPlaceholder'),
            value: Store.device.email || '' }))
        ]),
        el('p.small.muted', { text: t('demoNotice') })
      ],
      footer: [
        el('button.btn.btn--ghost', { type: 'button', text: t('close'),
          onclick: function () { ref.close(); if (done) done(); } }),
        el('button.btn.btn--primary', {
          type: 'button', text: t('sendInvoice'),
          onclick: function () {
            var email = (emailInput.value || '').trim();
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
              UI.toast(UI.lang() === 'el' ? 'Μη έγκυρο e-mail' : 'Invalid e-mail', 'danger');
              return;
            }
            Store.saveDevice({ email: email });
            Store.sendInvoice({ email: email, umbrella: currentUmbrella(),
              orderIds: orderIds, total: total });
            ref.close();
            UI.toast(t('invoiceSent') + ' ' + email, 'good');
            if (done) done();
          }
        })
      ],
      onClose: null
    });
  }

  // --- orders --------------------------------------------------------------

  function viewOrders() {
    var orders = Store.ordersForUmbrella(currentUmbrella());
    var tab = Store.tabFor(currentUmbrella());

    var head = [el('h1', { style: 'font-size:1.3rem;margin-bottom:10px', text: t('yourOrders') })];

    if (tab.total > 0) {
      head.push(el('div.card', {}, [
        el('div.row.row--between', {}, [
          el('div', {}, [
            el('div.card__title', { text: t('openTab') }),
            el('div.small.muted', { text: tab.orders.length + ' ' + t('orders') })
          ]),
          el('div', { style: 'font-size:1.4rem;font-weight:700' }, [money(tab.total)])
        ]),
        el('div.row', { style: 'margin-top:12px' }, [
          el('button.btn.btn--primary', {
            type: 'button', text: t('payTabNow') + ' · ' + money(tab.total),
            style: 'flex:1',
            onclick: function payTab() {
              // no card yet → ask for one, then come straight back to the payment
              if (!Store.device.card) return openCardSheet(payTab);
              runFakePayment(tab.total, function () {
                var ids = tab.orders.map(function (o) { return o.id; });
                Store.markPaid(ids, { mode: 'card', card: Store.device.card.last4Label });
                UI.toast(t('paid'), 'good');
                openInvoiceSheet(ids, tab.total, null);
              });
            }
          }),
          el('button.btn.btn--ghost', {
            type: 'button', text: '✉️',
            'aria-label': t('invoiceEmail'),
            onclick: function () {
              openInvoiceSheet(tab.orders.map(function (o) { return o.id; }), tab.total, null);
            }
          })
        ])
      ]));
    }

    if (!orders.length) {
      head.push(el('div.empty', {}, [
        el('span.empty__emoji', { text: '🧾' }),
        el('p', { text: t('noOrders') })
      ]));
    }

    UI.mount(view, head.concat(orders.map(orderCard)));
  }

  function orderCard(order) {
    return el('button.card', {
      type: 'button', style: 'width:100%;text-align:left;cursor:pointer',
      onclick: function () { UI.go('order/' + order.id); }
    }, [
      el('div.row.row--between', {}, [
        el('div.row', {}, [
          el('span.pill.pill--' + order.status, { text: UI.statusLabel(order.status) }),
          el('span.small.muted', { text: UI.clock(order.createdAt) })
        ]),
        el('b.tabular', { text: money(order.total) })
      ]),
      el('div.small.muted', { style: 'margin-top:6px', text: order.lines.map(function (line) {
        return line.qty + '× ' + UI.itemName(line.itemId);
      }).join(', ') }),
      el('div.row', { style: 'margin-top:8px' }, [
        el('span.small.muted', { text: order.id }),
        el('span.spacer'),
        el('span.pill.pill--' + (order.payment.status === 'paid' ? 'paid' : 'open'), {
          text: order.payment.status === 'paid' ? t('paid') : t('open')
        })
      ])
    ]);
  }

  function viewOrderDetail(orderId) {
    var order = Store.getOrder(orderId);
    if (!order) { UI.go('orders'); return; }

    var steps = ['new', 'preparing', 'ready', 'served'];
    var currentIndex = steps.indexOf(order.status);
    var stamps = { new: order.createdAt, preparing: order.acceptedAt, ready: order.readyAt, served: order.servedAt };

    var timeline = el('div.timeline');
    steps.forEach(function (status, index) {
      var done = order.status !== 'cancelled' && index < currentIndex;
      var current = index === currentIndex;
      timeline.appendChild(el('div.tl-step' + (done ? '.is-done' : '') + (current ? '.is-current' : ''), {}, [
        el('div.tl-step__dot', { text: done ? '✓' : '' }),
        el('div', {}, [
          el('div.tl-step__label', { text: UI.statusLabel(status) }),
          stamps[status] ? el('div.tl-step__time', { text: UI.clock(stamps[status]) }) : null
        ])
      ]));
      if (index < steps.length - 1) {
        timeline.appendChild(el('div.tl-step__rail' + (done ? '.is-done' : '')));
      }
    });

    var etaMinutes = Math.max(1, Math.round(
      (order.createdAt + Store.settings.avgPrepMinutes * 60000 - Date.now()) / 60000));

    UI.mount(view, [
      el('div.row.row--between', {}, [
        el('button.link-btn', { type: 'button', text: '← ' + t('yourOrders'),
          onclick: function () { UI.go('orders'); } }),
        el('span.pill.pill--' + order.status, { text: UI.statusLabel(order.status) })
      ]),
      el('div.card', { style: 'margin-top:10px' }, [
        el('div.row.row--between', {}, [
          el('h2', { style: 'font-size:1.1rem', text: t('orderPlaced') }),
          el('span.small.muted', { text: order.id })
        ]),
        el('p.small.muted', { text: t('orderPlacedHint') }),
        order.status !== 'served' && order.status !== 'cancelled'
          ? el('div.notice', { text: '⏱️ ' + t('eta') + ': ~' + etaMinutes + ' ' + t('minutes') })
          : null,
        el('div', { style: 'margin-top:14px' }, [timeline])
      ]),
      el('div.card', {}, order.lines.map(function (line) {
        return el('div.line', {}, [
          el('div.line__qty', { text: line.qty + '×' }),
          el('div.line__body', {}, [
            el('div.line__name', { text: UI.itemName(line.itemId) }),
            el('div.line__opts', { text: UI.optionSummary(line) })
          ]),
          el('div.line__price', { text: money(Store.lineTotal(line)) })
        ]);
      }).concat([
        order.note ? el('div.ticket__note', { text: '📝 ' + order.note }) : null,
        el('div.totals', {}, [
          el('div.totals__row.totals__row--big', {}, [
            el('span', { text: t('total') }), el('span', { text: money(order.total) })
          ]),
          el('div.totals__row.small.muted', {}, [
            el('span', { text: t('payment') }),
            el('span', { text: (order.payment.card || t('pay' + (order.payment.mode === 'cash' ? 'Cash' : 'Tab')))
              + ' · ' + (order.payment.status === 'paid' ? t('paid') : t('open')) })
          ])
        ]),
        el('div.row', { style: 'margin-top:12px' }, [
          order.payment.status !== 'paid' ? el('button.btn.btn--primary', {
            type: 'button', text: t('payNow'), style: 'flex:1',
            onclick: function () {
              if (!Store.device.card) return openCardSheet(function () { render(); });
              runFakePayment(order.total, function () {
                Store.markPaid([order.id], { mode: 'card', card: Store.device.card.last4Label });
                UI.toast(t('paid'), 'good');
              });
            }
          }) : null,
          el('button.btn.btn--ghost', {
            type: 'button', text: '✉️ ' + t('invoice'), style: 'flex:1',
            onclick: function () { openInvoiceSheet([order.id], order.total, null); }
          })
        ])
      ]))
    ]);
  }

  // --- account -------------------------------------------------------------

  function viewAccount() {
    var nameInput, emailInput;
    UI.mount(view, [
      el('h1', { style: 'font-size:1.3rem;margin-bottom:10px', text: t('account') }),
      el('div.card', {}, [
        el('div.field', {}, [
          el('label.field__label', { text: t('cardHolder') }),
          (nameInput = el('input', { type: 'text', value: Store.device.guestName || '',
            placeholder: 'Maria' }))
        ]),
        el('div.field', {}, [
          el('label.field__label', { text: 'E-Mail' }),
          (emailInput = el('input', { type: 'email', value: Store.device.email || '',
            placeholder: t('emailPlaceholder') }))
        ]),
        el('button.btn.btn--primary', {
          type: 'button', text: t('save'),
          onclick: function () {
            Store.saveDevice({ guestName: nameInput.value.trim(), email: emailInput.value.trim() });
            UI.toast(t('save') + ' ✓', 'good');
          }
        })
      ]),
      el('h2.section-title', { text: t('paymentMethod') }),
      el('div.card', {}, Store.device.card ? [
        el('div.card-visual', {}, [
          el('div.card-visual__num', { text: '•••• •••• •••• ' + Store.device.card.last4 }),
          el('div.card-visual__row', {}, [
            el('span', { text: (Store.device.card.holder || '—').toUpperCase() }),
            el('span', { text: Store.device.card.expiry })
          ])
        ]),
        el('p.small.muted', { style: 'margin-top:10px', text: t('cardStored') }),
        el('button.btn.btn--danger.btn--block', {
          type: 'button', text: t('removeCard'),
          onclick: function () { Store.saveDevice({ card: null }); render(); }
        })
      ] : [
        el('p.muted', { text: t('demoNotice') }),
        el('button.btn.btn--primary.btn--block', { type: 'button', text: '＋ ' + t('addCard'),
          onclick: function () { openCardSheet(function () { render(); }); } })
      ]),
      el('h2.section-title', { text: t('umbrella') }),
      el('div.card', {}, [
        el('div.row.row--between', {}, [
          el('span', { text: t('umbrella') + ' ' + (currentUmbrella() || '–') }),
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: t('save'), onclick: askUmbrella })
        ])
      ]),
      el('p.small.muted.center', { style: 'margin-top:22px' }, [
        document.createTextNode(t('demoNotice') + ' '),
        el('a', { href: 'index.html', text: '← Prototype start' })
      ])
    ]);
  }

  // --- router --------------------------------------------------------------

  function render() {
    var here = UI.route();
    renderChips();
    renderCartBar();
    if (here.indexOf('order/') === 0) viewOrderDetail(here.slice(6));
    else if (here === 'cart') viewCart();
    else if (here === 'orders') viewOrders();
    else if (here === 'account') viewAccount();
    else viewMenu();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function boot() {
    UI.applyLang();
    resolveUmbrella();
    Store.seedDemo();
    renderShell();
    render();
    if (!currentUmbrella()) askUmbrella();

    window.addEventListener('hashchange', render);
    Store.subscribe(function (state, reason) {
      // a status change from the bar should show up here immediately
      if (reason === 'order:status' || reason === 'payment' || reason === 'remote') {
        var here = UI.route();
        if (here.indexOf('order/') === 0 || here === 'orders') render();
      }
    });
    // keep the ETA countdown fresh
    setInterval(function () {
      if (UI.route().indexOf('order/') === 0) render();
    }, 30000);
  }

  boot();
})();
