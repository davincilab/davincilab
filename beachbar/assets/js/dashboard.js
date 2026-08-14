/*
 * dashboard.js — live numbers for the bar owner.
 *
 * Charts are hand-rolled SVG so the page stays dependency free. Colours come
 * from the validated categorical palette in app.css (--series-1 … --series-6).
 */
(function () {
  'use strict';

  var el = UI.el, t = UI.t, tx = UI.tx, money = UI.money;
  var view = UI.$('#view');
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var showTables = false;

  function svg(tag, attrs, children) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === 'text') node.textContent = attrs[key];
      else if (key.slice(0, 2) === 'on') node.addEventListener(key.slice(2), attrs[key]);
      else node.setAttribute(key, attrs[key]);
    });
    [].concat(children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  // --- aggregation ---------------------------------------------------------

  function startOfToday() {
    var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
  }

  function stats() {
    var today = startOfToday();
    var orders = Store.state.orders.filter(function (order) {
      return order.createdAt >= today && order.status !== 'cancelled';
    });

    var revenue = 0, prepTimes = [], byHour = {}, byItem = {}, byCategory = {}, byUmbrella = {};
    var openTabTotal = 0, openTabs = {};

    orders.forEach(function (order) {
      revenue += order.total;

      var hour = new Date(order.createdAt).getHours();
      byHour[hour] = (byHour[hour] || 0) + order.total;
      byUmbrella[order.umbrella] = (byUmbrella[order.umbrella] || 0) + order.total;

      if (order.readyAt && order.acceptedAt) {
        prepTimes.push((order.readyAt - order.createdAt) / 60000);
      }
      if (order.payment.status !== 'paid') {
        openTabTotal += order.total;
        openTabs[order.umbrella] = (openTabs[order.umbrella] || 0) + order.total;
      }
      order.lines.forEach(function (line) {
        var item = DATA.MENU_BY_ID[line.itemId];
        if (!item) return;
        var value = Store.lineTotal(line);
        var entry = byItem[line.itemId] || (byItem[line.itemId] = { qty: 0, revenue: 0 });
        entry.qty += line.qty;
        entry.revenue += value;
        byCategory[item.cat] = (byCategory[item.cat] || 0) + value;
      });
    });

    return {
      orders: orders,
      revenue: Store.round2(revenue),
      count: orders.length,
      avgTicket: orders.length ? Store.round2(revenue / orders.length) : 0,
      openOrders: Store.openOrders().length,
      activeUmbrellas: Object.keys(byUmbrella).length,
      avgPrep: prepTimes.length
        ? Math.round(prepTimes.reduce(function (a, b) { return a + b; }, 0) / prepTimes.length)
        : 0,
      byHour: byHour,
      byItem: byItem,
      byCategory: byCategory,
      byUmbrella: byUmbrella,
      openTabTotal: Store.round2(openTabTotal),
      openTabs: openTabs
    };
  }

  // --- KPI tiles -----------------------------------------------------------

  function kpi(label, value, hint) {
    return el('div.kpi', {}, [
      el('div.kpi__label', { text: label }),
      el('div.kpi__value', { text: value }),
      hint ? el('div.kpi__hint', { text: hint }) : null
    ]);
  }

  // --- revenue by hour (vertical bars, one series) -------------------------

  function revenueByHourChart(data) {
    // the axis follows the data: opening hour of the day so far … current hour
    var present = Object.keys(data.byHour).map(Number).sort(function (a, b) { return a - b; });
    var first = present.length ? Math.min(present[0], new Date().getHours()) : 9;
    var last = Math.max(present.length ? present[present.length - 1] : 18, new Date().getHours());
    if (last - first < 5) last = first + 5;

    var hours = [];
    for (var h = first; h <= last; h++) hours.push(h);
    var values = hours.map(function (hour) { return Store.round2(data.byHour[hour] || 0); });
    var max = Math.max(10, Math.max.apply(null, values));

    var W = 640, H = 220, padL = 44, padR = 8, padT = 12, padB = 26;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var slot = plotW / hours.length;
    var barW = Math.max(6, slot - 8);

    var children = [];
    // recessive gridlines + y axis labels
    [0, 0.5, 1].forEach(function (ratio) {
      var y = padT + plotH - ratio * plotH;
      children.push(svg('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: 'grid-line' }));
      children.push(svg('text', {
        x: padL - 8, y: y + 3, 'text-anchor': 'end', class: 'axis-label',
        text: money(max * ratio).replace(/[.,]00/, '')
      }));
    });

    hours.forEach(function (hour, index) {
      var value = values[index];
      var barH = max ? (value / max) * plotH : 0;
      var x = padL + index * slot + (slot - barW) / 2;
      var y = padT + plotH - barH;
      var title = svg('title', { text: hour + ':00 — ' + money(value) });
      if (barH > 0) {
        children.push(svg('rect', {
          x: x, y: y, width: barW, height: Math.max(2, barH),
          rx: 4, fill: 'var(--series-1)'
        }, [title]));
      } else {
        children.push(svg('rect', {
          x: x, y: padT + plotH - 2, width: barW, height: 2, rx: 1, class: 'bar-track'
        }, [title]));
      }
      if (index % 2 === 0) {
        children.push(svg('text', {
          x: x + barW / 2, y: H - 8, 'text-anchor': 'middle', class: 'axis-label',
          text: String(hour).padStart(2, '0') + ':00'
        }));
      }
    });

    return el('div.chart', {}, [
      svg('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H,
        role: 'img', 'aria-label': t('revenueByHour') }, children)
    ]);
  }

  // --- top products (horizontal bars, direct labels) ----------------------

  function topItemsChart(data) {
    var rows = Object.keys(data.byItem).map(function (itemId) {
      return { id: itemId, qty: data.byItem[itemId].qty, revenue: data.byItem[itemId].revenue };
    }).sort(function (a, b) { return b.revenue - a.revenue; }).slice(0, 8);

    if (!rows.length) return el('p.muted', { text: t('noData') });
    var max = rows[0].revenue;

    return el('div.hbar', {}, rows.map(function (row) {
      return el('div.hbar__row', {}, [
        el('span.hbar__name', { text: UI.itemName(row.id), title: UI.itemName(row.id) }),
        el('span.hbar__track', {}, [
          el('span.hbar__fill', { style: 'width:' + Math.max(2, (row.revenue / max) * 100) + '%' })
        ]),
        el('span.hbar__value', { text: money(row.revenue) + '  ·  ' + row.qty + '×' })
      ]);
    }));
  }

  // --- category share (stacked bar + legend) -------------------------------

  function categoryChart(data) {
    var total = Object.keys(data.byCategory).reduce(function (sum, key) {
      return sum + data.byCategory[key];
    }, 0);
    if (!total) return el('p.muted', { text: t('noData') });

    var segments = DATA.CATEGORIES.map(function (cat, index) {
      return {
        id: cat.id,
        name: tx(cat.name),
        value: data.byCategory[cat.id] || 0,
        color: 'var(--series-' + (index + 1) + ')'
      };
    }).filter(function (segment) { return segment.value > 0; });

    return el('div', {}, [
      el('div.stackbar', {}, segments.map(function (segment) {
        return el('span.stackbar__seg', {
          style: 'background:' + segment.color + ';width:' + (segment.value / total * 100) + '%',
          title: segment.name + ': ' + money(segment.value)
        });
      })),
      el('div.legend', {}, segments.map(function (segment) {
        return el('span.legend__item', {}, [
          el('span.legend__swatch', { style: 'background:' + segment.color }),
          segment.name + ' · ' + money(segment.value) +
            ' (' + Math.round(segment.value / total * 100) + '%)'
        ]);
      }))
    ]);
  }

  // --- umbrella revenue map (sequential ramp) ------------------------------

  function umbrellaMap(data) {
    var count = Store.settings.umbrellaCount;
    var values = Object.keys(data.byUmbrella).map(function (key) { return data.byUmbrella[key]; });
    var max = values.length ? Math.max.apply(null, values) : 0;

    var grid = el('div.umb-grid', {}, Array.from({ length: count }, function (_, index) {
      var no = index + 1;
      var value = data.byUmbrella[no] || 0;
      var heat = !value ? 0 : Math.min(4, Math.max(1, Math.ceil((value / max) * 4)));
      return el('div.umb', {
        dataset: { heat: String(heat) },
        title: t('umbrella') + ' ' + no + ': ' + money(value)
      }, [
        el('span', { text: String(no) }),
        value ? el('span.umb__sub', { text: money(value).replace(/[.,]00/, '') }) : null
      ]);
    }));

    return el('div', {}, [
      grid,
      el('div.legend', {}, [
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:var(--surface-1);border:1px solid var(--border)' }), t('noData')]),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#cde2fb' }), '≤ ' + money(max * 0.25)]),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#9ec5f4' }), '≤ ' + money(max * 0.5)]),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#5598e7' }), '≤ ' + money(max * 0.75)]),
        el('span.legend__item', {}, [el('span.legend__swatch', { style: 'background:#256abf' }), '≤ ' + money(max)])
      ])
    ]);
  }

  // --- tables (the accessible twin of every chart) -------------------------

  function tableFor(rows, headers) {
    return el('div.table-wrap', {}, [
      el('table.data', {}, [
        el('thead', {}, [el('tr', {}, headers.map(function (head, index) {
          return el('th' + (index ? '.num' : ''), { text: head });
        }))]),
        el('tbody', {}, rows.map(function (row) {
          return el('tr', {}, row.map(function (cell, index) {
            return el('td' + (index ? '.num' : ''), { text: String(cell) });
          }));
        }))
      ])
    ]);
  }

  // --- CSV -----------------------------------------------------------------

  function exportCsv() {
    var header = ['order_id', 'created_at', 'umbrella', 'channel', 'status', 'payment_mode',
      'payment_status', 'item', 'options', 'qty', 'unit_price', 'line_total'];
    var rows = [header];
    Store.state.orders.forEach(function (order) {
      order.lines.forEach(function (line) {
        rows.push([
          order.id,
          new Date(order.createdAt).toISOString(),
          order.umbrella,
          order.channel,
          order.status,
          order.payment.mode,
          order.payment.status,
          UI.itemName(line.itemId),
          UI.optionSummary(line).replace(/;/g, ','),
          line.qty,
          Store.unitPrice(line.itemId, line.options).toFixed(2),
          Store.lineTotal(line).toFixed(2)
        ]);
      });
    });
    var csv = rows.map(function (row) {
      return row.map(function (cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    var blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = el('a', { href: url, download: 'beachbar-orders.csv' });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // --- render --------------------------------------------------------------

  function render() {
    var data = stats();

    var topRows = Object.keys(data.byItem).map(function (itemId) {
      return [UI.itemName(itemId), data.byItem[itemId].qty, money(data.byItem[itemId].revenue)];
    }).sort(function (a, b) { return b[1] - a[1]; });

    var hourRows = Object.keys(data.byHour).sort(function (a, b) { return a - b; })
      .map(function (hour) { return [hour + ':00', money(data.byHour[hour])]; });

    var tabRows = Object.keys(data.openTabs).map(function (umbrella) {
      return ['⛱️ ' + umbrella, money(data.openTabs[umbrella])];
    });

    UI.mount(view, [
      el('div.row.row--between.row--wrap', { style: 'margin-bottom:14px' }, [
        el('h1', { style: 'font-size:1.3rem', text: t('dashboard') }),
        el('div.row.row--wrap', {}, [
          el('div.seg.seg--plain', { role: 'group' }, [
            el('button.seg__btn', { type: 'button', text: t('chartView'),
              'aria-pressed': showTables ? 'false' : 'true',
              onclick: function () { showTables = false; render(); } }),
            el('button.seg__btn', { type: 'button', text: t('tableView'),
              'aria-pressed': showTables ? 'true' : 'false',
              onclick: function () { showTables = true; render(); } })
          ]),
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: '⬇ ' + t('exportCsv'),
            onclick: exportCsv }),
          el('button.btn.btn--ghost.btn--sm', { type: 'button', text: '↺ ' + t('resetDemo'),
            onclick: function () {
              UI.confirmSheet(t('resetDemo'), UI.lang() === 'el'
                ? 'Όλες οι παραγγελίες θα αντικατασταθούν από δεδομένα επίδειξης.'
                : 'All orders will be replaced by demo data.', t('resetDemo'), function () {
                  Store.resetAll(); render();
                });
            } })
        ])
      ]),

      el('div.kpis', {}, [
        kpi(t('revenueToday'), money(data.revenue), data.count + ' ' + t('orders')),
        kpi(t('ordersToday'), String(data.count),
          Math.round(data.orders.filter(function (o) { return o.channel === 'qr'; }).length /
            Math.max(1, data.count) * 100) + '% QR'),
        kpi(t('avgTicket'), money(data.avgTicket)),
        kpi(t('openOrders'), String(data.openOrders)),
        kpi(t('activeUmbrellas'), data.activeUmbrellas + ' / ' + Store.settings.umbrellaCount),
        kpi(t('avgPrepTime'), data.avgPrep + ' ' + t('minutes')),
        kpi(t('openTabs'), money(data.openTabTotal),
          Object.keys(data.openTabs).length + ' ⛱️')
      ]),

      el('div.grid-2', { style: 'margin-top:14px' }, [
        el('div.card', {}, [
          el('h2.card__title', { text: t('revenueByHour') }),
          el('div', { style: 'margin-top:10px' }, [
            showTables ? tableFor(hourRows, [t('revenueByHour'), t('total')])
                       : revenueByHourChart(data)
          ])
        ]),
        el('div.card', {}, [
          el('h2.card__title', { text: t('topItems') }),
          el('div', { style: 'margin-top:10px' }, [
            showTables ? tableFor(topRows, [t('topItems'), 'Qty', t('total')])
                       : topItemsChart(data)
          ])
        ]),
        el('div.card', {}, [
          el('h2.card__title', { text: t('categoryShare') }),
          el('div', { style: 'margin-top:10px' }, [categoryChart(data)])
        ]),
        el('div.card', {}, [
          el('h2.card__title', { text: t('openTabs') }),
          el('div', { style: 'margin-top:10px' }, [
            tabRows.length ? tableFor(tabRows, [t('umbrella'), t('total')])
                           : el('p.muted', { text: t('noData') })
          ])
        ])
      ]),

      el('div.card', { style: 'margin-top:14px' }, [
        el('h2.card__title', { text: t('umbrellaMap') }),
        el('div', { style: 'margin-top:10px' }, [umbrellaMap(data)])
      ]),

      el('div.card', { style: 'margin-top:14px' }, [
        el('h2.card__title', { text: '🎵 ' + t('music') }),
        el('div', { style: 'margin-top:10px' }, [
          Store.state.music.length
            ? tableFor(Store.state.music.slice(0, 10).map(function (request) {
                return [request.text, '⛱️ ' + request.umbrella, UI.clock(request.createdAt)];
              }), [t('musicWish'), t('umbrella'), '⏱'])
            : el('p.muted', { text: t('noData') })
        ])
      ]),

      el('div.card', { style: 'margin-top:14px' }, [
        el('h2.card__title', { text: '✉️ ' + t('sentInvoices') }),
        el('div', { style: 'margin-top:10px' }, [
          Store.state.invoices.length
            ? tableFor(Store.state.invoices.slice(0, 10).map(function (invoice) {
                return [invoice.id + ' · ' + invoice.email, '⛱️ ' + invoice.umbrella,
                  money(invoice.total)];
              }), ['E-Mail', t('umbrella'), t('total')])
            : el('p.muted', { text: t('noData') })
        ])
      ]),

      el('p.small.muted.center', { style: 'margin-top:22px', text: t('demoNotice') })
    ]);
  }

  function boot() {
    UI.applyLang();
    Store.seedDemo();
    UI.$('#barName').textContent = Store.settings.barName;
    UI.$('#topSub').textContent = t('dashboard');
    UI.mount(UI.$('#langHost'), [UI.langToggle(function () {
      UI.$('#topSub').textContent = t('dashboard');
      render();
    })]);
    render();
    Store.subscribe(render);
    setInterval(render, 30000);
  }

  boot();
})();
