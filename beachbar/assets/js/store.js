/*
 * store.js — shared state, persistence and live sync.
 *
 * The prototype has no backend. Everything lives in localStorage and is
 * broadcast to the other open tabs/windows of the same browser through
 * BroadcastChannel (plus the `storage` event as a fallback). Guest app, bar
 * station and dashboard therefore update each other in real time on one device
 * — enough to demo the whole workflow. Swapping `Store.save` for an API call
 * is the only change needed for a real deployment.
 */
(function (global) {
  'use strict';

  var STATE_KEY = 'bb.state.v1';
  var DEVICE_KEY = 'bb.device.v1';
  var CHANNEL = 'beachbar';

  var DEFAULT_STATE = {
    version: 1,
    settings: {
      barName: 'Blue Wave Beach Bar',
      umbrellaCount: 40,
      vat: 0.24,
      currency: '€',
      avgPrepMinutes: 8
    },
    seq: 0,
    orders: [],
    music: [],
    invoices: []
  };

  var DEFAULT_DEVICE = {
    lang: null,           // set on first run from the browser language
    umbrella: null,
    guestName: '',
    email: '',
    card: null,           // { holder, last4, brand, expiry }
    theme: null,
    sound: true,
    seenIntro: false
  };

  var listeners = [];
  var channel = null;
  var state = null;
  var device = null;

  /* localStorage is unavailable in sandboxed previews, private-mode quirks and
     some in-app file viewers — there we keep everything in memory instead, so
     the app runs (just without remembering anything between reloads). */
  var storage = (function () {
    try {
      var probe = 'bb.probe';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return localStorage;
    } catch (err) {
      var memory = {};
      return {
        getItem: function (key) { return key in memory ? memory[key] : null; },
        setItem: function (key, value) { memory[key] = String(value); },
        removeItem: function (key) { delete memory[key]; }
      };
    }
  })();

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function readJSON(key, fallback) {
    try {
      var raw = storage.getItem(key);
      if (!raw) return clone(fallback);
      var parsed = JSON.parse(raw);
      return Object.assign(clone(fallback), parsed);
    } catch (err) {
      console.warn('store: could not read', key, err);
      return clone(fallback);
    }
  }

  function writeJSON(key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('store: could not write', key, err);
    }
  }

  function emit(reason) {
    listeners.forEach(function (fn) {
      try { fn(state, reason); } catch (err) { console.error(err); }
    });
  }

  function broadcast(reason) {
    if (channel) {
      try { channel.postMessage({ type: 'state', reason: reason }); } catch (err) { /* ignore */ }
    }
  }

  function init() {
    state = readJSON(STATE_KEY, DEFAULT_STATE);
    device = readJSON(DEVICE_KEY, DEFAULT_DEVICE);
    if (!device.lang) {
      device.lang = (navigator.language || 'en').toLowerCase().indexOf('el') === 0 ? 'el' : 'en';
      writeJSON(DEVICE_KEY, device);
    }
    try {
      channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    } catch (err) {
      channel = null;   // blocked in opaque origins; single-window still works
    }
    if (channel) {
      channel.onmessage = function (event) {
        if (event.data && event.data.type === 'state') {
          state = readJSON(STATE_KEY, DEFAULT_STATE);
          emit(event.data.reason || 'remote');
        }
      };
    }
    global.addEventListener('storage', function (event) {
      if (event.key === STATE_KEY) {
        state = readJSON(STATE_KEY, DEFAULT_STATE);
        emit('remote');
      }
    });
  }

  function commit(reason) {
    writeJSON(STATE_KEY, state);
    emit(reason);
    broadcast(reason);
  }

  function saveDevice(patch, reason) {
    Object.assign(device, patch || {});
    writeJSON(DEVICE_KEY, device);
    emit(reason || 'device');
  }

  // --- money ---------------------------------------------------------------

  function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  function money(amount, lang) {
    var value = round2(amount || 0);
    return new Intl.NumberFormat(lang === 'el' ? 'el-GR' : 'en-IE',
      { style: 'currency', currency: 'EUR' }).format(value);
  }

  /* Unit price = base price + all selected option surcharges. */
  function unitPrice(itemId, options) {
    var item = DATA.MENU_BY_ID[itemId];
    if (!item) return 0;
    var price = item.price;
    Object.keys(options || {}).forEach(function (groupId) {
      var group = DATA.OPTION_GROUPS[groupId];
      if (!group) return;
      [].concat(options[groupId] || []).forEach(function (choiceId) {
        var choice = group.choices.find(function (c) { return c.id === choiceId; });
        if (choice) price += choice.delta || 0;
      });
    });
    return round2(price);
  }

  function lineTotal(line) { return round2(unitPrice(line.itemId, line.options) * line.qty); }

  function cartTotal(lines) {
    return round2((lines || []).reduce(function (sum, line) {
      return sum + lineTotal(line);
    }, 0));
  }

  /* Two lines merge when product, options and note are identical. */
  function lineKey(line) {
    var opts = Object.keys(line.options || {}).sort().map(function (g) {
      return g + ':' + [].concat(line.options[g]).sort().join('+');
    }).join('|');
    return line.itemId + '#' + opts + '#' + (line.note || '').trim().toLowerCase();
  }

  // --- orders --------------------------------------------------------------

  function nextOrderId() {
    state.seq = (state.seq || 0) + 1;
    var n = String(state.seq).padStart(3, '0');
    return { id: 'BB-' + n, seq: state.seq };
  }

  function placeOrder(input) {
    var ids = nextOrderId();
    var lines = (input.lines || []).map(function (line) {
      return {
        itemId: line.itemId,
        qty: line.qty,
        options: line.options || {},
        note: (line.note || '').trim(),
        unitPrice: unitPrice(line.itemId, line.options)
      };
    });
    var order = {
      id: ids.id,
      seq: ids.seq,
      umbrella: Number(input.umbrella),
      lines: lines,
      note: (input.note || '').trim(),
      guestName: input.guestName || '',
      channel: input.channel || 'qr',       // qr | manual
      staff: input.staff || '',
      total: cartTotal(lines),
      status: 'new',
      payment: {
        mode: input.payment && input.payment.mode ? input.payment.mode : 'tab',
        status: input.payment && input.payment.status ? input.payment.status : 'open',
        card: (input.payment && input.payment.card) || null,
        paidAt: (input.payment && input.payment.paidAt) || null
      },
      createdAt: Date.now(),
      acceptedAt: null,
      readyAt: null,
      servedAt: null
    };
    state.orders.unshift(order);
    commit('order:new');
    return order;
  }

  var FLOW = { new: 'preparing', preparing: 'ready', ready: 'served' };

  function advanceOrder(orderId) {
    var order = getOrder(orderId);
    if (!order || order.status === 'served' || order.status === 'cancelled') return null;
    return setStatus(orderId, FLOW[order.status]);
  }

  function setStatus(orderId, status) {
    var order = getOrder(orderId);
    if (!order) return null;
    order.status = status;
    var now = Date.now();
    if (status === 'preparing' && !order.acceptedAt) order.acceptedAt = now;
    if (status === 'ready' && !order.readyAt) order.readyAt = now;
    if (status === 'served') {
      order.servedAt = now;
      if (!order.readyAt) order.readyAt = now;
      if (!order.acceptedAt) order.acceptedAt = now;
    }
    commit('order:status');
    return order;
  }

  function cancelOrder(orderId) { return setStatus(orderId, 'cancelled'); }

  function getOrder(orderId) {
    return state.orders.find(function (o) { return o.id === orderId; }) || null;
  }

  function ordersForUmbrella(umbrella) {
    return state.orders.filter(function (o) { return o.umbrella === Number(umbrella); });
  }

  function openOrders() {
    return state.orders.filter(function (o) {
      return o.status !== 'served' && o.status !== 'cancelled';
    });
  }

  /* Everything the guest still owes: unpaid, non-cancelled orders. */
  function tabFor(umbrella) {
    var orders = ordersForUmbrella(umbrella).filter(function (o) {
      return o.status !== 'cancelled' && o.payment.status !== 'paid';
    });
    return { orders: orders, total: round2(orders.reduce(function (s, o) { return s + o.total; }, 0)) };
  }

  function markPaid(orderIds, paymentInfo) {
    orderIds.forEach(function (id) {
      var order = getOrder(id);
      if (!order) return;
      order.payment = Object.assign({}, order.payment, paymentInfo, {
        status: 'paid', paidAt: Date.now()
      });
    });
    commit('payment');
  }

  // --- music requests ------------------------------------------------------

  function addMusicRequest(input) {
    var request = {
      id: 'M-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      umbrella: Number(input.umbrella),
      text: (input.text || '').trim(),
      status: 'new',
      createdAt: Date.now()
    };
    if (!request.text) return null;
    state.music.unshift(request);
    commit('music');
    return request;
  }

  function setMusicStatus(id, status) {
    var request = state.music.find(function (m) { return m.id === id; });
    if (!request) return;
    request.status = status;
    commit('music');
  }

  // --- fake invoices -------------------------------------------------------

  function sendInvoice(input) {
    var invoice = {
      id: 'INV-' + String(state.invoices.length + 1).padStart(4, '0'),
      email: input.email,
      umbrella: Number(input.umbrella),
      orderIds: input.orderIds || [],
      total: round2(input.total || 0),
      createdAt: Date.now()
    };
    state.invoices.unshift(invoice);
    commit('invoice');
    return invoice;
  }

  // --- demo data -----------------------------------------------------------

  /* relative order volume per hour of day — a typical beach day */
  var HOUR_WEIGHT = {
    9: 0.3, 10: 0.7, 11: 1.0, 12: 1.4, 13: 1.6, 14: 1.3,
    15: 1.1, 16: 1.2, 17: 0.9, 18: 0.5, 19: 0.4, 20: 0.3
  };
  var DEMO_HOURS_BACK = 8;

  function seedDemo(force) {
    if (state.orders.length && !force) return;
    state.orders = [];
    state.music = [];
    state.invoices = [];
    state.seq = 0;

    var rnd = mulberry32(20240814);
    var now = new Date();
    var count = state.settings.umbrellaCount;

    // history for the hours behind us, so the day looks alive whenever the
    // prototype is opened — never before midnight, never in the future
    var dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);

    for (var back = DEMO_HOURS_BACK; back >= 1; back--) {
      var slotStart = now.getTime() - back * 3600000;
      if (slotStart < dayStart.getTime()) continue;
      var hourOfDay = new Date(slotStart).getHours();
      var weight = HOUR_WEIGHT[hourOfDay] != null ? HOUR_WEIGHT[hourOfDay] : 0.6;
      var n = Math.round(weight * 4 + rnd() * 2);
      for (var i = 0; i < n; i++) {
        var when = new Date(slotStart + Math.floor(rnd() * 3600000));
        if (when.getTime() > now.getTime() - 900000) continue;
        var lines = randomLines(rnd);
        var ids = nextOrderId();
        var paidByCard = rnd() < 0.55;
        var order = {
          id: ids.id,
          seq: ids.seq,
          umbrella: 1 + Math.floor(rnd() * count),
          lines: lines,
          note: '',
          guestName: '',
          channel: rnd() < 0.8 ? 'qr' : 'manual',
          staff: '',
          total: cartTotal(lines),
          status: 'served',
          payment: {
            mode: paidByCard ? 'card' : (rnd() < 0.5 ? 'cash' : 'tab'),
            status: paidByCard || rnd() < 0.7 ? 'paid' : 'open',
            card: paidByCard ? '•••• 4242' : null,
            paidAt: when.getTime() + 600000
          },
          createdAt: when.getTime(),
          acceptedAt: when.getTime() + 60000 + Math.floor(rnd() * 120000),
          readyAt: when.getTime() + 240000 + Math.floor(rnd() * 300000),
          servedAt: when.getTime() + 420000 + Math.floor(rnd() * 300000)
        };
        state.orders.push(order);
      }
    }

    state.orders.sort(function (a, b) { return b.createdAt - a.createdAt; });

    // a few live ones so the bar station has something to work on
    ['new', 'new', 'preparing', 'ready'].forEach(function (status, index) {
      var lines = randomLines(rnd);
      var ids = nextOrderId();
      var ago = (index + 1) * 90000 + Math.floor(rnd() * 60000);
      state.orders.unshift({
        id: ids.id, seq: ids.seq,
        umbrella: 1 + Math.floor(rnd() * count),
        lines: lines, note: index === 0 ? 'Please bring extra napkins' : '',
        guestName: '', channel: 'qr', staff: '',
        total: cartTotal(lines), status: status,
        payment: { mode: 'card', status: 'paid', card: '•••• 4242', paidAt: Date.now() - ago },
        createdAt: Date.now() - ago,
        acceptedAt: status === 'new' ? null : Date.now() - ago + 40000,
        readyAt: status === 'ready' ? Date.now() - 30000 : null,
        servedAt: null
      });
    });

    ['Bob Marley – Three Little Birds', 'Despacito', 'Πέτρος Ιακωβίδης – Θάλασσα']
      .forEach(function (text, i) {
        state.music.push({
          id: 'M-DEMO' + i, umbrella: 3 + i * 7, text: text,
          status: i === 2 ? 'played' : 'new',
          createdAt: Date.now() - (i + 1) * 900000
        });
      });

    commit('seed');
  }

  function randomLines(rnd) {
    var n = 1 + Math.floor(rnd() * 3);
    var lines = [];
    for (var i = 0; i < n; i++) {
      var item = DATA.MENU[Math.floor(rnd() * DATA.MENU.length)];
      var options = {};
      (item.options || []).forEach(function (groupId) {
        var group = DATA.OPTION_GROUPS[groupId];
        if (group.type === 'multi') return;
        options[groupId] = [group.choices[Math.floor(rnd() * group.choices.length)].id];
      });
      lines.push({
        itemId: item.id,
        qty: 1 + Math.floor(rnd() * 2),
        options: options,
        note: '',
        unitPrice: unitPrice(item.id, options)
      });
    }
    return lines;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function resetAll() {
    state = clone(DEFAULT_STATE);
    seedDemo(true);
  }

  init();

  global.Store = {
    get state() { return state; },
    get device() { return device; },
    get settings() { return state.settings; },
    subscribe: function (fn) { listeners.push(fn); return function () {
      listeners = listeners.filter(function (f) { return f !== fn; });
    }; },
    commit: commit,
    saveDevice: saveDevice,
    money: money,
    round2: round2,
    unitPrice: unitPrice,
    lineTotal: lineTotal,
    cartTotal: cartTotal,
    lineKey: lineKey,
    placeOrder: placeOrder,
    advanceOrder: advanceOrder,
    setStatus: setStatus,
    cancelOrder: cancelOrder,
    getOrder: getOrder,
    ordersForUmbrella: ordersForUmbrella,
    openOrders: openOrders,
    tabFor: tabFor,
    markPaid: markPaid,
    addMusicRequest: addMusicRequest,
    setMusicStatus: setMusicStatus,
    sendInvoice: sendInvoice,
    seedDemo: seedDemo,
    resetAll: resetAll,
    storage: storage
  };
})(typeof window !== 'undefined' ? window : globalThis);
