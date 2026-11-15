/* NSStore for the accountant's viewer (ca.niveshsahayak.in): the same calls as store.js, but the data is only what a .nsca file brought
   (kept in memory) and nothing can be saved. The accountant's own Nivesh Sahayak data (if any) is never touched: this site has its own
   address and never opens the shared data home. */
(function () {
  'use strict';
  var DATA = { biz: [], party: [], item: [], doc: [], bin: [], log: [] }, META = {}, MODE = 'ca';
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function ro() { var e = new Error(window.NS && NS.t ? NS.t('cv.readonly') : 'This is a read-only view of a file.'); e.readonly = true; return Promise.reject(e); }
  window.NSStore = {
    ready: function () { return Promise.resolve(MODE); },
    mode: function () { return MODE; },
    list: function (s) { return Promise.resolve(copy(DATA[s] || [])); },
    get: function (s, id) { return Promise.resolve(copy((DATA[s] || []).filter(function (x) { return x.id === id; })[0] || null)); },
    put: ro, del: ro, restore: ro, importAll: ro,
    binDays: 30, lockDate: function () { return Promise.resolve(''); },
    exportAll: function () { return Promise.resolve(copy(DATA)); },
    persist: function () { return Promise.resolve(false); }, estimate: function () { return Promise.resolve(null); },
    autosave: function () { return Promise.resolve(null); },
    /* settings changes (language, theme) are accepted for this visit and forgotten: they must not write anything */
    meta: function (k, v) { if (arguments.length < 2) return Promise.resolve(META[k] === undefined ? undefined : copy(META[k])); return Promise.resolve(); },
    uid: function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    /* the viewer fills it from a verified file */
    _fill: function (data) {
      ['biz', 'party', 'item', 'doc'].forEach(function (s) { DATA[s] = copy(data[s] || []); });
      META = copy(data.meta || {});
    },
    _clear: function () { DATA = { biz: [], party: [], item: [], doc: [], bin: [], log: [] }; META = {}; }
  };
})();
