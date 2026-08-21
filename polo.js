/* --- CAPSULE MOD v2 PART 1/6 --- */
(function () {
'use strict';
if (window.plugin_capsule_mod) return;
function el(t, c, h) { var d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; }
function addClass(n, c) { if (!hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; }
function removeClass(n, c) { n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').replace(/^ +| +$/g, ''); }
function hasClass(n, c) { return (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
function closestAttr(n, a) { while (n && n !== document) { if (n.getAttribute && n.getAttribute(a)) return n; n = n.parentNode; } return null; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function nowMs() { return Date.now(); }
function dayMs() { return 86400000; }
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function normTitle(s) { return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, ''); }
var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(nowMs()); }, 16); };
function tweenScroll(n, p, to, ms) { if (!n) return; var from = n[p], t0 = nowMs(); ms = ms || 200; function s() { var q = Math.min(1, (nowMs() - t0) / ms), e = 1 - Math.pow(1 - q, 3); n[p] = Math.round(from + (to - from) * e); if (q < 1) raf(s); } raf(s); }
function sGet(k, d) { try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') { var v = Lampa.Storage.get(k, d); return (v === undefined || v === null) ? d : v; } } catch (e) {} try { if (window.localStorage) { var r = localStorage.getItem('cm_' + k); if (r != null) return JSON.parse(r); } } catch (e) {} return d; }
function sSet(k, v) { try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') { Lampa.Storage.set(k, v); return; } } catch (e) {} try { if (window.localStorage) localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) {} }
function sDel(k) { try { if (window.Lampa && Lampa.Storage && Lampa.Storage.remove) Lampa.Storage.remove(k); } catch (e) {} try { if (window.localStorage) localStorage.removeItem('cm_' + k); } catch (e) {} }
function httpGet(u, ok, err) { try { var x = new XMLHttpRequest(); x.open('GET', u, true); x.timeout = 12000; x.onreadystatechange = function () { if (x.readyState === 4) { if (x.status >= 200 && x.status < 400) { var d = null; try { d = JSON.parse(x.responseText); } catch (e) {} if (d) ok(d); else if (err) err(); } else if (err) err(); } }; x.onerror = function () { if (err) err(); }; x.ontimeout = function () { if (err) err(); }; x.send(); } catch (e) { if (err) err(); } }
function notify(t) { try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(t); return; } } catch (e) {} console.log('[CapsuleMod]', t); }
var COMPONENT = 'capsule_mod_view', CTRL_NAME = 'capsule_mod', TMDB_BASE = 'https://api.themoviedb.org/3', TMDB_DEFAULT_KEY = '04c35731a5ee918f014970082a0088b1', CACHE_TTL = dayMs(), PROFILE_TTL = dayMs();
var WEIGHTS = { completed: 3, favorite: 5, abandoned: -2 };
var GENRE_RU = { 28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия', 80: 'криминал', 99: 'документальный', 18: 'драма', 10751: 'семейный', 14: 'фэнтези', 27: 'ужасы', 9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика', 53: 'триллер', 37: 'вестерн', 10759: 'экшен', 10765: 'фантастика' };
var PHRASES = { hello: ['привет. я всегда готов помочь!', 'приветствую! подберём что-нибудь на вечер?'], morning: ['доброе утро! начнём день с хорошей истории?'], evening: ['добрый вечер! время для хорошего кино.'], loading: ['сканирую предпочтения...', 'заряжаю капсулу...'], error: ['ой. сеть мигает, но я не сдаюсь.'], empty: ['пока пусто. расскажите мне, что любите!'], done: ['готово! капсула пересчитана.'] };

/* --- CAPSULE MOD v2 PART 2/6 --- */
var CSS_TEXT = [
'.cm-root{position:fixed;left:0;top:0;right:0;bottom:0;background:#141414;z-index:99999;color:#fff;font-family:-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}',
'.cm-header{position:absolute;top:0;left:0;right:0;height:4.2em;display:flex;align-items:center;padding:0 1.6em;background:#141414;z-index:5}',
'.cm-hbtn{width:2.6em;height:2.6em;display:flex;align-items:center;justify-content:center;border-radius:0.6em;cursor:pointer}',
'.cm-hbtn svg{width:1.5em;height:1.5em;fill:#fff}',
'.cm-title{margin-left:auto;font-size:1.4em;font-weight:600;color:#eee}',
'.cm-clock{margin-left:0.9em;font-size:1.5em;font-weight:700}',
'.cm-content{position:absolute;top:4.2em;bottom:0;left:0;right:0;overflow:hidden;padding:0 1.6em 7em}',
'.cm-row{margin-bottom:1.2em}',
'.cm-row-title{font-size:1.15em;color:#cfcfcf;margin:0.4em 0 0.6em 0.1em;font-weight:600}',
'.cm-strip{display:flex;overflow:hidden;padding:0.6em 0.2em}',
'.cm-card{position:relative;flex:none;width:10.8em;height:16em;border-radius:0.9em;overflow:hidden;margin-right:1em;background:#222;border:0.22em solid transparent;transition:transform 0.15s;cursor:pointer}',
'.cm-card img{width:100%;height:100%;object-fit:cover;display:block}',
'.cm-card.cm-focus{border-color:#fff;transform:scale(1.05);z-index:2}',
'.cm-b-type{position:absolute;top:0.5em;left:0.5em;background:#e50914;color:#fff;font-size:0.75em;font-weight:700;padding:0.15em 0.5em;border-radius:0.4em}',
'.cm-b-type.mov{background:#3a3a3a}',
'.cm-b-rate{position:absolute;bottom:0.4em;right:0.4em;background:rgba(0,0,0,0.75);font-size:0.9em;font-weight:700;padding:0.1em 0.5em;border-radius:0.5em}',
'.cm-t{position:absolute;left:0;right:0;bottom:0;padding:1.8em 3em 0.5em 0.5em;font-size:0.8em;color:#eee;background:linear-gradient(transparent,rgba(0,0,0,0.85));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.cm-robot-row{display:flex;align-items:flex-end;margin:0.6em 0 1em}',
'.cm-robot{width:11em;height:11em;flex:none;cursor:pointer;will-change:transform;animation:cm-float 3.4s ease-in-out infinite}',
'.cm-robot.cm-focus{outline:0.22em solid #fff;border-radius:1em;transform:scale(1.05)}',
'.cm-robot svg{width:100%;height:100%}',
'.cm-bubble{position:relative;background:#222;border-radius:1em;padding:0.9em 1.2em;margin-left:1.4em;max-width:22em;font-size:1.05em;color:#eaeaea;line-height:1.4}',
'.cm-bubble:before{content:"";position:absolute;left:-0.9em;bottom:1em;border-top:0.8em solid transparent;border-bottom:0.8em solid transparent;border-right:1em solid #222}',
'@keyframes cm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.4em)}}',
'.cm-details{display:flex;height:100%}',
'.cm-d-left{flex:none;width:17em;padding-top:0.8em}',
'.cm-d-left .cm-card{width:16em;height:24em;margin:0;cursor:default}',
'.cm-d-meta{margin-top:0.8em;color:#bbb;font-size:0.95em;line-height:1.5}',
'.cm-d-meta b{color:#fff}',
'.cm-d-center{flex:1;display:flex;align-items:center;justify-content:center}',
'.cm-play{width:11em;height:7.4em;background:#222;border-radius:1.6em;border:0.25em solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform 0.15s}',
'.cm-play svg{width:3.6em;height:3.6em;fill:#161616}',
'.cm-play.cm-focus{border-color:#fff;transform:scale(1.06)}',
'.cm-d-right{flex:none;width:23em;padding:1.5em 0.8em 1em 0}',
'.cm-ai-item{background:#222;border:0.22em solid transparent;border-radius:0.9em;padding:0.7em 1em;margin-bottom:0.8em;font-size:1em;color:#e6e6e6;cursor:pointer}',
'.cm-ai-item.cm-focus{border-color:#fff;background:#2a2a2a}',
'.cm-drawer{position:absolute;right:0;top:40%;width:1.5em;height:6em;background:#222;border-radius:0.8em 0 0 0.8em;display:flex;align-items:center;justify-content:center;color:#9a9a9a;cursor:pointer;border:0.2em solid transparent;border-right:none}',
'.cm-drawer.cm-focus{border-color:#fff;color:#fff}',
'.cm-overlay{position:fixed;left:0;top:0;right:0;bottom:0;background:rgba(10,10,10,0.9);z-index:100000;display:flex;align-items:center;justify-content:center}',
'.cm-panel{background:#1b1b1b;border-radius:1.2em;padding:1.6em 2em;min-width:26em;max-width:92%;max-height:84%;overflow:hidden}',
'.cm-panel h2{margin:0 0 0.9em 0;font-size:1.3em}',
'.cm-set-item{background:#242424;border:0.22em solid transparent;border-radius:0.8em;padding:0.7em 1em;margin-bottom:0.7em;font-size:1.05em;color:#ddd;cursor:pointer;display:flex;justify-content:space-between}',
'.cm-set-item.cm-focus{border-color:#fff}',
'.cm-set-item .val{color:#8fd3ff}',
'.cm-modal-body{padding:0.4em;color:#ddd;font-size:1em;line-height:1.5;max-height:22em;overflow:hidden}',
'.cm-modal-body h4{color:#fff;margin:0.6em 0 0.4em}',
'.cm-chip{display:inline-block;background:#2a2a2a;border:0.2em solid transparent;border-radius:2em;padding:0.45em 1.1em;margin:0 0.5em 0.7em 0;color:#cfe8ff;cursor:pointer}',
'.cm-chip.cm-focus{border-color:#fff;background:#333}',
'.cm-input-fake{background:#242424;border:0.2em dashed #555;border-radius:0.8em;padding:0.7em 1em;margin-bottom:0.9em;color:#9ad1ff;cursor:pointer}',
'.cm-input-fake.cm-focus{border-color:#fff}',
'.cm-skel{background:#222;animation:cm-pulse 1.2s infinite}',
'@keyframes cm-pulse{0%,100%{opacity:1}50%{opacity:0.45}}',
'@media (min-width:2200px){.cm-root{font-size:22px}}'
].join('\n');
function injectCSS() { if (document.getElementById('capsule_mod_css')) return; var st = el('style'); st.id = 'capsule_mod_css'; st.type = 'text/css'; st.innerHTML = CSS_TEXT; (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(st); }
var SVG_ROBOT = '<svg viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg"><g fill="#d8d8d8"><rect x="118" y="8" width="86" height="66" rx="16" transform="rotate(4 161 41)"/><rect x="112" y="86" width="96" height="88" rx="24" transform="rotate(-7 160 130)"/><path d="M120 168 C104 176 96 196 92 214 L112 220 C118 202 126 188 138 182 Z"/><path d="M188 170 C196 186 202 202 206 218 L186 226 C180 208 172 194 164 186 Z"/><path d="M118 100 C96 108 84 124 78 140 L96 148 C104 132 114 120 126 114 Z"/></g><circle cx="146" cy="38" r="9" fill="#111"/><circle cx="149" cy="35" r="2.6" fill="#fff"/><circle cx="180" cy="40" r="9" fill="#111"/><circle cx="183" cy="37" r="2.6" fill="#fff"/><g stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"><path d="M146 112 L176 108"/><path d="M148 124 L178 120"/><path d="M150 136 L180 132"/></g><path d="M128 156 L146 152" stroke="#a33" stroke-width="5" stroke-linecap="round"/></svg>';
var SVG_BACK = '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5 1.6-1.6L11.2 12l5.9-5.9z"/></svg>';
var SVG_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.4 13c.04-.32.06-.66.06-1s-.02-.68-.07-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.9 8.78a.5.5 0 0 0 .12.64L5.05 11c-.05.32-.08.66-.08 1s.03.68.08 1l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.24.1.5 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>';
var SVG_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var SVG_MENU = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 12 7zm-4.4 8.6c.6-2 2.3-3.2 4.4-3.2s3.8 1.2 4.4 3.2c-1.2 1.2-2.7 1.9-4.4 1.9s-3.2-.7-4.4-1.9z"/></svg>';
function posterPlaceholder(title) {
    var t = esc(String(title || 'capsule').slice(0, 14));
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#1d1d1d"/><rect x="8" y="8" width="184" height="284" rx="10" fill="none" stroke="#333" stroke-width="2"/><text x="100" y="155" fill="#8fd3ff" font-size="15" text-anchor="middle" font-family="sans-serif">' + t + '</text></svg>');
}

/* --- CAPSULE MOD v2 PART 3/6 --- */
function isOn(v) { return v === true || v === 'on' || v === 'true' || v === 1 || v === '1'; }
function cfgMascot() { return isOn(sGet('capsule_mod_mascot', true)); }
function cfgDepth() { var v = sGet('capsule_mod_depth', 'month'); return (String(v).indexOf('все') > -1 || v === 'all') ? 'all' : 'month'; }
function cfgSens() { var v = sGet('capsule_mod_sens', 'strict'); return (String(v).indexOf('эксп') > -1 || v === 'exp') ? 'exp' : 'strict'; }
function cfgKey() { return sGet('capsule_mod_tmdb_key', '') || sGet('tmdb_api_key', '') || TMDB_DEFAULT_KEY; }
var cacheMem = sGet('capsule_mod_cache', {}) || {};
function cacheGet(u) { var e = cacheMem[u]; if (e && e.d && (nowMs() - e.t) < CACHE_TTL) return e.d; return null; }
function cacheSet(u, d) { var ks = [], k; for (k in cacheMem) if (Object.prototype.hasOwnProperty.call(cacheMem, k)) ks.push({ k: k, t: cacheMem[k].t || 0 }); if (ks.length > 60) { ks.sort(function (a, b) { return a.t - b.t; }); for (var i = 0; i < 20; i++) delete cacheMem[ks[i].k]; } cacheMem[u] = { t: nowMs(), d: d }; sSet('capsule_mod_cache', cacheMem); }
var TMDB = {
    url: function (p, q) { var s = 'api_key=' + encodeURIComponent(cfgKey()) + '&language=ru-RU'; if (q) for (var k in q) if (q[k] != null && q[k] !== '') s += '&' + k + '=' + encodeURIComponent(q[k]); return TMDB_BASE + p + '?' + s; },
    get: function (p, q, cb, err) { var u = this.url(p, q), c = cacheGet(u); if (c) { cb(c); return; } httpGet(u, function (d) { cacheSet(u, d); cb(d); }, err || function () {}); },
    img: function (p, size) { if (!p) return null; try { if (window.Lampa && Lampa.TMDB && Lampa.TMDB.image) return Lampa.TMDB.image(p, size || 'w342'); } catch (e) {} return 'https://image.tmdb.org/t/p/' + (size || 'w342') + p; }
};
function setPoster(img, path, title, size) {
    var urls = [], tried = 0, a = TMDB.img(path, size);
    if (a) urls.push(a);
    if (path) urls.push('https://www.themoviedb.org/t/p/' + (size || 'w342') + path);
    if (!urls.length) { img.src = posterPlaceholder(title); return; }
    img.onerror = function () { tried++; if (tried < urls.length) img.src = urls[tried]; else { img.onerror = null; img.src = posterPlaceholder(title); } };
    img.src = urls[0];
}
var Engine = {
    readHistory: function () {
        var out = [], seen = {}, h;
        try {
            var tl = sGet('timeline', {});
            if (tl && typeof tl === 'object') for (h in tl) {
                if (!Object.prototype.hasOwnProperty.call(tl, h)) continue; var e = tl[h]; if (!e || typeof e !== 'object') continue;
                var id = e.id || (e.card && e.card.id); if (!id) continue;
                var type = (e.method === 'tv' || e.type === 'tv' || (e.card && (e.card.name || e.card.original_name))) ? 'tv' : 'movie';
                var percent = typeof e.percent === 'number' ? e.percent : ((e.timeline && e.timeline.percent) || 0);
                var key = type + ':' + id; if (seen[key]) continue; seen[key] = 1;
                out.push({ id: id, type: type, percent: percent, date: e.date || e.last_time || 0, favorite: false });
            }
        } catch (e) {}
        try {
            var fav = sGet('favorite', {});
            var walk = function (v) { if (!v) return; if (v instanceof Array) { for (var j = 0; j < v.length; j++) walk(v[j]); return; } if (typeof v === 'object' && v.id) { var t = (v.name || v.original_name) ? 'tv' : 'movie'; var k2 = t + ':' + v.id; if (!seen[k2]) { seen[k2] = 1; out.push({ id: v.id, type: t, percent: 100, date: 0, favorite: true }); } } };
            walk(fav);
        } catch (e) {}
        return out;
    },
    classify: function (hist) {
        var ev = [], cut = cfgDepth() === 'month' ? (nowMs() - 30 * dayMs()) : 0;
        for (var i = 0; i < hist.length; i++) {
            var it = hist[i], w = 0;
            if (it.favorite) w = WEIGHTS.favorite;
            else if (it.percent >= 85) w = WEIGHTS.completed;
            else if (it.percent > 0 && it.percent < 25 && it.date && (nowMs() - it.date * (String(it.date).length > 11 ? 1 : 1000)) > 7 * dayMs()) w = WEIGHTS.abandoned;
            if (w !== 0) { if (cut && it.date && it.date * (String(it.date).length > 11 ? 1 : 1000) < cut) continue; ev.push({ id: it.id, type: it.type, weight: w }); }
        }
        ev.sort(function (a, b) { return Math.abs(b.weight) - Math.abs(a.weight); });
        return ev;
    },
    computeProfile: function (cb) {
        var events = this.classify(this.readHistory()).slice(0, 10), interests = {}, watched = { ids: {}, titles: {} }, idx = 0;
        function next() {
            if (idx >= events.length) return finish();
            var ev = events[idx++];
            TMDB.get('/' + ev.type + '/' + ev.id, { append_to_response: 'keywords,credits' }, function (d) {
                var i; watched.ids[ev.type + ':' + ev.id] = 1;
                if (d.title) watched.titles[normTitle(d.title)] = 1;
                if (d.name) watched.titles[normTitle(d.name)] = 1;
                if (d.genre_ids) for (i = 0; i < d.genre_ids.length; i++) interests['g' + d.genre_ids[i]] = (interests['g' + d.genre_ids[i]] || 0) + ev.weight;
                var kw = d.keywords && d.keywords.keywords ? d.keywords.keywords : (d.keywords instanceof Array ? d.keywords : []);
                for (i = 0; i < Math.min(kw.length, 8); i++) interests['k' + kw[i].id] = (interests['k' + kw[i].id] || 0) + ev.weight;
                var cast = d.credits && d.credits.cast ? d.credits.cast : [];
                for (i = 0; i < Math.min(cast.length, 4); i++) interests['p' + cast[i].id] = (interests['p' + cast[i].id] || 0) + ev.weight * 0.5;
                next();
            }, next);
        }
        function finish() {
            for (var k in interests) if (Object.prototype.hasOwnProperty.call(interests, k) && interests[k] <= 0) delete interests[k];
            var p = { interests: interests, watched: watched, last_updated: nowMs() };
            sSet('capsule_mod_profile', p); cb(p);
        }
        if (!events.length) return finish();
        next();
    },
    ensureProfile: function (force, cb) { var p = sGet('capsule_mod_profile', null); if (!force && p && p.interests && (nowMs() - (p.last_updated || 0)) < PROFILE_TTL) { cb(p); return; } this.computeProfile(cb); },
    extWatched: function (profile) {
        var w = {}, p = (profile && profile.watched) || {}, k, i;
        if (p.ids) for (k in p.ids) w[k] = 1;
        if (p.titles) for (k in p.titles) w['t' + k] = 1;
        var h = this.readHistory();
        for (i = 0; i < h.length; i++) { w[h[i].type + ':' + h[i].id] = 1; w['id' + h[i].id] = 1; }
        return w;
    },
    discover: function (profile, extra, cb) {
        var inter = (profile && profile.interests) || {}, g = [], kk = [], k, i;
        for (k in inter) { if (!Object.prototype.hasOwnProperty.call(inter, k)) continue; if (k.charAt(0) === 'g') g.push({ id: k.slice(1), w: inter[k] }); if (k.charAt(0) === 'k') kk.push({ id: k.slice(1), w: inter[k] }); }
        g.sort(function (a, b) { return b.w - a.w; }); kk.sort(function (a, b) { return b.w - a.w; });
        var pos = [], neg = [], kws = [];
        for (i = 0; i < Math.min(g.length, 4); i++) { if (g[i].w > 0) pos.push(g[i].id); else neg.push(g[i].id); }
        for (i = 0; i < Math.min(kk.length, 3); i++) if (kk[i].w > 0) kws.push(kk[i].id);
        if (cfgSens() === 'strict' && pos.length > 2) pos = pos.slice(0, 2);
        var params = { 'vote_average.gte': 6.0, include_adult: false, page: 1 };
        if (pos.length) params.with_genres = pos.join(',');
        if (neg.length) params.without_genres = neg.join(',');
        if (kws.length) params.with_keywords = kws.join('|');
        if (extra) for (k in extra) params[k] = extra[k];
        var done = 0, merged = [];
        function fin() { done++; if (done === 2) cb(merged); }
        function one(t) { TMDB.get('/discover/' + t, params, function (d) { var r = d.results || []; for (var j = 0; j < r.length; j++) { r[j].media_type = t; merged.push(r[j]); } fin(); }, fin); }
        one('movie'); one('tv');
    },
    pick: function (list, profile, watched, seen, mode, n) {
        var inter = (profile && profile.interests) || {}, maxG = 1, i, j, out = [];
        for (i = 0; i < list.length; i++) { var g = list[i].genre_ids || [], w = 0; for (j = 0; j < g.length; j++) w += inter['g' + g[j]] || 0; list[i]._gw = w; if (w > maxG) maxG = w; }
        list.sort(function (a, b) { return (b._gw || 0) - (a._gw || 0) || (b.vote_average || 0) - (a.vote_average || 0); });
        for (i = 0; i < list.length && out.length < n * 2; i++) {
            var m = list[i], t = m.media_type || (m.name ? 'tv' : 'movie'), key = t + ':' + m.id;
            if (watched[key] || watched['id' + m.id] || watched['t' + normTitle(m.title || m.name)] || seen[key]) continue;
            seen[key] = 1;
            var gn = Math.min(10, (m._gw / maxG) * 10), rt = m.vote_average || 0;
            var rel = m.release_date || m.first_air_date || '', days = rel ? Math.max(0, (nowMs() - new Date(rel).getTime()) / dayMs()) : 3650;
            var rec = Math.max(0, 10 * (1 - days / (365 * 3)));
            var score = mode === 'stable' ? gn * 0.4 + rt * 0.3 + Math.min(10, (m.vote_count || 0) / 100) * 0.3 : gn * 0.3 + rt * 0.2 + rec * 0.4 + Math.random() * 1.2;
            out.push({ m: m, s: score });
        }
        out.sort(function (a, b) { return b.s - a.s; });
        var res = []; for (i = 0; i < out.length && i < n; i++) res.push(out[i].m);
        return res;
    },
    buildBundle: function (profile, cb) {
        var self = this, watched = this.extWatched(profile), seen = {}, out = { stable: [], exp: [] }, done = 0;
        function fin() { done++; if (done === 2) cb(out); }
        this.discover(profile, { sort_by: 'vote_average.desc', 'vote_count.gte': 100 }, function (l) { out.stable = self.pick(l, profile, watched, seen, 'stable', 5); fin(); });
        this.discover(profile, { sort_by: 'popularity.desc', 'primary_release_date.gte': (new Date().getFullYear() - 3) + '-01-01' }, function (l) { out.exp = self.pick(l, profile, watched, seen, 'exp', 5); fin(); });
    },
    queryBundle: function (profile, f, cb) {
        var self = this, watched = this.extWatched(profile), seen = {}, p = { sort_by: 'popularity.desc', 'vote_average.gte': 6.0 };
        if (f.with_genres && f.with_genres.length) p.with_genres = f.with_genres.join(',');
        if (f.without_genres && f.without_genres.length) p.without_genres = f.without_genres.join(',');
        if (f.year_gte) p['primary_release_date.gte'] = f.year_gte + '-01-01';
        if (f.year_lte) p['primary_release_date.lte'] = f.year_lte + '-12-31';
        this.discover(profile, p, function (l) { cb(self.pick(l, profile, watched, seen, 'exp', 5)); });
    },
    resetProfile: function (cb) { sDel('capsule_mod_profile'); this.computeProfile(cb); }
};

/* --- CAPSULE MOD v2 PART 4/6 --- */
function parseUserQuery(text) {
    var s = String(text || '').toLowerCase(), f = { with_genres: [], without_genres: [], phrase: '' };
    var rules = [ { re: /комед|смешн|весел|юмор/, g: 35 }, { re: /боевик|экшн|экшен/, g: 28 }, { re: /фантаст|космос/, g: 878 }, { re: /ужас|хоррор|страш/, g: 27 }, { re: /триллер|напряж/, g: 53 }, { re: /драм/, g: 18 }, { re: /романти|мелодрам|любов/, g: 10749 }, { re: /детектив|криминал/, g: 80 }, { re: /приключени/, g: 12 }, { re: /аниме|манга|мульт/, g: 16 }, { re: /семейн|детск/, g: 10751 }, { re: /фэнтези/, g: 14 } ];
    for (var i = 0; i < rules.length; i++) { var m = s.match(rules[i].re); if (m) { var before = s.substring(Math.max(0, m.index - 14), m.index); if (/без|кроме|не\s/.test(before)) f.without_genres.push(rules[i].g); else f.with_genres.push(rules[i].g); } }
    if (/90[-хx]/.test(s)) { f.year_gte = 1990; f.year_lte = 1999; } else if (/80[-хx]/.test(s)) { f.year_gte = 1980; f.year_lte = 1989; } else if (/новинк|свеж/.test(s)) f.year_gte = new Date().getFullYear() - 1; else if (/стар|классик|ретро/.test(s)) f.year_lte = 2000;
    var names = []; for (var j = 0; j < f.with_genres.length; j++) names.push(GENRE_RU[f.with_genres[j]] || '');
    f.phrase = f.with_genres.length ? 'принял! собираю ' + names.join(' + ') + '.' : 'хм, попробую угадать настроение!';
    return f;
}
var MOODS = [ { title: '🎉 Весёлое', f: { with_genres: [35] } }, { title: '🌚 Мрачное', f: { with_genres: [53, 27] } }, { title: '💖 Романтичное', f: { with_genres: [10749] } }, { title: '🚀 Приключенческое', f: { with_genres: [12, 878] } }, { title: '👨‍👩‍👧 Семейное', f: { with_genres: [10751, 16] } } ];
function robotPhrase(st) { var h = new Date().getHours(); if (st === 'hello') return h < 6 ? rnd(PHRASES.evening) : (h < 12 ? rnd(PHRASES.morning) : rnd(PHRASES.hello)); return rnd(PHRASES[st] || PHRASES.hello); }
var FM = {
    rows: [], r: 0, i: 0, stack: [],
    setRows: function (rows, r, i) { this.rows = rows || []; this.r = r || 0; this.i = i || 0; this.apply(); },
    push: function () { this.stack.push({ rows: this.rows, r: this.r, i: this.i }); },
    pop: function () { var s = this.stack.pop(); if (s) { this.rows = s.rows; this.r = s.r; this.i = s.i; this.apply(); } },
    current: function () { var row = this.rows[this.r]; return row && row.length ? row[Math.min(this.i, row.length - 1)] : null; },
    apply: function () {
        var nodes = document.querySelectorAll('.cm-focus'); for (var i = 0; i < nodes.length; i++) removeClass(nodes[i], 'cm-focus');
        var n = this.current(); if (!n) return; addClass(n, 'cm-focus');
        var strip = n.parentNode && hasClass(n.parentNode, 'cm-strip') ? n.parentNode : null;
        if (strip) { var to = n.offsetLeft - strip.clientWidth / 2 + n.clientWidth / 2; tweenScroll(strip, 'scrollLeft', Math.max(0, Math.min(to, strip.scrollWidth - strip.clientWidth)), 180); }
        var content = document.querySelector('.cm-content');
        if (content && n.getBoundingClientRect) { var top = n.getBoundingClientRect().top - content.getBoundingClientRect().top + content.scrollTop; if (top < 60 || top > content.clientHeight - 240) tweenScroll(content, 'scrollTop', Math.max(0, top - content.clientHeight / 2), 180); }
        if (typeof Capsule.onFocus === 'function') Capsule.onFocus(n);
    },
    move: function (dir) {
        if (!this.rows.length) return;
        if (dir === 'left' || dir === 'right') { var row = this.rows[this.r], ni = this.i + (dir === 'right' ? 1 : -1); if (ni < 0 || ni >= row.length) return; this.i = ni; this.apply(); return; }
        var nr = this.r + (dir === 'down' ? 1 : -1); if (nr < 0 || nr >= this.rows.length) return;
        var cur = this.current(), target = this.rows[nr], best = 0, bd = 1e9, cx = cur ? cur.getBoundingClientRect().left : 0;
        for (var i = 0; i < target.length; i++) { var d = Math.abs(target[i].getBoundingClientRect().left - cx); if (d < bd) { bd = d; best = i; } }
        this.r = nr; this.i = best; this.apply();
    }
};
var state = { view: 'main', cards: {}, bundle: null, profile: null, custom: null, current: null, root: null, clockTimer: null, settingsOpen: false };
function normMovie(m) { return { id: m.id, type: m.media_type ? (m.media_type === 'tv' ? 'tv' : 'movie') : (m.name || m.original_name ? 'tv' : 'movie'), title: m.title || m.name || 'Без названия', poster_path: m.poster_path, vote_average: m.vote_average || 0, release_date: m.release_date || m.first_air_date || '', overview: m.overview || '' }; }
function buildCard(m) {
    var mm = normMovie(m); state.cards[mm.type + ':' + mm.id] = mm;
    var card = el('div', 'cm-card'); card.setAttribute('data-cm-action', 'card'); card.setAttribute('data-key', mm.type + ':' + mm.id);
    var img = el('img'); img.alt = ''; img.loading = 'lazy'; setPoster(img, mm.poster_path, mm.title, 'w342'); card.appendChild(img);
    card.appendChild(el('div', 'cm-b-type' + (mm.type === 'movie' ? ' mov' : ''), mm.type === 'tv' ? 'TV' : 'FILM'));
    card.appendChild(el('div', 'cm-b-rate', mm.vote_average ? mm.vote_average.toFixed(1) : '—'));
    card.appendChild(el('div', 'cm-t', esc(mm.title)));
    return card;
}
function buildRow(title, movies) {
    var row = el('div', 'cm-row'); row.appendChild(el('div', 'cm-row-title', esc(title)));
    var strip = el('div', 'cm-strip');
    for (var i = 0; i < movies.length; i++) strip.appendChild(buildCard(movies[i]));
    if (!movies.length) strip.appendChild(el('div', 'cm-bubble', 'пусто... робот уже ищет исправление'));
    row.appendChild(strip); return row;
}
function skeletonRows() {
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    for (var r = 0; r < 2; r++) { var row = el('div', 'cm-row'); var strip = el('div', 'cm-strip'); for (var i = 0; i < 5; i++) strip.appendChild(el('div', 'cm-card cm-skel')); row.appendChild(strip); content.appendChild(row); }
}
function buildRobotRow() {
    var row = el('div', 'cm-robot-row');
    var robot = el('div', 'cm-robot'); robot.setAttribute('data-cm-action', 'robot'); robot.innerHTML = SVG_ROBOT;
    var bubble = el('div', 'cm-bubble', esc(robotPhrase('hello'))); bubble.id = 'cm_bubble';
    row.appendChild(robot); row.appendChild(bubble); return row;
}
function robotSay(t) { var b = document.getElementById('cm_bubble'); if (b) b.innerHTML = esc(t); }
function buildHeader() {
    var h = el('div', 'cm-header');
    var back = el('div', 'cm-hbtn'); back.setAttribute('data-cm-action', 'back'); back.innerHTML = SVG_BACK;
    var title = el('div', 'cm-title', 'capsule mod');
    var gear = el('div', 'cm-hbtn'); gear.setAttribute('data-cm-action', 'settings'); gear.innerHTML = SVG_GEAR;
    var clock = el('div', 'cm-clock', '--:--'); clock.id = 'cm_clock';
    h.appendChild(back); h.appendChild(title); h.appendChild(gear); h.appendChild(clock); return h;
}
function tickClock() { var c = document.getElementById('cm_clock'); if (c) { var d = new Date(); c.innerHTML = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); } }
function renderMain() {
    state.view = 'main'; state.cards = {};
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    var drawer = state.root.querySelector('.cm-drawer'); if (drawer) drawer.parentNode.removeChild(drawer);
    var b = state.bundle || { stable: [], exp: [] };
    if (state.custom && state.custom.list) content.appendChild(buildRow(state.custom.title, state.custom.list));
    else content.appendChild(buildRow('Стабильно на вечер', b.stable));
    content.appendChild(buildRow('Интересные эксперименты', b.exp));
    if (cfgMascot()) content.appendChild(buildRobotRow());
    var rows = [[state.root.querySelector('[data-cm-action="back"]'), state.root.querySelector('[data-cm-action="settings"]')]];
    var strips = content.querySelectorAll('.cm-strip');
    for (var i = 0; i < strips.length; i++) { var cards = strips[i].querySelectorAll('.cm-card[data-cm-action="card"]'); if (cards.length) rows.push([].slice.call(cards, 0)); }
    var robot = content.querySelector('[data-cm-action="robot"]'); if (robot) rows.push([robot]);
    FM.setRows(rows, 1, 0);
}
function loadMainData(force) {
    skeletonRows(); robotSay(robotPhrase('loading'));
    Engine.ensureProfile(force, function (profile) {
        state.profile = profile;
        Engine.buildBundle(profile, function (bundle) { state.bundle = bundle; renderMain(); robotSay((bundle.stable.length + bundle.exp.length) ? robotPhrase('hello') : robotPhrase('empty')); });
    });
}
function renderDetails(movie) {
    state.view = 'details'; state.current = movie;
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    var wrap = el('div', 'cm-details');
    var left = el('div', 'cm-d-left');
    var poster = el('div', 'cm-card');
    var img = el('img'); img.alt = ''; setPoster(img, movie.poster_path, movie.title, 'w500'); poster.appendChild(img);
    poster.appendChild(el('div', 'cm-b-rate', movie.vote_average ? movie.vote_average.toFixed(1) : '—'));
    left.appendChild(poster);
    left.appendChild(el('div', 'cm-d-meta', '<b>' + esc(movie.title) + '</b><br>' + ((movie.release_date || '').slice(0, 4) || '—') + ' · ' + (movie.type === 'tv' ? 'сериал' : 'фильм')));
    wrap.appendChild(left);
    var center = el('div', 'cm-d-center');
    var play = el('div', 'cm-play'); play.setAttribute('data-cm-action', 'play'); play.innerHTML = SVG_PLAY; center.appendChild(play);
    wrap.appendChild(center);
    var right = el('div', 'cm-d-right');
    var items = [ { a: 'ai_desc', t: '📝 Описание и сюжет' }, { a: 'ai_fit', t: '👥 Кому подойдёт' }, { a: 'ai_rev', t: '💬 Отзывы зрителей' }, { a: 'ai_facts', t: '🎭 Актёры и факты' } ];
    for (var i = 0; i < items.length; i++) { var it = el('div', 'cm-ai-item', esc(items[i].t)); it.setAttribute('data-cm-action', items[i].a); right.appendChild(it); }
    wrap.appendChild(right); content.appendChild(wrap);
    var drawer = el('div', 'cm-drawer', '‹'); drawer.setAttribute('data-cm-action', 'drawer'); state.root.appendChild(drawer);
    FM.setRows([ [state.root.querySelector('[data-cm-action="back"]'), state.root.querySelector('[data-cm-action="settings"]')], [play, drawer], [].slice.call(right.querySelectorAll('.cm-ai-item'), 0) ], 1, 0);
    robotSay('расскажу всё о «' + movie.title + '» — меню справа!');
}
function openFullCard(m) { try { Lampa.Activity.push({ url: '', component: 'full', id: m.id, method: m.type, card: m, source: 'tmdb' }); } catch (e) { notify('Не удалось открыть карточку Lampa'); } }

/* --- CAPSULE MOD v2 PART 5/6 --- */
function modalOpen(title, node) {
    try { if (window.Lampa && Lampa.Modal && Lampa.Modal.open) { Lampa.Modal.open({ title: title, html: node, size: 'large', onBack: function () { Lampa.Modal.close(); Lampa.Controller.toggle(CTRL_NAME); } }); bindMouse(node); return; } } catch (e) {}
    var ov = el('div', 'cm-overlay'); var panel = el('div', 'cm-panel'); panel.appendChild(el('h2', '', esc(title))); panel.appendChild(node); ov.appendChild(panel); state.root.appendChild(ov); bindMouse(ov);
}
function modalClose() {
    try { if (window.Lampa && Lampa.Modal && Lampa.Modal.close) { Lampa.Modal.close(); return; } } catch (e) {}
    var ov = state.root && state.root.querySelector('.cm-overlay'); if (ov) ov.parentNode.removeChild(ov);
}
function openAiDialog() {
    var body = el('div', 'cm-modal-body');
    var input = el('div', 'cm-input-fake', '✍️ Написать запрос роботу...'); input.setAttribute('data-cm-action', 'ai_input'); body.appendChild(input);
    var chips = [ { t: '🔄 Обновить рекомендации', a: 'ai_refresh' }, { t: '🍿 Случайный фильм', a: 'ai_random' }, { t: '🎯 По настроению', a: 'ai_mood' } ];
    for (var i = 0; i < chips.length; i++) { var c = el('div', 'cm-chip', esc(chips[i].t)); c.setAttribute('data-cm-action', chips[i].a); body.appendChild(c); }
    body.appendChild(el('div', '', '<span style="color:#777">Понимаю: «фантастика без ужасов», «комедия 90-х»...</span>'));
    modalOpen('Диалог с роботом', body);
}
function aiApplyFilters(title, f) {
    modalClose(); robotSay(f.phrase || robotPhrase('loading')); skeletonRows();
    Engine.queryBundle(state.profile || { interests: {} }, f, function (list) {
        state.custom = { title: title, list: list }; renderMain();
        robotSay(list.length ? 'готово! обновил выдачу под запрос.' : robotPhrase('empty'));
    });
}
function aiRandom() {
    var pool = (state.bundle && state.bundle.stable.length ? state.bundle.stable : []).concat(state.bundle && state.bundle.exp ? state.bundle.exp : []);
    function show(m) {
        var mm = normMovie(m), body = el('div', 'cm-modal-body');
        body.appendChild(el('div', '', '<h4>🎲 ' + esc(mm.title) + '</h4><div>⭐ ' + (mm.vote_average ? mm.vote_average.toFixed(1) : '—') + ' · ' + ((mm.release_date || '').slice(0, 4) || '—') + '</div><div style="margin-top:0.6em">' + esc((mm.overview || 'Описание появится после загрузки.').slice(0, 280)) + '</div>'));
        var go = el('div', 'cm-chip', '▶ Смотреть'); go.setAttribute('data-cm-action', 'ai_random_play'); body.appendChild(go);
        modalOpen(rnd(PHRASES.hello), body); state.cards['rand'] = mm;
    }
    if (pool.length) { show(rnd(pool)); return; }
    TMDB.get('/discover/movie', { sort_by: 'popularity.desc', 'vote_average.gte': 6.5 }, function (d) { var r = d.results || []; if (r.length) show(rnd(r)); }, function () { notify(robotPhrase('error')); });
}
function aiInfo(kind) {
    var m = state.current; if (!m) return;
    var path = '/' + m.type + '/' + m.id;
    if (kind === 'ai_desc') TMDB.get(path, {}, function (d) { modalOpen('Описание', el('div', 'cm-modal-body', '<h4>📝 ' + esc(d.title || d.name || m.title) + '</h4><div>' + esc(d.overview || 'Описание отсутствует.') + '</div>')); }, function () { notify(robotPhrase('error')); });
    if (kind === 'ai_fit') TMDB.get(path, {}, function (d) {
        var ids = [], i, pros = [], cons = [];
        var g = d.genres || []; for (i = 0; i < g.length; i++) ids.push(g[i].id);
        if (ids.indexOf(28) > -1 || ids.indexOf(53) > -1) { pros.push('любителям динамики'); cons.push('ищущим спокойное кино'); }
        if (ids.indexOf(35) > -1) pros.push('для лёгкого вечера');
        if (ids.indexOf(27) > -1) { pros.push('крепким нервам'); cons.push('впечатлительным и детям'); }
        if (ids.indexOf(10751) > -1 || ids.indexOf(16) > -1) pros.push('для семейного просмотра');
        if (ids.indexOf(18) > -1) pros.push('ценителям глубины');
        if (!pros.length) pros.push('широкой аудитории');
        var html = '<h4>👥 Кому подойдёт</h4><div>✅ ' + pros.join('<br>✅ ') + '</div>';
        if (cons.length) html += '<h4>Кому нет</h4><div>⛔ ' + cons.join('<br>⛔ ') + '</div>';
        modalOpen('Кому подойдёт', el('div', 'cm-modal-body', html));
    }, function () { notify(robotPhrase('error')); });
    if (kind === 'ai_rev') TMDB.get(path + '/reviews', { language: 'ru-RU' }, function (d) {
        var r = d.results || [];
        function renderRev(list) {
            var html = '<h4>💬 Отзывы</h4>';
            if (!list.length) html += '<div>Отзывов пока нет.</div>';
            for (var i = 0; i < Math.min(list.length, 3); i++) html += '<div style="margin-bottom:0.8em"><b>' + esc(list[i].author) + ':</b> ' + esc(String(list[i].content).slice(0, 240)) + '…</div>';
            modalOpen('Отзывы', el('div', 'cm-modal-body', html));
        }
        if (!r.length) TMDB.get(path + '/reviews', { language: 'en-US' }, function (d2) { renderRev(d2.results || []); }, function () { renderRev([]); });
        else renderRev(r);
    }, function () { notify(robotPhrase('error')); });
    if (kind === 'ai_facts') TMDB.get(path, { append_to_response: 'credits,keywords' }, function (d) {
        var html = '<h4>🎭 Актёры</h4><div>', cast = (d.credits && d.credits.cast) || [], i;
        for (i = 0; i < Math.min(cast.length, 6); i++) html += '• ' + esc(cast[i].name) + ' — ' + esc(cast[i].character) + '<br>';
        var crew = (d.credits && d.credits.crew) || [], dir = '';
        for (i = 0; i < crew.length; i++) if (crew[i].job === 'Director') { dir = crew[i].name; break; }
        if (dir) html += '<br>Режиссёр: <b>' + esc(dir) + '</b>';
        html += '</div><h4>✨ Факты</h4><div>';
        if (d.budget) html += 'Бюджет: $' + (d.budget / 1000000).toFixed(1) + ' млн<br>';
        if (d.revenue) html += 'Сборы: $' + (d.revenue / 1000000).toFixed(1) + ' млн<br>';
        var kw = (d.keywords && (d.keywords.keywords || d.keywords)) || [], names = [];
        for (i = 0; i < Math.min(kw.length, 5); i++) names.push(esc(kw[i].name));
        if (names.length) html += 'Темы: ' + names.join(', ');
        html += '</div>';
        modalOpen('Актёры и факты', el('div', 'cm-modal-body', html));
    }, function () { notify(robotPhrase('error')); });
}

/* --- CAPSULE MOD v2 PART 6/6 --- */
function openSettings() {
    state.settingsOpen = true; FM.push();
    var ov = el('div', 'cm-overlay'); ov.id = 'cm_settings';
    var panel = el('div', 'cm-panel'); panel.appendChild(el('h2', '', '⚙️ Capsule Mod'));
    function item(l, v, a) { var it = el('div', 'cm-set-item'); it.setAttribute('data-cm-action', a); it.appendChild(el('span', '', esc(l))); it.appendChild(el('span', 'val', esc(v))); return it; }
    panel.appendChild(item('🤖 Робот', cfgMascot() ? 'вкл' : 'выкл', 'set_mascot'));
    panel.appendChild(item('🕓 Глубина анализа', cfgDepth() === 'all' ? 'всё время' : 'месяц', 'set_depth'));
    panel.appendChild(item('🧠 Алгоритм', cfgSens() === 'exp' ? 'эксперименты' : 'точный', 'set_sens'));
    panel.appendChild(item('🔑 TMDB ключ', cfgKey() === TMDB_DEFAULT_KEY ? 'стандарт' : 'свой', 'set_key'));
    panel.appendChild(item('♻️ Пересчитать профиль', '', 'set_reset'));
    panel.appendChild(item('✖ Закрыть', '', 'set_close'));
    ov.appendChild(panel); state.root.appendChild(ov); bindMouse(ov);
    FM.setRows([ [].slice.call(ov.querySelectorAll('.cm-set-item'), 0) ], 0, 0);
}
function closeSettings() { var ov = document.getElementById('cm_settings'); if (ov) ov.parentNode.removeChild(ov); state.settingsOpen = false; FM.pop(); }
function settingsAction(a) {
    if (a === 'set_close') { closeSettings(); return; }
    if (a === 'set_mascot') { sSet('capsule_mod_mascot', cfgMascot() ? false : true); closeSettings(); openSettings(); if (state.view === 'main') renderMain(); return; }
    if (a === 'set_depth') { sSet('capsule_mod_depth', cfgDepth() === 'all' ? 'month' : 'all'); closeSettings(); openSettings(); return; }
    if (a === 'set_sens') { sSet('capsule_mod_sens', cfgSens() === 'exp' ? 'strict' : 'exp'); closeSettings(); openSettings(); return; }
    if (a === 'set_key') { try { Lampa.Input.edit({ title: 'TMDB API ключ', value: '', free: true, nosave: true }, function (v) { if (v) sSet('capsule_mod_tmdb_key', v); Lampa.Controller.toggle(CTRL_NAME); closeSettings(); openSettings(); }); } catch (e) { notify('Ввод недоступен'); } return; }
    if (a === 'set_reset') { closeSettings(); robotSay(robotPhrase('loading')); Engine.resetProfile(function (p) { state.profile = p; state.custom = null; notify('Профиль пересчитан'); robotSay(robotPhrase('done')); if (state.view === 'main') loadMainData(true); }); }
}
function doAction(node) {
    var a = node.getAttribute('data-cm-action'); if (!a) return;
    if (state.settingsOpen && a.indexOf('set_') === 0) { settingsAction(a); return; }
    if (state.settingsOpen && a !== 'back') return;
    switch (a) {
        case 'back':
            if (state.settingsOpen) { closeSettings(); return; }
            if (state.view === 'details') { renderMain(); return; }
            try { Lampa.Activity.backward(); } catch (e) { try { Lampa.Activity.back(); } catch (e2) {} }
            return;
        case 'settings': openSettings(); return;
        case 'card': var key = node.getAttribute('data-key'); if (state.cards[key]) renderDetails(state.cards[key]); return;
        case 'robot': openAiDialog(); return;
        case 'play': if (state.current) openFullCard(state.current); return;
        case 'drawer': renderMain(); return;
        case 'ai_input':
            try { Lampa.Input.edit({ title: 'Запрос роботу', value: '', free: true, nosave: true }, function (v) { Lampa.Controller.toggle(CTRL_NAME); if (v) aiApplyFilters('Ответ: «' + v.slice(0, 20) + '»', parseUserQuery(v)); }); } catch (e) { notify('Клавиатура недоступна'); }
            return;
        case 'ai_refresh': modalClose(); state.custom = null; loadMainData(true); return;
        case 'ai_random': aiRandom(); return;
        case 'ai_random_play': if (state.cards['rand']) { modalClose(); openFullCard(state.cards['rand']); } return;
        case 'ai_mood':
            try { Lampa.Select.show({ title: '🎯 Настроение', items: MOODS, onSelect: function (s) { Lampa.Controller.toggle(CTRL_NAME); aiApplyFilters('Настроение: ' + s.title, s.f); }, onBack: function () { Lampa.Controller.toggle(CTRL_NAME); } }); } catch (e) {}
            return;
        case 'ai_desc': case 'ai_fit': case 'ai_rev': case 'ai_facts': aiInfo(a); return;
    }
}
function bindMouse(scope) {
    scope.addEventListener('click', function (e) { var n = closestAttr(e.target, 'data-cm-action'); if (n) doAction(n); });
    scope.addEventListener('mouseover', function (e) {
        var n = closestAttr(e.target, 'data-cm-action');
        if (n && !hasClass(n, 'cm-focus')) { for (var r = 0; r < FM.rows.length; r++) { var idx = FM.rows[r].indexOf(n); if (idx > -1) { FM.r = r; FM.i = idx; FM.apply(); break; } } }
    });
}
var Capsule = { onFocus: function (n) { if (n.getAttribute('data-cm-action') === 'card' && state.view === 'main') { var m = state.cards[n.getAttribute('data-key')]; if (m) robotSay('«' + m.title + '» — рейтинг ' + (m.vote_average ? m.vote_average.toFixed(1) : '—') + '.'); } } };
function CapsuleComponent() {
    var html = el('div', 'cm-root');
    this.create = function () {
        injectCSS();
        try { if (window.Lampa && Lampa.Background && Lampa.Background.immediately) Lampa.Background.immediately(''); } catch (e) {}
        state.root = html; html.innerHTML = '';
        html.appendChild(buildHeader()); html.appendChild(el('div', 'cm-content'));
        bindMouse(html); tickClock();
        if (state.clockTimer) clearInterval(state.clockTimer);
        state.clockTimer = setInterval(tickClock, 1000);
        state.custom = null; loadMainData(false);
        return this.render();
    };
    this.start = function () {
        try {
            Lampa.Controller.add(CTRL_NAME, { toggle: function () { FM.apply(); }, up: function () { FM.move('up'); }, down: function () { FM.move('down'); }, left: function () { FM.move('left'); }, right: function () { FM.move('right'); }, enter: function () { var n = FM.current(); if (n) doAction(n); }, back: function () { doAction(html.querySelector('[data-cm-action="back"]')); } });
            Lampa.Controller.toggle(CTRL_NAME);
        } catch (e) {
            document.addEventListener('keydown', function (ev) {
                var k = ev.keyCode;
                if (k === 37) FM.move('left'); else if (k === 39) FM.move('right'); else if (k === 38) FM.move('up'); else if (k === 40) FM.move('down');
                else if (k === 13) { var n = FM.current(); if (n) doAction(n); }
                else if (k === 8 || k === 27 || k === 461 || k === 10009) doAction(html.querySelector('[data-cm-action="back"]'));
            });
        }
    };
    this.render = function () { return html; };
    this.pause = function () {};
    this.stop = function () {};
    this.back = function () { doAction(html.querySelector('[data-cm-action="back"]')); };
    this.destroy = function () { if (state.clockTimer) clearInterval(state.clockTimer); state.clockTimer = null; html.innerHTML = ''; };
}
function addMenuItem() {
    var done = false;
    var mk = function () {
        if (done) return;
        try {
            if (document.querySelector('[data-action="capsule_mod"]')) { done = true; return; }
            if (window.jQuery || window.$) {
                var list = $('.menu .menu__list').eq(0); if (!list.length) return;
                var btn = $('<li class="menu__item selector" data-action="capsule_mod"><div class="menu__ico">' + SVG_MENU + '</div><div class="menu__text">Capsule Mod</div></li>');
                btn.on('hover:enter', function () { try { Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT, page: 1 }); } catch (e) {} });
                list.append(btn);
            } else {
                var l2 = document.querySelector('.menu .menu__list'); if (!l2) return;
                var b2 = el('li', 'menu__item', '<div class="menu__ico">' + SVG_MENU + '</div><div class="menu__text">Capsule Mod</div>');
                b2.setAttribute('data-action', 'capsule_mod');
                b2.onclick = function () { try { Lampa.Activity.push({ url: '', title: 'Capsule Mod', component: COMPONENT, page: 1 }); } catch (e) {} };
                l2.appendChild(b2);
            }
            done = true;
        } catch (e) {}
    };
    if (window.appready) setTimeout(mk, 500);
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) { Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') setTimeout(mk, 500); }); setTimeout(function () { if (window.appready) setTimeout(mk, 500); }, 2500); }
    else setTimeout(mk, 1000);
}
function startPlugin() {
    if (window.plugin_capsule_mod) return;
    window.plugin_capsule_mod = true;
    injectCSS();
    var booted = false;
    var boot = function () {
        if (booted) return; booted = true;
        setTimeout(function () {
            try { if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT, CapsuleComponent); } catch (e) {}
            addMenuItem();
            console.log('[CapsuleMod] v2.0 готов');
        }, 300);
    };
    if (window.appready) boot();
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) { Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); }); setTimeout(function () { if (window.appready) boot(); }, 2500); }
    else boot();
}
startPlugin();
})();
