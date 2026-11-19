/* NS caview (gap round, 2026-11-14): the accountant's viewer, ca.niveshsahayak.in.
   Opens a .nsca file (cashare.js) READ-ONLY: nothing is saved, nothing leaves the browser, no login, works offline once the page has loaded.
   The App's own screens (dues, parties, books, ledgers, final accounts, reports) run on the file's data through the in-memory store (castore.js);
   this file adds what an accountant needs on top: the file check, documents, day book, GST working and queries/comments.
   Comments are kept in this browser (localStorage) per file and leave only as a small .nsca-comments file the accountant sends back. */
(function () {
  'use strict';
  var NS = window.NS, C = window.NSCAshare, B = window.NSBooks, $ = NS.$, $$ = NS.$$, esc = NS.esc, r2 = NS.r2, num = NS.num;
  function T(k, v) { return NS.t(k, v); }
  var SHARE = null, CF = null, VER = null, DOCS = [], BIZ = '', CKEY = 'ns-ca-comments-';

  function money(v, sym) { return NS.money(v, sym); }
  function loadCF(id) { try { return JSON.parse(localStorage.getItem(CKEY + id)); } catch (e) { return null; } }
  function saveCF() { try { localStorage.setItem(CKEY + SHARE.id, JSON.stringify(CF)); } catch (e) { NS.toast(T('cv.nostore'), 'bad'); } }
  function who() { try { return localStorage.getItem('ns-ca-by') || ''; } catch (e) { return ''; } }
  function count(kind, id) { return CF ? CF.items.filter(function (c) { return c.ref && c.ref.kind === kind && c.ref.id === id; }).length : 0; }
  function dlg(id, title, html) {
    var d = $('#' + id);
    if (!d) { d = NS.el('dialog', { id: id, 'aria-labelledby': id + '-h' }); document.body.appendChild(d); }
    d.innerHTML = '<div class="dlg-h"><h2 id="' + id + '-h">' + esc(title) + '</h2><form method="dialog"><button class="btn sm">' + esc(T('close')) + '</button></form></div><div class="dlg-b">' + html + '</div>';
    d.showModal ? d.showModal() : d.setAttribute('open', ''); return d;
  }

  /* ---------- opening a file ---------- */
  function openText(txt, name) {
    var s; try { s = JSON.parse(txt); } catch (e) { s = null; }
    if (s && s.format === C.CFORMAT) return fail(T('cv.iscomments'));
    var v = C.verify(s);
    if (!v.ok && v.why === 'format') return fail(T('cv.notfile'));
    if (!v.ok && v.why === 'newer') return fail(T('cv.newer'));
    SHARE = s; VER = v; BIZ = s.business && s.business.name || '';
    var data = s.data; if (!data.biz.length) data.biz = [{ id: 'cabiz', name: BIZ, gstin: s.business.gstin || '' }];
    NSStore._fill(data); DOCS = data.doc;
    CF = loadCF(s.id) || C.newComments(s); if (!CF.items) CF.items = [];
    start();
  }
  function fail(msg) { var e = $('#cv-err'); if (e) { e.hidden = false; e.textContent = msg; } return false; }
  function start() {
    document.documentElement.classList.add('ca-open');
    $('#cv-err').hidden = true;
    var p = SHARE.period, from = p.from || '', to = p.to || NS.today();
    renderBanner();
    if (window.NSApp && NSApp.range) NSApp.range(from, to);
    try { sessionStorage.setItem('ns-app-biz', (NSStore && SHARE.data.biz[0].id) || ''); } catch (e) {}
    location.hash = '#'; document.dispatchEvent(new CustomEvent('ns-data'));
    if (window.NSApp && NSApp.show) { NSApp.show(); setTimeout(function () { NSApp.show(); }, 500); }   /* the second draw picks up the data the first one was still reading */
    var b = $('#cv-banner'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'start' });
  }

  function renderBanner() {
    var s = SHARE, left = C.leftOut(s).map(function (k) { return T('ca.no.' + k); }).join(', ');
    var tamper = VER.ok ? '<p class="note ok-note">' + esc(T('cv.sumok')) + '</p>' : '<p class="note bad"><b>' + esc(T('cv.sumbad')) + '</b> ' + esc(T('cv.sumbadh')) + '</p>';
    $('#cv-banner').innerHTML = '<div class="card cv-card"><h2>' + esc(s.business.name) + (s.business.gstin ? ' <span class="soft mono">' + esc(s.business.gstin) + '</span>' : '') + '</h2>' +
      '<p>' + esc(T('cv.period', { from: s.period.from ? NS.fmtDate(s.period.from) : '—', to: s.period.to ? NS.fmtDate(s.period.to) : '—' })) + (s.period.earlier ? ' · ' + esc(T('cv.earlier')) : '') + ' · ' + esc(T('cv.made', { d: NS.fmtDate(String(s.created).slice(0, 10)) })) + '</p>' +
      (s.note ? '<p class="note"><b>' + esc(T('cv.fromowner')) + '</b> ' + esc(s.note).replace(/\n/g, '<br>') + '</p>' : '') + tamper +
      '<p>' + esc(T('cv.code')) + ' <b class="mono">' + esc(VER.code) + '</b></p>' +
      '<p class="cv-chk"><label for="cv-told">' + esc(T('cv.told')) + '</label> <input id="cv-told" class="mono" maxlength="19" placeholder="XXXX-XXXX-XXXX-XXXX" autocomplete="off"> <span id="cv-told-r" aria-live="polite"></span></p>' +
      '<p class="soft">' + esc(T('cv.counts', { d: s.counts.docs, p: s.counts.parties, i: s.counts.items })) + ' ' + esc(left ? T('cv.notin', { w: left }) : T('cv.allin')) + '</p>' +
      '<p class="soft">' + esc(T('cv.readonly')) + ' ' + esc(T('ca.notlive')) + '</p>' +
      '<div class="btns"><button type="button" class="btn primary" data-cv-comment>' + esc(T('cv.addc')) + '</button><button type="button" class="btn" data-cv-other>' + esc(T('cv.other')) + '</button></div></div>';
    $('#cv-told').addEventListener('input', function (e) {
      var v = e.target.value.toUpperCase().replace(/[^0-9A-F]/g, ''), r = $('#cv-told-r');
      if (v.length < 16) { r.textContent = ''; return; }
      var ok = v.slice(0, 16) === VER.code.replace(/-/g, '');
      r.className = ok ? 'ok-note' : 'bad'; r.textContent = ok ? T('cv.told.ok') : T('cv.told.bad');
    });
    $('[data-cv-comment]').addEventListener('click', function () { commentBox({ kind: 'screen', id: location.hash || '#', label: screenName() }); });
    $('[data-cv-other]').addEventListener('click', function () { if (NS.okSync(T('cv.confirmother'))) { location.hash = ''; location.reload(); } });
  }
  function screenName() { var s = NS.$('.hub-nav [aria-current="page"]'); return (s ? s.textContent : '') + (location.hash.length > 1 ? ' ' + decodeURIComponent(location.hash.slice(1)) : ''); }

  /* ---------- queries and comments ---------- */
  function commentBox(ref) {
    var old = CF.items.filter(function (c) { return c.ref && c.ref.kind === ref.kind && c.ref.id === ref.id; });
    var d = dlg('cv-cbox', T('cv.addc'), '<p class="soft">' + esc(ref.kind === 'doc' ? T('cv.about', { x: ref.label }) : ref.kind === 'party' ? T('cv.aboutp', { x: ref.label }) : ref.kind === 'screen' ? T('cv.abouts', { x: ref.label || '' }) : T('cv.aboutg')) + '</p>' +
      (old.length ? '<ul class="cv-old">' + old.map(function (c) { return '<li><b>' + esc(T(c.kind === 'note' ? 'ca.knote' : 'ca.kquery')) + ':</b> ' + esc(c.text) + (c.reply ? '<br><i>' + esc(T('cv.ownerreply')) + ' ' + esc(c.reply) + '</i>' : '') + '</li>'; }).join('') + '</ul>' : '') +
      '<label for="cv-ct">' + esc(T('cv.ctext')) + '</label><textarea id="cv-ct" rows="3" maxlength="1500"></textarea>' +
      '<label class="chk"><input type="radio" name="cv-ck" value="query" checked> ' + esc(T('ca.kquery')) + '</label><label class="chk"><input type="radio" name="cv-ck" value="note"> ' + esc(T('ca.knote')) + '</label>' +
      '<label for="cv-by">' + esc(T('cv.by')) + '</label><input id="cv-by" value="' + esc(who()) + '" maxlength="60"><div class="btns"><button type="button" class="btn primary" id="cv-cs">' + esc(T('cv.csave')) + '</button></div>');
    $('#cv-cs', d).addEventListener('click', function () {
      var by = $('#cv-by', d).value.trim(); try { localStorage.setItem('ns-ca-by', by); } catch (e) {}
      var c = C.addComment(CF, ref, $('#cv-ct', d).value, ($('[name=cv-ck]:checked', d) || {}).value, by);
      if (!c) { $('#cv-ct', d).focus(); return; }
      saveCF(); d.close(); NS.toast(T('cv.csaved')); badge(); if (cur === 'cacom') NSApp.show(); else markRows();
    });
  }
  function badge() { var a = $('[data-sec="cacom"] span'); if (a) a.textContent = T('cv.cT') + (CF && CF.items.length ? ' (' + CF.items.length + ')' : ''); }
  function markRows() { $$('[data-cdoc]').forEach(function (b) { var n = count('doc', b.getAttribute('data-cdoc')); b.textContent = n ? '💬 ' + n : '💬'; }); }
  function commentsHtml() {
    var rows = CF.items.slice().reverse();
    return '<div class="pane-hd"><h2>' + esc(T('cv.cT')) + '</h2><div class="quick"><button type="button" class="btn primary" data-cv-comment2>' + esc(T('cv.addc')) + '</button>' +
      (rows.length ? '<button type="button" class="btn" data-cv-export>' + esc(T('cv.export')) + '</button>' : '') + '<button type="button" class="btn" data-cv-load>' + esc(T('cv.loadback')) + '</button></div></div>' +
      '<p class="soft">' + esc(T('cv.cIntro')) + '</p><input type="file" id="cv-lf" accept=".nsca-comments,.json" hidden><div id="cv-cmsg" aria-live="polite"></div>' +
      (rows.length ? rows.map(function (c) {
        var r = c.ref || {}, d = r.kind === 'doc' ? DOCS.filter(function (x) { return x.id === r.id; })[0] : null;
        return '<div class="card' + (c.status === 'closed' ? ' ca-done' : '') + '"><p class="soft">' + esc(d ? C.brief(d) : r.label || (r.kind === 'general' ? T('ca.general') : r.id)) + '</p><p><b>' + esc(T(c.kind === 'note' ? 'ca.knote' : 'ca.kquery')) + '</b> · ' + esc(NS.fmtDate(String(c.at).slice(0, 10))) + '</p><p>' + esc(c.text).replace(/\n/g, '<br>') + '</p>' +
          (c.reply ? '<p class="note ok-note"><b>' + esc(T('cv.ownerreply')) + '</b> ' + esc(c.reply).replace(/\n/g, '<br>') + '</p>' : '') + (c.status === 'closed' ? '<p class="soft">' + esc(T('ca.closed')) + '</p>' : '') +
          '<div class="btns"><button type="button" class="btn sm" data-cv-del="' + esc(c.id) + '">' + esc(T('cv.cdel')) + '</button></div></div>';
      }).join('') : '<p>' + esc(T('ca.none')) + '</p>');
  }
  function wireComments(pane) {
    $('[data-cv-comment2]', pane).addEventListener('click', function () { commentBox({ kind: 'general', id: '', label: '' }); });
    var ex = $('[data-cv-export]', pane);
    if (ex) ex.addEventListener('click', function () {
      var cf = C.sealComments(JSON.parse(JSON.stringify(CF))), name = ('comments-' + SHARE.business.name + '-' + NS.today()).replace(/[\\\/:*?"<>|\s]+/g, '-') + '.nsca-comments';
      var f = new File([JSON.stringify(cf, null, 1)], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: name, text: T('cv.sharetext', { n: C.openCount(cf), code: cf.shareCode }) }).catch(function () {});
      else { NS.saveFile(f, name); NS.toast(T('pdf.saved', { file: name })); }
    });
    $('[data-cv-load]', pane).addEventListener('click', function () { $('#cv-lf', pane).click(); });
    $('#cv-lf', pane).addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0]; if (!f) return;
      f.text().then(function (t) {
        var inc; try { inc = JSON.parse(t); } catch (x) { inc = null; }
        if (!C.verifyComments(inc).ok || inc.shareId !== SHARE.id) { $('#cv-cmsg', pane).innerHTML = '<p class="note bad">' + esc(T('cv.wrongc')) + '</p>'; return; }
        var m = C.mergeComments(CF, inc); CF = m.file; saveCF(); NS.toast(T('ca.loaded', { a: m.added, c: m.changed })); NSApp.show();
      }); e.target.value = '';
    });
    pane.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-cv-del]'); if (!b) return;
      CF.items = CF.items.filter(function (c) { return c.id !== b.getAttribute('data-cv-del'); }); saveCF(); badge(); NSApp.show();
    });
  }

  /* ---------- documents ---------- */
  var TYPE = { invoice: 'Tax invoice', cashmemo: 'Cash memo', pharma: 'Pharmacy bill', resto: 'Restaurant bill', lr: 'Bilty', fee: 'Fee receipt', job: 'Job card', rabill: 'RA bill', note: 'Note', receipt: 'Receipt', voucher: 'Voucher', self: 'Self invoice',
    pbill: 'Purchase bill', exp: 'Expense', contra: 'Contra', ob: 'Opening balance', jv: 'Journal', quote: 'Quotation', proforma: 'Proforma', so: 'Sales order', challan: 'Challan', po: 'Purchase order', salary: 'Salary slip', rent: 'Rent receipt', fa: 'Fixed asset', oinc: 'Other income', taxpay: 'Tax payment' };
  function tname(d) { return d.type === 'note' ? (d.kind === 'debit' ? 'Debit note' : 'Credit note') : TYPE[d.type || 'invoice'] || d.type; }
  function totalOf(d) {
    try { var R = B.role(d); if (R === 'in' || R === 'out' || R === 'outexp' || R === 'oinc' || R === 'refund' || R === 'contra' || R === 'ob' || R === 'exp') return num(d.amount) || (d.lines || []).reduce(function (s, l) { return s + num(l.amt); }, 0); return B.itemTotals(d).total; } catch (e) { return num(d.total || d.amount); }
  }
  var DQ = '', DT = 'all', DF = '', DTO = '';
  function docsHtml() {
    var types = {}; DOCS.forEach(function (d) { types[tname(d)] = 1; });
    var q = DQ.toLowerCase(), rows = DOCS.filter(function (d) {
      if (DT !== 'all' && tname(d) !== DT) return false; if (DF && d.date < DF) return false; if (DTO && d.date > DTO) return false;
      return !q || [d.no, d.billNo, d.buyer && d.buyer.name, d.buyer && d.buyer.gstin, tname(d), d.notes, d.narration].join(' ').toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || String(b.no || '').localeCompare(String(a.no || '')); });
    var sum = rows.reduce(function (s, d) { return s + totalOf(d); }, 0);
    return '<div class="pane-hd"><h2>' + esc(T('cv.docs')) + '</h2></div><div class="quick cv-filt"><input type="search" id="cv-dq" value="' + esc(DQ) + '" placeholder="' + esc(T('cv.dsearch')) + '" aria-label="' + esc(T('cv.dsearch')) + '">' +
      '<select id="cv-dt"><option value="all">' + esc(T('cv.alltypes')) + '</option>' + Object.keys(types).sort().map(function (t) { return '<option' + (DT === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select>' +
      '<input type="date" id="cv-df" value="' + esc(DF) + '" aria-label="' + esc(T('b3.ac.from')) + '"><input type="date" id="cv-dto" value="' + esc(DTO) + '" aria-label="' + esc(T('b3.ac.to')) + '"></div>' +
      '<p class="soft">' + esc(T('cv.dcount', { n: rows.length, v: money(r2(sum)) })) + '</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(T('cv.date')) + '</th><th>' + esc(T('cv.type')) + '</th><th>' + esc(T('cv.no')) + '</th><th>' + esc(T('cv.party')) + '</th><th class="n">' + esc(T('cv.amount')) + '</th><th></th></tr></thead><tbody>' +
      (rows.slice(0, 400).map(function (d) {
        return '<tr><td>' + esc(NS.fmtDate(d.date)) + '</td><td>' + esc(tname(d)) + '</td><td>' + esc(d.no || d.billNo || '') + '</td><td>' + esc(d.buyer && d.buyer.name || '') + '</td><td class="n">' + money(r2(totalOf(d)), false) + '</td><td><button type="button" class="btn sm" data-cv-view="' + esc(d.id) + '">' + esc(T('cv.view')) + '</button> <button type="button" class="btn sm" data-cdoc="' + esc(d.id) + '" aria-label="' + esc(T('cv.addc')) + '">💬</button></td></tr>';
      }).join('') || '<tr><td colspan="6">' + esc(T('cv.none')) + '</td></tr>') + '</tbody></table></div>' + (rows.length > 400 ? '<p class="soft">' + esc(T('cv.first400')) + '</p>' : '');
  }
  function docView(id) {
    var d = DOCS.filter(function (x) { return x.id === id; })[0]; if (!d) return;
    var t = null, R = ''; try { R = B.role(d); t = (d.items && d.items.length) ? B.itemTotals(d) : null; } catch (e) {}
    var facts = [[T('cv.type'), tname(d)], [T('cv.no'), d.no || d.billNo || ''], [T('cv.date'), NS.fmtDate(d.date)], [T('cv.party'), d.buyer && d.buyer.name || ''], [T('cv.gstin'), d.buyer && d.buyer.gstin || ''], [T('cv.pos'), d.pos || d.buyer && d.buyer.state || ''],
      [T('cv.mode'), d.mode || d.payMode || ''], [T('cv.status'), d.status || ''], [T('cv.ref'), d.ref || (d.orig && d.orig.no) || ''], [T('cv.narr'), d.narration || d.notes || '']].filter(function (f) { return f[1]; });
    var h = '<table class="tbl"><tbody>' + facts.map(function (f) { return '<tr><th scope="row">' + esc(f[0]) + '</th><td>' + esc(f[1]) + '</td></tr>'; }).join('') + '</tbody></table>';
    if (d.items && d.items.length) h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(T('cv.item')) + '</th><th>HSN</th><th class="n">' + esc(T('cv.qty')) + '</th><th class="n">' + esc(T('cv.rate')) + '</th><th class="n">GST %</th></tr></thead><tbody>' +
      d.items.map(function (i) { return '<tr><td>' + esc(i.desc || '') + '</td><td>' + esc(i.hsn || '') + '</td><td class="n">' + esc(i.qty == null ? '' : i.qty) + '</td><td class="n">' + esc(i.rate || '') + '</td><td class="n">' + esc(i.gst == null ? '' : i.gst) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (d.lines && d.lines.length) h += '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(T('cv.item')) + '</th><th class="n">' + esc(T('cv.amount')) + '</th></tr></thead><tbody>' + d.lines.map(function (l) { return '<tr><td>' + esc(l.desc || l.head || '') + '</td><td class="n">' + esc(l.amt || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
    if (t) h += '<table class="tbl"><tbody><tr><th scope="row">' + esc(T('cv.taxable')) + '</th><td class="n">' + money(t.taxable, false) + '</td></tr>' + (t.cgst ? '<tr><th scope="row">CGST</th><td class="n">' + money(t.cgst, false) + '</td></tr>' : '') + (t.sgst ? '<tr><th scope="row">SGST/UTGST</th><td class="n">' + money(t.sgst, false) + '</td></tr>' : '') + (t.igst ? '<tr><th scope="row">IGST</th><td class="n">' + money(t.igst, false) + '</td></tr>' : '') + (t.round ? '<tr><th scope="row">' + esc(T('cv.round')) + '</th><td class="n">' + money(t.round, false) + '</td></tr>' : '') + '<tr><th scope="row">' + esc(T('cv.total')) + '</th><td class="n"><b>' + money(t.total, false) + '</b></td></tr></tbody></table>';
    else if (R) h += '<p><b>' + esc(T('cv.amount')) + ':</b> ' + money(r2(totalOf(d))) + '</p>';
    if (d.alloc && d.alloc.length) h += '<p class="soft">' + esc(T('cv.against')) + ' ' + esc(d.alloc.map(function (a) { return (a.no || '') + ' ' + money(num(a.amt), false); }).join(', ')) + '</p>';
    var P = R ? B.postings(d) : []; if (P.length) h += '<h3>' + esc(T('cv.entries')) + '</h3><table class="tbl"><thead><tr><th>' + esc(T('cv.account')) + '</th><th class="n">Dr</th><th class="n">Cr</th></tr></thead><tbody>' + P.map(function (l) { return '<tr><td>' + esc(accName(l.a)) + '</td><td class="n">' + (l.dr ? money(l.dr, false) : '') + '</td><td class="n">' + (l.cr ? money(l.cr, false) : '') + '</td></tr>'; }).join('') + '</tbody></table>';
    h += '<div class="btns"><button type="button" class="btn primary" data-cv-c2="' + esc(d.id) + '">' + esc(T('cv.addc')) + '</button></div>';
    var dd = dlg('cv-doc', C.brief(d), h);
    $('[data-cv-c2]', dd).addEventListener('click', function () { dd.close(); commentBox({ kind: 'doc', id: d.id, label: C.brief(d) }); });
  }
  function accName(a) {
    if (B.isBank && B.isBank(a)) return B.bankName(a);   /* each bank account by its name (several banks) */
    if (/^p:/.test(a)) { var k = a.slice(2), hit = null; DOCS.some(function (d) { if (d.buyer && B.key(d.buyer.name) === k) { hit = d.buyer.name; return true; } }); return hit || k; }
    var m = { sales: 'Sales', 'sales-return': 'Sales return', cash: 'Cash', bank: 'Bank', 'round-off': 'Round off', 'tds-receivable': 'TDS receivable', 'tds-payable': 'TDS payable', 'tcs-payable': 'TCS payable', purchases: 'Purchases', 'gst-out-cgst': 'Output CGST', 'gst-out-sgst': 'Output SGST', 'gst-out-utgst': 'Output UTGST', 'gst-out-igst': 'Output IGST', 'gst-in-cgst': 'Input CGST', 'gst-in-sgst': 'Input SGST', 'gst-in-igst': 'Input IGST' };
    return m[a] || a.replace(/^exp:/, 'Expense: ').replace(/^inc:/, 'Income: ').replace(/-/g, ' ');
  }

  /* ---------- day book ---------- */
  var DBQ = '';
  function dateBar() { var r = NSApp.range(); return '<div class="tools-row"><label>' + esc(T('b3.ac.from')) + ' <input type="date" id="cv-rf" value="' + r[0] + '"></label><label>' + esc(T('b3.ac.to')) + ' <input type="date" id="cv-rt" value="' + r[1] + '"></label></div>'; }
  function wireDates(pane) { var f = $('#cv-rf', pane), t = $('#cv-rt', pane); if (!f) return; function go() { if (f.value && t.value && f.value <= t.value) { NSApp.range(f.value, t.value); NSApp.show(false); } } f.addEventListener('change', go); t.addEventListener('change', go); }
  function dayHtml() {
    var r = NSApp.range(), ent = B.inBooks(DOCS, BIZ).filter(function (d) { return d.date >= r[0] && d.date <= r[1]; }), q = DBQ.toLowerCase(), td = 0, tc = 0;
    if (q) ent = ent.filter(function (d) { return (C.brief(d) + ' ' + B.postings(d).map(function (l) { return accName(l.a); }).join(' ')).toLowerCase().indexOf(q) >= 0; });
    var rows = ent.map(function (d) {
      var L = B.postings(d), id = d.id;
      return L.map(function (l, i) { td = r2(td + l.dr); tc = r2(tc + l.cr);
        return '<tr' + (i === 0 ? ' class="first"' : '') + '><td>' + (i === 0 ? esc(NS.fmtDate(d.date)) : '') + '</td><td>' + (i === 0 ? esc(C.brief(d).replace(/ · \d{4}-\d\d-\d\d/, '')) : '') + '</td><td>' + (l.cr ? '&nbsp;&nbsp;To ' : '') + esc(accName(l.a)) + '</td><td class="n">' + (l.dr ? money(l.dr, false) : '') + '</td><td class="n">' + (l.cr ? money(l.cr, false) : '') + '</td><td>' + (i === 0 && id ? '<button type="button" class="btn sm" data-cdoc="' + esc(id) + '" aria-label="' + esc(T('cv.addc')) + '">💬</button>' : '') + '</td></tr>'; }).join('');
    }).join('');
    return '<div class="pane-hd"><h2>' + esc(T('cv.day')) + '</h2></div><p class="soft">' + esc(T('cv.dayh')) + '</p><div class="quick cv-filt">' + dateBar() + '<input type="search" id="cv-dbq" value="' + esc(DBQ) + '" placeholder="' + esc(T('cv.dsearch')) + '"></div>' +
      '<div class="tbl-wrap"><table class="tbl st"><thead><tr><th>' + esc(T('cv.date')) + '</th><th>' + esc(T('cv.entry')) + '</th><th>' + esc(T('cv.account')) + '</th><th class="n">Dr</th><th class="n">Cr</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6">' + esc(T('cv.none')) + '</td></tr>') +
      '</tbody><tfoot><tr><th colspan="3">' + esc(T('cv.total')) + '</th><th class="n">' + money(td, false) + '</th><th class="n">' + money(tc, false) + '</th><th></th></tr></tfoot></table></div>';
  }

  /* ---------- GST working (month by month, from the same entries as the books) ---------- */
  function gstRows() {
    var m = {};
    B.inBooks(DOCS, BIZ).forEach(function (d) {
      var mo = String(d.date || '').slice(0, 7); if (!mo) return;
      var o = m[mo] || (m[mo] = { sales: 0, oc: 0, os: 0, oi: 0, ic: 0, is: 0, ii: 0 });
      B.postings(d).forEach(function (l) {
        var v = r2(l.cr - l.dr);
        if (l.a === 'sales' || l.a === 'sales-return' || l.a.indexOf('sales:') === 0) o.sales = r2(o.sales + v);
        else if (l.a === 'gst-out-cgst') o.oc = r2(o.oc + v); else if (l.a === 'gst-out-sgst' || l.a === 'gst-out-utgst') o.os = r2(o.os + v); else if (l.a === 'gst-out-igst') o.oi = r2(o.oi + v);
        else if (l.a === 'gst-in-cgst') o.ic = r2(o.ic - v); else if (l.a === 'gst-in-sgst') o.is = r2(o.is - v); else if (l.a === 'gst-in-igst') o.ii = r2(o.ii - v);
      });
    });
    return Object.keys(m).sort().map(function (k) { return Object.assign({ month: k }, m[k]); });
  }
  function gstHtml() {
    var rows = gstRows(), tot = { sales: 0, oc: 0, os: 0, oi: 0, ic: 0, is: 0, ii: 0 };
    rows.forEach(function (o) { Object.keys(tot).forEach(function (k) { tot[k] = r2(tot[k] + o[k]); }); });
    function line(o, lbl) { var out = r2(o.oc + o.os + o.oi), inp = r2(o.ic + o.is + o.ii); return '<tr><th scope="row">' + esc(lbl) + '</th><td class="n">' + money(o.sales, false) + '</td><td class="n">' + money(o.oc, false) + '</td><td class="n">' + money(o.os, false) + '</td><td class="n">' + money(o.oi, false) + '</td><td class="n">' + money(o.ic, false) + '</td><td class="n">' + money(o.is, false) + '</td><td class="n">' + money(o.ii, false) + '</td><td class="n"><b>' + money(r2(out - inp), false) + '</b></td></tr>'; }
    return '<div class="pane-hd"><h2>' + esc(T('cv.gst')) + '</h2></div><p class="soft">' + esc(T('cv.gsth')) + '</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>' + esc(T('cv.month')) + '</th><th class="n">' + esc(T('cv.taxsales')) + '</th><th class="n">Out CGST</th><th class="n">Out SGST</th><th class="n">Out IGST</th><th class="n">In CGST</th><th class="n">In SGST</th><th class="n">In IGST</th><th class="n">' + esc(T('cv.net')) + '</th></tr></thead><tbody>' +
      (rows.map(function (o) { return line(o, new Date(o.month + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })); }).join('') || '<tr><td colspan="9">' + esc(T('cv.none')) + '</td></tr>') + '</tbody><tfoot>' + line(tot, T('cv.total')).replace(/<tr>/, '<tr class="first">') + '</tfoot></table></div>' +
      '<p class="soft">' + esc(T('cv.gstnote')) + '</p>';
  }

  /* ---------- sections and wiring ---------- */
  var cur = '';
  function mount() {
    if (!window.NSApp || !NSApp.addSection) return;
    NSApp.addSection('cadoc', function () { cur = 'cadoc'; return docsHtml(); }, function (pane) {
      var rerun = function () { var p = $('#cv-dq'); var pos = p && p.selectionStart; NSApp.show(); };
      var t; $('#cv-dq', pane).addEventListener('input', function (e) { DQ = e.target.value; clearTimeout(t); t = setTimeout(function () { NSApp.show(false); var n = $('#cv-dq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
      $('#cv-dt', pane).addEventListener('change', function (e) { DT = e.target.value; NSApp.show(); });
      $('#cv-df', pane).addEventListener('change', function (e) { DF = e.target.value; NSApp.show(); }); $('#cv-dto', pane).addEventListener('change', function (e) { DTO = e.target.value; NSApp.show(); });
      pane.addEventListener('click', function (e) {
        var v = e.target.closest && e.target.closest('[data-cv-view]'); if (v) docView(v.getAttribute('data-cv-view'));
        var c = e.target.closest && e.target.closest('[data-cdoc]'); if (c) { var d = DOCS.filter(function (x) { return x.id === c.getAttribute('data-cdoc'); })[0]; commentBox({ kind: 'doc', id: d.id, label: C.brief(d) }); }
      });
      markRows();
    });
    NSApp.addSection('cadb', function () { cur = 'cadb'; return dayHtml(); }, function (pane) {
      var t; $('#cv-dbq', pane).addEventListener('input', function (e) { DBQ = e.target.value; clearTimeout(t); t = setTimeout(function () { NSApp.show(false); var n = $('#cv-dbq'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); });
      pane.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('[data-cdoc]'); if (c) { var d = DOCS.filter(function (x) { return x.id === c.getAttribute('data-cdoc'); })[0]; if (d) commentBox({ kind: 'doc', id: d.id, label: C.brief(d) }); } });
      wireDates(pane); markRows();
    });
    NSApp.addSection('cagst', function () { cur = 'cagst'; return gstHtml(); });
    NSApp.addSection('cacom', function () { cur = 'cacom'; return commentsHtml(); }, wireComments);
    document.addEventListener('ns-sec', function () {});
    badge();
  }

  /* the file chooser (home of the viewer) */
  function init() {
    var inp = $('#cv-file'), dz = $('#cv-drop');
    function take(f) { if (!f) return; f.text().then(function (t) { openText(t, f.name); }, function () { fail(T('cv.notfile')); }); }
    if (inp) inp.addEventListener('change', function (e) { take(e.target.files[0]); e.target.value = ''; });
    if (dz) {
      ['dragenter', 'dragover'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.add('on'); }); });
      ['dragleave', 'drop'].forEach(function (n) { dz.addEventListener(n, function (e) { e.preventDefault(); dz.classList.remove('on'); }); });
      dz.addEventListener('drop', function (e) { take(e.dataTransfer.files[0]); });
    }
    /* a file given to the page by the phone's "Open with" (launch queue) */
    if (window.launchQueue && launchQueue.setConsumer) launchQueue.setConsumer(function (p) { if (p.files && p.files[0]) p.files[0].getFile().then(take); });
    if (window.NSApp) mount(); else window.addEventListener('load', mount);
  }
  window.NSCAV = { open: openText, share: function () { return SHARE; }, comments: function () { return CF; }, gstRows: gstRows };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
