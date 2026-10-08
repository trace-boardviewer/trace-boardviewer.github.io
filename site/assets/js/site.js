/* TRACE Boardviewer site — theme toggle, release data, captions, gallery lightbox, demo seeking. No network calls except the site's own JSON files. */
(function () {
  'use strict';
  var root = document.documentElement;
  // The site root, taken from this script's own address, so every page (at any depth) fetches the same JSON files.
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/assets\/js\/site\.js(?:[?#].*)?$/, '') : '';
  })();
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: ignore */ } }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  // Each page declares its own language; English is only the fallback.
  if (!root.getAttribute('lang')) root.setAttribute('lang', 'en');

  // Theme: stored > system.
  var theme = get('trace.theme'); if (theme) root.setAttribute('data-theme', theme);
  each('[data-theme-btn]', function (b) {
    b.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
      var next = cur === 'light' ? 'dark' : 'light'; root.setAttribute('data-theme', next); set('trace.theme', next);
    });
  });

  // Release data (static JSON committed with the site; updated by the release process).
  // "version" is a bare semver, "status" the release state ("unreleased" | "released"), "statusText" an optional label shown on the page.
  // File names and URLs are used only when they look like a file name / an https URL, so a stray value can never break the commands shown.
  var SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
  var FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
  function fmtBytes(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB'; }
  function httpsUrl(u) { return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : ''; }
  function text(sel, value) { each(sel, function (e) { e.textContent = value; }); }
  function show(sel, on) { each(sel, function (e) { e.hidden = !on; }); }
  function enableLink(sel, url) { if (!url) return; each(sel, function (e) { e.setAttribute('href', url); e.removeAttribute('aria-disabled'); e.removeAttribute('role'); }); }
  function statusLabel(rel) {
    if (typeof rel.statusText === 'string' && rel.statusText) return rel.statusText;
    if (rel.status === 'unreleased') return 'not released yet';
    return '';
  }
  var SHA256 = /^[0-9a-f]{64}$/;
  // Optional Linux packages (release.json "linux": { deb, appimage }). The download card exists in the page only when
  // scripts/render-release.cjs found a linux entry; without one nothing here touches the page.
  function linuxRelease(rel) {
    var lin = rel && typeof rel.linux === 'object' && rel.linux ? rel.linux : {};
    var out = {};
    ['deb', 'appimage'].forEach(function (key) {
      var item = lin[key] && typeof lin[key] === 'object' ? lin[key] : {};
      out[key] = {
        file: FILENAME.test(item.file || '') ? item.file : '',
        url: httpsUrl(item.url),
        sha: typeof item.sha256 === 'string' && SHA256.test(item.sha256) ? item.sha256 : '',
        bytes: typeof item.bytes === 'number' && item.bytes > 0 ? item.bytes : 0,
      };
    });
    out.any = !!(out.deb.url || out.appimage.url);
    return out;
  }
  // Platform hint: only swaps which hero button is shown; it never downloads anything. Android and ChromeOS count as "other".
  function platform() {
    var ua = navigator.userAgent || '', p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
    if (/android|cros/i.test(ua)) return 'other';
    if (/^win/i.test(p) || /windows/i.test(ua)) return 'windows';
    if (/^mac/i.test(p) || /macintosh/i.test(ua)) return 'mac';
    if (/linux/i.test(p) || /linux|x11/i.test(ua)) return 'linux';
    return 'other';
  }
  // Every platform button stays visible; the one for the visitor's system is highlighted and moved to the front (Windows otherwise).
  function highlightPlatform() {
    var key = { windows: 'windows', mac: 'macos', linux: 'linux' }[platform()];
    var target = key && document.querySelector('[data-platform-cta="' + key + '"]:not([hidden])');
    if (!target) target = document.querySelector('[data-platform-cta="windows"]');
    if (!target) return;
    each('[data-platform-cta]', function (e) { e.classList.toggle('primary', e === target); });
    var first = target.parentNode && target.parentNode.querySelector('[data-platform-cta]');
    if (first && first !== target) target.parentNode.insertBefore(target, first);
  }
  highlightPlatform();
  // Pages without release placeholders (guides, 404) skip the request; they link to the download section of the home page.
  (document.querySelector('[data-rel]') ? fetch(BASE + 'release.json', { cache: 'no-cache' }) : Promise.reject(new Error('no release data on this page'))).then(function (r) { return r.json(); }).then(function (rel) {
    var win = rel.windows || {}, mac = rel.macos || {};
    var version = SEMVER.test(rel.version || '') ? rel.version : '';
    var winFile = FILENAME.test(win.file || '') ? win.file : '';
    var macFile = FILENAME.test(mac.file || '') ? mac.file : '';
    var winUrl = httpsUrl(win.url), macUrl = httpsUrl(mac.url);
    if (version) text('[data-rel="version"]', version);
    // A version with a suffix (1.3.1-rc.1) is a test version: the badge and the note above the downloads are shown only then.
    show('[data-rel="prerelease"]', /^\d+\.\d+\.\d+-/.test(version));
    show('[data-rel="prerelease-note"]', /^\d+\.\d+\.\d+-/.test(version));
    if (winFile) text('[data-rel="win-name"]', winFile);
    enableLink('[data-rel="win-url"]', winUrl);
    text('[data-rel="win-sha"]', win.sha256 || '—'); show('[data-rel="win-sha-item"]', !!win.sha256);
    text('[data-rel="win-size"]', win.bytes ? fmtBytes(win.bytes) : '—'); show('[data-rel="win-size"]', !!win.bytes);
    text('[data-rel="date"]', rel.date || '—'); show('[data-rel="date"]', !!rel.date);
    var status = statusLabel(rel);
    text('[data-rel="status"]', status); show('[data-rel="status"]', !!status && !winUrl);
    enableLink('[data-rel="mac-url"]', macUrl);
    text('[data-rel="mac-name"]', macFile && macUrl ? macFile : 'No macOS download yet');
    if (macFile) text('[data-rel="mac-file"]', macFile);
    text('[data-rel="mac-sha"]', mac.sha256 || '—'); show('[data-rel="mac-sha-item"]', !!mac.sha256);
    text('[data-rel="mac-size"]', mac.bytes ? fmtBytes(mac.bytes) : '—'); show('[data-rel="mac-size"]', !!mac.bytes);
    show('[data-rel="mac-hash-cmd"]', !!(macFile && macUrl));
    each('[data-rel="releases"]', function (e) { var u = httpsUrl(rel.releasesUrl); if (u) e.setAttribute('href', u); });
    // The install commands of the Linux page repeat the package file names (the home page has the same spans in its download card).
    ['deb', 'appimage'].forEach(function (key) {
      var item = linuxRelease(rel)[key];
      if (item.file) text('[data-rel="linux-' + key + '-name"]', item.file);
    });
    if (document.querySelector('[data-rel="linux-card"]')) {
      var lin = linuxRelease(rel);
      ['deb', 'appimage'].forEach(function (key) {
        var item = lin[key], pre = '[data-rel="linux-' + key;
        enableLink(pre + '-url"]', item.url);
        if (item.file) text(pre + '-name"]', item.file);
        text(pre + '-sha"]', item.sha || '—'); show(pre + '-sha-item"]', !!item.sha);
        text(pre + '-size"]', item.bytes ? fmtBytes(item.bytes) : '—'); show(pre + '-size"]', !!item.bytes);
        show(pre + '-block"]', !!item.url);
      });
      show('[data-rel="linux-card"]', lin.any);
      show('[data-platform-cta="linux"]', lin.any);
      highlightPlatform();
    }
    // A meta line whose items are all hidden is hidden as a whole.
    each('p.meta', function (p) { if (p.querySelector('.item')) p.hidden = !p.querySelector('.item:not([hidden])'); });
  }).catch(function () { /* keep the static placeholders */ });

  // Screenshot provenance captions (build hash, sample file, licence) from a static JSON written by the media lane.
  if (document.querySelector('[data-cap]')) {
    fetch(BASE + 'assets/img/captions.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (caps) {
      each('[data-cap]', function (e) { var c = caps[e.getAttribute('data-cap')]; if (c) e.textContent = c; });
    }).catch(function () { /* captions stay empty until the media lane writes them */ });
  }

  // Gallery lightbox: a modal <dialog> opened from the thumbnail buttons (click, Enter or Space), closed by Esc, the close button
  // or a click anywhere; the focus moves to the close button (the only control, so Tab stays on it) and returns to the thumbnail afterwards.
  var lb = document.querySelector('.lightbox');
  if (lb) {
    var lbImg = lb.querySelector('img'), lbCap = lb.querySelector('.lightbox-cap'), lbClose = lb.querySelector('.lightbox-close');
    var opener = null;
    var native = typeof lb.showModal === 'function';
    var isOpen = function () { return lb.hasAttribute('open'); };
    var onClosed = function () { lbImg.removeAttribute('src'); lbImg.alt = ''; if (opener) { opener.focus(); opener = null; } };
    var openLightbox = function (btn) {
      var thumb = btn.querySelector('img'); if (!thumb || isOpen()) return;
      var fig = btn.parentNode, fc = fig && fig.querySelector ? fig.querySelector('figcaption') : null;
      lbImg.src = thumb.getAttribute('data-full') || thumb.src; lbImg.alt = thumb.alt;
      if (lbCap) lbCap.textContent = fc && fc.firstChild && fc.firstChild.nodeType === 3 ? fc.firstChild.textContent : thumb.alt;
      opener = btn;
      if (native) lb.showModal(); else lb.setAttribute('open', '');
      if (lbClose) lbClose.focus();
    };
    var closeLightbox = function () {
      if (!isOpen()) return;
      if (native) lb.close(); else { lb.removeAttribute('open'); onClosed(); }
    };
    each('.shot', function (b) { b.addEventListener('click', function () { openLightbox(b); }); });
    lb.addEventListener('click', function () { closeLightbox(); });
    lb.addEventListener('close', onClosed);
    lb.addEventListener('keydown', function (e) { if (e.key === 'Tab' && lbClose) { e.preventDefault(); lbClose.focus(); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && isOpen() && !native) closeLightbox(); });
  }

  // Demo watch page: "?t=SECONDS" or "#t=SECONDS" in the address starts the video there (the key-moment links of the
  // VideoObject markup use ?t=); transcript links with data-t seek without leaving the page.
  var video = document.querySelector('video[data-seek]');
  if (video) {
    var startAt = function () {
      var m = /[?&#]t=(\d+(?:\.\d+)?)/.exec(location.search + location.hash);
      return m ? Number(m[1]) : 0;
    };
    var seek = function (t) {
      if (!(t >= 0)) return;
      var go = function () { try { video.currentTime = Math.min(t, video.duration || t); } catch (e) { /* not seekable yet */ } };
      if (video.readyState >= 1) go(); else video.addEventListener('loadedmetadata', go, { once: true });
    };
    if (startAt() > 0) { video.preload = 'metadata'; seek(startAt()); }
    each('[data-t]', function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var t = Number(a.getAttribute('data-t'));
        seek(t);
        var played = video.play(); if (played && played.catch) played.catch(function () { /* autoplay blocked: the position is set anyway */ });
        try { history.replaceState(null, '', '#t=' + t); } catch (err) { /* file:// or sandboxed */ }
        video.focus();
      });
    });
  }
})();
