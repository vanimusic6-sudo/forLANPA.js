/* ============================================================
   MULTIPLEX v2 — Lampa Main-Page Replacer & Multi-Source Search
   Исправлены интеграции в Lampa API: меню, поиск, настройки
   ============================================================ */

(function () {
    'use strict';

    /* ══════════════════════════════════════════════
       0. КОНФИГУРАЦИЯ
    ══════════════════════════════════════════════ */
    var DEFAULT_CONFIG = {
        version: '2.0.0',

        // ── Источники (включаются/отключаются в настройках) ──
        sources: {
            tmdb: {
                enabled: true,
                label: 'TMDB',
                priority: 100,           // чем больше, тем приоритетнее
                weight_ru: 60,           // вес для русского контента
                weight_foreign: 100,     // вес для зарубежного
                weight_quality: 80,      // качество метаданных (0-100)
                weight_posters: 90,      // качество постеров
                api_key: '',
                base_url: 'https://api.themoviedb.org/3',
                img_base: 'https://image.tmdb.org/t/p/',
                lang: 'ru-RU'
            },
            kp: {
                enabled: true,
                label: 'Кинопоиск',
                priority: 90,
                weight_ru: 100,
                weight_foreign: 50,
                weight_quality: 95,
                weight_posters: 85,
                api_key: '',
                base_url: 'https://kinopoiskapiunofficial.tech/api'
            },
            trakt: {
                enabled: true,
                label: 'Trakt',
                priority: 80,
                weight_ru: 40,
                weight_foreign: 90,
                weight_quality: 85,
                weight_posters: 70,
                client_id: '7a4f4a40096c3491ec8be46d9f00c4f8b3ce43b1c0c86f42f30dc5f1839a1670' // публичный
            },
            omdb: {
                enabled: true,
                label: 'OMDb (IMDb)',
                priority: 70,
                weight_ru: 30,
                weight_foreign: 75,
                weight_quality: 80,
                weight_posters: 75,
                api_key: ''
            },
            simkl: {
                enabled: false,
                label: 'Simkl',
                priority: 60,
                weight_ru: 50,
                weight_foreign: 70,
                weight_quality: 75,
                weight_posters: 80,
                client_id: ''
            },
            fanart: {
                enabled: true,
                label: 'Fanart.tv (Обложки)',
                priority: 50,
                weight_ru: 80,
                weight_foreign: 90,
                weight_quality: 100,
                weight_posters: 100,
                api_key: ''
            }
        },

        // ── Стриминги ──
        streamings: {
            ru: [
                { id: 'kinopoisk', title: 'Кинопоиск', provider_id: 115, color: '#ff6a00' },
                { id: 'ivi',       title: 'IVI',       provider_id: 113, color: '#ff0050' },
                { id: 'okko',      title: 'Okko',      provider_id: 116, color: '#1ba5e0' },
                { id: 'start',     title: 'START',     provider_id: 118, color: '#8b00ff' }
            ],
            foreign: [
                { id: 'appletv',   title: 'Apple TV+', provider_id: 350, color: '#ffffff' },
                { id: 'disney',    title: 'Disney+',   provider_id: 337, color: '#113ccf' },
                { id: 'netflix',   title: 'Netflix',   provider_id: 8,   color: '#e50914' }
            ]
        },

        // ── Рекомендательный движок ──
        recommender: {
            max_history: 300,
            weights: {
                genre:    0.35,   // 1 место
                tag:      0.20,   // 2 место
                actor:    0.15,   // 3 место (с режиссёрами)
                director: 0.15,   // 3 место
                runtime:  0.05,   // последний
                rating:   0.05,
                year:     0.03,
                country:  0.02
            },
            min_score: 0.10,
            result_count: 24
        },

        // ── Дизайн карточек ──
        card_design: {
            border_radius: 8,        // скругление (px)
            show_quality: true,      // показывать бейдж качества (как в CUB)
            show_rating: true,
            show_year: true,
            show_source_badge: true,
            card_width: 160,
            card_gap: 12
        },

        // ── Анти-дубликаты ──
        anti_dup: {
            enabled: true,
            mode: 'url_hash',        // 'url_hash' | 'perceptual' | 'strict'
            min_poster_distance: 0.3 // для perceptual-режима
        },

        // ── Умный выбор источника ──
        smart_select: {
            enabled: true,
            prefer_quality: true,    // учитывать качество метаданных
            prefer_quantity: true,   // учитывать количество результатов
            prefer_speed: true,      // учитывать скорость
            fallback_chain: ['tmdb', 'kp', 'trakt', 'omdb']
        },

        // ── Строки главной ──
        rows: [
            { id: 'for_you',      title: '🎯 Интересно лично вам',   type: 'for_you' },
            { id: 'trending',     title: '🔥 В тренде',              type: 'trending' },
            { id: 'popular',      title: '⭐ Популярное',             type: 'popular' },
            { id: 'top_rated',    title: '🏆 Топ по рейтингу',       type: 'top_rated' },
            { id: 'box_office',   title: '💰 Кассовые сборы',        type: 'box_office' },
            { id: 'now_playing',  title: '🆕 Новинки',               type: 'now_playing' },
            { id: 'streamings',   title: '📺 Стриминги',             type: 'streamings' },
            { id: 'genres',       title: '🎭 По жанрам',             type: 'genres' }
        ]
    };

    var CONFIG = Lampa.Storage.get('mpx_config_v2', null) || DEFAULT_CONFIG;

    function saveConfig() {
        Lampa.Storage.set('mpx_config_v2', CONFIG);
    }

    /* ══════════════════════════════════════════════
       1. УТИЛИТЫ
    ══════════════════════════════════════════════ */
    var Utils = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('[MULTIPLEX]');
            try { console.log.apply(console, args); } catch (e) {}
        },

        request: function (url, params, onSuccess, onError) {
            try {
                var req = new Lampa.Reguest();
                req.native(url, function (d) {
                    if (onSuccess) onSuccess(d);
                }, function (a, b) {
                    Utils.log('Ошибка:', url, a, b);
                    if (onError) onError(a, b);
                }, params || {});
                return req;
            } catch (e) {
                Utils.log('Reguest не поддерживается:', e);
                if (onError) onError(e);
            }
        },

        // Простой perceptual hash для сравнения постеров
        perceptualHash: function (url) {
            // Хеш URL как быстрый прокси-сравнитель
            // (настоящий perceptual hash требует canvas, не везде работает)
            var s = url || '';
            // Нормализуем размер в URL (w300/w500/w1280)
            s = s.replace(/\/w\d+\//, '/w300/');
            s = s.replace(/\/original\//, '/w300/');
            // Убираем расширения
            var h = 0;
            for (var i = 0; i < s.length; i++) {
                h = ((h << 5) - h + s.charCodeAt(i)) | 0;
            }
            return h;
        },

        // Сравнение двух хешей
        hashDistance: function (h1, h2) {
            var x = h1 ^ h2;
            var d = 0;
            while (x) { d += x & 1; x >>= 1; }
            return d / 32;
        },

        deduplicate: function (items, checkPosters) {
            var seen = {};
            var posterHashes = [];
            var result = [];

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var key = item.imdb_id || ('tmdb_' + item.tmdb_id) || ('kp_' + item.kp_id);

                if (!key) {
                    key = (item.title || '') + '_' + (item.year || '');
                }
                if (seen[key]) continue;

                // Анти-дубликаты обложек
                if (checkPosters && CONFIG.anti_dup.enabled && item.poster) {
                    var ph = Utils.perceptualHash(item.poster);
                    var tooSimilar = false;

                    if (CONFIG.anti_dup.mode === 'url_hash') {
                        // Строгое сравнение URL
                        if (posterHashes.indexOf(ph) !== -1) {
                            tooSimilar = true;
                        }
                    } else if (CONFIG.anti_dup.mode === 'perceptual') {
                        for (var j = 0; j < posterHashes.length; j++) {
                            if (Utils.hashDistance(ph, posterHashes[j]) < CONFIG.anti_dup.min_poster_distance) {
                                tooSimilar = true;
                                break;
                            }
                        }
                    }

                    if (tooSimilar) continue;
                    posterHashes.push(ph);
                }

                seen[key] = true;
                result.push(item);
            }
            return result;
        },

        shuffle: function (arr) {
            for (var i = arr.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
            }
            return arr;
        },

        mergeResults: function (arrays) {
            var merged = [];
            var maxLen = 0;
            for (var i = 0; i < arrays.length; i++) {
                if (arrays[i] && arrays[i].length > maxLen) maxLen = arrays[i].length;
            }
            for (var pos = 0; pos < maxLen; pos++) {
                for (var src = 0; src < arrays.length; src++) {
                    if (arrays[src] && arrays[src][pos]) merged.push(arrays[src][pos]);
                }
            }
            return merged;
        },

        getProfileParam: function (key) {
            try {
                var profile = Lampa.Storage.get('profile', null);
                if (profile && profile.params && profile.params[key] !== undefined) {
                    return profile.params[key];
                }
            } catch (e) {}
            return false;
        },

        isRusProfile: function () { return Utils.getProfileParam('onlyRus'); },
        isKidsProfile: function () { return Utils.getProfileParam('forKids'); }
    };

    /* ══════════════════════════════════════════════
       2. УМНЫЙ ВЫБОР ИСТОЧНИКА
    ══════════════════════════════════════════════ */
    var SmartSource = {
        _stats: {},  // статистика по источникам

        // Оценить источник для конкретной задачи
        score: function (srcName, task) {
            var src = CONFIG.sources[srcName];
            if (!src || !src.enabled) return -1;

            var score = src.priority;

            // Вес по типу контента
            if (task === 'ru') {
                score += src.weight_ru;
            } else if (task === 'foreign') {
                score += src.weight_foreign;
            }

            if (CONFIG.smart_select.prefer_quality) {
                score += src.weight_quality * 0.5;
            }
            if (CONFIG.smart_select.prefer_quantity) {
                score += src.weight_posters * 0.3;
            }

            // Учитываем статистику ошибок
            var stat = this._stats[srcName] || { ok: 0, fail: 0, avg_time: 0 };
            if (stat.ok + stat.fail > 0) {
                var successRate = stat.ok / (stat.ok + stat.fail);
                score *= successRate;
                if (CONFIG.smart_select.prefer_speed && stat.avg_time > 0) {
                    score *= Math.max(0.5, 1 - (stat.avg_time - 1000) / 5000);
                }
            }

            return score;
        },

        // Получить ранжированный список источников под задачу
        getChain: function (task) {
            var chain = [];
            var names = Object.keys(CONFIG.sources);
            for (var i = 0; i < names.length; i++) {
                var score = this.score(names[i], task);
                if (score > 0) {
                    chain.push({ name: names[i], score: score });
                }
            }
            chain.sort(function (a, b) { return b.score - a.score; });
            return chain.map(function (c) { return c.name; });
        },

        // Выполнить запрос с fallback
        execute: function (task, fn, cb) {
            var chain = this.getChain(task);
            if (!chain.length) { cb(null); return; }

            var self = this;
            var idx = 0;

            function tryNext() {
                if (idx >= chain.length) { cb(null); return; }

                var src = chain[idx++];
                var start = Date.now();

                try {
                    fn(src, function (result) {
                        var time = Date.now() - start;
                        self._record(src, true, time);
                        if (result && (Array.isArray(result) ? result.length > 0 : result)) {
                            cb(result);
                        } else {
                            tryNext();
                        }
                    }, function () {
                        self._record(src, false, Date.now() - start);
                        tryNext();
                    });
                } catch (e) {
                    Utils.log('Исключение в', src, e);
                    tryNext();
                }
            }

            tryNext();
        },

        _record: function (src, ok, time) {
            if (!this._stats[src]) this._stats[src] = { ok: 0, fail: 0, avg_time: 0 };
            var s = this._stats[src];
            if (ok) {
                s.ok++;
                s.avg_time = s.avg_time ? (s.avg_time + time) / 2 : time;
            } else {
                s.fail++;
            }
        }
    };

    /* ══════════════════════════════════════════════
       3. ИСТОЧНИКИ ДАННЫХ
    ══════════════════════════════════════════════ */
    var Sources = {

        // ── TMDB ──
        tmdb: {
            _url: function (path, extra) {
                var cfg = CONFIG.sources.tmdb;
                var key = cfg.api_key || Lampa.Storage.get('mpx_tmdb_key', '');
                var sep = path.indexOf('?') === -1 ? '?' : '&';
                return cfg.base_url + path + sep + 'api_key=' + key + '&language=' + cfg.lang + (extra || '');
            },

            trending: function (cb, err) {
                Utils.request(this._url('/trending/all/week'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || [], 'tmdb'));
                }, err);
            },

            popular: function (type, cb, err) {
                Utils.request(this._url('/' + (type || 'movie') + '/popular'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || [], 'tmdb'));
                }, err);
            },

            topRated: function (type, cb, err) {
                Utils.request(this._url('/' + (type || 'movie') + '/top_rated'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || [], 'tmdb'));
                }, err);
            },

            nowPlaying: function (cb, err) {
                Utils.request(this._url('/movie/now_playing'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || [], 'tmdb'));
                }, err);
            },

            byGenre: function (genreId, cb, err) {
                Utils.request(this._url('/discover/movie', '&with_genres=' + genreId + '&sort_by=popularity.desc'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || [], 'tmdb'));
                }, err);
            },

            byStreaming: function (providerId, cb, err) {
                Utils.request(this._url('/discover/movie', '&with_watch_providers=' + providerId + '&watch_region=RU&sort_by=popularity.desc'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || [], 'tmdb'));
                }, err);
            },

            search: function (query, cb, err) {
                var q = encodeURIComponent(query);
                var results = [];
                var done = 0;
                var total = 2;

                function finish() {
                    if (++done >= total) cb(results);
                }

                Utils.request(this._url('/search/movie', '&query=' + q), {}, function (d) {
                    results = results.concat(Sources.tmdb._map(d.results || [], 'tmdb'));
                    finish();
                }, finish);

                Utils.request(this._url('/search/tv', '&query=' + q), {}, function (d) {
                    results = results.concat(Sources.tmdb._map(d.results || [], 'tmdb'));
                    finish();
                }, finish);
            },

            details: function (id, type, cb) {
                Utils.request(this._url('/' + (type || 'movie') + '/' + id, '&append_to_response=credits,keywords,videos,release_dates'), {}, function (d) {
                    cb(d);
                }, function () { cb(null); });
            },

            _map: function (items, source) {
                var cfg = CONFIG.sources.tmdb;
                return items.map(function (it) {
                    return {
                        source: source,
                        tmdb_id: it.id,
                        imdb_id: it.imdb_id || '',
                        title: it.title || it.name || '',
                        original_title: it.original_title || it.original_name || '',
                        overview: it.overview || '',
                        poster: it.poster_path ? cfg.img_base + 'w500' + it.poster_path : '',
                        backdrop: it.backdrop_path ? cfg.img_base + 'w1280' + it.backdrop_path : '',
                        vote_average: it.vote_average || 0,
                        vote_count: it.vote_count || 0,
                        release_date: it.release_date || it.first_air_date || '',
                        year: (it.release_date || it.first_air_date || '').substring(0, 4),
                        genre_ids: it.genre_ids || [],
                        media_type: it.media_type || (it.first_air_date ? 'tv' : 'movie'),
                        popularity: it.popularity || 0,
                        quality: Utils.extractQuality(it)
                    };
                });
            }
        },

        // ── Кинопоиск ──
        kp: {
            _headers: function () {
                return { 'X-API-KEY': CONFIG.sources.kp.api_key || Lampa.Storage.get('mpx_kp_key', '') };
            },

            search: function (query, cb, err) {
                var q = encodeURIComponent(query);
                Utils.request(
                    CONFIG.sources.kp.base_url + '/v2.1/films/search-by-keyword?keyword=' + q + '&page=1',
                    { headers: this._headers() },
                    function (d) { cb(Sources.kp._map(d.films || [], 'kp')); },
                    err
                );
            },

            top: function (type, cb, err) {
                Utils.request(
                    CONFIG.sources.kp.base_url + '/v2.2/films/top?type=' + (type || 'TOP_100_POPULAR_FILMS') + '&page=1',
                    { headers: this._headers() },
                    function (d) { cb(Sources.kp._map(d.films || [], 'kp')); },
                    err
                );
            },

            byGenre: function (genreId, cb, err) {
                Utils.request(
                    CONFIG.sources.kp.base_url + '/v2.2/films?genres=' + genreId + '&order=RATING&type=ALL&page=1',
                    { headers: this._headers() },
                    function (d) { cb(Sources.kp._map(d.items || [], 'kp')); },
                    err
                );
            },

            _map: function (items, source) {
                return items.map(function (it) {
                    return {
                        source: source,
                        kp_id: it.kinopoiskId || it.filmId || it.id,
                        imdb_id: it.imdbId || '',
                        title: it.nameRu || it.nameEn || it.nameOriginal || '',
                        original_title: it.nameEn || it.nameOriginal || '',
                        overview: it.description || '',
                        poster: it.posterUrl || it.posterUrlPreview || '',
                        backdrop: it.coverUrl || '',
                        vote_average: it.ratingKinopoisk || it.rating || 0,
                        vote_count: it.ratingVoteCount || 0,
                        release_date: it.year ? it.year + '-01-01' : '',
                        year: String(it.year || ''),
                        genre_ids: (it.genres || []).map(function (g) { return g.genre || g; }),
                        media_type: it.type === 'TV_SERIES' ? 'tv' : 'movie',
                        popularity: it.rating || 0,
                        country: (it.countries || [])[0] ? ((it.countries || [])[0].country || '') : '',
                        quality: Utils.extractQuality(it)
                    };
                });
            }
        },

        // ── Trakt (бесплатный, для трендов) ──
        trakt: {
            _headers: function () {
                return {
                    'Content-Type': 'application/json',
                    'trakt-api-version': '2',
                    'trakt-api-key': CONFIG.sources.trakt.client_id
                };
            },

            trending: function (type, cb, err) {
                Utils.request(
                    'https://api.trakt.tv/' + (type || 'movies') + '/trending?limit=30',
                    { headers: this._headers() },
                    function (d) { cb(Sources.trakt._map(d || [], 'trakt')); },
                    err
                );
            },

            popular: function (type, cb, err) {
                Utils.request(
                    'https://api.trakt.tv/' + (type || 'movies') + '/popular?limit=30',
                    { headers: this._headers() },
                    function (d) { cb(Sources.trakt._map(d || [], 'trakt')); },
                    err
                );
            },

            _map: function (items, source) {
                return items.map(function (it) {
                    var movie = it.movie || it;
                    return {
                        source: source,
                        tmdb_id: movie.ids ? movie.ids.tmdb : null,
                        imdb_id: movie.ids ? movie.ids.imdb : '',
                        title: movie.title || '',
                        year: String(movie.year || ''),
                        poster: '', // Trakt не даёт постеров напрямую
                        vote_average: 0,
                        media_type: it.movie ? 'movie' : 'tv'
                    };
                });
            }
        },

        // ── OMDb (IMDb, бесплатный по ключу) ──
        omdb: {
            search: function (query, cb, err) {
                var key = CONFIG.sources.omdb.api_key || Lampa.Storage.get('mpx_omdb_key', '');
                if (!key) { cb([]); return; }
                Utils.request(
                    'https://www.omdbapi.com/?s=' + encodeURIComponent(query) + '&apikey=' + key,
                    {},
                    function (d) {
                        if (d && d.Search) cb(Sources.omdb._map(d.Search, 'omdb'));
                        else cb([]);
                    },
                    err
                );
            },

            _map: function (items, source) {
                return items.map(function (it) {
                    return {
                        source: source,
                        imdb_id: it.imdbID || '',
                        title: it.Title || '',
                        year: (it.Year || '').substring(0, 4),
                        poster: it.Poster && it.Poster !== 'N/A' ? it.Poster : '',
                        media_type: it.Type === 'series' ? 'tv' : 'movie'
                    };
                });
            }
        },

        // ── Fanart (обложки высокого качества) ──
        fanart: {
            getByTmdb: function (tmdbId, type, cb, err) {
                var key = CONFIG.sources.fanart.api_key || Lampa.Storage.get('mpx_fanart_key', '319934406de61a2f07f83629b78b49cd');
                var url = type === 'tv'
                    ? 'https://webservice.fanart.tv/v3/tv/' + tmdbId + '?api_key=' + key
                    : 'https://webservice.fanart.tv/v3/movies/' + tmdbId + '?api_key=' + key;
                Utils.request(url, {}, cb, err);
            }
        }
    };

    // Вспомогательная функция для качества
    Utils.extractQuality = function (item) {
        // Определяем качество из доступных данных
        // В CUB это обычно приходит из release info
        if (item.quality) return item.quality;
        if (item.release_dates && item.release_dates.results) {
            for (var i = 0; i < item.release_dates.results.length; i++) {
                var rd = item.release_dates.results[i];
                if (rd.release_dates && rd.release_dates[0]) {
                    var type = rd.release_dates[0].type;
                    if (type === 1) return '4K';        // Premiere
                    if (type === 4) return 'WEBDL';     // Digital
                    if (type === 5) return 'BluRay';    // Physical
                }
            }
        }
        return '';
    };

    /* ══════════════════════════════════════════════
       4. РЕКОМЕНДАТЕЛЬНЫЙ ДВИЖОК (с правильными весами)
    ══════════════════════════════════════════════ */
    var Recommender = {
        _historyKey: 'mpx_watch_history_v2',
        _prefsKey: 'mpx_user_prefs_v2',

        addWatch: function (item) {
            var history = Lampa.Storage.get(this._historyKey, []);
            history.unshift({
                tmdb_id: item.tmdb_id,
                kp_id: item.kp_id,
                title: item.title,
                genre_ids: item.genre_ids || [],
                actors: item.actors || [],
                directors: item.directors || [],
                tags: item.tags || [],
                runtime: item.runtime || 0,
                vote_average: item.vote_average || 0,
                year: item.year || '',
                country: item.country || '',
                media_type: item.media_type || 'movie',
                ts: Date.now()
            });
            if (history.length > CONFIG.recommender.max_history) {
                history = history.slice(0, CONFIG.recommender.max_history);
            }
            Lampa.Storage.set(this._historyKey, history);
            this._rebuildPrefs();
        },

        _rebuildPrefs: function () {
            var history = Lampa.Storage.get(this._historyKey, []);
            if (!history.length) return;

            var prefs = {
                genres: {},
                actors: {},
                directors: {},
                tags: {},
                runtimes: [],
                ratings: [],
                years: [],
                countries: {},
                types: {}
            };

            for (var i = 0; i < history.length; i++) {
                var h = history[i];
                var recency = 1 - (i / history.length) * 0.5;

                (h.genre_ids || []).forEach(function (g) {
                    prefs.genres[g] = (prefs.genres[g] || 0) + recency;
                });
                (h.actors || []).forEach(function (a) {
                    prefs.actors[a] = (prefs.actors[a] || 0) + recency;
                });
                (h.directors || []).forEach(function (d) {
                    prefs.directors[d] = (prefs.directors[d] || 0) + recency;
                });
                (h.tags || []).forEach(function (t) {
                    prefs.tags[t] = (prefs.tags[t] || 0) + recency;
                });
                if (h.runtime) prefs.runtimes.push(h.runtime);
                if (h.vote_average) prefs.ratings.push(h.vote_average);
                if (h.year) prefs.years.push(parseInt(h.year));
                if (h.country) prefs.countries[h.country] = (prefs.countries[h.country] || 0) + recency;
                if (h.media_type) prefs.types[h.media_type] = (prefs.types[h.media_type] || 0) + recency;
            }

            prefs.avg_runtime = prefs.runtimes.length ? Math.round(prefs.runtimes.reduce(function (a, b) { return a + b; }, 0) / prefs.runtimes.length) : 0;
            prefs.avg_rating = prefs.ratings.length ? (prefs.ratings.reduce(function (a, b) { return a + b; }, 0) / prefs.ratings.length) : 0;
            prefs.avg_year = prefs.years.length ? Math.round(prefs.years.reduce(function (a, b) { return a + b; }, 0) / prefs.years.length) : 0;

            prefs.top_genres = this._topKeys(prefs.genres, 10);
            prefs.top_actors = this._topKeys(prefs.actors, 15);
            prefs.top_directors = this._topKeys(prefs.directors, 10);
            prefs.top_tags = this._topKeys(prefs.tags, 10);
            prefs.top_countries = this._topKeys(prefs.countries, 5);

            Lampa.Storage.set(this._prefsKey, prefs);
        },

        _topKeys: function (obj, n) {
            return Object.keys(obj)
                .sort(function (a, b) { return obj[b] - obj[a]; })
                .slice(0, n);
        },

        score: function (candidate) {
            var prefs = Lampa.Storage.get(this._prefsKey, null);
            if (!prefs) return 0;

            var w = CONFIG.recommender.weights;
            var s = 0;

            // ЖАНРЫ — 1 место
            if (candidate.genre_ids && prefs.top_genres.length) {
                var matched = 0;
                for (var i = 0; i < candidate.genre_ids.length; i++) {
                    if (prefs.top_genres.indexOf(String(candidate.genre_ids[i])) !== -1) matched++;
                }
                s += w.genre * (matched / Math.max(candidate.genre_ids.length, 1));
            }

            // ТЕГИ — 2 место
            if (candidate.tags && prefs.top_tags.length) {
                var tagMatch = 0;
                for (var k = 0; k < candidate.tags.length; k++) {
                    if (prefs.top_tags.indexOf(candidate.tags[k]) !== -1) tagMatch++;
                }
                s += w.tag * Math.min(tagMatch / 3, 1);
            }

            // АКТЁРЫ — 3 место
            if (candidate.actors && prefs.top_actors.length) {
                var actorMatch = 0;
                for (var j = 0; j < candidate.actors.length; j++) {
                    if (prefs.top_actors.indexOf(candidate.actors[j]) !== -1) actorMatch++;
                }
                s += w.actor * Math.min(actorMatch / 3, 1);
            }

            // РЕЖИССЁРЫ — 3 место
            if (candidate.directors && prefs.top_directors.length) {
                var dirMatch = 0;
                for (var d = 0; d < candidate.directors.length; d++) {
                    if (prefs.top_directors.indexOf(candidate.directors[d]) !== -1) dirMatch++;
                }
                s += w.director * Math.min(dirMatch / 2, 1);
            }

            // ХРОНОМЕТРАЖ — последний
            if (candidate.runtime && prefs.avg_runtime) {
                var diff = Math.abs(candidate.runtime - prefs.avg_runtime);
                s += w.runtime * Math.max(0, 1 - diff / 60);
            }

            // Бонусы (не основные)
            if (candidate.vote_average && prefs.avg_rating) {
                var rDiff = Math.abs(candidate.vote_average - prefs.avg_rating);
                s += w.rating * Math.max(0, 1 - rDiff / 3);
            }
            if (candidate.year && prefs.avg_year) {
                var yDiff = Math.abs(parseInt(candidate.year) - prefs.avg_year);
                s += w.year * Math.max(0, 1 - yDiff / 20);
            }
            if (candidate.country && prefs.top_countries.indexOf(candidate.country) !== -1) {
                s += w.country;
            }

            return s;
        },

        getRecommendations: function (cb) {
            var self = this;
            var prefs = Lampa.Storage.get(this._prefsKey, null);

            if (!prefs || !prefs.top_genres || !prefs.top_genres.length) {
                Utils.log('Нет истории, показываю популярное');
                SmartSource.execute('foreign', function (srcName, resolve, reject) {
                    if (Sources[srcName] && Sources[srcName].popular) {
                        Sources[srcName].popular('movie', resolve, reject);
                    } else {
                        reject();
                    }
                }, function (items) {
                    cb(items || []);
                });
                return;
            }

            var genreQueries = prefs.top_genres.slice(0, 4);
            var allResults = [];
            var doneCount = 0;

            genreQueries.forEach(function (gid) {
                SmartSource.execute('foreign', function (srcName, resolve, reject) {
                    if (Sources[srcName] && Sources[srcName].byGenre) {
                        Sources[srcName].byGenre(gid, resolve, reject);
                    } else {
                        reject();
                    }
                }, function (items) {
                    if (items) allResults.push(items);
                    doneCount++;
                    if (doneCount >= genreQueries.length) {
                        self._rankAndReturn(allResults, cb);
                    }
                });
            });
        },

        _rankAndReturn: function (arrays, cb) {
            var merged = Utils.mergeResults(arrays);
            var scored = merged.map(function (item) {
                return { item: item, score: Recommender.score(item) };
            });

            scored.sort(function (a, b) { return b.score - a.score; });
            var filtered = scored.filter(function (s) { return s.score >= CONFIG.recommender.min_score; });
            var result = Utils.deduplicate(filtered.map(function (s) { return s.item; }), true)
                            .slice(0, CONFIG.recommender.result_count);

            Utils.log('Рекомендаций:', result.length);
            cb(result);
        }
    };

    /* ══════════════════════════════════════════════
       5. ЕДИНЫЙ ПОИСК
    ══════════════════════════════════════════════ */
    var UnifiedSearch = {
        search: function (query, cb) {
            if (!query || query.trim().length < 2) { cb([]); return; }

            var allResults = [];
            var activeSources = [];

            for (var name in CONFIG.sources) {
                var src = CONFIG.sources[name];
                if (src.enabled && Sources[name] && Sources[name].search) {
                    activeSources.push(name);
                }
            }

            if (!activeSources.length) { cb([]); return; }

            var pending = activeSources.length;

            function finish() {
                if (--pending <= 0) {
                    var merged = Utils.deduplicate(Utils.mergeResults(allResults), true);
                    merged.sort(function (a, b) {
                        var sa = (a.popularity || 0) + (a.vote_average || 0) * 10;
                        var sb = (b.popularity || 0) + (b.vote_average || 0) * 10;
                        return sb - sa;
                    });
                    Utils.log('Поиск "' + query + '":', merged.length, 'результатов из', activeSources.length, 'источников');
                    cb(merged);
                }
            }

            activeSources.forEach(function (srcName) {
                Sources[srcName].search(query, function (results) {
                    if (results && results.length) allResults.push(results);
                    finish();
                }, finish);
            });
        }
    };

    /* ══════════════════════════════════════════════
       6. ОТРИСОВКА КАСТОМНЫХ КАРТОЧЕК (CUB-style)
    ══════════════════════════════════════════════ */
    var CardDesigner = {
        render: function (item) {
            var cfg = CONFIG.card_design;
            var radius = cfg.border_radius || 8;

            var html = '<div class="mpx-card" style="min-width:' + cfg.card_width + 'px;max-width:' + cfg.card_width + 'px;">';

            if (item.poster) {
                html += '<div class="mpx-card__img-wrap" style="border-radius:' + radius + 'px;">';
                html += '<img class="mpx-card__img" src="' + item.poster + '" loading="lazy" />';

                // Бейдж качества (как в CUB)
                if (cfg.show_quality && item.quality) {
                    var qClass = 'mpx-quality--' + item.quality.toLowerCase();
                    html += '<span class="mpx-quality ' + qClass + '">' + item.quality + '</span>';
                }

                // Бейдж источника
                if (cfg.show_source_badge && item.source) {
                    html += '<span class="mpx-source-badge">' + (CONFIG.sources[item.source] ? CONFIG.sources[item.source].label : item.source) + '</span>';
                }

                html += '</div>';
            } else {
                html += '<div class="mpx-card__placeholder" style="border-radius:' + radius + 'px;">' + item.title + '</div>';
            }

            html += '<div class="mpx-card__info">';
            html += '<span class="mpx-card__title">' + item.title + '</span>';
            if (cfg.show_year && item.year) html += '<span class="mpx-card__meta">' + item.year + '</span>';
            if (cfg.show_rating && item.vote_average) html += '<span class="mpx-card__meta">⭐ ' + item.vote_average.toFixed(1) + '</span>';
            html += '</div></div>';

            return html;
        }
    };

    /* ══════════════════════════════════════════════
       7. ГЛАВНАЯ СТРАНИЦА
    ══════════════════════════════════════════════ */
    var MainPage = {
        _rendered: false,

        build: function () {
            var self = this;
            Utils.log('Строим главную...');

            var isKids = Utils.isKidsProfile();
            var isRus = Utils.isRusProfile();
            var task = isRus ? 'ru' : 'foreign';

            CONFIG.rows.forEach(function (row) {
                if (isKids && row.id === 'box_office') return;
                self._buildRow(row, task);
            });

            this._rendered = true;
        },

        _buildRow: function (row, task) {
            var self = this;

            switch (row.type) {
                case 'for_you':
                    Recommender.getRecommendations(function (items) { self._renderRow(row, items); });
                    break;

                case 'trending':
                    SmartSource.execute(task, function (srcName, resolve, reject) {
                        if (Sources[srcName] && Sources[srcName].trending) {
                            Sources[srcName].trending(resolve, reject);
                        } else {
                            reject();
                        }
                    }, function (items) { self._renderRow(row, items || []); });
                    break;

                case 'popular':
                    SmartSource.execute(task, function (srcName, resolve, reject) {
                        if (Sources[srcName] && Sources[srcName].popular) {
                            Sources[srcName].popular('movie', resolve, reject);
                        } else {
                            reject();
                        }
                    }, function (items) { self._renderRow(row, items || []); });
                    break;

                case 'top_rated':
                    SmartSource.execute(task, function (srcName, resolve, reject) {
                        if (Sources[srcName] && Sources[srcName].topRated) {
                            Sources[srcName].topRated('movie', resolve, reject);
                        } else {
                            reject();
                        }
                    }, function (items) { self._renderRow(row, items || []); });
                    break;

                case 'box_office':
                    Utils.request(
                        Sources.tmdb._url('/discover/movie', '&sort_by=revenue.desc&primary_release_date.lte=' + new Date().toISOString().split('T')[0]),
                        {},
                        function (d) { self._renderRow(row, Sources.tmdb._map(d.results || [], 'tmdb')); },
                        function () { self._renderRow(row, []); }
                    );
                    break;

                case 'now_playing':
                    SmartSource.execute(task, function (srcName, resolve, reject) {
                        if (Sources[srcName] && Sources[srcName].nowPlaying) {
                            Sources[srcName].nowPlaying(resolve, reject);
                        } else {
                            reject();
                        }
                    }, function (items) { self._renderRow(row, items || []); });
                    break;

                case 'streamings':
                    self._buildStreamingsRow(row);
                    break;

                case 'genres':
                    self._buildGenresRow(row);
                    break;
            }
        },

        _buildStreamingsRow: function (row) {
            var items = [];
            var streams = CONFIG.streamings.ru.concat(CONFIG.streamings.foreign);

            streams.forEach(function (s) {
                items.push({
                    title: s.title,
                    poster: '',
                    card_type: 'streaming',
                    streaming_id: s.provider_id,
                    streaming_name: s.title,
                    streaming_color: s.color
                });
            });

            this._renderRow(row, items);
        },

        _buildGenresRow: function (row) {
            var genreNames = {
                28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия',
                80: 'Криминал', 99: 'Документальный', 18: 'Драма', 10751: 'Семейный',
                14: 'Фэнтези', 36: 'История', 27: 'Ужасы', 10402: 'Музыка',
                9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика',
                53: 'Триллер', 10752: 'Военный', 37: 'Вестерн'
            };

            var items = [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 9648, 10749, 878, 53, 10752].map(function (id) {
                return {
                    title: genreNames[id],
                    poster: '',
                    card_type: 'genre',
                    genre_id: id
                };
            });
            this._renderRow(row, items);
        },

        _renderRow: function (row, items) {
            if (!items || !items.length) {
                Utils.log('Ряд "' + row.title + '" пуст');
                return;
            }

            var title = row.title;
            var custom = Lampa.Storage.get('mpx_row_name_' + row.id, '');
            if (custom) title = custom;

            var cardsHtml = items.map(function (item) {
                return CardDesigner.render(item);
            }).join('');

            var html = '<div class="mpx-row" data-row-id="' + row.id + '">' +
                '<div class="mpx-row__title">' + title + '</div>' +
                '<div class="mpx-row__items">' + cardsHtml + '</div>' +
                '</div>';

            var container = document.querySelector('.main-page__content') ||
                            document.querySelector('.app-content') ||
                            document.querySelector('#app');

            if (container) {
                var div = document.createElement('div');
                div.innerHTML = html;
                container.appendChild(div.firstChild);
            }
        },

        refresh: function () {
            var existing = document.querySelectorAll('.mpx-row');
            for (var i = 0; i < existing.length; i++) {
                existing[i].remove();
            }
            this._rendered = false;
            this.build();
        }
    };

    /* ══════════════════════════════════════════════
       8. CSS
    ══════════════════════════════════════════════ */
    function injectStyles() {
        var css = '' +
            '.mpx-row { margin-bottom: 24px; padding: 0 20px; }' +
            '.mpx-row__title { font-size: 1.3em; font-weight: 700; margin-bottom: 12px; color: #fff; }' +
            '.mpx-row__items { display: flex; gap: ' + (CONFIG.card_design.card_gap || 12) + 'px; overflow-x: auto; padding-bottom: 8px; scroll-behavior: smooth; }' +
            '.mpx-row__items::-webkit-scrollbar { height: 4px; }' +
            '.mpx-row__items::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }' +
            '.mpx-card { cursor: pointer; transition: transform 0.2s; flex-shrink: 0; }' +
            '.mpx-card:hover { transform: scale(1.08); outline: 2px solid #e50914; border-radius: 8px; }' +
            '.mpx-card__img-wrap { position: relative; overflow: hidden; }' +
            '.mpx-card__img { width: 100%; aspect-ratio: 2/3; object-fit: cover; display: block; background: #222; }' +
            '.mpx-card__placeholder { width: 100%; aspect-ratio: 2/3; background: linear-gradient(135deg, #333, #555); display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 0.9em; text-align: center; padding: 8px; }' +
            '.mpx-quality { position: absolute; top: 6px; right: 6px; padding: 2px 6px; font-size: 0.7em; font-weight: 700; border-radius: 4px; background: rgba(0,0,0,0.75); color: #fff; text-transform: uppercase; }' +
            '.mpx-quality--4k { background: #e50914; color: #fff; }' +
            '.mpx-quality--bluray, .mpx-quality--hd { background: #00a651; color: #fff; }' +
            '.mpx-quality--webdl, .mpx-quality--web-dl { background: #0088cc; color: #fff; }' +
            '.mpx-quality--cam, .mpx-quality--ts { background: #666; color: #fff; }' +
            '.mpx-source-badge { position: absolute; bottom: 6px; left: 6px; padding: 2px 6px; font-size: 0.65em; background: rgba(0,0,0,0.8); color: #ffd700; border-radius: 3px; font-weight: 600; }' +
            '.mpx-card__info { margin-top: 6px; }' +
            '.mpx-card__title { display: block; font-size: 0.85em; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
            '.mpx-card__meta { font-size: 0.75em; color: #999; margin-right: 6px; }';

        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ══════════════════════════════════════════════
       9. ИНТЕГРАЦИЯ В LAMPA API (главные исправления!)
    ══════════════════════════════════════════════ */
    function integrateWithLampa() {

        injectStyles();

        /* ── 9.1. Регистрация в меню «Остальное» ── */
        try {
            if (Lampa.Menu && Lampa.Menu.add) {
                Lampa.Menu.add({
                    title: 'MULTIPLEX',
                    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
                    controller: 'mpx_main'
                });
                Utils.log('Добавлено в меню "Остальное"');
            }
        } catch (e) {
            Utils.log('Ошибка добавления в меню:', e);
        }

        /* ── 9.2. Регистрация источника в основном поиске Лампы ── */
        try {
            if (Lampa.Search && Lampa.Search.addSource) {
                Lampa.Search.addSource({
                    title: 'MULTIPLEX (Мульти-поиск)',
                    id: 'multiplex',
                    search: function (query, cb) {
                        UnifiedSearch.search(query, function (items) {
                            // Преобразуем в формат, который ожидает Lampa.Search
                            var result = items.map(function (it) {
                                return {
                                    title: it.title,
                                    original_title: it.original_title,
                                    year: it.year,
                                    poster: it.poster,
                                    vote_average: it.vote_average,
                                    media_type: it.media_type,
                                    imdb_id: it.imdb_id,
                                    tmdb_id: it.tmdb_id,
                                    kp_id: it.kp_id
                                };
                            });
                            cb(result);
                        });
                    }
                });
                Utils.log('Источник поиска зарегистрирован');
            }
        } catch (e) {
            Utils.log('Ошибка регистрации поиска:', e);
        }

        /* ── 9.3. Добавление настроек в Lampa Settings ── */
        try {
            if (Lampa.Settings && Lampa.Settings.addComponent) {
                Lampa.Settings.addComponent({
                    name: 'MULTIPLEX',
                    render: function () {
                        return MpxSettings.buildHTML();
                    },
                    onChange: function (name, value) {
                        MpxSettings.handleChange(name, value);
                    }
                });
                Utils.log('Настройки добавлены в Lampa');
            }
        } catch (e) {
            Utils.log('Ошибка добавления настроек:', e);
        }

        /* ── 9.4. Регистрация основного источника на главной ── */
        try {
            if (Lampa.Controller && Lampa.Controller.add) {
                Lampa.Controller.add('mpx_main', {
                    link: function () { return 'MULTIPLEX'; },
                    start: function () {
                        MainPage.refresh();
                    },
                    pause: function () {},
                    stop: function () {},
                    keydown: function (e) {}
                });
            }
        } catch (e) {
            Utils.log('Ошибка регистрации контроллера:', e);
        }

        /* ── 9.5. Регистрация как основной источник постеров ── */
        try {
            if (Lampa.Manifest && Lampa.Manifest.add_source) {
                Lampa.Manifest.add_source({
                    name: 'MULTIPLEX',
                    type: 'main',
                    priority: 95,
                    search: function (q, cb) {
                        UnifiedSearch.search(q, cb);
                    }
                });
            }
        } catch (e) {
            Utils.log('Manifest.add_source:', e);
        }

        /* ── 9.6. Слушатели событий ── */
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                Utils.log('Lampa готова, MULTIPLEX v' + CONFIG.version);
                setTimeout(function () { MainPage.build(); }, 500);
            }
        });

        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' && e.component === 'main') {
                if (MainPage._rendered) MainPage.refresh();
            }
        });

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'start' && e.object) {
                Recommender.addWatch({
                    tmdb_id: e.object.id || e.object.tmdb_id,
                    kp_id: e.object.kp_id,
                    title: e.object.title || e.object.name,
                    genre_ids: e.object.genres ? e.object.genres.map(function (g) { return g.id; }) : [],
                    actors: e.object.actors ? e.object.actors.slice(0, 10).map(function (a) { return a.name || a; }) : [],
                    directors: e.object.directors ? e.object.directors.map(function (d) { return d.name || d; }) : [],
                    tags: e.object.keywords ? e.object.keywords.map(function (k) { return k.name; }) : [],
                    runtime: e.object.runtime || 0,
                    vote_average: e.object.vote_average || 0,
                    year: (e.object.release_date || '').substring(0, 4),
                    country: e.object.country || '',
                    media_type: e.object.number_of_seasons ? 'tv' : 'movie'
                });
            }
        });

        Lampa.Listener.follow('profile', function (e) {
            if (e.type === 'switch' || e.type === 'change') {
                Utils.log('Профиль изменён');
                MainPage.refresh();
            }
        });

        Utils.log('Интеграция с Lampa API завершена');
    }

    /* ══════════════════════════════════════════════
       10. МЕНЮ НАСТРОЕК
    ══════════════════════════════════════════════ */
    var MpxSettings = {
        buildHTML: function () {
            var html = '<div class="mpx-settings">';

            // Секция: Источники
            html += '<h3 style="color:#ffd700;margin:12px 0 8px;">🔌 Источники данных</h3>';
            for (var name in CONFIG.sources) {
                var src = CONFIG.sources[name];
                html += '<div class="settings-param" data-mpx-src="' + name + '">' +
                    '<div class="settings-param__name">' + src.label + ' <span style="color:#888;font-size:0.8em;">(приоритет: ' + src.priority + ')</span></div>' +
                    '<div class="settings-param__value">' +
                    '<label><input type="checkbox" data-mpx-toggle="' + name + '" ' + (src.enabled ? 'checked' : '') + ' /> Включён</label>' +
                    '</div></div>';
            }

            // Секция: API ключи
            html += '<h3 style="color:#ffd700;margin:16px 0 8px;">🔑 API-ключи</h3>';
            html += '<div class="settings-param"><div class="settings-param__name">TMDB API Key</div>' +
                '<div class="settings-param__value"><input type="text" data-mpx-key="mpx_tmdb_key" value="' + (Lampa.Storage.get('mpx_tmdb_key', '') || '') + '" style="width:100%;padding:6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;" /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Кинопоиск API Key</div>' +
                '<div class="settings-param__value"><input type="text" data-mpx-key="mpx_kp_key" value="' + (Lampa.Storage.get('mpx_kp_key', '') || '') + '" style="width:100%;padding:6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;" /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">OMDb API Key</div>' +
                '<div class="settings-param__value"><input type="text" data-mpx-key="mpx_omdb_key" value="' + (Lampa.Storage.get('mpx_omdb_key', '') || '') + '" style="width:100%;padding:6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;" /></div></div>';

            // Секция: Карточки
            html += '<h3 style="color:#ffd700;margin:16px 0 8px;">🎨 Дизайн карточек</h3>';
            html += '<div class="settings-param"><div class="settings-param__name">Скругление углов (px)</div>' +
                '<div class="settings-param__value"><input type="number" data-mpx-design="border_radius" value="' + CONFIG.card_design.border_radius + '" min="0" max="32" style="width:80px;padding:6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;" /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Показывать качество (как в CUB)</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-design-toggle="show_quality" ' + (CONFIG.card_design.show_quality ? 'checked' : '') + ' /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Показывать рейтинг</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-design-toggle="show_rating" ' + (CONFIG.card_design.show_rating ? 'checked' : '') + ' /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Показывать источник на карточке</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-design-toggle="show_source_badge" ' + (CONFIG.card_design.show_source_badge ? 'checked' : '') + ' /></div></div>';

            // Секция: Анти-дубликаты
            html += '<h3 style="color:#ffd700;margin:16px 0 8px;">🚫 Анти-дубликаты обложек</h3>';
            html += '<div class="settings-param"><div class="settings-param__name">Включить</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-antidup="enabled" ' + (CONFIG.anti_dup.enabled ? 'checked' : '') + ' /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Режим</div>' +
                '<div class="settings-param__value"><select data-mpx-antidup="mode" style="padding:6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;">' +
                '<option value="url_hash" ' + (CONFIG.anti_dup.mode === 'url_hash' ? 'selected' : '') + '>URL-хеш (быстрый)</option>' +
                '<option value="perceptual" ' + (CONFIG.anti_dup.mode === 'perceptual' ? 'selected' : '') + '>Perceptual (умный)</option>' +
                '<option value="strict" ' + (CONFIG.anti_dup.mode === 'strict' ? 'selected' : '') + '>Строгий</option>' +
                '</select></div></div>';

            // Секция: Умный выбор
            html += '<h3 style="color:#ffd700;margin:16px 0 8px;">🧠 Умный выбор источника</h3>';
            html += '<div class="settings-param"><div class="settings-param__name">Включить</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-smart="enabled" ' + (CONFIG.smart_select.enabled ? 'checked' : '') + ' /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Учитывать качество</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-smart="prefer_quality" ' + (CONFIG.smart_select.prefer_quality ? 'checked' : '') + ' /></div></div>';
            html += '<div class="settings-param"><div class="settings-param__name">Учитывать количество результатов</div>' +
                '<div class="settings-param__value"><input type="checkbox" data-mpx-smart="prefer_quantity" ' + (CONFIG.smart_select.prefer_quantity ? 'checked' : '') + ' /></div></div>';

            // Секция: Весовые коэффициенты
            html += '<h3 style="color:#ffd700;margin:16px 0 8px;">⚖️ Веса рекомендаций</h3>';
            var weightLabels = {
                genre: '🎭 Жанры',
                tag: '🏷️ Теги',
                actor: '👤 Актёры',
                director: '🎬 Режиссёры',
                runtime: '⏱️ Хронометраж',
                rating: '⭐ Рейтинг',
                year: '📅 Год',
                country: '🌍 Страна'
            };
            for (var w in CONFIG.recommender.weights) {
                html += '<div class="settings-param"><div class="settings-param__name">' + (weightLabels[w] || w) + '</div>' +
                    '<div class="settings-param__value"><input type="number" data-mpx-weight="' + w + '" value="' + CONFIG.recommender.weights[w] + '" step="0.05" min="0" max="1" style="width:80px;padding:6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;" /></div></div>';
            }

            // Секция: Действия
            html += '<h3 style="color:#ffd700;margin:16px 0 8px;">⚙️ Действия</h3>';
            html += '<div class="settings-param" style="cursor:pointer;" data-mpx-action="refresh"><div class="settings-param__name">🔄 Обновить главную</div></div>';
            html += '<div class="settings-param" style="cursor:pointer;" data-mpx-action="reset_history"><div class="settings-param__name">🗑️ Сбросить историю просмотров</div></div>';
            html += '<div class="settings-param" style="cursor:pointer;" data-mpx-action="reset_config"><div class="settings-param__name">⚠️ Сбросить все настройки</div></div>';

            html += '<div style="margin-top:20px;padding:12px;background:rgba(255,215,0,0.1);border-radius:6px;border-left:3px solid #ffd700;font-size:0.85em;color:#ccc;">' +
                '<strong>MULTIPLEX v' + CONFIG.version + '</strong><br>' +
                '💡 Поддержка автора: Сбер +7 923 668 0000 (с комментарием "это тебе на ПАЗик")<br>' +
                '🚌 Мечтаю построить автодом из ПАЗика на японском моторе!</div>';

            html += '</div>';
            return html;
        },

        handleChange: function (name, value) {
            Utils.log('Настройка:', name, '=', value);
        },

        // Привязка обработчиков через делегирование
        bindEvents: function () {
            document.addEventListener('change', function (e) {
                var t = e.target;

                if (t.hasAttribute('data-mpx-toggle')) {
                    var srcName = t.getAttribute('data-mpx-toggle');
                    CONFIG.sources[srcName].enabled = t.checked;
                    saveConfig();
                    Utils.log('Источник', srcName, t.checked ? 'включён' : 'выключен');
                }
                else if (t.hasAttribute('data-mpx-key')) {
                    var keyName = t.getAttribute('data-mpx-key');
                    Lampa.Storage.set(keyName, t.value);
                    Utils.log('Ключ', keyName, 'сохранён');
                }
                else if (t.hasAttribute('data-mpx-design')) {
                    var dKey = t.getAttribute('data-mpx-design');
                    CONFIG.card_design[dKey] = parseInt(t.value) || 0;
                    saveConfig();
                    injectStyles();
                }
                else if (t.hasAttribute('data-mpx-design-toggle')) {
                    var dTKey = t.getAttribute('data-mpx-design-toggle');
                    CONFIG.card_design[dTKey] = t.checked;
                    saveConfig();
                }
                else if (t.hasAttribute('data-mpx-antidup')) {
                    var adKey = t.getAttribute('data-mpx-antidup');
                    CONFIG.anti_dup[adKey] = t.type === 'checkbox' ? t.checked : t.value;
                    saveConfig();
                }
                else if (t.hasAttribute('data-mpx-smart')) {
                    var smKey = t.getAttribute('data-mpx-smart');
                    CONFIG.smart_select[smKey] = t.checked;
                    saveConfig();
                }
                else if (t.hasAttribute('data-mpx-weight')) {
                    var wKey = t.getAttribute('data-mpx-weight');
                    CONFIG.recommender.weights[wKey] = parseFloat(t.value) || 0;
                    saveConfig();
                }
            });

            document.addEventListener('click', function (e) {
                var t = e.target.closest('[data-mpx-action]');
                if (!t) return;

                var action = t.getAttribute('data-mpx-action');
                if (action === 'refresh') {
                    MainPage.refresh();
                    alert('Главная обновлена');
                }
                else if (action === 'reset_history') {
                    if (confirm('Сбросить историю просмотров и рекомендации?')) {
                        Lampa.Storage.set('mpx_watch_history_v2', []);
                        Lampa.Storage.set('mpx_user_prefs_v2', null);
                        alert('История сброшена');
                    }
                }
                else if (action === 'reset_config') {
                    if (confirm('Сбросить ВСЕ настройки MULTIPLEX?')) {
                        Lampa.Storage.set('mpx_config_v2', DEFAULT_CONFIG);
                        CONFIG = DEFAULT_CONFIG;
                        alert('Настройки сброшены. Перезагрузите Лампу.');
                    }
                }
            });
        }
    };

    /* ══════════════════════════════════════════════
       11. ГЛОБАЛЬНЫЙ ОБЪЕКТ И ТОЧКА ВХОДА
    ══════════════════════════════════════════════ */
    window.MULTIPLEX = {
        version: CONFIG.version,
        config: CONFIG,
        sources: Sources,
        search: UnifiedSearch,
        recommender: Recommender,
        smartSource: SmartSource,
        mainPage: MainPage,
        settings: MpxSettings,
        refresh: function () { MainPage.refresh(); }
    };

    function init() {
        if (window.appready) {
            integrateWithLampa();
            MpxSettings.bindEvents();
        } else {
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    integrateWithLampa();
                    MpxSettings.bindEvents();
                }
            });
        }
    }

    init();

})();
