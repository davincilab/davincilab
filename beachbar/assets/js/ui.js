/*
 * ui.js — shared UI helpers: translation, DOM building, sheets, toasts.
 */
(function (global) {
  'use strict';

  /* The app ships two ways: as separate pages (guest.html, bar.html …) and as
     one self-contained file for hosting/sharing. In single-file mode the first
     hash segment names the role, so an app's own routes live behind it:
     multi-page  #cart            single-file  #guest/cart
     multi-page  ?u=12            single-file  #guest?u=12                    */
  var SINGLE = !!global.BB_SINGLE_FILE;

  /* Some hosts (in-app file viewers, sandboxed previews) refuse fragment
     navigation. When we notice the address bar did not take our hash, we keep
     it in memory instead and raise the event ourselves, so routing keeps
     working wherever the file is opened. */
  var virtualHash = null;

  function hash() {
    return virtualHash != null ? virtualHash : location.hash;
  }

  function setHash(next) {
    if (virtualHash == null) {
      try { location.hash = next; } catch (err) { /* blocked */ }
      if (location.hash === next || location.hash === '#' + next.replace(/^#/, '')) return;
    }
    virtualHash = next;
    var event;
    try {
      event = new HashChangeEvent('hashchange');
    } catch (err) {
      event = document.createEvent('Event');
      event.initEvent('hashchange', false, false);
    }
    global.dispatchEvent(event);
  }

  function roleName() {
    return SINGLE ? (hash().replace(/^#/, '').split(/[/?]/)[0] || 'index') : '';
  }

  /* the route inside the current app, without role prefix and query */
  function route() {
    var h = hash().replace(/^#/, '');
    var query = h.indexOf('?');
    if (query >= 0) h = h.slice(0, query);
    if (!SINGLE) return h;
    var slash = h.indexOf('/');
    return slash < 0 ? '' : h.slice(slash + 1);
  }

  function go(sub) {
    setHash(SINGLE ? '#' + roleName() + '/' + (sub || 'menu') : '#' + (sub || 'menu'));
  }

  function lang() { return Store.device.lang || 'en'; }

  function t(key) {
    var entry = DATA.STRINGS[key];
    if (!entry) return key;
    return entry[lang()] || entry.en;
  }

  function tx(obj) {
    if (!obj) return '';
    return obj[lang()] || obj.en || '';
  }

  function money(amount) { return Store.money(amount, lang()); }

  /* el('div.card', {onclick: fn}, [children]) */
  function el(spec, attrs, children) {
    var parts = String(spec).split(/(?=[.#])/);
    var node = document.createElement(parts[0] || 'div');
    parts.slice(1).forEach(function (part) {
      if (part[0] === '.') node.classList.add(part.slice(1));
      else if (part[0] === '#') node.id = part.slice(1);
    });
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value == null || value === false) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'html') node.innerHTML = value;
      else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), value);
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else node.setAttribute(key, value === true ? '' : value);
    });
    [].concat(children || []).forEach(function (child) {
      if (child == null || child === false) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function mount(node, children) {
    clear(node);
    [].concat(children || []).forEach(function (child) {
      if (child) node.appendChild(child);
    });
    return node;
  }

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  /* Human readable option summary, e.g. "Little sugar · Oat milk". */
  function optionSummary(line) {
    var parts = [];
    Object.keys(line.options || {}).forEach(function (groupId) {
      var group = DATA.OPTION_GROUPS[groupId];
      if (!group) return;
      [].concat(line.options[groupId]).forEach(function (choiceId) {
        var choice = group.choices.find(function (c) { return c.id === choiceId; });
        if (!choice) return;
        // "normal ice" and "regular milk" are the default, no need to shout them
        if (choice.id === 'normal' && groupId === 'ice') return;
        if (choice.id === 'regular' && groupId === 'milk') return;
        parts.push(tx(choice.name));
      });
    });
    if (line.note) parts.push('“' + line.note + '”');
    return parts.join(' · ');
  }

  function itemName(itemId) {
    var item = DATA.MENU_BY_ID[itemId];
    return item ? tx(item.name) : itemId;
  }

  function timeAgo(timestamp) {
    var seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
    if (seconds < 60) return seconds + 's';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + ':' + String(seconds % 60).padStart(2, '0');
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
  }

  function clock(timestamp) {
    return new Date(timestamp).toLocaleTimeString(lang() === 'el' ? 'el-GR' : 'en-GB',
      { hour: '2-digit', minute: '2-digit' });
  }

  function statusLabel(status) { return t('status_' + status); }

  // --- host detection ------------------------------------------------------

  /* Some in-app file viewers do not give the page its own viewport: they grow
     the frame to the full document height and scroll it from the outside. A
     window taller than the physical screen gives that away. In such a host
     nothing inside the page can scroll on its own, so overlays with their own
     scrollbar would be unreachable below the fold — we lay them out in the
     document flow instead. Re-checked on demand, because the host resizes the
     frame only after content has rendered. */
  function isFlowHost() {
    var framed = true;
    try { framed = global.top !== global.self; } catch (err) { framed = true; }
    if (!framed) return false;
    var screenHeight = (global.screen && global.screen.height) || 0;
    return screenHeight > 0 && global.innerHeight > screenHeight * 1.2;
  }

  function markHost() {
    if (document.body) document.body.classList.toggle('is-flowhost', isFlowHost());
  }

  /* Last line of defence. Some hosts neither scroll the page nor let the page
     scroll itself (an injected overflow:hidden, a web view sized to one screen
     that never re-measures). Taps still arrive, so we can move the content
     ourselves. Enabled only after proving the window refuses to scroll while
     content sticks out below — a normal browser never reaches this. */
  var dragScroll = null;

  /* Careful: this only says the window can be scrolled *by script*. A host that
     pins the viewport with overflow:hidden still answers yes here while the
     user's finger achieves nothing — which is why the real detection below
     watches actual gestures instead. */
  function canScrollWindow() {
    var before = global.scrollY;
    global.scrollTo(0, before + 40);
    var moved = Math.abs(global.scrollY - before) > 1;
    global.scrollTo(0, before);
    return moved;
  }

  function contentOverflows() {
    return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
      > global.innerHeight + 24;
  }

  function viewportPinned() {
    var root = getComputedStyle(document.documentElement).overflowY;
    var body = getComputedStyle(document.body).overflowY;
    return root === 'hidden' || (body === 'hidden' && !document.body.classList.contains('is-locked'));
  }

  function probeScrolling() {
    if (dragScroll || isFlowHost()) return;
    if (contentOverflows() && viewportPinned()) enableDragScroll();
  }

  /* The decisive test: the user drags, and nothing moves. No assumption about
     the host required — if a real gesture fails to scroll anything, we take
     over scrolling ourselves from then on. */
  function scrollableAncestor(node) {
    while (node && node !== document.body && node.nodeType === 1) {
      var style = getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 4) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  function watchGestures() {
    var startY = 0, startScroll = 0, inner = null, innerTop = 0;
    var strikes = 0;   // two failed gestures in a row before we take over

    document.addEventListener('touchstart', function (event) {
      if (dragScroll || event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
      startScroll = global.scrollY;
      inner = scrollableAncestor(event.target);
      innerTop = inner ? inner.scrollTop : 0;
    }, { passive: true });

    document.addEventListener('touchend', function (event) {
      if (dragScroll || isFlowHost() || !contentOverflows()) return;
      var touch = (event.changedTouches && event.changedTouches[0]) || null;
      if (!touch) return;

      var delta = startY - touch.clientY;               // > 0 means "show me what's below"
      if (Math.abs(delta) < 30) return;                 // a tap, not a scroll

      /* Was there anywhere to go? At the very top a downward pull moves
         nothing in any browser — that is not a broken host. */
      var room = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
        - global.innerHeight;
      if (delta > 0 && startScroll >= room - 2) return;
      if (delta < 0 && startScroll <= 2) return;

      if (Math.abs(global.scrollY - startScroll) > 2 ||
          (inner && Math.abs(inner.scrollTop - innerTop) > 2)) {
        strikes = 0;                                    // something moved: all good
        return;
      }

      if (++strikes < 2) return;
      enableDragScroll();
      toast(lang() === 'el' ? 'Κύλιση ενεργή — σύρετε με το δάχτυλο'
                            : 'Scrolling enabled — drag with your finger', 'good');
    }, { passive: true });
  }

  function enableDragScroll() {
    if (dragScroll) return;
    dragScroll = { offset: 0 };
    document.body.classList.add('is-dragscroll', 'is-flowhost');

    function surface() {
      return document.querySelector('.sheet-backdrop') ||
             document.querySelector('.app') ||
             document.body.firstElementChild;
    }

    function limit(node) {
      return Math.max(0, node.scrollHeight - global.innerHeight + 24);
    }

    function place(node, value) {
      dragScroll.offset = Math.min(Math.max(0, value), limit(node));
      node.style.position = 'relative';
      node.style.top = (-dragScroll.offset) + 'px';
    }

    var startY = 0, startOffset = 0, tracking = false;

    document.addEventListener('touchstart', function (event) {
      if (event.touches.length !== 1) return;
      tracking = true;
      startY = event.touches[0].clientY;
      startOffset = dragScroll.offset;
    }, { passive: true });

    document.addEventListener('touchmove', function (event) {
      if (!tracking) return;
      var delta = startY - event.touches[0].clientY;
      if (Math.abs(delta) < 4) return;
      place(surface(), startOffset + delta);
      if (event.cancelable) event.preventDefault();
    }, { passive: false });

    document.addEventListener('touchend', function () { tracking = false; }, { passive: true });

    document.addEventListener('wheel', function (event) {
      place(surface(), dragScroll.offset + event.deltaY);
      if (event.cancelable) event.preventDefault();
    }, { passive: false });

    /* a fresh view starts at the top again */
    dragScroll.reset = function () {
      var node = surface();
      if (node) { dragScroll.offset = 0; node.style.top = '0px'; }
    };
  }

  function resetScroll() {
    if (dragScroll && dragScroll.reset) dragScroll.reset();
    else global.scrollTo(0, 0);
  }

  function scrollMode() {
    return dragScroll ? 'drag' : (isFlowHost() ? 'host' : 'window');
  }

  // --- toast ---------------------------------------------------------------

  var toastHost = null;
  function toast(message, kind) {
    if (!toastHost) {
      toastHost = el('div.toast-host');
      document.body.appendChild(toastHost);
    }
    var node = el('div.toast' + (kind ? '.toast--' + kind : ''), { text: message });
    toastHost.appendChild(node);
    setTimeout(function () { node.classList.add('is-out'); }, 2600);
    setTimeout(function () { node.remove(); }, 3100);
  }

  // --- sheet / modal -------------------------------------------------------

  function sheet(options) {
    var inline = isFlowHost() || scrollMode() === 'drag';
    var backdrop = el('div.sheet-backdrop' + (inline ? '.sheet-backdrop--inline' : ''));
    var panel = el('div.sheet' + (options.wide ? '.sheet--wide' : ''), {
      role: 'dialog', 'aria-modal': 'true', 'aria-label': options.title || ''
    });
    var head = el('header.sheet__head', {}, [
      el('h2.sheet__title', { text: options.title || '' }),
      el('button.icon-btn', {
        type: 'button', 'aria-label': t('close'), onclick: close
      }, ['✕'])
    ]);
    var body = el('div.sheet__body');
    panel.appendChild(head);
    panel.appendChild(body);
    if (options.footer) panel.appendChild(el('footer.sheet__foot', {}, options.footer));
    backdrop.appendChild(panel);
    backdrop.addEventListener('click', function (event) {
      if (event.target === backdrop) close();
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(backdrop);

    /* In a flow host the page underneath is hidden while the panel is open:
       the document then ends with the panel, the outer scroll snaps back to
       the top and every field down to the footer is reachable. */
    var app = document.querySelector('.app');
    if (inline) {
      if (app) app.style.display = 'none';
      backdrop.classList.add('is-open');
      resetScroll();
    } else {
      document.body.classList.add('is-locked');
      requestAnimationFrame(function () { backdrop.classList.add('is-open'); });
    }

    function onKey(event) { if (event.key === 'Escape') close(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      backdrop.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      if (inline && app) { app.style.display = ''; resetScroll(); }
      setTimeout(function () { backdrop.remove(); }, inline ? 0 : 200);
      if (options.onClose) options.onClose();
    }

    mount(body, options.content || []);
    return { close: close, body: body, panel: panel };
  }

  function confirmSheet(title, message, confirmLabel, onConfirm) {
    var ref = sheet({
      title: title,
      content: [el('p.muted', { text: message })],
      footer: [
        el('button.btn.btn--ghost', { type: 'button', text: t('cancel'), onclick: function () { ref.close(); } }),
        el('button.btn.btn--primary', {
          type: 'button', text: confirmLabel,
          onclick: function () { ref.close(); onConfirm(); }
        })
      ]
    });
    return ref;
  }

  // --- language & theme ----------------------------------------------------

  function langToggle(onChange) {
    var wrap = el('div.seg.seg--lang', { role: 'group', 'aria-label': t('language') });
    [['en', 'EN'], ['el', 'ΕΛ']].forEach(function (pair) {
      wrap.appendChild(el('button.seg__btn', {
        type: 'button',
        'aria-pressed': Store.device.lang === pair[0] ? 'true' : 'false',
        text: pair[1],
        onclick: function () {
          Store.saveDevice({ lang: pair[0] });
          document.documentElement.lang = pair[0];
          if (onChange) onChange();
        }
      }));
    });
    return wrap;
  }

  function applyLang() {
    document.documentElement.lang = lang();
    markHost();
  }

  // the frame is sized after content renders, so re-check when it changes
  function checkHost() { markHost(); probeScrolling(); }
  watchGestures();
  global.addEventListener('resize', checkHost);
  setTimeout(checkHost, 400);
  setTimeout(checkHost, 1200);
  setTimeout(checkHost, 2500);

  // --- sound (bar station) -------------------------------------------------

  var audioCtx = null;
  function beep(pattern) {
    if (!Store.device.sound) return;
    try {
      audioCtx = audioCtx || new (global.AudioContext || global.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      (pattern || [880, 1320]).forEach(function (freq, index) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        var start = audioCtx.currentTime + index * 0.16;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.18);
      });
    } catch (err) { /* audio is a nicety, never break the UI over it */ }
  }

  // --- misc ----------------------------------------------------------------

  /* ?u=12 works from the query string and from behind the hash alike */
  function param(name) {
    var fromSearch = new URLSearchParams(location.search).get(name);
    if (fromSearch != null) return fromSearch;
    var h = hash() || '';
    var query = h.indexOf('?');
    return query < 0 ? null : new URLSearchParams(h.slice(query + 1)).get(name);
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments, self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait || 200);
    };
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  global.UI = {
    t: t, tx: tx, lang: lang, money: money,
    el: el, mount: mount, clear: clear, $: $, $$: $$,
    optionSummary: optionSummary, itemName: itemName,
    timeAgo: timeAgo, clock: clock, statusLabel: statusLabel,
    toast: toast, sheet: sheet, confirmSheet: confirmSheet,
    langToggle: langToggle, applyLang: applyLang,
    beep: beep, param: param, debounce: debounce, escapeHtml: escapeHtml,
    single: SINGLE, roleName: roleName, route: route, go: go,
    hash: hash, setHash: setHash, isFlowHost: isFlowHost, markHost: markHost,
    probeScrolling: probeScrolling, resetScroll: resetScroll, scrollMode: scrollMode,
    forceDragScroll: enableDragScroll,
    canScrollWindow: canScrollWindow
  };
})(typeof window !== 'undefined' ? window : globalThis);
