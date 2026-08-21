/* --- CAPSULE MOD v4.0 --- переработанный движок рекомендаций + 2D-навигация + обновлённый интерфейс */
(function () {
'use strict';
if (window.plugin_capsule_mod) return;
window.plugin_capsule_mod = true;

/* ============================== УТИЛИТЫ ============================== */
function el(t, c, h) { var d = document.createElement(t); if (c) d.className = c; if (h != null) d.innerHTML = h; return d; }
function addClass(n, c) { if (n && !hasClass(n, c)) n.className += (n.className ? ' ' : '') + c; }
function removeClass(n, c) { if (!n) return; n.className = (' ' + n.className + ' ').replace(' ' + c + ' ', ' ').replace(/\s+/g, ' ').replace(/^ +| +$/g, ''); }
function hasClass(n, c) { return n && (' ' + n.className + ' ').indexOf(' ' + c + ' ') > -1; }
function closestAttr(n, a) { while (n && n !== document) { if (n.getAttribute && n.getAttribute(a)) return n; n = n.parentNode; } return null; }
function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function nowMs() { return Date.now(); }
function dayMs() { return 86400000; }
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function normTitle(s) { return String(s || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi, ''); }
function toMs(ts) { if (!ts) return 0; return String(Math.floor(ts)).length > 11 ? ts : ts * 1000; }
var raf = window.requestAnimationFrame || function (f) { return setTimeout(function () { f(nowMs()); }, 16); };
function tweenScroll(n, p, to, ms) { if (!n) return; var from = n[p], t0 = nowMs(); ms = ms || 200; function s() { var q = Math.min(1, (nowMs() - t0) / ms), e = 1 - Math.pow(1 - q, 3); n[p] = Math.round(from + (to - from) * e); if (q < 1) raf(s); } raf(s); }

function sGet(k, d) {
    try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') { var v = Lampa.Storage.get(k, d); return (v === undefined || v === null) ? d : v; } } catch (e) {}
    try { if (window.localStorage) { var r = localStorage.getItem('cm_' + k); if (r != null) return JSON.parse(r); } } catch (e) {}
    return d;
}
function sSet(k, v) {
    try { if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') { Lampa.Storage.set(k, v); return; } } catch (e) {}
    try { if (window.localStorage) localStorage.setItem('cm_' + k, JSON.stringify(v)); } catch (e) {}
}
function sDel(k) {
    try { if (window.Lampa && Lampa.Storage && Lampa.Storage.remove) Lampa.Storage.remove(k); } catch (e) {}
    try { if (window.localStorage) localStorage.removeItem('cm_' + k); } catch (e) {}
}
function httpGet(u, ok, err) {
    try {
        var x = new XMLHttpRequest(); x.open('GET', u, true); x.timeout = 12000;
        x.onreadystatechange = function () {
            if (x.readyState === 4) {
                if (x.status >= 200 && x.status < 400) { var d = null; try { d = JSON.parse(x.responseText); } catch (e) {} if (d) ok(d); else if (err) err('parse'); }
                else if (err) err('status:' + x.status);
            }
        };
        x.onerror = function () { if (err) err('network'); };
        x.ontimeout = function () { if (err) err('timeout'); };
        x.send();
    } catch (e) { if (err) err('exception'); }
}
function notify(t) { try { if (window.Lampa && Lampa.Noty && Lampa.Noty.show) { Lampa.Noty.show(t); return; } } catch (e) {} console.log('[CapsuleMod]', t); }

/* ============================== КОНСТАНТЫ ============================== */
var COMPONENT = 'capsule_mod_view';
var CTRL_NAME = 'capsule_mod';
var TMDB_BASE = 'https://api.themoviedb.org/3';
var TMDB_DEFAULT_KEY = '04c35731a5ee918f014970082a0088b1';
var CACHE_TTL = dayMs();
var PROFILE_TTL = 12 * 60 * 60 * 1000; /* профиль живёт полдня — быстрее подхватывает новые оценки */

/* Веса сигналов. Брошенное — сильный отрицательный сигнал, но включается только
   при уверенном детекте (см. Engine.classify). */
var WEIGHTS = { completed: 3, favorite: 5, abandoned: -4, disliked: -6 };

var GENRE_RU = { 28: 'боевик', 12: 'приключения', 16: 'анимация', 35: 'комедия', 80: 'криминал', 99: 'документальный', 18: 'драма', 10751: 'семейный', 14: 'фэнтези', 27: 'ужасы', 9648: 'детектив', 10749: 'мелодрама', 878: 'фантастика', 53: 'триллер', 37: 'вестерн', 10752: 'военный', 36: 'история', 10402: 'музыка', 10770: 'ТВ-фильм' };

/* Шумные keyword-категории TMDB, которые почти не несут сигнала о жанровом вкусе
   и часто перетягивают выдачу в случайную сторону — сознательно занижаем их вес. */
var NOISY_KEYWORD_IDS = { 818: 1, 9663: 1, 155792: 1 }; /* based on novel / murder / duringcreditsstinger и т.п. заглушки */

var PHRASES = {
    hello: ['Привет! Подобрал кое-что интересное.', 'Приветствую — есть пара хороших находок.'],
    morning: ['Доброе утро! Начнём день с хорошей истории?'],
    evening: ['Добрый вечер! Время для хорошего кино.'],
    loading: ['Изучаю ваши вкусы…', 'Подбираю варианты…'],
    error: ['Сеть подводит, но я не сдаюсь. Попробуйте обновить.'],
    empty: ['Пока маловато данных — посмотрите что-нибудь, и я подстроюсь под вас.'],
    done: ['Готово! Профиль пересчитан.'],
    noKey: ['Нужен рабочий TMDB-ключ — загляните в настройки.']
};

/* ============================== СТИЛИ ============================== */
var CSS_TEXT = [
':root{--cm-bg:#0c0e12;--cm-panel:#181b21;--cm-panel2:#20242c;--cm-accent:#5da9ff;--cm-text:#eef1f5;--cm-sub:#9aa3b2;--cm-danger:#ff5d6c;}',
'.cm-root{position:fixed;inset:0;background:var(--cm-bg);z-index:99999;color:var(--cm-text);font-family:-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}',
'.cm-header{position:absolute;top:0;left:0;right:0;height:4.4em;display:flex;align-items:center;padding:0 1.6em;background:linear-gradient(#0c0e12 60%,rgba(12,14,18,0));z-index:20}',
'.cm-hbtn{width:2.7em;height:2.7em;display:flex;align-items:center;justify-content:center;border-radius:0.8em;cursor:pointer;background:var(--cm-panel);transition:background .12s,transform .12s}',
'.cm-hbtn svg{width:1.4em;height:1.4em;fill:var(--cm-text)}',
'.cm-hbtn.cm-focus{background:var(--cm-accent);transform:scale(1.08)}',
'.cm-hbtn.cm-focus svg{fill:#08111e}',
'.cm-title{margin-left:1em;font-size:1.35em;font-weight:700;color:var(--cm-text);letter-spacing:.01em}',
'.cm-status{margin-left:0.8em;font-size:0.85em;color:var(--cm-sub)}',
'.cm-clock{margin-left:auto;font-size:1.4em;font-weight:700;color:var(--cm-sub);font-variant-numeric:tabular-nums}',
'.cm-content{position:absolute;top:4.4em;bottom:0;left:0;right:0;overflow-y:auto;overflow-x:hidden;padding:0.4em 1.6em 9em}',
'.cm-row{margin-bottom:1.6em}',
'.cm-row-head{display:flex;align-items:baseline;gap:0.6em;margin:0.4em 0 0.7em 0.1em}',
'.cm-row-title{font-size:1.18em;color:var(--cm-text);font-weight:700}',
'.cm-row-sub{font-size:0.85em;color:var(--cm-sub)}',
'.cm-strip{display:flex;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;padding:0.5em 0.2em 0.8em;scrollbar-width:none}',
'.cm-strip::-webkit-scrollbar{display:none}',
'.cm-card{position:relative;flex:none;width:11em;height:16.5em;border-radius:1em;overflow:hidden;margin-right:1em;background:var(--cm-panel);border:0.22em solid transparent;transition:transform .15s,border-color .15s;cursor:pointer}',
'.cm-card img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}',
'.cm-card.cm-focus{border-color:var(--cm-accent);transform:scale(1.06);z-index:2;box-shadow:0 0.5em 1.4em rgba(0,0,0,.5)}',
'.cm-b-type{position:absolute;top:0.5em;left:0.5em;background:rgba(93,169,255,.92);color:#08111e;font-size:0.72em;font-weight:800;padding:0.18em 0.55em;border-radius:0.5em;letter-spacing:.02em}',
'.cm-b-type.mov{background:rgba(255,255,255,.85)}',
'.cm-b-rate{position:absolute;bottom:0.45em;right:0.45em;background:rgba(0,0,0,0.78);font-size:0.85em;font-weight:700;padding:0.12em 0.55em;border-radius:0.6em}',
'.cm-b-match{position:absolute;top:0.5em;right:0.5em;background:rgba(20,180,110,.92);color:#04150c;font-size:0.7em;font-weight:800;padding:0.16em 0.5em;border-radius:0.5em}',
'.cm-t{position:absolute;left:0;right:0;bottom:0;padding:2em 0.6em 0.55em 0.6em;font-size:0.82em;color:#f3f5f8;background:linear-gradient(transparent,rgba(0,0,0,0.88));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
'.cm-robot-wrap{position:absolute;left:2.2em;bottom:1.4em;z-index:30;display:flex;align-items:flex-end;max-width:70%}',
'.cm-robot{width:6.6em;height:6.6em;flex:none;cursor:pointer;will-change:transform;animation:cm-float 3.6s ease-in-out infinite;border-radius:1.2em}',
'.cm-robot.cm-focus{outline:0.2em solid var(--cm-accent);transform:scale(1.06)}',
'.cm-robot svg{width:100%;height:100%}',
'.cm-bubble{position:relative;background:var(--cm-panel);border-radius:1em;padding:0.8em 1.1em;margin-left:1.2em;max-width:22em;font-size:1em;color:#eaeaea;line-height:1.4;box-shadow:0 0.2em 0.6em rgba(0,0,0,0.3)}',
'.cm-bubble:before{content:"";position:absolute;left:-0.85em;bottom:1em;border-top:0.75em solid transparent;border-bottom:0.75em solid transparent;border-right:0.95em solid var(--cm-panel)}',
'@keyframes cm-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-0.35em)}}',
'.cm-details{display:flex;gap:1.6em;padding:0.6em 0 8em}',
'.cm-d-left{flex:none;width:17em}',
'.cm-d-left .cm-card{width:16em;height:24em;margin:0;cursor:default}',
'.cm-d-meta{margin-top:0.9em;color:var(--cm-sub);font-size:0.95em;line-height:1.6}',
'.cm-d-meta b{color:var(--cm-text);font-size:1.1em}',
'.cm-d-genres{margin-top:0.5em;display:flex;flex-wrap:wrap;gap:0.4em}',
'.cm-d-genre{background:var(--cm-panel2);color:#cfe0ff;font-size:0.8em;padding:0.25em 0.7em;border-radius:1em}',
'.cm-d-center{flex:none;width:12em;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:1em;padding-top:1em}',
'.cm-play{width:100%;height:6.6em;background:var(--cm-panel2);border-radius:1.3em;border:0.22em solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .15s,border-color .15s}',
'.cm-play svg{width:3em;height:3em;fill:var(--cm-text)}',
'.cm-play.cm-focus{border-color:var(--cm-accent);transform:scale(1.05)}',
'.cm-feedback{display:flex;gap:0.6em;width:100%}',
'.cm-fbtn{flex:1;height:3.2em;border-radius:1em;background:var(--cm-panel2);border:0.2em solid transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:1.3em}',
'.cm-fbtn.cm-focus{border-color:var(--cm-accent);transform:scale(1.06)}',
'.cm-fbtn.cm-active-like{background:rgba(20,180,110,.25);border-color:#14b46e}',
'.cm-fbtn.cm-active-dislike{background:rgba(255,93,108,.2);border-color:var(--cm-danger)}',
'.cm-d-right{flex:1;padding-top:0.2em;min-width:0}',
'.cm-ai-item{background:var(--cm-panel);border:0.22em solid transparent;border-radius:1em;padding:0.8em 1.1em;margin-bottom:0.8em;font-size:1em;color:#e6e6e6;cursor:pointer;transition:border-color .12s,background .12s}',
'.cm-ai-item.cm-focus{border-color:var(--cm-accent);background:var(--cm-panel2)}',
'.cm-overlay{position:fixed;inset:0;background:rgba(6,7,10,0.92);z-index:100000;display:flex;align-items:center;justify-content:center;padding:2em}',
'.cm-panel{background:var(--cm-panel);border-radius:1.4em;padding:1.7em 2em;min-width:26em;max-width:92%;max-height:86%;overflow-y:auto}',
'.cm-panel h2{margin:0 0 1em 0;font-size:1.35em}',
'.cm-set-item{background:var(--cm-panel2);border:0.22em solid transparent;border-radius:0.9em;padding:0.8em 1.1em;margin-bottom:0.7em;font-size:1.05em;color:#ddd;cursor:pointer;display:flex;justify-content:space-between;gap:1em}',
'.cm-set-item.cm-focus{border-color:var(--cm-accent)}',
'.cm-set-item .val{color:var(--cm-accent);font-weight:600}',
'.cm-set-hint{font-size:0.82em;color:var(--cm-sub);margin:-0.3em 0 0.9em 0.2em}',
'.cm-modal-body{padding:0.2em;color:#ddd;font-size:1em;line-height:1.55;max-height:24em;overflow:auto}',
'.cm-modal-body h4{color:#fff;margin:0.7em 0 0.4em}',
'.cm-chip{display:inline-block;background:var(--cm-panel2);border:0.2em solid transparent;border-radius:2em;padding:0.5em 1.15em;margin:0 0.5em 0.7em 0;color:#cfe8ff;cursor:pointer}',
'.cm-chip.cm-focus{border-color:var(--cm-accent);background:#2a3040}',
'.cm-input-fake{background:var(--cm-panel2);border:0.2em dashed #4a5060;border-radius:0.9em;padding:0.8em 1.1em;margin-bottom:0.9em;color:#9ad1ff;cursor:pointer}',
'.cm-input-fake.cm-focus{border-color:var(--cm-accent)}',
'.cm-skel{background:linear-gradient(90deg,#181b21,#22262e,#181b21);background-size:200% 100%;animation:cm-shimmer 1.4s infinite}',
'@keyframes cm-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',
'.cm-empty-block{padding:2em 1em;text-align:center;color:var(--cm-sub);background:var(--cm-panel);border-radius:1em}',
'.cm-empty-block b{display:block;color:var(--cm-text);font-size:1.1em;margin-bottom:0.4em}',
'@media (max-width:768px){.cm-root{font-size:12px}.cm-header{height:3.6em;padding:0 1em}.cm-hbtn{width:2.1em;height:2.1em}.cm-hbtn svg{width:1.2em;height:1.2em}.cm-title{font-size:1.15em}.cm-clock{font-size:1.1em}.cm-content{padding:0.3em 1em 8em}.cm-robot-wrap{left:1em;bottom:0.7em;max-width:88%}.cm-robot{width:4.6em;height:4.6em}.cm-bubble{max-width:15em;font-size:0.88em}.cm-details{flex-direction:column;padding-bottom:4em;gap:1em}.cm-d-left{width:100%;display:flex;gap:1em;align-items:flex-start}.cm-d-left .cm-card{width:6.4em;height:9.6em}.cm-d-meta{margin-top:0}.cm-d-center{width:100%;flex-direction:row}.cm-play{height:4.2em}.cm-d-right{width:100%}}',
'@media (min-width:2200px){.cm-root{font-size:22px}}'
].join('\n');
function injectCSS() { if (document.getElementById('capsule_mod_css')) return; var st = el('style'); st.id = 'capsule_mod_css'; st.type = 'text/css'; st.innerHTML = CSS_TEXT; (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(st); }

/* ============================== ИКОНКИ ============================== */
var SVG_ROBOT = '<svg viewBox="0 0 220 230" xmlns="http://www.w3.org/2000/svg"><g fill="#d8d8d8"><rect x="118" y="8" width="86" height="66" rx="16" transform="rotate(4 161 41)"/><rect x="112" y="86" width="96" height="88" rx="24" transform="rotate(-7 160 130)"/><path d="M120 168 C104 176 96 196 92 214 L112 220 C118 202 126 188 138 182 Z"/><path d="M188 170 C196 186 202 202 206 218 L186 226 C180 208 172 194 164 186 Z"/><path d="M118 100 C96 108 84 124 78 140 L96 148 C104 132 114 120 126 114 Z"/></g><circle cx="146" cy="38" r="9" fill="#111"/><circle cx="149" cy="35" r="2.6" fill="#fff"/><circle cx="180" cy="40" r="9" fill="#111"/><circle cx="183" cy="37" r="2.6" fill="#fff"/><g stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"><path d="M146 112 L176 108"/><path d="M148 124 L178 120"/><path d="M150 136 L180 132"/></g><path d="M128 156 L146 152" stroke="#a33" stroke-width="5" stroke-linecap="round"/></svg>';
var SVG_BACK = '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5 1.6-1.6L11.2 12l5.9-5.9z"/></svg>';
var SVG_GEAR = '<svg viewBox="0 0 24 24"><path d="M19.4 13c.04-.32.06-.66.06-1s-.02-.68-.07-1l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.5.5 0 0 0-.61.22L2.9 8.78a.5.5 0 0 0 .12.64L5.05 11c-.05.32-.08.66-.08 1s.03.68.08 1l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.42.34.61.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.12-.56 1.62-.94l2.39.96c.24.1.5 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64L19.4 13zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"/></svg>';
var SVG_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
var SVG_MENU = '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5a2.2 2.2 0 1 1 0 4.4A2.2 2.2 0 0 1 12 7zm-4.4 8.6c.6-2 2.3-3.2 4.4-3.2s3.8 1.2 4.4 3.2c-1.2 1.2-2.7 1.9-4.4 1.9s-3.2-.7-4.4-1.9z"/></svg>';

function posterPlaceholder(title) {
    var t = esc(String(title || 'capsule').slice(0, 16));
    return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300"><rect width="200" height="300" fill="#181b21"/><rect x="8" y="8" width="184" height="284" rx="12" fill="none" stroke="#2a2e38" stroke-width="2"/><text x="100" y="155" fill="#5da9ff" font-size="15" text-anchor="middle" font-family="sans-serif">' + t + '</text></svg>');
}

/* ============================== НАСТРОЙКИ ============================== */
function isOn(v) { return v === true || v === 'on' || v === 'true' || v === 1 || v === '1'; }
function cfgMascot() { return isOn(sGet('capsule_mod_mascot', true)); }
function cfgDepth() { var v = sGet('capsule_mod_depth', 'month'); return (v === 'all') ? 'all' : 'month'; }
function cfgSens() { var v = sGet('capsule_mod_sens', 'balanced'); return (v === 'exp' || v === 'strict') ? v : 'balanced'; }
function cfgKey() { return sGet('capsule_mod_tmdb_key', '') || sGet('tmdb_api_key', '') || TMDB_DEFAULT_KEY; }

/* ============================== КЭШ TMDB-ЗАПРОСОВ ============================== */
var cacheMem = sGet('capsule_mod_cache', {}) || {};
function cacheGet(u) { var e = cacheMem[u]; if (e && e.d && (nowMs() - e.t) < CACHE_TTL) return e.d; return null; }
function cacheSet(u, d) {
    var ks = [], k;
    for (k in cacheMem) if (Object.prototype.hasOwnProperty.call(cacheMem, k)) ks.push({ k: k, t: cacheMem[k].t || 0 });
    if (ks.length > 80) { ks.sort(function (a, b) { return a.t - b.t; }); for (var i = 0; i < 30; i++) delete cacheMem[ks[i].k]; }
    cacheMem[u] = { t: nowMs(), d: d };
    sSet('capsule_mod_cache', cacheMem);
}
var TMDB = {
    url: function (p, q) {
        var s = 'api_key=' + encodeURIComponent(cfgKey()) + '&language=ru-RU';
        if (q) for (var k in q) if (q[k] != null && q[k] !== '') s += '&' + k + '=' + encodeURIComponent(q[k]);
        return TMDB_BASE + p + '?' + s;
    },
    get: function (p, q, cb, err) {
        var u = this.url(p, q), c = cacheGet(u);
        if (c) { cb(c); return; }
        httpGet(u, function (d) { cacheSet(u, d); cb(d); }, function (reason) { if (err) err(reason); });
    },
    img: function (p, size) {
        if (!p) return null;
        try { if (window.Lampa && Lampa.TMDB && Lampa.TMDB.image) return Lampa.TMDB.image(p, size || 'w342'); } catch (e) {}
        return 'https://image.tmdb.org/t/p/' + (size || 'w342') + p;
    }
};
function setPoster(img, path, title, size) {
    var urls = [], tried = 0, a = TMDB.img(path, size);
    if (a) urls.push(a);
    if (path) urls.push('https://www.themoviedb.org/t/p/' + (size || 'w342') + path);
    if (!urls.length) { img.src = posterPlaceholder(title); return; }
    img.onerror = function () { tried++; if (tried < urls.length) img.src = urls[tried]; else { img.onerror = null; img.src = posterPlaceholder(title); } };
    img.src = urls[0];
}

/* ============================== ДВИЖОК РЕКОМЕНДАЦИЙ ============================== */
/*
   Ключевые изменения относительно v3:
   - Анализируем ДО 40 последних значимых событий, а не 10 — иначе профиль
     строится по случайной трети истории.
   - "Брошенное" (abandoned) детектируется явно: percent между 5 и 40,
     и с момента последнего сохранения прошло не меньше 3 дней (значит,
     человек не просто на паузе, а действительно бросил).
   - Ручной лайк/дизлайк из карточки фильма — сильный прямой сигнал,
     хранится отдельно и не протухает по TTL.
   - Жанровые веса нормализуются НЕ по максимуму в текущей случайной
     выдаче (как было — это делало скор нестабильным), а по сумме
     положительных весов в самом профиле, что даёт устойчивый % совпадения.
   - Явно исключаем из "without_genres" любой жанр, который одновременно
     находится в положительных интересах (защита от противоречия старого кода).
   - Шумные keyword ушли в игнор-лист, вес keyword снижен относительно жанра.
   - Показываем reason ("почему рекомендовано") на карточке через match%.
*/
var MANUAL_KEY = 'capsule_mod_manual'; /* { 'movie:123': 1 (like) | -1 (dislike) } */
function manualGet() { return sGet(MANUAL_KEY, {}) || {}; }
function manualSet(map) { sSet(MANUAL_KEY, map); }
function setManualFeedback(type, id, val) {
    var m = manualGet(), key = type + ':' + id;
    if (val === 0) delete m[key]; else m[key] = val;
    manualSet(m);
}
function getManualFeedback(type, id) { var m = manualGet(); return m[type + ':' + id] || 0; }

var Engine = {
    readHistory: function () {
        var out = [], seen = {};
        function addItem(item, sourceFavorite) {
            if (!item || !item.id) return;
            var type = (item.method === 'tv' || item.type === 'tv' || (item.card && (item.card.name || item.card.original_name))) ? 'tv' : 'movie';
            var id = item.id;
            var percent = typeof item.percent === 'number' ? item.percent : ((item.timeline && item.timeline.percent) || 0);
            var key = type + ':' + id;
            if (seen[key]) {
                /* если один и тот же тайтл встретился и в таймлайне, и в избранном — считаем избранным */
                if (sourceFavorite) { for (var i = 0; i < out.length; i++) if (out[i].id === id && out[i].type === type) out[i].favorite = true; }
                return;
            }
            seen[key] = 1;
            out.push({ id: id, type: type, percent: percent, date: toMs(item.date || item.last_time || 0), favorite: !!sourceFavorite });
        }
        try {
            if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.view === 'function') {
                var tl = Lampa.Timeline.view(0, 200);
                if (tl && tl.forEach) tl.forEach(function (e) { addItem(e, false); });
            }
        } catch (e) {}
        try {
            var tl2 = sGet('timeline', {});
            if (tl2 && typeof tl2 === 'object') for (var h in tl2) if (Object.prototype.hasOwnProperty.call(tl2, h)) addItem(tl2[h], false);
        } catch (e) {}
        try {
            if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.get === 'function') {
                var fav = Lampa.Favorite.get();
                var walkFav = function (v) {
                    if (!v) return;
                    if (v instanceof Array) { for (var j = 0; j < v.length; j++) walkFav(v[j]); return; }
                    if (typeof v === 'object' && v.id) {
                        var t = (v.name || v.original_name) ? 'tv' : 'movie';
                        addItem({ id: v.id, type: t, percent: 100, date: 0 }, true);
                    }
                };
                walkFav(fav);
            }
        } catch (e) {}
        return out;
    },
    /* Классификация: превращаем сырую историю в взвешенные события.
       Порядок важности сигнала: ручной лайк/дизлайк > избранное > завершено > брошено. */
    classify: function (hist) {
        var ev = [], cut = cfgDepth() === 'month' ? (nowMs() - 30 * dayMs()) : 0, manual = manualGet();
        for (var i = 0; i < hist.length; i++) {
            var it = hist[i], key = it.type + ':' + it.id, w = 0;
            if (manual[key]) { w = manual[key] > 0 ? WEIGHTS.favorite : WEIGHTS.disliked; }
            else if (it.favorite) w = WEIGHTS.favorite;
            else if (it.percent >= 80) w = WEIGHTS.completed;
            else if (it.percent >= 5 && it.percent < 40 && it.date && (nowMs() - it.date) > 3 * dayMs()) w = WEIGHTS.abandoned;
            if (w === 0) continue;
            if (cut && it.date && it.date < cut && !manual[key] && !it.favorite) continue; /* глубина анализа не режет ручные оценки и избранное */
            ev.push({ id: it.id, type: it.type, weight: w, date: it.date || 0 });
        }
        /* Более свежие события важнее при равном модуле веса — сортируем по (|вес|, дата) */
        ev.sort(function (a, b) { return (Math.abs(b.weight) - Math.abs(a.weight)) || (b.date - a.date); });
        return ev.slice(0, 40);
    },
    computeProfile: function (cb) {
        var events = this.classify(this.readHistory()), interests = {}, watched = { ids: {}, titles: {} }, idx = 0, failed = 0;
        function next() {
            if (idx >= events.length) return finish();
            var ev = events[idx++];
            TMDB.get('/' + ev.type + '/' + ev.id, { append_to_response: 'keywords,credits' }, function (d) {
                var i;
                watched.ids[ev.type + ':' + ev.id] = 1;
                if (d.title) watched.titles[normTitle(d.title)] = 1;
                if (d.name) watched.titles[normTitle(d.name)] = 1;
                var genreIds = d.genre_ids || (d.genres ? d.genres.map(function (g) { return g.id; }) : []);
                for (i = 0; i < genreIds.length; i++) interests['g' + genreIds[i]] = (interests['g' + genreIds[i]] || 0) + ev.weight;
                var kw = d.keywords && d.keywords.keywords ? d.keywords.keywords : (d.keywords && d.keywords.results ? d.keywords.results : (d.keywords instanceof Array ? d.keywords : []));
                var kwUsed = 0;
                for (i = 0; i < kw.length && kwUsed < 6; i++) {
                    if (NOISY_KEYWORD_IDS[kw[i].id]) continue;
                    interests['k' + kw[i].id] = (interests['k' + kw[i].id] || 0) + ev.weight * 0.5; /* keyword слабее жанра */
                    kwUsed++;
                }
                var cast = d.credits && d.credits.cast ? d.credits.cast : [];
                for (i = 0; i < Math.min(cast.length, 3); i++) interests['p' + cast[i].id] = (interests['p' + cast[i].id] || 0) + ev.weight * 0.35;
                next();
            }, function () { failed++; next(); });
        }
        function finish() {
            for (var k in interests) if (Object.prototype.hasOwnProperty.call(interests, k) && interests[k] === 0) delete interests[k];
            var p = { interests: interests, watched: watched, last_updated: nowMs(), sampleSize: events.length, failedLookups: failed };
            sSet('capsule_mod_profile', p);
            cb(p);
        }
        if (!events.length) return finish();
        next();
    },
    ensureProfile: function (force, cb) {
        var p = sGet('capsule_mod_profile', null);
        if (!force && p && p.interests && (nowMs() - (p.last_updated || 0)) < PROFILE_TTL) { cb(p); return; }
        this.computeProfile(cb);
    },
    extWatched: function (profile) {
        var w = {}, p = (profile && profile.watched) || {}, k, i;
        if (p.ids) for (k in p.ids) w[k] = 1;
        if (p.titles) for (k in p.titles) w['t' + k] = 1;
        var h = this.readHistory();
        for (i = 0; i < h.length; i++) { w[h[i].type + ':' + h[i].id] = 1; w['id' + h[i].id] = 1; }
        return w;
    },
    /* Сумма положительных жанровых весов — база для нормализации совпадения (0..100%). */
    positiveGenreSum: function (profile) {
        var inter = (profile && profile.interests) || {}, sum = 0, k;
        for (k in inter) if (k.charAt(0) === 'g' && inter[k] > 0) sum += inter[k];
        return sum || 1;
    },
    topGenres: function (profile, sens) {
        var inter = (profile && profile.interests) || {}, pos = [], neg = [], k;
        for (k in inter) {
            if (k.charAt(0) !== 'g') continue;
            var id = k.slice(1), w = inter[k];
            if (w > 0) pos.push({ id: id, w: w }); else if (w < 0) neg.push({ id: id, w: w });
        }
        pos.sort(function (a, b) { return b.w - a.w; });
        neg.sort(function (a, b) { return a.w - b.w; });
        var limit = sens === 'strict' ? 2 : (sens === 'exp' ? 5 : 3);
        pos = pos.slice(0, limit);
        /* Защита от противоречия: жанр не может одновременно быть исключён и включён */
        var posIds = {}; for (var i = 0; i < pos.length; i++) posIds[pos[i].id] = 1;
        neg = neg.filter(function (n) { return !posIds[n.id]; }).slice(0, 3);
        return { pos: pos.map(function (x) { return x.id; }), neg: neg.map(function (x) { return x.id; }) };
    },
    topKeywords: function (profile, sens) {
        var inter = (profile && profile.interests) || {}, kw = [], k;
        for (k in inter) if (k.charAt(0) === 'k' && inter[k] > 0) kw.push({ id: k.slice(1), w: inter[k] });
        kw.sort(function (a, b) { return b.w - a.w; });
        return kw.slice(0, sens === 'exp' ? 4 : 2).map(function (x) { return x.id; });
    },
    discover: function (profile, extra, cb) {
        var sens = cfgSens(), genres = this.topGenres(profile, sens), kws = this.topKeywords(profile, sens);
        var params = { 'vote_average.gte': 5.8, include_adult: false, page: 1 };
        if (genres.pos.length) params.with_genres = genres.pos.join(',');
        if (genres.neg.length) params.without_genres = genres.neg.join(',');
        if (kws.length) params.with_keywords = kws.join('|');
        if (extra) for (var k in extra) params[k] = extra[k];
        var done = 0, merged = [], anyOk = false;
        function fin(ok) { if (ok) anyOk = true; done++; if (done === 2) cb(merged, anyOk); }
        function one(t) {
            var p2 = {}; for (var k2 in params) p2[k2] = params[k2];
            p2['vote_count.gte'] = t === 'movie' ? 120 : 40;
            TMDB.get('/discover/' + t, p2, function (d) {
                var r = d.results || [];
                for (var j = 0; j < r.length; j++) { r[j].media_type = t; merged.push(r[j]); }
                fin(true);
            }, function () { fin(false); });
        }
        one('movie'); one('tv');
    },
    /* Скоринг: жанровое совпадение нормализуется по сумме позитивных весов ПРОФИЛЯ
       (стабильно между вызовами), а не по максимуму в конкретной случайной выборке. */
    pick: function (list, profile, watched, seen, mode, n) {
        var inter = (profile && profile.interests) || {}, base = this.positiveGenreSum(profile), i, j, out = [];
        for (i = 0; i < list.length; i++) {
            var m = list[i], g = m.genre_ids || [], w = 0;
            for (j = 0; j < g.length; j++) w += inter['g' + g[j]] || 0;
            m._gw = w;
            m._matchPct = clamp(Math.round((w / base) * 100), 0, 100);
        }
        for (i = 0; i < list.length && out.length < n * 3; i++) {
            var mm = list[i], t = mm.media_type || (mm.name ? 'tv' : 'movie'), key = t + ':' + mm.id;
            if (watched[key] || watched['id' + mm.id] || watched['t' + normTitle(mm.title || mm.name)] || seen[key]) continue;
            var manualScore = getManualFeedback(t, mm.id);
            if (manualScore < 0) continue; /* явный дизлайк — никогда не показываем повторно */
            seen[key] = 1;
            var rt = mm.vote_average || 0;
            var rel = mm.release_date || mm.first_air_date || '';
            var days = rel ? Math.max(0, (nowMs() - new Date(rel).getTime()) / dayMs()) : 3650;
            var recency = Math.max(0, 10 * (1 - days / (365 * 3)));
            var gn = clamp(mm._gw / (base / 10), 0, 10); /* 0..10, где 10 = максимально попадает во вкус */
            var score;
            if (mode === 'stable') score = gn * 0.5 + rt * 0.35 + Math.min(10, (mm.vote_count || 0) / 150) * 0.15;
            else score = gn * 0.3 + rt * 0.2 + recency * 0.35 + Math.random() * 1.5;
            if (manualScore > 0) score += 3; /* лайкнутые похожие жанры чуть приоритетнее */
            out.push({ m: mm, s: score });
        }
        out.sort(function (a, b) { return b.s - a.s; });
        var res = []; for (i = 0; i < out.length && i < n; i++) res.push(out[i].m);
        return res;
    },
    buildBundle: function (profile, cb) {
        var self = this, watched = this.extWatched(profile), seen = {}, out = { stable: [], exp: [], ok: true };
        var done = 0;
        function fin(ok) { if (!ok) out.ok = out.ok; done++; if (done === 2) cb(out); }
        this.discover(profile, { sort_by: 'vote_average.desc' }, function (l, ok) { out.stable = self.pick(l, profile, watched, seen, 'stable', 8); fin(ok); });
        this.discover(profile, { sort_by: 'popularity.desc', 'primary_release_date.gte': (new Date().getFullYear() - 3) + '-01-01' }, function (l, ok) { out.exp = self.pick(l, profile, watched, seen, 'exp', 8); fin(ok); });
    },
    queryBundle: function (profile, f, cb) {
        var self = this, watched = this.extWatched(profile), seen = {}, p = { sort_by: 'popularity.desc', 'vote_average.gte': 5.8 };
        if (f.with_genres && f.with_genres.length) p.with_genres = f.with_genres.join(',');
        if (f.without_genres && f.without_genres.length) p.without_genres = f.without_genres.join(',');
        if (f.year_gte) p['primary_release_date.gte'] = f.year_gte + '-01-01';
        if (f.year_lte) p['primary_release_date.lte'] = f.year_lte + '-12-31';
        this.discover(profile, p, function (l) { cb(self.pick(l, profile, watched, seen, 'exp', 10)); });
    },
    resetProfile: function (cb) { sDel('capsule_mod_profile'); this.computeProfile(cb); },
    setFeedback: function (type, id, val) { setManualFeedback(type, id, val); }
};

/* ============================== ПАРСЕР ЗАПРОСА К РОБОТУ ============================== */
function parseUserQuery(text) {
    var s = String(text || '').toLowerCase(), f = { with_genres: [], without_genres: [], phrase: '' };
    var rules = [
        { re: /комед|смешн|весел|юмор/, g: 35 }, { re: /боевик|экшн|экшен/, g: 28 }, { re: /фантаст|космос/, g: 878 },
        { re: /ужас|хоррор|страш/, g: 27 }, { re: /триллер|напряж/, g: 53 }, { re: /драм/, g: 18 },
        { re: /романти|мелодрам|любов/, g: 10749 }, { re: /детектив|криминал/, g: 80 }, { re: /приключени/, g: 12 },
        { re: /аниме|манга|мульт/, g: 16 }, { re: /семейн|детск/, g: 10751 }, { re: /фэнтези/, g: 14 }, { re: /документал/, g: 99 }
    ];
    for (var i = 0; i < rules.length; i++) {
        var m = s.match(rules[i].re);
        if (m) { var before = s.substring(Math.max(0, m.index - 14), m.index); if (/без|кроме|не\s/.test(before)) f.without_genres.push(rules[i].g); else f.with_genres.push(rules[i].g); }
    }
    if (/90[-хx]/.test(s)) { f.year_gte = 1990; f.year_lte = 1999; }
    else if (/80[-хx]/.test(s)) { f.year_gte = 1980; f.year_lte = 1989; }
    else if (/новинк|свеж/.test(s)) f.year_gte = new Date().getFullYear() - 1;
    else if (/стар|классик|ретро/.test(s)) f.year_lte = 2000;
    var names = []; for (var j = 0; j < f.with_genres.length; j++) names.push(GENRE_RU[f.with_genres[j]] || '');
    f.phrase = f.with_genres.length ? 'Принял! Собираю: ' + names.join(', ') + '.' : 'Попробую угадать настроение по запросу.';
    return f;
}
var MOODS = [
    { title: '🎉 Весёлое', f: { with_genres: [35] } },
    { title: '🌚 Мрачное', f: { with_genres: [53, 27] } },
    { title: '💖 Романтичное', f: { with_genres: [10749] } },
    { title: '🚀 Приключенческое', f: { with_genres: [12, 878] } },
    { title: '👨‍👩‍👧 Семейное', f: { with_genres: [10751, 16] } }
];
function robotPhrase(st) { var h = new Date().getHours(); if (st === 'hello') return h < 6 ? rnd(PHRASES.evening) : (h < 12 ? rnd(PHRASES.morning) : rnd(PHRASES.hello)); return rnd(PHRASES[st] || PHRASES.hello); }

/* ============================== 2D ФОКУС-МЕНЕДЖЕР ============================== */
/* Полностью переработан: используется настоящее 2D-расстояние между
   геометрическими центрами элементов с учётом направления движения,
   а не только координата X. Это чинит навигацию вверх/вниз между
   строками разной высоты и в mobile-раскладке (flex-column). */
var FocusManager = {
    rows: [], r: 0, i: 0, stack: [],
    setRows: function (rows, r, i) { this.rows = rows || []; this.r = clamp(r || 0, 0, Math.max(0, this.rows.length - 1)); this.i = i || 0; this.apply(); },
    push: function () { this.stack.push({ rows: this.rows, r: this.r, i: this.i }); },
    pop: function () { var s = this.stack.pop(); if (s) { this.rows = s.rows; this.r = clamp(s.r, 0, Math.max(0, s.rows.length - 1)); this.i = s.i; this.apply(); } },
    clearStack: function () { this.stack = []; },
    current: function () { var row = this.rows[this.r]; if (!row || !row.length) return null; return row[clamp(this.i, 0, row.length - 1)]; },
    apply: function () {
        var nodes = document.querySelectorAll('.cm-focus');
        for (var i = 0; i < nodes.length; i++) removeClass(nodes[i], 'cm-focus');
        var n = this.current();
        if (!n || !document.body.contains(n)) return;
        addClass(n, 'cm-focus');
        var strip = n.parentNode && hasClass(n.parentNode, 'cm-strip') ? n.parentNode : null;
        if (strip) {
            var to = n.offsetLeft - strip.clientWidth / 2 + n.clientWidth / 2;
            tweenScroll(strip, 'scrollLeft', clamp(to, 0, Math.max(0, strip.scrollWidth - strip.clientWidth)), 180);
        }
        var content = document.querySelector('.cm-content');
        if (content && n.getBoundingClientRect) {
            var rect = n.getBoundingClientRect(), crect = content.getBoundingClientRect();
            var top = rect.top - crect.top + content.scrollTop;
            if (top < 70 || top > content.scrollTop + content.clientHeight - 220) {
                tweenScroll(content, 'scrollTop', Math.max(0, top - content.clientHeight / 2), 180);
            }
        }
        if (typeof Capsule.onFocus === 'function') Capsule.onFocus(n);
    },
    /* Центр элемента в системе координат документа (учитывает скролл) */
    centerOf: function (n) {
        var r = n.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    move: function (dir) {
        if (!this.rows.length) return;
        var cur = this.current();
        if (dir === 'left' || dir === 'right') {
            var row = this.rows[this.r];
            if (!row) return;
            var ni = this.i + (dir === 'right' ? 1 : -1);
            if (ni < 0 || ni >= row.length) return;
            this.i = ni; this.apply();
            return;
        }
        if (!cur) { /* нет текущего фокуса — просто встаём на первый доступный ряд */
            for (var rr = 0; rr < this.rows.length; rr++) if (this.rows[rr] && this.rows[rr].length) { this.r = rr; this.i = 0; this.apply(); return; }
            return;
        }
        var curC = this.centerOf(cur);
        var searchDirs = dir === 'down' ? [1] : [-1];
        for (var s = 0; s < searchDirs.length; s++) {
            var step = searchDirs[s], nr = this.r + step, best = -1, bestRow = -1, bestScore = Infinity;
            while (nr >= 0 && nr < this.rows.length) {
                var target = this.rows[nr];
                if (target && target.length) {
                    for (var ti = 0; ti < target.length; ti++) {
                        if (!document.body.contains(target[ti])) continue;
                        var tc = this.centerOf(target[ti]);
                        var dy = (tc.y - curC.y) * step; /* должно быть положительным в сторону движения */
                        if (dy <= 0) continue;
                        var dx = Math.abs(tc.x - curC.x);
                        var score = dy * 1.0 + dx * 0.35; /* приоритет ближайшей строке, затем по X */
                        if (score < bestScore) { bestScore = score; best = ti; bestRow = nr; }
                    }
                    if (best > -1) break; /* нашли подходящую строку — не идём дальше */
                }
                nr += step;
            }
            if (best > -1) { this.r = bestRow; this.i = best; this.apply(); return; }
        }
    }
};

/* ============================== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ============================== */
var state = { view: 'main', cards: {}, bundle: null, profile: null, custom: null, current: null, root: null, clockTimer: null, modalOpen: false, lastError: null };

function normMovie(m) {
    return {
        id: m.id,
        type: m.media_type ? (m.media_type === 'tv' ? 'tv' : 'movie') : (m.name || m.original_name ? 'tv' : 'movie'),
        title: m.title || m.name || 'Без названия',
        poster_path: m.poster_path,
        vote_average: m.vote_average || 0,
        release_date: m.release_date || m.first_air_date || '',
        overview: m.overview || '',
        genre_ids: m.genre_ids || [],
        matchPct: typeof m._matchPct === 'number' ? m._matchPct : null
    };
}
function buildCard(m) {
    var mm = normMovie(m);
    state.cards[mm.type + ':' + mm.id] = mm;
    var card = el('div', 'cm-card');
    card.setAttribute('data-cm-action', 'card');
    card.setAttribute('data-key', mm.type + ':' + mm.id);
    var img = el('img'); img.alt = ''; img.loading = 'lazy'; setPoster(img, mm.poster_path, mm.title, 'w342'); card.appendChild(img);
    card.appendChild(el('div', 'cm-b-type' + (mm.type === 'movie' ? ' mov' : ''), mm.type === 'tv' ? 'TV' : 'FILM'));
    card.appendChild(el('div', 'cm-b-rate', mm.vote_average ? mm.vote_average.toFixed(1) : '—'));
    if (mm.matchPct != null && mm.matchPct > 0) card.appendChild(el('div', 'cm-b-match', mm.matchPct + '%'));
    card.appendChild(el('div', 'cm-t', esc(mm.title)));
    return card;
}
function buildRow(title, sub, movies) {
    var row = el('div', 'cm-row');
    var head = el('div', 'cm-row-head');
    head.appendChild(el('div', 'cm-row-title', esc(title)));
    if (sub) head.appendChild(el('div', 'cm-row-sub', esc(sub)));
    row.appendChild(head);
    var strip = el('div', 'cm-strip');
    for (var i = 0; i < movies.length; i++) strip.appendChild(buildCard(movies[i]));
    if (!movies.length) strip.appendChild(el('div', 'cm-empty-block', '<b>Пока пусто</b>Попробуйте обновить или посмотреть что-нибудь ещё'));
    row.appendChild(strip);
    return row;
}
function skeletonRows() {
    var content = state.root.querySelector('.cm-content'); content.innerHTML = '';
    for (var r = 0; r < 2; r++) {
        var row = el('div', 'cm-row'); var strip = el('div', 'cm-strip');
        for (var i = 0; i < 6; i++) strip.appendChild(el('div', 'cm-card cm-skel'));
        row.appendChild(strip); content.appendChild(row);
    }
}
function buildRobotWrap() {
    var wrap = el('div', 'cm-robot-wrap');
    var robot = el('div', 'cm-robot'); robot.setAttribute('data-cm-action', 'robot'); robot.innerHTML = SVG_ROBOT;
    var bubble = el('div', 'cm-bubble', esc(robotPhrase('hello'))); bubble.id = 'cm_bubble';
    wrap.appendChild(robot); wrap.appendChild(bubble);
    return wrap;
}
function robotSay(t) { var b = document.getElementById('cm_bubble'); if (b) b.innerHTML = esc(t); }
function buildHeader() {
    var h = el('div', 'cm-header');
    var back = el('div', 'cm-hbtn'); back.setAttribute('data-cm-action', 'back'); back.innerHTML = SVG_BACK;
    var title = el('div', 'cm-title', 'Capsule');
    var status = el('div', 'cm-status'); status.id = 'cm_status';
    var gear = el('div', 'cm-hbtn'); gear.setAttribute('data-cm-action', 'settings'); gear.innerHTML = SVG_GEAR;
    var clock = el('div', 'cm-clock', '--:--'); clock.id = 'cm_clock';
    h.appendChild(back); h.appendChild(title); h.appendChild(status); h.appendChild(gear); h.appendChild(clock);
    return h;
}
function setStatus(t) { var s = document.getElementById('cm_status'); if (s) s.textContent = t || ''; }
function tickClock() { var c = document.getElementById('cm_clock'); if (c) { var d = new Date(); c.textContent = pad2(d.getHours()) + ':' + pad2(d.getMinutes()); } }

function focusableRowsFromContent(content, extraTail) {
    var rows = [[state.root.querySelector('[data-cm-action="back"]'), state.root.querySelector('[data-cm-action="settings"]')]];
    var strips = content.querySelectorAll('.cm-strip');
    for (var i = 0; i < strips.length; i++) {
        var cards = strips[i].querySelectorAll('.cm-card[data-cm-action="card"]');
        if (cards.length) rows.push([].slice.call(cards, 0));
    }
    if (extraTail) for (var j = 0; j < extraTail.length; j++) if (extraTail[j] && extraTail[j].length) rows.push(extraTail[j]);
    return rows;
}

function renderMain(keepFocus) {
    state.view = 'main'; state.cards = {};
    var root = state.root;
    var existingRobotWrap = root.querySelector('.cm-robot-wrap');
    if (existingRobotWrap) existingRobotWrap.parentNode.removeChild(existingRobotWrap);
    var content = root.querySelector('.cm-content'); content.innerHTML = '';
    var b = state.bundle || { stable: [], exp: [] };
    if (state.custom && state.custom.list) {
        content.appendChild(buildRow(state.custom.title, 'по вашему запросу', state.custom.list));
    } else {
        var profile = state.profile;
        var sampleNote = profile && profile.sampleSize != null ? ('на основе ' + profile.sampleSize + ' просмотров') : '';
        content.appendChild(buildRow('Стабильно на вечер', sampleNote, b.stable));
        content.appendChild(buildRow('Новое и неожиданное', '', b.exp));
    }
    if (cfgMascot()) root.appendChild(buildRobotWrap());
    var robot = root.querySelector('[data-cm-action="robot"]');
    var rows = focusableRowsFromContent(content, robot ? [[robot]] : null);
    FocusManager.clearStack();
    if (keepFocus && keepFocus.r != null) FocusManager.setRows(rows, keepFocus.r, keepFocus.i);
    else FocusManager.setRows(rows, rows.length > 1 ? 1 : 0, 0);
}

function loadMainData(force) {
    skeletonRows(); setStatus('Загрузка…'); robotSay(robotPhrase('loading'));
    if (!cfgKey()) { setStatus(''); robotSay(robotPhrase('noKey')); renderMain(); return; }
    Engine.ensureProfile(force, function (profile) {
        state.profile = profile;
        Engine.buildBundle(profile, function (bundle) {
            state.bundle = bundle;
            renderMain();
            setStatus('');
            var total = bundle.stable.length + bundle.exp.length;
            robotSay(total ? robotPhrase('hello') : robotPhrase('empty'));
        });
    });
}

function feedbackButtonsHtml() {}
function renderDetails(movie) {
    state.view = 'details'; state.current = movie;
    var root = state.root;
    var existingRobotWrap = root.querySelector('.cm-robot-wrap');
    if (existingRobotWrap) existingRobotWrap.parentNode.removeChild(existingRobotWrap);
    var content = root.querySelector('.cm-content'); content.innerHTML = '';
    var wrap = el('div', 'cm-details');

    var left = el('div', 'cm-d-left');
    var poster = el('div', 'cm-card');
    var img = el('img'); img.alt = ''; setPoster(img, movie.poster_path, movie.title, 'w500'); poster.appendChild(img);
    poster.appendChild(el('div', 'cm-b-rate', movie.vote_average ? movie.vote_average.toFixed(1) : '—'));
    if (movie.matchPct != null && movie.matchPct > 0) poster.appendChild(el('div', 'cm-b-match', movie.matchPct + '% в вашем вкусе'));
    left.appendChild(poster);
    var genresHtml = (movie.genre_ids || []).map(function (id) { return GENRE_RU[id]; }).filter(Boolean).slice(0, 4);
    var metaHtml = '<b>' + esc(movie.title) + '</b><br>' + ((movie.release_date || '').slice(0, 4) || '—') + ' · ' + (movie.type === 'tv' ? 'сериал' : 'фильм');
    left.appendChild(el('div', 'cm-d-meta', metaHtml));
    if (genresHtml.length) {
        var gWrap = el('div', 'cm-d-genres');
        for (var gi = 0; gi < genresHtml.length; gi++) gWrap.appendChild(el('div', 'cm-d-genre', esc(genresHtml[gi])));
        left.appendChild(gWrap);
    }
    wrap.appendChild(left);

    var center = el('div', 'cm-d-center');
    var play = el('div', 'cm-play'); play.setAttribute('data-cm-action', 'play'); play.innerHTML = SVG_PLAY; center.appendChild(play);
    var fbWrap = el('div', 'cm-feedback');
    var curFb = getManualFeedback(movie.type, movie.id);
    var likeBtn = el('div', 'cm-fbtn' + (curFb > 0 ? ' cm-active-like' : ''), '👍'); likeBtn.setAttribute('data-cm-action', 'like');
    var dislikeBtn = el('div', 'cm-fbtn' + (curFb < 0 ? ' cm-active-dislike' : ''), '👎'); dislikeBtn.setAttribute('data-cm-action', 'dislike');
    fbWrap.appendChild(likeBtn); fbWrap.appendChild(dislikeBtn);
    center.appendChild(fbWrap);
    wrap.appendChild(center);

    var right = el('div', 'cm-d-right');
    var items = [
        { a: 'ai_desc', t: '📝 Описание и сюжет' },
        { a: 'ai_fit', t: '👥 Кому подойдёт' },
        { a: 'ai_rev', t: '💬 Отзывы зрителей' },
        { a: 'ai_facts', t: '🎭 Актёры и факты' }
    ];
    for (var i = 0; i < items.length; i++) { var it = el('div', 'cm-ai-item', esc(items[i].t)); it.setAttribute('data-cm-action', items[i].a); right.appendChild(it); }
    wrap.appendChild(right);
    content.appendChild(wrap);

    var rows = [
        [root.querySelector('[data-cm-action="back"]'), root.querySelector('[data-cm-action="settings"]')],
        [play, likeBtn, dislikeBtn],
        [].slice.call(right.querySelectorAll('.cm-ai-item'), 0)
    ];
    FocusManager.clearStack();
    FocusManager.setRows(rows, 1, 0);
    robotSay('Расскажу всё о «' + movie.title + '» — меню справа.');
}

function openFullCard(m) {
    try { Lampa.Activity.push({ url: '', component: 'full', id: m.id, method: m.type, card: m, source: 'tmdb' }); }
    catch (e) { notify('Не удалось открыть карточку Lampa'); }
}

/* ============================== МОДАЛЬНЫЕ ОКНА ============================== */
/* Фикс: раньше при отсутствии Lampa.Modal фолбэк-оверлей не восстанавливал
   фокус-стек надёжно. Теперь push/pop стека всегда идёт в паре с открытием/закрытием,
   независимо от того, какой рендер модалки используется. */
function modalOpen(title, node) {
    state.modalOpen = true;
    FocusManager.push();
    try {
        if (window.Lampa && Lampa.Modal && Lampa.Modal.open) {
            Lampa.Modal.open({
                title: title,
                html: node,
                size: 'medium',
                onBack: function () { modalClose(); }
            });
            return;
        }
    } catch (e) {}
    var ov = el('div', 'cm-overlay'); ov.className += ' cm-fallback-modal';
    var panel = el('div', 'cm-panel'); panel.appendChild(el('h2', '', esc(title))); panel.appendChild(node);
    ov.appendChild(panel); state.root.appendChild(ov); bindMouse(ov);
    var focusable = [].slice.call(ov.querySelectorAll('[data-cm-action]'), 0);
    if (focusable.length) FocusManager.setRows([focusable], 0, 0);
}
function modalClose() {
    state.modalOpen = false;
    try { if (window.Lampa && Lampa.Modal && Lampa.Modal.close) { Lampa.Modal.close(); } } catch (e) {}
    var ov = state.root && state.root.querySelector('.cm-fallback-modal'); if (ov) ov.parentNode.removeChild(ov);
    FocusManager.pop();
    try { if (window.Lampa && Lampa.Controller && Lampa.Controller.toggle) Lampa.Controller.toggle(CTRL_NAME); } catch (e) {}
}
function openAiDialog() {
    var body = el('div', 'cm-modal-body');
    var input = el('div', 'cm-input-fake', '✍️ Написать запрос роботу…'); input.setAttribute('data-cm-action', 'ai_input'); body.appendChild(input);
    var chips = [ { t: '🔄 Обновить рекомендации', a: 'ai_refresh' }, { t: '🍿 Случайный фильм', a: 'ai_random' }, { t: '🎯 По настроению', a: 'ai_mood' } ];
    for (var i = 0; i < chips.length; i++) { var c = el('div', 'cm-chip', esc(chips[i].t)); c.setAttribute('data-cm-action', chips[i].a); body.appendChild(c); }
    body.appendChild(el('div', '', '<span style="color:#8f97a6">Понимаю запросы вида: «фантастика без ужасов», «комедия 90-х»…</span>'));
    modalOpen('Диалог с роботом', body);
}
function aiApplyFilters(title, f) {
    modalClose(); robotSay(f.phrase || robotPhrase('loading')); skeletonRows(); setStatus('Подбираю…');
    Engine.queryBundle(state.profile || { interests: {} }, f, function (list) {
        state.custom = { title: title, list: list }; renderMain(); setStatus('');
        robotSay(list.length ? 'Готово! Обновил выдачу под запрос.' : robotPhrase('empty'));
    });
}
function aiRandom() {
    var pool = (state.bundle && state.bundle.stable ? state.bundle.stable : []).concat(state.bundle && state.bundle.exp ? state.bundle.exp : []);
    function show(m) {
        var mm = normMovie(m), body = el('div', 'cm-modal-body');
        body.appendChild(el('div', '', '<h4>🎲 ' + esc(mm.title) + '</h4><div>⭐ ' + (mm.vote_average ? mm.vote_average.toFixed(1) : '—') + ' · ' + ((mm.release_date || '').slice(0, 4) || '—') + '</div><div style="margin-top:0.6em">' + esc((mm.overview || 'Описание появится после загрузки.').slice(0, 280)) + '</div>'));
        var go = el('div', 'cm-chip', '▶ Смотреть'); go.setAttribute('data-cm-action', 'ai_random_play'); body.appendChild(go);
        modalOpen(rnd(PHRASES.hello), body); state.cards['rand'] = mm;
    }
    if (pool.length) { show(rnd(pool)); return; }
    TMDB.get('/discover/movie', { sort_by: 'popularity.desc', 'vote_average.gte': 6.5, 'vote_count.gte': 150 }, function (d) { var r = d.results || []; if (r.length) show(rnd(r)); else notify(robotPhrase('empty')); }, function () { notify(robotPhrase('error')); });
}
function aiInfo(kind) {
    var m = state.current; if (!m) return;
    var path = '/' + m.type + '/' + m.id;
    if (kind === 'ai_desc') {
        TMDB.get(path, {}, function (d) { modalOpen('Описание', el('div', 'cm-modal-body', '<h4>📝 ' + esc(d.title || d.name || m.title) + '</h4><div>' + esc(d.overview || 'Описание отсутствует.') + '</div>')); }, function () { notify(robotPhrase('error')); });
    }
    if (kind === 'ai_fit') {
        TMDB.get(path, {}, function (d) {
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
    }
    if (kind === 'ai_rev') {
        TMDB.get(path + '/reviews', { language: 'ru-RU' }, function (d) {
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
    }
    if (kind === 'ai_facts') {
        TMDB.get(path, { append_to_response: 'credits,keywords' }, function (d) {
            var html = '<h4>🎭 Актёры</h4><div>', cast = (d.credits && d.credits.cast) || [], i;
            for (i = 0; i < Math.min(cast.length, 6); i++) html += '• ' + esc(cast[i].name) + ' — ' + esc(cast[i].character) + '<br>';
            var crew = (d.credits && d.credits.crew) || [], dir = '';
            for (i = 0; i < crew.length; i++) if (crew[i].job === 'Director') { dir = crew[i].name; break; }
            if (dir) html += '<br>Режиссёр: <b>' + esc(dir) + '</b>';
            html += '</div><h4>✨ Факты</h4><div>';
            if (d.budget) html += 'Бюджет: $' + (d.budget / 1000000).toFixed(1) + ' млн<br>';
            if (d.revenue) html += 'Сборы: $' + (d.revenue / 1000000).toFixed(1) + ' млн<br>';
            var kw = (d.keywords && (d.keywords.keywords || d.keywords.results || d.keywords)) || [], names = [];
            for (i = 0; i < Math.min(kw.length, 5); i++) names.push(esc(kw[i].name));
            if (names.length) html += 'Темы: ' + names.join(', ');
            html += '</div>';
            modalOpen('Актёры и факты', el('div', 'cm-modal-body', html));
        }, function () { notify(robotPhrase('error')); });
    }
}

/* ============================== НАСТРОЙКИ ============================== */
function openSettings() {
    FocusManager.push();
    var ov = el('div', 'cm-overlay'); ov.id = 'cm_settings';
    var panel = el('div', 'cm-panel'); panel.appendChild(el('h2', '', '⚙️ Capsule Mod'));
    function item(l, v, a, hint) {
        var it = el('div', 'cm-set-item'); it.setAttribute('data-cm-action', a);
        it.appendChild(el('span', '', esc(l))); it.appendChild(el('span', 'val', esc(v)));
        panel.appendChild(it);
        if (hint) panel.appendChild(el('div', 'cm-set-hint', esc(hint)));
        return it;
    }
    item('🤖 Робот-помощник', cfgMascot() ? 'вкл' : 'выкл', 'set_mascot');
    item('🕓 Глубина анализа', cfgDepth() === 'all' ? 'всё время' : 'месяц', 'set_depth', 'Сколько истории просмотров учитывать');
    item('🧠 Алгоритм', cfgSens() === 'exp' ? 'разнообразие' : (cfgSens() === 'strict' ? 'точный' : 'сбалансированный'), 'set_sens', 'точный — меньше жанров, но точнее; разнообразие — шире подборка');
    item('🔑 TMDB ключ', cfgKey() === TMDB_DEFAULT_KEY ? 'стандартный' : 'свой', 'set_key');
    item('♻️ Пересчитать профиль', '', 'set_reset', 'Полный пересбор рекомендаций из истории просмотров');
    item('✖ Закрыть', '', 'set_close');
    state.root.appendChild(ov); bindMouse(ov);
    FocusManager.setRows([[].slice.call(panel.querySelectorAll('.cm-set-item'), 0)], 0, 0);
}
function closeSettings() { var ov = document.getElementById('cm_settings'); if (ov) ov.parentNode.removeChild(ov); FocusManager.pop(); }
function settingsAction(a) {
    if (a === 'set_close') { closeSettings(); return; }
    if (a === 'set_mascot') { sSet('capsule_mod_mascot', !cfgMascot()); closeSettings(); openSettings(); if (state.view === 'main') renderMain(); return; }
    if (a === 'set_depth') { sSet('capsule_mod_depth', cfgDepth() === 'all' ? 'month' : 'all'); closeSettings(); openSettings(); return; }
    if (a === 'set_sens') {
        var cur = cfgSens(), next = cur === 'strict' ? 'balanced' : (cur === 'balanced' ? 'exp' : 'strict');
        sSet('capsule_mod_sens', next); closeSettings(); openSettings(); return;
    }
    if (a === 'set_key') {
        try {
            Lampa.Input.edit({ title: 'TMDB API ключ', value: '', free: true, nosave: true }, function (v) {
                if (v) sSet('capsule_mod_tmdb_key', v);
                try { Lampa.Controller.toggle(CTRL_NAME); } catch (e) {}
                closeSettings(); openSettings();
            });
        } catch (e) { notify('Ввод недоступен на этом устройстве'); }
        return;
    }
    if (a === 'set_reset') {
        closeSettings(); robotSay(robotPhrase('loading'));
        Engine.resetProfile(function (p) { state.profile = p; state.custom = null; notify('Профиль пересчитан'); robotSay(robotPhrase('done')); if (state.view === 'main') loadMainData(true); });
    }
}

/* ============================== ОБРАБОТКА ДЕЙСТВИЙ ============================== */
function doAction(node) {
    if (!node) return;
    var a = node.getAttribute('data-cm-action'); if (!a) return;
    var inSettings = !!document.getElementById('cm_settings');
    if (inSettings) { if (a.indexOf('set_') === 0) settingsAction(a); else if (a === 'back') closeSettings(); return; }
    switch (a) {
        case 'back':
            if (state.modalOpen) { modalClose(); return; }
            if (state.view === 'details') { renderMain(); return; }
            try { Lampa.Activity.backward(); } catch (e) { try { Lampa.Activity.back(); } catch (e2) {} }
            return;
        case 'settings': openSettings(); return;
        case 'card': var key = node.getAttribute('data-key'); if (state.cards[key]) renderDetails(state.cards[key]); return;
        case 'robot': openAiDialog(); return;
        case 'play': if (state.current) openFullCard(state.current); return;
        case 'like': if (state.current) { var cur = getManualFeedback(state.current.type, state.current.id); Engine.setFeedback(state.current.type, state.current.id, cur > 0 ? 0 : 1); renderDetails(state.current); } return;
        case 'dislike': if (state.current) { var curD = getManualFeedback(state.current.type, state.current.id); Engine.setFeedback(state.current.type, state.current.id, curD < 0 ? 0 : -1); renderDetails(state.current); } return;
        case 'ai_input':
            try {
                Lampa.Input.edit({ title: 'Запрос роботу', value: '', free: true, nosave: true }, function (v) {
                    try { Lampa.Controller.toggle(CTRL_NAME); } catch (e) {}
                    if (v) aiApplyFilters('Ответ: «' + v.slice(0, 24) + '»', parseUserQuery(v));
                });
            } catch (e) { notify('Клавиатура недоступна на этом устройстве'); }
            return;
        case 'ai_refresh': modalClose(); state.custom = null; loadMainData(true); return;
        case 'ai_random': aiRandom(); return;
        case 'ai_random_play': if (state.cards['rand']) { modalClose(); openFullCard(state.cards['rand']); } return;
        case 'ai_mood':
            try {
                Lampa.Select.show({
                    title: '🎯 Настроение', items: MOODS,
                    onSelect: function (s) { try { Lampa.Controller.toggle(CTRL_NAME); } catch (e) {} aiApplyFilters('Настроение: ' + s.title, s.f); },
                    onBack: function () { try { Lampa.Controller.toggle(CTRL_NAME); } catch (e) {} }
                });
            } catch (e) { notify('Выбор недоступен'); }
            return;
        case 'ai_desc': case 'ai_fit': case 'ai_rev': case 'ai_facts': aiInfo(a); return;
    }
}
function bindMouse(scope) {
    scope.addEventListener('click', function (e) { var n = closestAttr(e.target, 'data-cm-action'); if (n) doAction(n); });
    scope.addEventListener('mouseover', function (e) {
        var n = closestAttr(e.target, 'data-cm-action');
        if (n && !hasClass(n, 'cm-focus')) {
            for (var r = 0; r < FocusManager.rows.length; r++) {
                var idx = FocusManager.rows[r].indexOf(n);
                if (idx > -1) { FocusManager.r = r; FocusManager.i = idx; FocusManager.apply(); break; }
            }
        }
    });
}

var Capsule = {
    onFocus: function (n) {
        if (n.getAttribute('data-cm-action') === 'card' && state.view === 'main') {
            var m = state.cards[n.getAttribute('data-key')];
            if (m) {
                var extra = (m.matchPct != null && m.matchPct > 0) ? (', совпадение ' + m.matchPct + '%') : '';
                robotSay('«' + m.title + '» — рейтинг ' + (m.vote_average ? m.vote_average.toFixed(1) : '—') + extra + '.');
            }
        }
    }
};

/* ============================== КОМПОНЕНТ LAMPA ============================== */
function CapsuleComponent() {
    var html = el('div', 'cm-root');
    this.create = function () {
        injectCSS();
        try { if (window.Lampa && Lampa.Head && Lampa.Head.hide) Lampa.Head.hide(); } catch (e) {}
        try { if (window.Lampa && Lampa.Menu && Lampa.Menu.hide) Lampa.Menu.hide(); } catch (e) {}
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
            Lampa.Controller.add(CTRL_NAME, {
                toggle: function () { FocusManager.apply(); },
                up: function () { FocusManager.move('up'); },
                down: function () { FocusManager.move('down'); },
                left: function () { FocusManager.move('left'); },
                right: function () { FocusManager.move('right'); },
                enter: function () { var n = FocusManager.current(); if (n) doAction(n); },
                back: function () { doAction(html.querySelector('[data-cm-action="back"]')); }
            });
            Lampa.Controller.toggle(CTRL_NAME);
        } catch (e) {
            document.addEventListener('keydown', function (ev) {
                var k = ev.keyCode;
                if (k === 37) FocusManager.move('left'); else if (k === 39) FocusManager.move('right');
                else if (k === 38) FocusManager.move('up'); else if (k === 40) FocusManager.move('down');
                else if (k === 13) { var n = FocusManager.current(); if (n) doAction(n); }
                else if (k === 8 || k === 27 || k === 461 || k === 10009) doAction(html.querySelector('[data-cm-action="back"]'));
            });
        }
    };
    this.render = function () { return html; };
    this.pause = function () {};
    this.stop = function () {};
    this.back = function () { doAction(html.querySelector('[data-cm-action="back"]')); };
    this.destroy = function () {
        if (state.clockTimer) clearInterval(state.clockTimer); state.clockTimer = null;
        try { if (window.Lampa && Lampa.Head && Lampa.Head.show) Lampa.Head.show(); } catch (e) {}
        try { if (window.Lampa && Lampa.Menu && Lampa.Menu.show) Lampa.Menu.show(); } catch (e) {}
        html.innerHTML = '';
    };
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
    injectCSS();
    var booted = false;
    var boot = function () {
        if (booted) return; booted = true;
        setTimeout(function () {
            try { if (window.Lampa && Lampa.Component && Lampa.Component.add) Lampa.Component.add(COMPONENT, CapsuleComponent); } catch (e) {}
            addMenuItem();
            console.log('[CapsuleMod] v4.0 готов');
        }, 300);
    };
    if (window.appready) boot();
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) { Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); }); setTimeout(function () { if (window.appready) boot(); }, 2500); }
    else boot();
}
startPlugin();
})();
