#!/usr/bin/env python3
"""Bundle the whole prototype into one self-contained HTML file.

    python3 tools/build_single.py            -> dist/beachbar-demo.html
    python3 tools/build_single.py --fragment -> dist/beachbar-artifact.html

The --fragment variant leaves out <!doctype>/<html>/<head>/<body> for hosts that
supply their own document skeleton (e.g. published artifacts); the router writes
data-app onto whatever <body> it finds, so the stylesheet keys the same way.

The pages become roles behind the hash (#index, #guest, #bar, #dashboard, #qr);
CSS, JS and icons are inlined, so the result works from a USB stick, an e-mail
attachment or any static host — and can be shared as a single link.

Switching roles reloads the page, which keeps every app's boot code exactly as
it is in the multi-page build (no double listeners, no shared state to unwind).
"""

import base64
import os
import re

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
OUT_DIR = os.path.join(ROOT, 'dist')
OUT = os.path.join(OUT_DIR, 'beachbar-demo.html')

SHARED_JS = ['data.js', 'store.js', 'ui.js', 'qrcode.js']
ROLES = [
    # role,        page,              module js
    ('index', 'index.html', None),
    ('guest', 'guest.html', 'guest.js'),
    ('bar', 'bar.html', 'bar.js'),
    ('dashboard', 'dashboard.html', 'dashboard.js'),
    ('qr', 'qr.html', 'qr.js'),
]
ICONS = ['icon-guest-192.png', 'icon-bar-192.png', 'icon-guest-180.png']


def read(*parts):
    with open(os.path.join(ROOT, *parts), encoding='utf-8') as fh:
        return fh.read()


def data_uri(name):
    with open(os.path.join(ROOT, 'assets', 'icons', name), 'rb') as fh:
        return 'data:image/png;base64,' + base64.b64encode(fh.read()).decode()


def body_of(page):
    """Body markup of a page, without its <script> tags, links rewritten."""
    html = read(page)
    body = re.search(r'<body[^>]*>(.*)</body>', html, re.S).group(1)
    body = re.sub(r'<script\b.*?</script>', '', body, flags=re.S)

    # guest.html?u=12 -> #guest?u=12 ; bar.html -> #bar
    body = re.sub(r'href="([a-z]+)\.html\?u=(\d+)"', r'href="#\1?u=\2"', body)
    body = re.sub(r'href="([a-z]+)\.html"', r'href="#\1"', body)

    for icon in ICONS:
        body = body.replace('assets/icons/' + icon, data_uri(icon))
    return body.strip()


def app_attr(page):
    match = re.search(r'<body[^>]*data-app="([^"]+)"', read(page))
    return match.group(1) if match else 'guest'


def escape_for_block(text):
    """Keep the browser from ending our <script type="text/plain"> early."""
    return text.replace('</script', '<\\/script')


def assert_scriptable(name, source):
    """Module sources go into real <script> tags — they must not close them."""
    if '</script' in source:
        raise SystemExit('%s contains a literal </script and cannot be inlined' % name)
    return source


TITLE = 'Blue Wave Beach Bar'


def build(fragment=False):
    parts = []
    if not fragment:
        parts.append('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">')
        parts.append('<meta name="viewport" content="width=device-width, initial-scale=1, '
                     'viewport-fit=cover">')
    parts.append('<title>%s</title>' % TITLE)
    if not fragment:
        parts.append('<meta name="description" content="QR based ordering prototype for a '
                     'beach bar: guest app, bar station, dashboard, umbrella QR codes.">')
        parts.append('<meta name="theme-color" content="#2a78d6">')
        parts.append('<meta name="mobile-web-app-capable" content="yes">')
        parts.append('<meta name="apple-mobile-web-app-capable" content="yes">')
        parts.append('<meta name="apple-mobile-web-app-title" content="Beach Bar">')
        parts.append('<link rel="apple-touch-icon" href="%s">' % data_uri('icon-guest-180.png'))
        parts.append('<link rel="icon" href="%s">' % data_uri('icon-guest-192.png'))
    parts.append('<style>\n%s\n</style>' % read('assets', 'css', 'app.css'))
    if not fragment:
        parts.append('</head>\n<body data-app="guest">')

    parts.append('<div id="bb-root"></div>')

    # page markup, parked as inert data until the router needs it
    for role, page, module in ROLES:
        parts.append('<script type="text/plain" id="bb-body-%s" data-app="%s">\n%s\n</script>'
                     % (role, app_attr(page), escape_for_block(body_of(page))))

    parts.append('<script>window.BB_SINGLE_FILE = true; window.BB_MODULES = {};</script>')
    for name in SHARED_JS:
        parts.append('<script>\n%s\n</script>' % read('assets', 'js', name))

    # role modules as ordinary inline functions: no injected <script>, no eval,
    # so a strict Content-Security-Policy on the host cannot break them
    for role, page, module in ROLES:
        if not module:
            continue
        source = assert_scriptable(module, read('assets', 'js', module))
        parts.append('<script>\nwindow.BB_MODULES[%r] = function () {\n%s\n};\n</script>'
                     % (role, source))

    parts.append('''<script>
/* router: one role per page load — switching roles reloads, so every app boots
   exactly like it does in the multi-page build */
(function () {
  var ROLES = %s;
  function currentRole() {
    var role = (location.hash || '').replace(/^#/, '').split(/[\\/?]/)[0];
    return ROLES.indexOf(role) >= 0 ? role : 'index';
  }
  var booted = currentRole();

  function boot() {
    var role = booted;
    document.documentElement.lang = 'en';
    var markup = document.getElementById('bb-body-' + role);
    document.body.dataset.app = markup.dataset.app;
    document.getElementById('bb-root').innerHTML = markup.textContent;
    if (window.BB_MODULES[role]) window.BB_MODULES[role]();
  }

  window.addEventListener('hashchange', function () {
    if (currentRole() !== booted) location.reload();
  });

  boot();
})();
</script>''' % repr([role for role, _, _ in ROLES]).replace("'", '"'))

    if not fragment:
        parts.append('</body>\n</html>')
    return '\n'.join(parts)


if __name__ == '__main__':
    import sys
    fragment = '--fragment' in sys.argv
    target = os.path.join(OUT_DIR, 'beachbar-artifact.html') if fragment else OUT
    os.makedirs(OUT_DIR, exist_ok=True)
    html = build(fragment)
    with open(target, 'w', encoding='utf-8') as fh:
        fh.write(html)
    print('%s (%.0f KB)' % (os.path.relpath(target, ROOT), len(html.encode()) / 1024))
