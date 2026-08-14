/*
 * qrcode.js — minimal QR code generator (ISO/IEC 18004), byte mode, EC level M.
 *
 * Self-contained, no dependencies, no network: the umbrella QR codes have to be
 * printable on a beach with a flaky connection. Supports versions 1–10, which
 * covers every URL this app produces (up to 213 bytes).
 *
 * QR.matrix(text) -> array of rows of booleans (true = dark module)
 * QR.svg(text, opts) -> SVG string
 */
(function (global) {
  'use strict';

  // --- GF(256) arithmetic, primitive polynomial 0x11d ----------------------
  var EXP = new Uint8Array(512);
  var LOG = new Uint8Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function gmul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(degree) {
    var poly = [1];
    for (var d = 0; d < degree; d++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var i = 0; i < poly.length; i++) {
        next[i] ^= poly[i];
        next[i + 1] ^= gmul(poly[i], EXP[d]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
    }
    return res;
  }

  // --- version tables (EC level M only) ------------------------------------
  // [total codewords, ec codewords per block, block count group 1,
  //  data codewords per block group 1, block count group 2, data codewords g2]
  var VERSIONS = {
    1: [26, 10, 1, 16, 0, 0],
    2: [44, 16, 1, 28, 0, 0],
    3: [70, 26, 1, 44, 0, 0],
    4: [100, 18, 2, 32, 0, 0],
    5: [134, 24, 2, 43, 0, 0],
    6: [172, 16, 4, 27, 0, 0],
    7: [196, 18, 4, 31, 0, 0],
    8: [242, 22, 2, 38, 2, 39],
    9: [292, 22, 3, 36, 2, 37],
    10: [346, 26, 4, 43, 1, 44]
  };

  var ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50]
  };

  function dataCapacity(version) {
    var v = VERSIONS[version];
    return v[2] * v[3] + v[4] * v[5];
  }

  function pickVersion(byteLen) {
    for (var v = 1; v <= 10; v++) {
      var header = 4 + (v < 10 ? 8 : 16);
      if (dataCapacity(v) * 8 >= header + byteLen * 8) return v;
    }
    throw new Error('QR: payload too long (' + byteLen + ' bytes)');
  }

  function utf8Bytes(text) {
    var out = [];
    for (var i = 0; i < text.length; i++) {
      var c = text.charCodeAt(i);
      if (c < 0x80) {
        out.push(c);
      } else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
        var lo = text.charCodeAt(++i);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
                 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      }
    }
    return out;
  }

  // --- bit buffer ----------------------------------------------------------
  function BitBuffer() { this.bits = []; }
  BitBuffer.prototype.put = function (value, length) {
    for (var i = length - 1; i >= 0; i--) this.bits.push((value >> i) & 1);
  };
  BitBuffer.prototype.bytes = function () {
    var out = [];
    for (var i = 0; i < this.bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | (this.bits[i + j] || 0);
      out.push(b);
    }
    return out;
  };

  function buildCodewords(bytes, version) {
    var spec = VERSIONS[version];
    var capacity = dataCapacity(version);
    var buf = new BitBuffer();
    buf.put(0b0100, 4);                       // byte mode
    buf.put(bytes.length, version < 10 ? 8 : 16);
    for (var i = 0; i < bytes.length; i++) buf.put(bytes[i], 8);
    var free = capacity * 8 - buf.bits.length;
    buf.put(0, Math.min(4, free));            // terminator
    while (buf.bits.length % 8) buf.bits.push(0);
    var data = buf.bytes();
    var pad = [0xec, 0x11];
    for (var p = 0; data.length < capacity; p++) data.push(pad[p % 2]);

    // split into blocks, compute EC, then interleave
    var blocks = [], ecBlocks = [], pos = 0;
    var groups = [[spec[2], spec[3]], [spec[4], spec[5]]];
    groups.forEach(function (g) {
      for (var b = 0; b < g[0]; b++) {
        var block = data.slice(pos, pos + g[1]);
        pos += g[1];
        blocks.push(block);
        ecBlocks.push(rsEncode(block, spec[1]));
      }
    });

    var result = [], maxData = Math.max(spec[3], spec[5]);
    for (var c = 0; c < maxData; c++) {
      for (var bi = 0; bi < blocks.length; bi++) {
        if (c < blocks[bi].length) result.push(blocks[bi][c]);
      }
    }
    for (var e = 0; e < spec[1]; e++) {
      for (var ei = 0; ei < ecBlocks.length; ei++) result.push(ecBlocks[ei][e]);
    }
    return result;
  }

  // --- matrix construction -------------------------------------------------
  function newMatrix(size) {
    var m = [];
    for (var i = 0; i < size; i++) m.push(new Array(size).fill(null));
    return m;
  }

  function placeFinder(m, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || rr >= m.length || cc < 0 || cc >= m.length) continue;
        var dark = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                   (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                   (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        m[rr][cc] = dark;
      }
    }
  }

  function placeAlignment(m, version) {
    var centers = ALIGN[version];
    var last = m.length - 1;
    centers.forEach(function (r) {
      centers.forEach(function (c) {
        var corner = (r === 6 && c === 6) || (r === 6 && c === last - 6) ||
                     (r === last - 6 && c === 6);
        if (corner) return;
        for (var dr = -2; dr <= 2; dr++) {
          for (var dc = -2; dc <= 2; dc++) {
            m[r + dr][c + dc] =
              Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          }
        }
      });
    });
  }

  function placeTiming(m) {
    for (var i = 8; i < m.length - 8; i++) {
      if (m[6][i] === null) m[6][i] = i % 2 === 0;
      if (m[i][6] === null) m[i][6] = i % 2 === 0;
    }
  }

  function reserveFormat(m) {
    var size = m.length;
    for (var i = 0; i < 9; i++) {
      if (m[8][i] === null) m[8][i] = false;
      if (m[i][8] === null) m[i][8] = false;
    }
    for (var j = 0; j < 8; j++) {
      if (m[8][size - 1 - j] === null) m[8][size - 1 - j] = false;
      if (m[size - 1 - j][8] === null) m[size - 1 - j][8] = false;
    }
    m[size - 8][8] = true; // dark module
  }

  function placeVersionInfo(m, version) {
    if (version < 7) return;
    var rem = version;
    for (var i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    var bits = (version << 12) | rem;
    var size = m.length;
    for (var k = 0; k < 18; k++) {
      var bit = ((bits >> k) & 1) === 1;
      var a = Math.floor(k / 3), b = (k % 3) + size - 11;
      m[a][b] = bit;
      m[b][a] = bit;
    }
  }

  function placeData(m, codewords, reserved) {
    var size = m.length, bitIndex = 0, upward = true;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right--; // skip vertical timing column
      for (var v = 0; v < size; v++) {
        var row = upward ? size - 1 - v : v;
        for (var c = 0; c < 2; c++) {
          var col = right - c;
          if (reserved[row][col]) continue;
          var bit = false;
          if (bitIndex < codewords.length * 8) {
            bit = ((codewords[bitIndex >> 3] >> (7 - (bitIndex & 7))) & 1) === 1;
          }
          m[row][col] = bit;
          bitIndex++;
        }
      }
      upward = !upward;
    }
  }

  var MASKS = [
    function (r, c) { return (r + c) % 2 === 0; },
    function (r) { return r % 2 === 0; },
    function (r, c) { return c % 3 === 0; },
    function (r, c) { return (r + c) % 3 === 0; },
    function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; },
    function (r, c) { return ((r * c) % 2) + ((r * c) % 3) === 0; },
    function (r, c) { return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; },
    function (r, c) { return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; }
  ];

  function applyFormat(m, maskIndex) {
    // EC level M = 0b00, BCH(15,5) with generator 0x537, XOR mask 0x5412
    var data = (0b00 << 3) | maskIndex;
    var rem = data;
    for (var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    var bits = ((data << 10) | rem) ^ 0x5412;
    var size = m.length;
    for (var k = 0; k < 15; k++) {
      var bit = ((bits >> k) & 1) === 1;
      // copy 1 — around the top-left finder
      if (k < 6) m[k][8] = bit;
      else if (k < 8) m[k + 1][8] = bit;
      else if (k === 8) m[8][7] = bit;
      else m[8][14 - k] = bit;
      // copy 2 — split between bottom-left and top-right
      if (k < 8) m[8][size - 1 - k] = bit;
      else m[size - 15 + k][8] = bit;
    }
  }

  function penalty(m) {
    var size = m.length, score = 0, r, c, i;
    // rule 1: runs of 5+ same-colour modules
    for (r = 0; r < size; r++) {
      for (var dir = 0; dir < 2; dir++) {
        var run = 1;
        for (c = 1; c < size; c++) {
          var cur = dir ? m[c][r] : m[r][c];
          var prev = dir ? m[c - 1][r] : m[r][c - 1];
          if (cur === prev) {
            run++;
            if (run === 5) score += 3;
            else if (run > 5) score += 1;
          } else run = 1;
        }
      }
    }
    // rule 2: 2x2 blocks of the same colour
    for (r = 0; r < size - 1; r++) {
      for (c = 0; c < size - 1; c++) {
        var v = m[r][c];
        if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
      }
    }
    // rule 3: finder-like 1:1:3:1:1 patterns
    var pat1 = [true, false, true, true, true, false, true, false, false, false, false];
    var pat2 = [false, false, false, false, true, false, true, true, true, false, true];
    function matches(line, at, pat) {
      for (var k = 0; k < 11; k++) if (line[at + k] !== pat[k]) return false;
      return true;
    }
    for (r = 0; r < size; r++) {
      var row = m[r], col = [];
      for (i = 0; i < size; i++) col.push(m[i][r]);
      for (c = 0; c + 11 <= size; c++) {
        if (matches(row, c, pat1) || matches(row, c, pat2)) score += 40;
        if (matches(col, c, pat1) || matches(col, c, pat2)) score += 40;
      }
    }
    // rule 4: overall dark/light balance
    var dark = 0;
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  function matrix(text) {
    var bytes = utf8Bytes(String(text));
    var version = pickVersion(bytes.length);
    var codewords = buildCodewords(bytes, version);
    var size = version * 4 + 17;

    var base = newMatrix(size);
    placeFinder(base, 0, 0);
    placeFinder(base, 0, size - 7);
    placeFinder(base, size - 7, 0);
    placeAlignment(base, version);
    placeTiming(base);
    placeVersionInfo(base, version);
    reserveFormat(base);

    var reserved = base.map(function (row) {
      return row.map(function (cell) { return cell !== null; });
    });

    var best = null, bestScore = Infinity;
    for (var maskIndex = 0; maskIndex < 8; maskIndex++) {
      var m = base.map(function (row) { return row.slice(); });
      placeData(m, codewords, reserved);
      for (var r = 0; r < size; r++) {
        for (var c = 0; c < size; c++) {
          if (!reserved[r][c] && MASKS[maskIndex](r, c)) m[r][c] = !m[r][c];
        }
      }
      applyFormat(m, maskIndex);
      var score = penalty(m);
      if (score < bestScore) { bestScore = score; best = m; }
    }
    return best;
  }

  function svg(text, opts) {
    opts = opts || {};
    var quiet = opts.quiet == null ? 4 : opts.quiet;
    var dark = opts.dark || '#101010';
    var light = opts.light || '#ffffff';
    var m = matrix(text);
    var size = m.length + quiet * 2;
    var path = '';
    for (var r = 0; r < m.length; r++) {
      for (var c = 0; c < m.length; c++) {
        if (m[r][c]) path += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' +
      size + '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
      '<rect width="' + size + '" height="' + size + '" fill="' + light + '"/>' +
      '<path d="' + path + '" fill="' + dark + '"/></svg>';
  }

  global.QR = { matrix: matrix, svg: svg };
})(typeof window !== 'undefined' ? window : globalThis);
