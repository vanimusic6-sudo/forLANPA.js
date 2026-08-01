/* ============================================================
   MULTIPLEX — Lampa Main-Page Replacer & Multi-Source Search
   ============================================================
   Установка:
     1. Свой сервер: положить в wwwroot/multiplex.js
     2. Лампа → Настройки → Плагины → указать: ВашАдрес/multiplex.js
     3. Для всех: в lampainit.js добавить:
        Lampa.Utils.putScriptAsync(["https://ВАШ_ДОМЕН/multiplex.js"], function(){});

   Настройки (вызывать из консоли или lampainit.js):
     Lampa.Storage.set('mpx_disableMenu', true);        // скрыть меню подборок
     Lampa.Storage.set('mpx_disableCustomName', true);   // запретить смену названий
     Lampa.Storage.set('mpx_name', 'МОЯ ГЛАВНАЯ');       // своё название
     Lampa.Storage.set('mpx_sources', ['tmdb','kp']);    // активные источники
     Lampa.Storage.set('mpx_tmdb_key', 'ВАШ_КЛЮЧ');      // TMDB API key
     Lampa.Storage.set('mpx_proxy_url', '');             // свой прокси (опционально)
   ============================================================ */

(function () {
    'use strict';

    /* ──────────────────────────────────────────────
       0. КОНФИГУРАЦИЯ ПО УМОЛЧАНИЮ
    ────────────────────────────────────────────── */
    var DEFAULT_CONFIG = {
        plugin_name: 'MULTIPLEX',
        version: '1.0.0',

        // Источники постеров / данных
        sources: {
            tmdb: {
                enabled: true,
                label: 'TMDB',
                base_url: 'https://api.themoviedb.org/3',
                img_base: 'https://image.tmdb.org/t/p/',
                api_key: Lampa.Storage.get('mpx_tmdb_key', '') || '',
                lang: 'ru-RU',
                weight: 1
            },
            kp: {
                enabled: true,
                label: 'Кинопоиск',
                base_url: 'https://kinopoiskapiunofficial.tech/api',
                img_base: '',
                api_key: Lampa.Storage.get('mpx_kp_key', '') || '',
                weight: 1
            },
            proxy: {
                enabled: false,
                label: 'Прокси',
                base_url: Lampa.Storage.get('mpx_proxy_url', '') || '',
                weight: 0.5
            }
        },

        // Строки главной страницы
        rows: [
            { id: 'trending',    title: '🔥 В тренде',           type: 'trending' },
            { id: 'popular',     title: '⭐ Популярное',          type: 'popular' },
            { id: 'top_rated',   title: '🏆 Топ по рейтингу',    type: 'top_rated' },
            { id: 'box_office',  title: '💰 Кассовые сборы',     type: 'box_office' },
            { id: 'new_releases',title: '🆕 Новинки',            type: 'now_playing' },
            { id: 'for_you',     title: '🎯 Интересно лично вам', type: 'for_you' },
            { id: 'streamings',  title: '📺 Стриминги',          type: 'streamings' },
            { id: 'genres',      title: '🎭 По жанрам',          type: 'genres' }
        ],

        // Жанры для подборок
        genre_ids: [28, 12, 16, 35, 80, 99, 18, 10751, 14, 36, 27, 10402, 9648, 10749, 878, 53, 10752, 37],

        // Стриминги (заготовка — пришлёшь свои пожелания)
        streamings: [
            { id: 'netflix',    title: 'Netflix',     provider_id: 8 },
            { id: 'kinopoisk',  title: 'Кинопоиск',   provider_id: 115 },
            { id: 'ivi',        title: 'IVI',         provider_id: 113 },
            { id: 'okko',       title: 'Okko',        provider_id: 116 },
            { id: 'wink',       title: 'Wink',        provider_id: 117 },
            { id: 'amediateka', title: 'Amediateka',  provider_id: 119 },
            { id: 'disney',     title: 'Disney+',     provider_id: 337 },
            { id: 'hbo',        title: 'HBO Max',     provider_id: 384 }
        ],

        // Рекомендательный движок
        recommender: {
            max_history: 200,
            weights: {
                genre: 0.30,
                actor: 0.20,
                tag: 0.15,
                runtime: 0.10,
                rating: 0.10,
                year: 0.05,
                country: 0.05,
                type: 0.05
            },
            min_score: 0.15,
            result_count: 20
        },

        // Профили
        profile_keys: {
            main: 'surs',
            kids: 'forKids',
            rus: 'onlyRus'
        }
    };

    var CONFIG = Lampa.Storage.get('mpx_config', null) || DEFAULT_CONFIG;

    /* ──────────────────────────────────────────────
       1. УТИЛИТЫ
    ────────────────────────────────────────────── */
    var Utils = {
        log: function () {
            var args = Array.prototype.slice.call(arguments);
            args.unshift('[MULTIPLEX]');
            console.log.apply(console, args);
        },

        request: function (url, params, onSuccess, onError) {
            var reguest = new Lampa.Reguest();
            reguest.native(url, function (data) {
                if (onSuccess) onSuccess(data);
            }, function (a, b) {
                Utils.log('Ошибка запроса:', url, a, b);
                if (onError) onError(a, b);
            }, params || {});
            return reguest;
        },

        // Дедупликация по imdb_id / tmdb_id / kp_id
        deduplicate: function (items) {
            var seen = {};
            var result = [];
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var key = item.imdb_id || ('tmdb_' + item.tmdb_id) || ('kp_' + item.kp_id) || ('t_' + item.title + '_' + item.year);
                if (!seen[key]) {
                    seen[key] = true;
                    result.push(item);
                }
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
                if (arrays[i].length > maxLen) maxLen = arrays[i].length;
            }
            for (var pos = 0; pos < maxLen; pos++) {
                for (var src = 0; src < arrays.length; src++) {
                    if (arrays[src][pos]) merged.push(arrays[src][pos]);
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
        }
    };

    /* ──────────────────────────────────────────────
       2. ИСТОЧНИКИ ДАННЫХ (АДАПТЕРЫ)
    ────────────────────────────────────────────── */
    var Sources = {

        /* --- TMDB --- */
        tmdb: {
            _url: function (path, extra) {
                var cfg = CONFIG.sources.tmdb;
                var sep = path.indexOf('?') === -1 ? '?' : '&';
                return cfg.base_url + path + sep + 'api_key=' + cfg.api_key + '&language=' + cfg.lang + (extra || '');
            },

            trending: function (cb) {
                Utils.request(this._url('/trending/all/week'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || []));
                }, function () { cb([]); });
            },

            popular: function (type, cb) {
                Utils.request(this._url('/' + (type || 'movie') + '/popular'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || []));
                }, function () { cb([]); });
            },

            topRated: function (type, cb) {
                Utils.request(this._url('/' + (type || 'movie') + '/top_rated'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || []));
                }, function () { cb([]); });
            },

            nowPlaying: function (cb) {
                Utils.request(this._url('/movie/now_playing'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || []));
                }, function () { cb([]); });
            },

            byGenre: function (genreId, cb) {
                Utils.request(this._url('/discover/movie', '&with_genres=' + genreId + '&sort_by=popularity.desc'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || []));
                }, function () { cb([]); });
            },

            byStreaming: function (providerId, cb) {
                Utils.request(this._url('/discover/movie', '&with_watch_providers=' + providerId + '&watch_region=RU&sort_by=popularity.desc'), {}, function (d) {
                    cb(Sources.tmdb._map(d.results || []));
                }, function () { cb([]); });
            },

            search: function (query, cb) {
                var encoded = encodeURIComponent(query);
                var results = [];
                var done = 0;
                var total = 2;

                function finish() {
                    done++;
                    if (done >= total) cb(results);
                }

                Utils.request(this._url('/search/movie', '&query=' + encoded), {}, function (d) {
                    results = results.concat(Sources.tmdb._map(d.results || []));
                    finish();
                }, finish);

                Utils.request(this._url('/search/tv', '&query=' + encoded), {}, function (d) {
                    results = results.concat(Sources.tmdb._map(d.results || []));
                    finish();
                }, finish);
            },

            details: function (tmdbId, type, cb) {
                Utils.request(this._url('/' + (type || 'movie') + '/' + tmdbId, '&append_to_response=credits,keywords'), {}, function (d) {
                    cb(d);
                }, function () { cb(null); });
            },

            _map: function (items) {
                var cfg = CONFIG.sources.tmdb;
                return items.map(function (it) {
                    return {
                        source: 'tmdb',
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
                        popularity: it.popularity || 0
                    };
                });
            }
        },

        /* --- Кинопоиск (Unofficial API) --- */
        kp: {
            _url: function (path, extra) {
                var cfg = CONFIG.sources.kp;
                return cfg.base_url + path + (extra || '');
            },
            _headers: function () {
                return { 'X-API-KEY': CONFIG.sources.kp.api_key };
            },

            search: function (query, cb) {
                var encoded = encodeURIComponent(query);
                Utils.request(this._url('/v2.1/films/search-by-keyword', '?keyword=' + encoded + '&page=1'), {
                    headers: this._headers()
                }, function (d) {
                    cb(Sources.kp._map(d.films || []));
                }, function () { cb([]); });
            },

            top: function (type, cb) {
                // type: TOP_250_MOVIES, TOP_100_POPULAR_FILMS, etc.
                Utils.request(this._url('/v2.2/films/top', '?type=' + (type || 'TOP_100_POPULAR_FILMS') + '&page=1'), {
                    headers: this._headers()
                }, function (d) {
                    cb(Sources.kp._map(d.films || []));
                }, function () { cb([]); });
            },

            byGenre: function (genreId, cb) {
                Utils.request(this._url('/v2.2/films', '?genres=' + genreId + '&order=RATING&type=ALL&page=1'), {
                    headers: this._headers()
                }, function (d) {
                    cb(Sources.kp._map(d.items || []));
                }, function () { cb([]); });
            },

            details: function (kpId, cb) {
                Utils.request(this._url('/v2.2/films/' + kpId), {
                    headers: this._headers()
                }, function (d) { cb(d); }, function () { cb(null); });
            },

            _map: function (items) {
                return items.map(function (it) {
                    return {
                        source: 'kp',
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
                        genre_ids: (it.genres || []).map(function (g) { return g.genre || g.id || g; }),
                        media_type: it.type === 'TV_SERIES' ? 'tv' : 'movie',
                        popularity: it.rating || 0
                    };
                });
            }
        },

        /* --- Прокси (заготовка) --- */
        proxy: {
            search: function (query, cb) {
                var base = CONFIG.sources.proxy.base_url;
                if (!base) { cb([]); return; }
                Utils.request(base + '/search?q=' + encodeURIComponent(query), {}, function (d) {
                    cb(d.results || []);
                }, function () { cb([]); });
            }
        }
    };

    /* ──────────────────────────────────────────────
       3. РЕКОМЕНДАТЕЛЬНЫЙ ДВИЖОК «ИНТЕРЕСНО ЛИЧНО ВАМ»
    ────────────────────────────────────────────── */
    var Recommender = {
        _historyKey: 'mpx_watch_history',
        _prefsKey: 'mpx_user_prefs',

        // Записать просмотр
        addWatch: function (item) {
            var history = Lampa.Storage.get(this._historyKey, []);
            history.unshift({
                tmdb_id: item.tmdb_id,
                kp_id: item.kp_id,
                title: item.title,
                genre_ids: item.genre_ids || [],
                actors: item.actors || [],
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

        // Пересчитать профиль предпочтений
        _rebuildPrefs: function () {
            var history = Lampa.Storage.get(this._historyKey, []);
            if (!history.length) return;

            var w = CONFIG.recommender.weights;
            var prefs = {
                genres: {},
                actors: {},
                tags: {},
                runtimes: [],
                ratings: [],
                years: [],
                countries: {},
                types: {}
            };

            for (var i = 0; i < history.length; i++) {
                var h = history[i];
                var recency = 1 - (i / history.length) * 0.5; // недавние важнее

                (h.genre_ids || []).forEach(function (g) {
                    prefs.genres[g] = (prefs.genres[g] || 0) + recency;
                });
                (h.actors || []).forEach(function (a) {
                    prefs.actors[a] = (prefs.actors[a] || 0) + recency;
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

            // Средние значения
            prefs.avg_runtime = prefs.runtimes.length ? Math.round(prefs.runtimes.reduce(function (a, b) { return a + b; }, 0) / prefs.runtimes.length) : 0;
            prefs.avg_rating = prefs.ratings.length ? (prefs.ratings.reduce(function (a, b) { return a + b; }, 0) / prefs.ratings.length) : 0;
            prefs.avg_year = prefs.years.length ? Math.round(prefs.years.reduce(function (a, b) { return a + b; }, 0) / prefs.years.length) : 0;

            // Топ-N
            prefs.top_genres = this._topKeys(prefs.genres, 8);
            prefs.top_actors = this._topKeys(prefs.actors, 15);
            prefs.top_tags = this._topKeys(prefs.tags, 10);
            prefs.top_countries = this._topKeys(prefs.countries, 5);

            Lampa.Storage.set(this._prefsKey, prefs);
        },

        _topKeys: function (obj, n) {
            return Object.keys(obj)
                .sort(function (a, b) { return obj[b] - obj[a]; })
                .slice(0, n);
        },

        // Оценка кандидата
        score: function (candidate) {
            var prefs = Lampa.Storage.get(this._prefsKey, null);
            if (!prefs) return 0;

            var w = CONFIG.recommender.weights;
            var s = 0;

            // Жанры
            if (candidate.genre_ids && prefs.top_genres.length) {
                var matched = 0;
                for (var i = 0; i < candidate.genre_ids.length; i++) {
                    if (prefs.top_genres.indexOf(String(candidate.genre_ids[i])) !== -1) matched++;
                }
                s += w.genre * (matched / Math.max(candidate.genre_ids.length, 1));
            }

            // Актёры
            if (candidate.actors && prefs.top_actors.length) {
                var actorMatch = 0;
                for (var j = 0; j < candidate.actors.length; j++) {
                    if (prefs.top_actors.indexOf(candidate.actors[j]) !== -1) actorMatch++;
                }
                s += w.actor * Math.min(actorMatch / 3, 1);
            }

            // Теги / ключевые слова
            if (candidate.tags && prefs.top_tags.length) {
                var tagMatch = 0;
                for (var k = 0; k < candidate.tags.length; k++) {
                    if (prefs.top_tags.indexOf(candidate.tags[k]) !== -1) tagMatch++;
                }
                s += w.tag * Math.min(tagMatch / 3, 1);
            }

            // Хронометраж (±30 мин)
            if (candidate.runtime && prefs.avg_runtime) {
                var diff = Math.abs(candidate.runtime - prefs.avg_runtime);
                s += w.runtime * Math.max(0, 1 - diff / 60);
            }

            // Рейтинг (близость к среднему)
            if (candidate.vote_average && prefs.avg_rating) {
                var rDiff = Math.abs(candidate.vote_average - prefs.avg_rating);
                s += w.rating * Math.max(0, 1 - rDiff / 3);
            }

            // Год (±10 лет)
            if (candidate.year && prefs.avg_year) {
                var yDiff = Math.abs(parseInt(candidate.year) - prefs.avg_year);
                s += w.year * Math.max(0, 1 - yDiff / 20);
            }

            // Страна
            if (candidate.country && prefs.top_countries.length) {
                if (prefs.top_countries.indexOf(candidate.country) !== -1) {
                    s += w.country;
                }
            }

            // Тип (movie/tv)
            if (candidate.media_type && prefs.types[candidate.media_type]) {
                s += w.type;
            }

            return s;
        },

        // Получить рекомендации
        getRecommendations: function (cb) {
            var self = this;
            var prefs = Lampa.Storage.get(this._prefsKey, null);

            if (!prefs || !prefs.top_genres || !prefs.top_genres.length) {
                // Нет истории — вернуть популярное
                Utils.log('Нет истории просмотров, показываю популярное');
                Sources.tmdb.popular('movie', function (movies) {
                    Sources.tmdb.popular('tv', function (tv) {
                        cb(Utils.deduplicate(movies.concat(tv)).slice(0, CONFIG.recommender.result_count));
                    });
                });
                return;
            }

            // Запрашиваем по топ-жанрам и фильтруем
            var genreQueries = prefs.top_genres.slice(0, 4);
            var allResults = [];
            var doneCount = 0;

            genreQueries.forEach(function (gid) {
                Sources.tmdb.byGenre(gid, function (items) {
                    allResults.push(items);
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

            var filtered = scored.filter(function (s) {
                return s.score >= CONFIG.recommender.min_score;
            });

            var result = filtered.map(function (s) { return s.item; });
            result = Utils.deduplicate(result).slice(0, CONFIG.recommender.result_count);

            Utils.log('Рекомендации: найдено ' + result.length + ' из ' + merged.length);
            cb(result);
        }
    };

    /* ──────────────────────────────────────────────
       4. ЕДИНЫЙ ПОИСК
    ────────────────────────────────────────────── */
    var UnifiedSearch = {
        search: function (query, cb) {
            if (!query || query.trim().length < 2) { cb([]); return; }

            var allResults = [];
            var pending = 0;
            var activeSources = [];

            // Определяем активные источники
            if (CONFIG.sources.tmdb.enabled && CONFIG.sources.tmdb.api_key) activeSources.push('tmdb');
            if (CONFIG.sources.kp.enabled && CONFIG.sources.kp.api_key) activeSources.push('kp');
            if (CONFIG.sources.proxy.enabled && CONFIG.sources.proxy.base_url) activeSources.push('proxy');

            if (!activeSources.length) {
                Utils.log('Нет активных источников для поиска!');
                cb([]);
                return;
            }

            pending = activeSources.length;

            function finish() {
                pending--;
                if (pending <= 0) {
                    var merged = Utils.deduplicate(Utils.mergeResults(allResults));
                    // Сортировка по релевантности (популярность + рейтинг)
                    merged.sort(function (a, b) {
                        var sa = (a.popularity || 0) + (a.vote_average || 0) * 10;
                        var sb = (b.popularity || 0) + (b.vote_average || 0) * 10;
                        return sb - sa;
                    });
                    Utils.log('Поиск "' + query + '": ' + merged.length + ' результатов из ' + activeSources.length + ' источников');
                    cb(merged);
                }
            }

            activeSources.forEach(function (srcName) {
                var src = Sources[srcName];
                if (src && src.search) {
                    src.search(query, function (results) {
                        allResults.push(results);
                        finish();
                    });
                } else {
                    finish();
                }
            });
        }
    };

    /* ──────────────────────────────────────────────
       5. ГЛАВНАЯ СТРАНИЦА
    ────────────────────────────────────────────── */
    var MainPage = {
        _rendered: false,

        build: function () {
            var self = this;
            Utils.log('Строим главную страницу...');

            var rows = CONFIG.rows;

            // Проверяем профиль
            var isKids = Utils.getProfileParam(CONFIG.profile_keys.kids);
            var isRus = Utils.getProfileParam(CONFIG.profile_keys.rus);

            if (isKids) {
                rows = rows.filter(function (r) { return r.type !== 'box_office'; });
            }

            rows.forEach(function (row) {
                self._buildRow(row, isKids, isRus);
            });

            this._rendered = true;
        },

        _buildRow: function (row, isKids, isRus) {
            var self = this;

            switch (row.type) {
                case 'trending':
                    Sources.tmdb.trending(function (items) {
                        self._renderRow(row, items);
                    });
                    break;

                case 'popular':
                    var popMovies = [], popTv = [];
                    Sources.tmdb.popular('movie', function (m) {
                        popMovies = m;
                        Sources.tmdb.popular('tv', function (t) {
                            popTv = t;
                            self._renderRow(row, Utils.deduplicate(Utils.mergeResults([popMovies, popTv])));
                        });
                    });
                    break;

                case 'top_rated':
                    Sources.tmdb.topRated('movie', function (items) {
                        self._renderRow(row, items);
                    });
                    break;

                case 'box_office':
                    // TMDB не имеет прямого endpoint, используем discover по revenue
                    Utils.request(
                        Sources.tmdb._url('/discover/movie', '&sort_by=revenue.desc&primary_release_date.lte=' + new Date().toISOString().split('T')[0]),
                        {},
                        function (d) { self._renderRow(row, Sources.tmdb._map(d.results || [])); },
                        function () { self._renderRow(row, []); }
                    );
                    break;

                case 'now_playing':
                    Sources.tmdb.nowPlaying(function (items) {
                        self._renderRow(row, items);
                    });
                    break;

                case 'for_you':
                    Recommender.getRecommendations(function (items) {
                        self._renderRow(row, items);
                    });
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
            var self = this;
            var streamings = CONFIG.streamings;
            var items = streamings.map(function (s) {
                return {
                    title: s.title,
                    poster: '',
                    card_type: 'streaming',
                    streaming_id: s.provider_id,
                    streaming_name: s.title
                };
            });
            self._renderRow(row, items);
        },

        _buildGenresRow: function (row) {
            var self = this;
            var genreNames = {
                28: 'Боевик', 12: 'Приключения', 16: 'Мультфильм', 35: 'Комедия',
                80: 'Криминал', 99: 'Документальный', 18: 'Драма', 10751: 'Семейный',
                14: 'Фэнтези', 36: 'История', 27: 'Ужасы', 10402: 'Музыка',
                9648: 'Детектив', 10749: 'Мелодрама', 878: 'Фантастика',
                53: 'Триллер', 10752: 'Военный', 37: 'Вестерн'
            };

            var items = CONFIG.genre_ids.map(function (id) {
                return {
                    title: genreNames[id] || ('Жанр ' + id),
                    poster: '',
                    card_type: 'genre',
                    genre_id: id
                };
            });
            self._renderRow(row, items);
        },

        _renderRow: function (row, items) {
            if (!items || !items.length) {
                Utils.log('Ряд "' + row.title + '" пуст, пропускаем');
                return;
            }

            var title = row.title;
            if (!Lampa.Storage.get('mpx_disableCustomName', false)) {
                var custom = Lampa.Storage.get('mpx_row_name_' + row.id, '');
                if (custom) title = custom;
            }

            // Формируем карточки
            var cards = items.map(function (item) {
                return {
                    title: item.title,
                    original_title: item.original_title || '',
                    poster: item.poster || '',
                    backdrop: item.backdrop || '',
                    vote_average: item.vote_average || 0,
                    year: item.year || '',
                    media_type: item.media_type || 'movie',
                    tmdb_id: item.tmdb_id,
                    kp_id: item.kp_id,
                    imdb_id: item.imdb_id,
                    source: item.source || 'tmdb',
                    card_type: item.card_type || 'card',
                    genre_id: item.genre_id,
                    streaming_id: item.streaming_id,
                    streaming_name: item.streaming_name
                };
            });

            // Рендер через Lampa Template
            var html = '<div class="mpx-row" data-row-id="' + row.id + '">';
            html += '<div class="mpx-row__title">' + title + '</div>';
            html += '<div class="mpx-row__items">';

            cards.forEach(function (card, idx) {
                html += '<div class="mpx-card" data-index="' + idx + '" data-tmdb="' + (card.tmdb_id || '') + '" data-kp="' + (card.kp_id || '') + '" data-type="' + card.card_type + '">';
                if (card.poster) {
                    html += '<img class="mpx-card__img" src="' + card.poster + '" alt="' + card.title + '" loading="lazy" />';
                } else {
                    html += '<div class="mpx-card__placeholder">' + (card.streaming_name || card.title || '') + '</div>';
                }
                html += '<div class="mpx-card__info">';
                html += '<span class="mpx-card__title">' + card.title + '</span>';
                if (card.year) html += '<span class="mpx-card__year">' + card.year + '</span>';
                if (card.vote_average) html += '<span class="mpx-card__rating">⭐ ' + card.vote_average.toFixed(1) + '</span>';
                html += '</div></div>';
            });

            html += '</div></div>';

            // Вставляем в DOM
            var container = document.querySelector('.main-page__content') ||
                            document.querySelector('.app-content') ||
                            document.querySelector('#app');

            if (container) {
                var div = document.createElement('div');
                div.innerHTML = html;
                container.appendChild(div.firstChild);
            }

            Utils.log('Ряд "' + title + '" отрисован: ' + cards.length + ' карточек');
        },

        refresh: function () {
            Utils.log('Обновление главной страницы...');
            var existing = document.querySelectorAll('.mpx-row');
            for (var i = 0; i < existing.length; i++) {
                existing[i].remove();
            }
            this._rendered = false;
            this.build();
        }
    };

    /* ──────────────────────────────────────────────
       6. ПОИСКОВЫЙ ИНТЕРФЕЙС
    ────────────────────────────────────────────── */
    var SearchUI = {
        _visible: false,

        open: function () {
            if (this._visible) return;
            this._visible = true;

            var html = '' +
                '<div class="mpx-search-overlay" id="mpx-search-overlay">' +
                '  <div class="mpx-search-box">' +
                '    <input type="text" class="mpx-search-input" id="mpx-search-input" placeholder="Поиск по всем источникам..." />' +
                '    <div class="mpx-search-results" id="mpx-search-results"></div>' +
                '  </div>' +
                '</div>';

            var div = document.createElement('div');
            div.innerHTML = html;
            document.body.appendChild(div.firstChild);

            var input = document.getElementById('mpx-search-input');
            var self = this;
            var debounceTimer = null;

            input.addEventListener('input', function () {
                clearTimeout(debounceTimer);
                var q = input.value.trim();
                if (q.length < 2) return;
                debounceTimer = setTimeout(function () {
                    self._doSearch(q);
                }, 400);
            });

            input.focus();
            Utils.log('Поиск открыт');
        },

        close: function () {
            var overlay = document.getElementById('mpx-search-overlay');
            if (overlay) overlay.remove();
            this._visible = false;
        },

        _doSearch: function (query) {
            var resultsEl = document.getElementById('mpx-search-results');
            if (!resultsEl) return;

            resultsEl.innerHTML = '<div class="mpx-search-loading">Ищем во всех источниках...</div>';

            UnifiedSearch.search(query, function (items) {
                if (!items.length) {
                    resultsEl.innerHTML = '<div class="mpx-search-empty">Ничего не найдено</div>';
                    return;
                }

                var html = '';
                items.forEach(function (item, idx) {
                    html += '<div class="mpx-search-item" data-index="' + idx + '">';
                    if (item.poster) {
                        html += '<img src="' + item.poster + '" class="mpx-search-item__poster" />';
                    }
                    html += '<div class="mpx-search-item__info">';
                    html += '<div class="mpx-search-item__title">' + item.title + '</div>';
                    html += '<div class="mpx-search-item__meta">';
                    if (item.year) html += '<span>' + item.year + '</span> ';
                    if (item.vote_average) html += '<span>⭐ ' + item.vote_average.toFixed(1) + '</span> ';
                    html += '<span class="mpx-search-item__source">[' + (item.source || '?') + ']</span>';
                    html += '</div></div></div>';
                });

                resultsEl.innerHTML = html;
                Utils.log('Поиск: показано ' + items.length + ' результатов');
            });
        }
    };

    /* ──────────────────────────────────────────────
       7. CSS СТИЛИ
    ────────────────────────────────────────────── */
    function injectStyles() {
        var css = '' +
            '.mpx-row { margin-bottom: 24px; padding: 0 20px; }' +
            '.mpx-row__title { font-size: 1.3em; font-weight: 700; margin-bottom: 12px; color: #fff; }' +
            '.mpx-row__items { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; scroll-behavior: smooth; }' +
            '.mpx-row__items::-webkit-scrollbar { height: 4px; }' +
            '.mpx-row__items::-webkit-scrollbar-thumb { background: #555; border-radius: 2px; }' +
            '.mpx-card { min-width: 150px; max-width: 150px; cursor: pointer; transition: transform 0.2s; }' +
            '.mpx-card:hover, .mpx-card:focus { transform: scale(1.08); outline: 2px solid #e50914; border-radius: 8px; }' +
            '.mpx-card__img { width: 100%; border-radius: 8px; aspect-ratio: 2/3; object-fit: cover; background: #222; }' +
            '.mpx-card__placeholder { width: 100%; aspect-ratio: 2/3; background: linear-gradient(135deg, #333, #555); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 0.9em; text-align: center; padding: 8px; }' +
            '.mpx-card__info { margin-top: 6px; }' +
            '.mpx-card__title { display: block; font-size: 0.85em; color: #eee; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }' +
            '.mpx-card__year, .mpx-card__rating { font-size: 0.75em; color: #999; margin-right: 6px; }' +
            '.mpx-search-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.92); z-index: 9999; display: flex; justify-content: center; padding-top: 60px; }' +
            '.mpx-search-box { width: 90%; max-width: 800px; }' +
            '.mpx-search-input { width: 100%; padding: 14px 20px; font-size: 1.2em; border: none; border-radius: 8px; background: #333; color: #fff; outline: none; }' +
            '.mpx-search-input::placeholder { color: #888; }' +
            '.mpx-search-results { margin-top: 16px; max-height: 70vh; overflow-y: auto; }' +
            '.mpx-search-item { display: flex; gap: 12px; padding: 10px; border-radius: 8px; cursor: pointer; transition: background 0.2s; }' +
            '.mpx-search-item:hover { background: #333; }' +
            '.mpx-search-item__poster { width: 60px; height: 90px; object-fit: cover; border-radius: 4px; background: #222; }' +
            '.mpx-search-item__title { font-size: 1em; color: #fff; }' +
            '.mpx-search-item__meta { font-size: 0.8em; color: #999; margin-top: 4px; }' +
            '.mpx-search-item__source { color: #e50914; font-weight: 600; }' +
            '.mpx-search-loading, .mpx-search-empty { text-align: center; color: #888; padding: 30px; }';

        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ──────────────────────────────────────────────
       8. ИНТЕГРАЦИЯ С LAMPA (МЕНЮ, КНОПКИ, СОБЫТИЯ)
    ────────────────────────────────────────────── */
    function integrateWithLampa() {

        // Кнопка поиска в навигации
        if (Lampa.Template && Lampa.Template.add) {
            Lampa.Template.add('mpx_search_button', '<button class="mpx-nav-search-btn">🔍 Поиск</button>');
        }

        // Перехватываем кнопку Home для обновления
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                Utils.log('Lampa готова, инициализация MULTIPLEX v' + CONFIG.version);
                injectStyles();

                // Строим главную
                setTimeout(function () {
                    MainPage.build();
                }, 500);
            }
        });

        // Обновление при нажатии Home
        Lampa.Listener.follow('activity', function (e) {
            if (e.type === 'start' && e.component === 'main') {
                if (MainPage._rendered) {
                    MainPage.refresh();
                }
            }
        });

        // Отслеживание просмотров для рекомендателя
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'start' && e.object) {
                Recommender.addWatch({
                    tmdb_id: e.object.id || e.object.tmdb_id,
                    kp_id: e.object.kp_id,
                    title: e.object.title || e.object.name,
                    genre_ids: e.object.genres ? e.object.genres.map(function (g) { return g.id; }) : [],
                    actors: e.object.actors || [],
                    tags: e.object.keywords ? e.object.keywords.map(function (k) { return k.name; }) : [],
                    runtime: e.object.runtime || 0,
                    vote_average: e.object.vote_average || 0,
                    year: (e.object.release_date || '').substring(0, 4),
                    country: e.object.country || '',
                    media_type: e.object.number_of_seasons ? 'tv' : 'movie'
                });
            }
        });

        // Горячая клавиша / кнопка для поиска
        document.addEventListener('keydown', function (e) {
            // Ctrl+F или кнопка поиска на пульте (код 19 / 83)
            if ((e.ctrlKey && e.key === 'f') || e.keyCode === 19 || e.keyCode === 83) {
                e.preventDefault();
                if (SearchUI._visible) {
                    SearchUI.close();
                } else {
                    SearchUI.open();
                }
            }
            // Escape — закрыть поиск
            if (e.keyCode === 27 && SearchUI._visible) {
                SearchUI.close();
            }
        });

        // Пункт в меню настроек Lampa
        if (Lampa.Settings && Lampa.Settings.main && Lampa.Settings.main().render) {
            try {
                var settingsHtml = '' +
                    '<div class="settings-param" data-name="mpx_settings">' +
                    '  <div class="settings-param__name">MULTIPLEX</div>' +
                    '  <div class="settings-param__value">v' + CONFIG.version + '</div>' +
                    '</div>';
                // Добавляем в DOM настроек, если возможно
                var settingsContainer = document.querySelector('.settings__body');
                if (settingsContainer) {
                    var sDiv = document.createElement('div');
                    sDiv.innerHTML = settingsHtml;
                    settingsContainer.appendChild(sDiv.firstChild);
                }
            } catch (ex) {
                Utils.log('Не удалось добавить пункт настроек:', ex);
            }
        }

        // Совместимость с profiles.js
        Lampa.Listener.follow('profile', function (e) {
            if (e.type === 'switch' || e.type === 'change') {
                Utils.log('Профиль изменён, перестраиваем главную');
                var isKids = Utils.getProfileParam(CONFIG.profile_keys.kids);
                var isRus = Utils.getProfileParam(CONFIG.profile_keys.rus);

                if (isKids) {
                    Utils.log('Детский профиль активен');
                }
                if (isRus) {
                    Utils.log('Русский профиль активен');
                }

                MainPage.refresh();
            }
        });

        Utils.log('Интеграция с Lampa завершена');
    }

    /* ──────────────────────────────────────────────
       9. ЭКСПОРТ ГЛОБАЛЬНЫХ ОБЪЕКТОВ
    ────────────────────────────────────────────── */
    window.MULTIPLEX = {
        version: CONFIG.version,
        config: CONFIG,
        sources: Sources,
        search: UnifiedSearch,
        recommender: Recommender,
        mainPage: MainPage,
        searchUI: SearchUI,
        refresh: function () { MainPage.refresh(); },
        setConfig: function (key, value) {
            CONFIG[key] = value;
            Lampa.Storage.set('mpx_config', CONFIG);
            Utils.log('Конфиг обновлён:', key, '=', value);
        }
    };

    /* ──────────────────────────────────────────────
       10. ТОЧКА ВХОДА
    ────────────────────────────────────────────── */
    function init() {
        if (Lampa.Manifest && Lampa.Manifest.app_digital >= 300) {
            if (window.appready) {
                integrateWithLampa();
            } else {
                Lampa.Listener.follow('app', function (e) {
                    if (e.type === 'ready') {
                        integrateWithLampa();
                    }
                });
            }
        } else {
            // Fallback для старых версий
            Lampa.Listener.follow('app', function (e) {
                if (e.type === 'ready') {
                    integrateWithLampa();
                }
            });
        }
    }

    init();

})();
