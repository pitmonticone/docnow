"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Database = void 0;

var _objectSpread2 = _interopRequireDefault(require("@babel/runtime/helpers/objectSpread"));

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _v = _interopRequireDefault(require("uuid/v4"));

var _elasticsearch = _interopRequireDefault(require("elasticsearch"));

var _redis = require("./redis");

var _logger = _interopRequireDefault(require("./logger"));

var _twitter = require("./twitter");

var _urlFetcher = require("./url-fetcher");

var _utils = require("./utils");

// elasticsearch doc types
var SETTINGS = 'settings';
var USER = 'user';
var PLACE = 'place';
var SEARCH = 'search';
var TREND = 'trend';
var TWEET = 'tweet';
var TWUSER = 'twuser';
var urlFetcher = new _urlFetcher.UrlFetcher();

var Database =
/*#__PURE__*/
function () {
  function Database() {
    var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    (0, _classCallCheck2["default"])(this, Database);
    // setup redis
    this.redis = (0, _redis.getRedis)(); // setup elasticsearch

    var esOpts = opts.es || {};
    esOpts.host = esOpts.host || process.env.ES_HOST || '127.0.0.1:9200';

    _logger["default"].info('connecting to elasticsearch:', esOpts);

    if (process.env.NODE_ENV === 'test') {
      this.esPrefix = 'test';
    } else {
      this.esPrefix = 'docnow';
    }

    this.es = new _elasticsearch["default"].Client(esOpts);
  }

  (0, _createClass2["default"])(Database, [{
    key: "getIndex",
    value: function getIndex(type) {
      return this.esPrefix + '-' + type;
    }
  }, {
    key: "close",
    value: function close() {
      this.redis.quit();
      urlFetcher.stop();
    }
  }, {
    key: "clear",
    value: function clear() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this.redis.flushdbAsync().then(function (didSucceed) {
          if (didSucceed === 'OK') {
            _this.deleteIndexes().then(resolve)["catch"](reject);
          } else {
            reject('redis flushdb failed');
          }
        });
      });
    }
  }, {
    key: "add",
    value: function add(type, id, doc) {
      var _this2 = this;

      _logger["default"].debug("update ".concat(type, " ").concat(id), doc);

      return new Promise(function (resolve, reject) {
        _this2.es.index({
          index: _this2.getIndex(type),
          type: type,
          id: id,
          body: doc,
          refresh: 'wait_for'
        }).then(function () {
          resolve(doc);
        })["catch"](reject);
      });
    }
  }, {
    key: "get",
    value: function get(type, id) {
      var _this3 = this;

      _logger["default"].debug("get type=".concat(type, " id=").concat(id));

      return new Promise(function (resolve, reject) {
        _this3.es.get({
          index: _this3.getIndex(type),
          type: type,
          id: id
        }).then(function (result) {
          resolve(result._source);
        })["catch"](function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: "search",
    value: function search(type, q) {
      var _this4 = this;

      var first = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

      _logger["default"].debug('search', type, q, first);

      var size = first ? 1 : 1000;
      return new Promise(function (resolve, reject) {
        _this4.es.search({
          index: _this4.getIndex(type),
          type: type,
          q: q,
          size: size
        }).then(function (result) {
          if (result.hits.total > 0) {
            if (first) {
              resolve(result.hits.hits[0]._source);
            } else {
              resolve(result.hits.hits.map(function (h) {
                return h._source;
              }));
            }
          } else if (first) {
            resolve(null);
          } else {
            resolve([]);
          }
        })["catch"](reject);
      });
    }
  }, {
    key: "addSettings",
    value: function addSettings(settings) {
      return this.add(SETTINGS, 'settings', settings);
    }
  }, {
    key: "getSettings",
    value: function getSettings() {
      var _this5 = this;

      return new Promise(function (resolve) {
        _this5.get(SETTINGS, 'settings').then(function (settings) {
          resolve(settings);
        })["catch"](function () {
          resolve({});
        });
      });
    }
  }, {
    key: "addUser",
    value: function addUser(user) {
      var _this6 = this;

      user.id = (0, _v["default"])();
      user.places = [];

      _logger["default"].info('creating user: ', {
        user: user
      });

      return new Promise(function (resolve) {
        _this6.getSuperUser().then(function (u) {
          user.isSuperUser = u ? false : true;

          _this6.add(USER, user.id, user).then(function () {
            if (user.isSuperUser) {
              _this6.loadPlaces().then(function () {
                resolve(user);
              });
            } else {
              resolve(user);
            }
          });
        });
      });
    }
  }, {
    key: "updateUser",
    value: function updateUser(user) {
      return this.add(USER, user.id, user);
    }
  }, {
    key: "getUser",
    value: function getUser(userId) {
      return this.get(USER, userId);
    }
  }, {
    key: "getUsers",
    value: function getUsers() {
      return this.search(USER, '*');
    }
  }, {
    key: "getSuperUser",
    value: function getSuperUser() {
      return this.search(USER, 'isSuperUser:true', true);
    }
  }, {
    key: "getUserByTwitterUserId",
    value: function getUserByTwitterUserId(twitterUserId) {
      return this.search(USER, "twitterUserId:".concat(twitterUserId), true);
    }
  }, {
    key: "getUserByTwitterScreenName",
    value: function getUserByTwitterScreenName(twitterScreenName) {
      return this.search(USER, "twitterScreenName:".concat(twitterScreenName), true);
    }
  }, {
    key: "importLatestTrends",
    value: function importLatestTrends() {
      var _this7 = this;

      _logger["default"].debug('importing trends');

      return new Promise(function (resolve) {
        _this7.getUsers().then(function (users) {
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = users[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var user = _step.value;

              _this7.importLatestTrendsForUser(user).then(resolve);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator["return"] != null) {
                _iterator["return"]();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        })["catch"](function () {
          _logger["default"].info('no users to import trends for');

          resolve();
        });
      });
    }
  }, {
    key: "importLatestTrendsForUser",
    value: function importLatestTrendsForUser(user) {
      var _this8 = this;

      _logger["default"].debug('importing trends', {
        user: user
      });

      return new Promise(function (resolve, reject) {
        _this8.getTwitterClientForUser(user).then(function (twtr) {
          var placeIds = user.places.map(_utils.stripPrefix);

          if (placeIds.length === 0) {
            resolve([]);
          } else {
            _logger["default"].info('importing trends for ', {
              placeIds: placeIds
            });

            Promise.all(placeIds.map(twtr.getTrendsAtPlace, twtr)).then(_this8.saveTrends.bind(_this8)).then(resolve);
          }
        })["catch"](reject);
      });
    }
  }, {
    key: "startTrendsWatcher",
    value: function startTrendsWatcher() {
      var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _logger["default"].info('starting trend watcher');

      this.importLatestTrends();
      this.trendsWatcherId = setInterval(this.importLatestTrends.bind(this), opts.interval || 60 * 1000);
    }
  }, {
    key: "stopTrendsWatcher",
    value: function stopTrendsWatcher() {
      _logger["default"].info('stopping trend watcher');

      if (this.trendsWatcherId) {
        clearInterval(this.trendsWatcherId);
        this.trendsWatcherId = null;
      }
    }
  }, {
    key: "getTrendsForPlace",
    value: function getTrendsForPlace(placeId) {
      var _this9 = this;

      return new Promise(function (resolve) {
        _this9.search('trend', "placeId:".concat(placeId), true).then(function (results) {
          var filtered = results.trends.filter(function (t) {
            return t.tweets > 0;
          });
          filtered.sort(function (a, b) {
            return b.tweets - a.tweets;
          });
          results.trends = filtered;
          resolve(results);
        });
      });
    }
  }, {
    key: "getUserTrends",
    value: function getUserTrends(user) {
      if (user && user.places) {
        return Promise.all(user.places.map(this.getTrendsForPlace, this));
      }
    }
  }, {
    key: "saveTrends",
    value: function saveTrends(trends) {
      var _this10 = this;

      var body = [];
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = trends[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var trend = _step2.value;
          trend.id = (0, _utils.addPrefix)('trend', trend.id);
          trend.placeId = (0, _utils.addPrefix)('place', (0, _utils.stripPrefix)(trend.id));
          body.push({
            index: {
              _index: this.getIndex(TREND),
              _type: 'trend',
              _id: trend.id
            },
            refresh: 'wait_for'
          }, trend);
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2["return"] != null) {
            _iterator2["return"]();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      return new Promise(function (resolve, reject) {
        _this10.es.bulk({
          body: body,
          refresh: 'wait_for'
        }).then(function () {
          resolve(trends);
        })["catch"](function (err) {
          _logger["default"].error('bulk insert failed', err);

          reject(err);
        });
      });
    }
  }, {
    key: "loadPlaces",
    value: function loadPlaces() {
      var _this11 = this;

      return new Promise(function (resolve, reject) {
        _this11.getSuperUser().then(function (user) {
          _this11.getTwitterClientForUser(user).then(function (t) {
            t.getPlaces().then(function (places) {
              // bulk insert all the places as separate
              // documents in elasticsearch
              var body = [];
              var _iteratorNormalCompletion3 = true;
              var _didIteratorError3 = false;
              var _iteratorError3 = undefined;

              try {
                for (var _iterator3 = places[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                  var place = _step3.value;
                  place.id = (0, _utils.addPrefix)('place', place.id);
                  place.parentId = (0, _utils.addPrefix)('place', place.parent);
                  delete place.parent;
                  body.push({
                    index: {
                      _index: _this11.getIndex(PLACE),
                      _type: 'place',
                      _id: place.id
                    }
                  });
                  body.push(place);
                }
              } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion3 && _iterator3["return"] != null) {
                    _iterator3["return"]();
                  }
                } finally {
                  if (_didIteratorError3) {
                    throw _iteratorError3;
                  }
                }
              }

              _this11.es.bulk({
                body: body,
                refresh: 'wait_for'
              }).then(function () {
                resolve(places);
              })["catch"](reject);
            });
          })["catch"](reject);
        })["catch"](reject);
      });
    }
  }, {
    key: "getPlace",
    value: function getPlace(placeId) {
      return this.search(PLACE, placeId, true);
    }
  }, {
    key: "getPlaces",
    value: function getPlaces() {
      return this.search(PLACE, '*');
    }
  }, {
    key: "getTwitterClientForUser",
    value: function getTwitterClientForUser(user) {
      var _this12 = this;

      return new Promise(function (resolve) {
        _this12.getSettings().then(function (settings) {
          resolve(new _twitter.Twitter({
            consumerKey: settings.appKey,
            consumerSecret: settings.appSecret,
            accessToken: user.twitterAccessToken,
            accessTokenSecret: user.twitterAccessTokenSecret
          }));
        });
      });
    }
  }, {
    key: "createSearch",
    value: function createSearch(user, query) {
      var _this13 = this;

      return new Promise(function (resolve, reject) {
        var search = {
          id: (0, _v["default"])(),
          creator: user.id,
          query: query,
          created: new Date().toISOString(),
          updated: new Date(),
          maxTweetId: null,
          active: true
        };

        _this13.es.create({
          index: _this13.getIndex(SEARCH),
          type: SEARCH,
          id: search.id,
          body: search
        }).then(function () {
          resolve(search);
        })["catch"](function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: "deleteSearch",
    value: function () {
      var _deleteSearch = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee(search) {
        var resp;
        return _regenerator["default"].wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                _logger["default"].info('deleting search', {
                  id: search.id
                });

                _context.next = 3;
                return this.es["delete"]({
                  index: this.getIndex(SEARCH),
                  type: SEARCH,
                  id: search.id
                });

              case 3:
                resp = _context.sent;
                return _context.abrupt("return", resp && resp.result === 'deleted');

              case 5:
              case "end":
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function deleteSearch(_x) {
        return _deleteSearch.apply(this, arguments);
      }

      return deleteSearch;
    }()
  }, {
    key: "getUserSearches",
    value: function () {
      var _getUserSearches = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee2(user) {
        var body, resp, searches, _iteratorNormalCompletion4, _didIteratorError4, _iteratorError4, _iterator4, _step4, hit, search, stats;

        return _regenerator["default"].wrap(function _callee2$(_context2) {
          while (1) {
            switch (_context2.prev = _context2.next) {
              case 0:
                // const body = {query: {match: {creator: user.id, saved: true}}}
                body = {
                  query: {
                    bool: {
                      must: [{
                        match: {
                          creator: user.id
                        }
                      }, {
                        match: {
                          saved: true
                        }
                      }]
                    }
                  },
                  sort: [{
                    created: 'desc'
                  }]
                };
                _context2.next = 3;
                return this.es.search({
                  index: this.getIndex(SEARCH),
                  type: SEARCH,
                  body: body
                });

              case 3:
                resp = _context2.sent;
                searches = [];
                _iteratorNormalCompletion4 = true;
                _didIteratorError4 = false;
                _iteratorError4 = undefined;
                _context2.prev = 8;
                _iterator4 = resp.hits.hits[Symbol.iterator]();

              case 10:
                if (_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done) {
                  _context2.next = 20;
                  break;
                }

                hit = _step4.value;
                search = hit._source;
                _context2.next = 15;
                return this.getSearchStats(search);

              case 15:
                stats = _context2.sent;
                searches.push((0, _objectSpread2["default"])({}, search, stats));

              case 17:
                _iteratorNormalCompletion4 = true;
                _context2.next = 10;
                break;

              case 20:
                _context2.next = 26;
                break;

              case 22:
                _context2.prev = 22;
                _context2.t0 = _context2["catch"](8);
                _didIteratorError4 = true;
                _iteratorError4 = _context2.t0;

              case 26:
                _context2.prev = 26;
                _context2.prev = 27;

                if (!_iteratorNormalCompletion4 && _iterator4["return"] != null) {
                  _iterator4["return"]();
                }

              case 29:
                _context2.prev = 29;

                if (!_didIteratorError4) {
                  _context2.next = 32;
                  break;
                }

                throw _iteratorError4;

              case 32:
                return _context2.finish(29);

              case 33:
                return _context2.finish(26);

              case 34:
                return _context2.abrupt("return", searches);

              case 35:
              case "end":
                return _context2.stop();
            }
          }
        }, _callee2, this, [[8, 22, 26, 34], [27,, 29, 33]]);
      }));

      function getUserSearches(_x2) {
        return _getUserSearches.apply(this, arguments);
      }

      return getUserSearches;
    }()
  }, {
    key: "getSearch",
    value: function () {
      var _getSearch = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee3(searchId) {
        var search, stats;
        return _regenerator["default"].wrap(function _callee3$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _context3.next = 2;
                return this.get(SEARCH, searchId);

              case 2:
                search = _context3.sent;
                _context3.next = 5;
                return this.getSearchStats(search);

              case 5:
                stats = _context3.sent;
                return _context3.abrupt("return", (0, _objectSpread2["default"])({}, search, stats));

              case 7:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee3, this);
      }));

      function getSearch(_x3) {
        return _getSearch.apply(this, arguments);
      }

      return getSearch;
    }()
  }, {
    key: "updateSearch",
    value: function updateSearch(search) {
      search.updated = new Date();
      return this.add(SEARCH, search.id, search);
    }
  }, {
    key: "getSearchSummary",
    value: function () {
      var _getSearchSummary = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee4(search) {
        var body, resp, stats;
        return _regenerator["default"].wrap(function _callee4$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                body = {
                  query: {
                    match: {
                      search: search.id
                    }
                  },
                  aggregations: {
                    minDate: {
                      min: {
                        field: 'created'
                      }
                    },
                    maxDate: {
                      max: {
                        field: 'created'
                      }
                    }
                  }
                };
                _context4.next = 3;
                return this.es.search({
                  index: this.getIndex(TWEET),
                  type: TWEET,
                  body: body
                });

              case 3:
                resp = _context4.sent;
                _context4.next = 6;
                return this.getSearchStats(search);

              case 6:
                stats = _context4.sent;
                return _context4.abrupt("return", (0, _objectSpread2["default"])({}, search, stats, {
                  minDate: new Date(resp.aggregations.minDate.value),
                  maxDate: new Date(resp.aggregations.maxDate.value)
                }));

              case 8:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee4, this);
      }));

      function getSearchSummary(_x4) {
        return _getSearchSummary.apply(this, arguments);
      }

      return getSearchSummary;
    }()
  }, {
    key: "getSearchStats",
    value: function () {
      var _getSearchStats = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee5(search) {
        var tweetCount, userCount, videoCount, imageCount, urlCount;
        return _regenerator["default"].wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.next = 2;
                return this.redis.getAsync((0, _redis.tweetsCountKey)(search));

              case 2:
                tweetCount = _context5.sent;
                _context5.next = 5;
                return this.redis.zcardAsync((0, _redis.usersCountKey)(search));

              case 5:
                userCount = _context5.sent;
                _context5.next = 8;
                return this.redis.zcardAsync((0, _redis.videosCountKey)(search));

              case 8:
                videoCount = _context5.sent;
                _context5.next = 11;
                return this.redis.zcardAsync((0, _redis.imagesCountKey)(search));

              case 11:
                imageCount = _context5.sent;
                _context5.next = 14;
                return this.redis.zcardAsync((0, _redis.urlsKey)(search));

              case 14:
                urlCount = _context5.sent;
                return _context5.abrupt("return", {
                  tweetCount: parseInt(tweetCount || 0, 10),
                  imageCount: imageCount,
                  videoCount: videoCount,
                  userCount: userCount,
                  urlCount: urlCount
                });

              case 16:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, this);
      }));

      function getSearchStats(_x5) {
        return _getSearchStats.apply(this, arguments);
      }

      return getSearchStats;
    }()
  }, {
    key: "importFromSearch",
    value: function importFromSearch(search) {
      var _this14 = this;

      var maxTweets = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 1000;
      var count = 0;
      var totalCount = search.count || 0;
      var maxTweetId = null;
      var queryParts = [];
      var _iteratorNormalCompletion5 = true;
      var _didIteratorError5 = false;
      var _iteratorError5 = undefined;

      try {
        for (var _iterator5 = search.query[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
          var term = _step5.value;

          if (term.type === 'keyword') {
            queryParts.push(term.value);
          } else if (term.type === 'user') {
            queryParts.push('@' + term.value);
          } else if (term.type === 'phrase') {
            queryParts.push("\"".concat(term.value, "\""));
          } else if (term.type === 'hashtag') {
            queryParts.push(term.value);
          } else {
            _logger["default"].warn('search is missing a type: ', search);

            queryParts.push(term.value);
          }
        }
      } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion5 && _iterator5["return"] != null) {
            _iterator5["return"]();
          }
        } finally {
          if (_didIteratorError5) {
            throw _iteratorError5;
          }
        }
      }

      var q = queryParts.join(' OR ');
      return new Promise(function (resolve, reject) {
        _this14.getUser(search.creator).then(function (user) {
          _this14.updateSearch((0, _objectSpread2["default"])({}, search, {
            active: true
          })).then(function (newSearch) {
            _this14.getTwitterClientForUser(user).then(function (twtr) {
              twtr.search({
                q: q,
                sinceId: search.maxTweetId,
                count: maxTweets
              }, function (err, results) {
                if (err) {
                  reject(err);
                } else if (results.length === 0) {
                  newSearch.count = totalCount;
                  newSearch.maxTweetId = maxTweetId;
                  newSearch.active = false;

                  _this14.updateSearch(newSearch).then(function () {
                    resolve(count);
                  });
                } else {
                  count += results.length;
                  totalCount += results.length;

                  if (maxTweetId === null) {
                    maxTweetId = results[0].id;
                  }

                  _this14.loadTweets(search, results).then(function () {
                    _logger["default"].info('bulk loaded ' + results.items + ' objects');
                  });
                }
              });
            });
          })["catch"](function (e) {
            _logger["default"].error('unable to update search: ', e);
          });
        });
      });
    }
  }, {
    key: "loadTweets",
    value: function loadTweets(search, tweets) {
      var _this15 = this;

      return new Promise(function (resolve, reject) {
        var bulk = [];
        var seenUsers = new Set();
        var _iteratorNormalCompletion6 = true;
        var _didIteratorError6 = false;
        var _iteratorError6 = undefined;

        try {
          for (var _iterator6 = tweets[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var tweet = _step6.value;

            _this15.tallyTweet(search, tweet);

            var _iteratorNormalCompletion7 = true;
            var _didIteratorError7 = false;
            var _iteratorError7 = undefined;

            try {
              for (var _iterator7 = tweet.urls[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                var url = _step7.value;
                urlFetcher.add(search, url["long"], tweet.id);
              }
            } catch (err) {
              _didIteratorError7 = true;
              _iteratorError7 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion7 && _iterator7["return"] != null) {
                  _iterator7["return"]();
                }
              } finally {
                if (_didIteratorError7) {
                  throw _iteratorError7;
                }
              }
            }

            tweet.search = search.id;
            var id = search.id + ':' + tweet.id;
            bulk.push({
              index: {
                _index: _this15.getIndex(TWEET),
                _type: 'tweet',
                _id: id
              }
            }, tweet);

            if (!seenUsers.has(tweet.user.id)) {
              bulk.push({
                index: {
                  _index: _this15.getIndex(TWUSER),
                  _type: 'twuser',
                  _id: tweet.user.id
                }
              }, tweet.user);
              seenUsers.add(tweet.user.id);
            }
          }
        } catch (err) {
          _didIteratorError6 = true;
          _iteratorError6 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion6 && _iterator6["return"] != null) {
              _iterator6["return"]();
            }
          } finally {
            if (_didIteratorError6) {
              throw _iteratorError6;
            }
          }
        }

        _this15.es.bulk({
          body: bulk,
          refresh: 'wait_for'
        }).then(function (resp) {
          if (resp.errors) {
            reject('indexing error check elasticsearch log');
          } else {
            resolve(resp);
          }
        })["catch"](function (elasticErr) {
          _logger["default"].error(elasticErr.message);

          reject(elasticErr.message);
        });
      });
    }
  }, {
    key: "tallyTweet",
    value: function tallyTweet(search, tweet) {
      this.redis.incr((0, _redis.tweetsCountKey)(search));
      this.redis.zincrby((0, _redis.usersCountKey)(search), 1, tweet.user.screenName);
      var _iteratorNormalCompletion8 = true;
      var _didIteratorError8 = false;
      var _iteratorError8 = undefined;

      try {
        for (var _iterator8 = tweet.videos[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
          var video = _step8.value;
          this.redis.zincrby((0, _redis.videosCountKey)(search), 1, video);
        }
      } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion8 && _iterator8["return"] != null) {
            _iterator8["return"]();
          }
        } finally {
          if (_didIteratorError8) {
            throw _iteratorError8;
          }
        }
      }

      var _iteratorNormalCompletion9 = true;
      var _didIteratorError9 = false;
      var _iteratorError9 = undefined;

      try {
        for (var _iterator9 = tweet.images[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
          var image = _step9.value;
          this.redis.zincrby((0, _redis.imagesCountKey)(search), 1, image);
        }
      } catch (err) {
        _didIteratorError9 = true;
        _iteratorError9 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion9 && _iterator9["return"] != null) {
            _iterator9["return"]();
          }
        } finally {
          if (_didIteratorError9) {
            throw _iteratorError9;
          }
        }
      }
    }
  }, {
    key: "getTweets",
    value: function getTweets(search) {
      var _this16 = this;

      var includeRetweets = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
      var body = {
        from: offset,
        size: 100,
        query: {
          bool: {
            must: {
              term: {
                search: search.id
              }
            }
          }
        },
        sort: {
          created: 'desc'
        } // adjust the query and sorting if they don't want retweets

      };

      if (!includeRetweets) {
        body.query.bool.must_not = {
          exists: {
            field: 'retweet'
          }
        };
        body.sort = [{
          retweetCount: 'desc'
        }, {
          created: 'desc'
        }];
      }

      return new Promise(function (resolve, reject) {
        _this16.es.search({
          index: _this16.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          resolve(response.hits.hits.map(function (h) {
            return h._source;
          }));
        })["catch"](function (err) {
          _logger["default"].error(err);

          reject(err);
        });
      });
    }
  }, {
    key: "getAllTweets",
    value: function () {
      var _getAllTweets = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee6(search, cb) {
        var response, scrollId;
        return _regenerator["default"].wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                _context6.next = 2;
                return this.es.search({
                  index: this.getIndex(TWEET),
                  type: TWEET,
                  q: 'search:' + search.id,
                  scroll: '1m',
                  size: 100
                });

              case 2:
                response = _context6.sent;
                response.hits.hits.map(function (hit) {
                  cb(hit._source);
                });
                scrollId = response._scroll_id;

              case 5:
                if (!true) {
                  _context6.next = 14;
                  break;
                }

                _context6.next = 8;
                return this.es.scroll({
                  scrollId: scrollId,
                  scroll: '1m'
                });

              case 8:
                response = _context6.sent;

                if (!(response.hits.hits.length === 0)) {
                  _context6.next = 11;
                  break;
                }

                return _context6.abrupt("break", 14);

              case 11:
                response.hits.hits.map(function (hit) {
                  cb(hit._source);
                });
                _context6.next = 5;
                break;

              case 14:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, this);
      }));

      function getAllTweets(_x6, _x7) {
        return _getAllTweets.apply(this, arguments);
      }

      return getAllTweets;
    }()
  }, {
    key: "getTweetsForUrl",
    value: function () {
      var _getTweetsForUrl = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee7(search, url) {
        var ids, body, resp;
        return _regenerator["default"].wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.next = 2;
                return urlFetcher.getTweetIdentifiers(search, url);

              case 2:
                ids = _context7.sent;
                body = {
                  size: 100,
                  query: {
                    bool: {
                      must: [{
                        match: {
                          search: search.id
                        }
                      }],
                      filter: {
                        terms: {
                          id: ids
                        }
                      }
                    }
                  },
                  sort: [{
                    id: 'desc'
                  }]
                };
                _context7.next = 6;
                return this.es.search({
                  index: this.getIndex(TWEET),
                  type: TWEET,
                  body: body
                });

              case 6:
                resp = _context7.sent;
                return _context7.abrupt("return", resp.hits.hits.map(function (h) {
                  return h._source;
                }));

              case 8:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, this);
      }));

      function getTweetsForUrl(_x8, _x9) {
        return _getTweetsForUrl.apply(this, arguments);
      }

      return getTweetsForUrl;
    }()
  }, {
    key: "getTwitterUsers",
    value: function getTwitterUsers(search) {
      var _this17 = this;

      // first get the user counts for tweets
      var body = {
        query: {
          match: {
            search: search.id
          }
        },
        aggregations: {
          users: {
            terms: {
              field: 'user.screenName',
              size: 100
            }
          }
        }
      };
      return new Promise(function (resolve, reject) {
        _this17.es.search({
          index: _this17.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response1) {
          // with the list of users get the user information for them
          var counts = new Map();
          var buckets = response1.aggregations.users.buckets;
          buckets.map(function (c) {
            counts.set(c.key, c.doc_count);
          });
          var screenNames = Array.from(counts.keys());
          body = {
            size: 100,
            query: {
              constant_score: {
                filter: {
                  terms: {
                    'screenName': screenNames
                  }
                }
              }
            }
          };

          _this17.es.search({
            index: _this17.getIndex(TWUSER),
            type: TWUSER,
            body: body
          }).then(function (response2) {
            var users = response2.hits.hits.map(function (h) {
              return h._source;
            }); // add the tweet counts per user that we got previously

            var _iteratorNormalCompletion10 = true;
            var _didIteratorError10 = false;
            var _iteratorError10 = undefined;

            try {
              for (var _iterator10 = users[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
                var user = _step10.value;
                user.tweetsInSearch = counts.get(user.screenName);
              } // sort them by their counts

            } catch (err) {
              _didIteratorError10 = true;
              _iteratorError10 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion10 && _iterator10["return"] != null) {
                  _iterator10["return"]();
                }
              } finally {
                if (_didIteratorError10) {
                  throw _iteratorError10;
                }
              }
            }

            users.sort(function (a, b) {
              return b.tweetsInSearch - a.tweetsInSearch;
            });
            resolve(users);
          });
        })["catch"](function (err) {
          _logger["default"].error(err);

          reject(err);
        });
      });
    }
  }, {
    key: "getHashtags",
    value: function getHashtags(search) {
      var _this18 = this;

      var body = {
        size: 0,
        query: {
          match: {
            search: search.id
          }
        },
        aggregations: {
          hashtags: {
            terms: {
              field: 'hashtags',
              size: 100
            }
          }
        }
      };
      return new Promise(function (resolve, reject) {
        _this18.es.search({
          index: _this18.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var hashtags = response.aggregations.hashtags.buckets.map(function (ht) {
            return {
              hashtag: ht.key,
              count: ht.doc_count
            };
          });
          resolve(hashtags);
        })["catch"](function (err) {
          _logger["default"].error(err);

          reject(err);
        });
      });
    }
  }, {
    key: "getUrls",
    value: function getUrls(search) {
      var _this19 = this;

      var body = {
        size: 0,
        query: {
          match: {
            search: search.id
          }
        },
        aggregations: {
          urls: {
            terms: {
              field: 'urls.long',
              size: 100
            }
          }
        }
      };
      return new Promise(function (resolve, reject) {
        _this19.es.search({
          index: _this19.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var urls = response.aggregations.urls.buckets.map(function (u) {
            return {
              url: u.key,
              count: u.doc_count
            };
          });
          resolve(urls);
        })["catch"](function (err) {
          _logger["default"].error(err);

          reject(err);
        });
      });
    }
  }, {
    key: "getImages",
    value: function getImages(search) {
      var _this20 = this;

      var body = {
        size: 0,
        query: {
          match: {
            search: search.id
          }
        },
        aggregations: {
          images: {
            terms: {
              field: 'images',
              size: 100
            }
          }
        }
      };
      return new Promise(function (resolve, reject) {
        _this20.es.search({
          index: _this20.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var images = response.aggregations.images.buckets.map(function (u) {
            return {
              url: u.key,
              count: u.doc_count
            };
          });
          resolve(images);
        })["catch"](function (err) {
          _logger["default"].error(err);

          reject(err);
        });
      });
    }
  }, {
    key: "getVideos",
    value: function getVideos(search) {
      var _this21 = this;

      var body = {
        size: 0,
        query: {
          match: {
            search: search.id
          }
        },
        aggregations: {
          videos: {
            terms: {
              field: 'videos',
              size: 100
            }
          }
        }
      };
      return new Promise(function (resolve, reject) {
        _this21.es.search({
          index: _this21.getIndex(TWEET),
          type: TWEET,
          body: body
        }).then(function (response) {
          var videos = response.aggregations.videos.buckets.map(function (u) {
            return {
              url: u.key,
              count: u.doc_count
            };
          });
          resolve(videos);
        })["catch"](function (err) {
          _logger["default"].error(err);

          reject(err);
        });
      });
    }
  }, {
    key: "addUrl",
    value: function addUrl(search, url) {
      var job = {
        url: url,
        search: search
      };
      return this.redis.lpushAsync('urlqueue', JSON.stringify(job));
    }
  }, {
    key: "processUrl",
    value: function processUrl() {
      var _this22 = this;

      return new Promise(function (resolve, reject) {
        _this22.redis.blpopAsync('urlqueue', 0).then(function (result) {
          var job = JSON.parse(result[1]);
          resolve({
            url: job.url,
            title: 'Twitter'
          });
        })["catch"](function (err) {
          reject(err);
        });
      });
    }
  }, {
    key: "getWebpages",
    value: function getWebpages(search) {
      var start = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      var limit = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 100;
      return urlFetcher.getWebpages(search, start, limit);
    }
  }, {
    key: "queueStats",
    value: function queueStats(search) {
      return urlFetcher.queueStats(search);
    }
  }, {
    key: "selectWebpage",
    value: function selectWebpage(search, url) {
      return urlFetcher.selectWebpage(search, url);
    }
  }, {
    key: "deselectWebpage",
    value: function deselectWebpage(search, url) {
      return urlFetcher.deselectWebpage(search, url);
    }
    /* elastic search index management */

  }, {
    key: "setupIndexes",
    value: function setupIndexes() {
      var _this23 = this;

      return this.es.indices.exists({
        index: this.getIndex(TWEET)
      }).then(function (exists) {
        if (!exists) {
          _logger["default"].info('adding indexes');

          _this23.addIndexes();
        } else {
          _logger["default"].warn('indexes already present, not adding');
        }
      })["catch"](function (e) {
        _logger["default"].error(e);
      });
    }
  }, {
    key: "addIndexes",
    value: function addIndexes() {
      var indexMappings = this.getIndexMappings();
      var promises = [];

      for (var _i = 0, _Object$keys = Object.keys(indexMappings); _i < _Object$keys.length; _i++) {
        var name = _Object$keys[_i];
        promises.push(this.addIndex(name, indexMappings[name]));
      }

      return Promise.all(promises);
    }
  }, {
    key: "addIndex",
    value: function addIndex(name, map) {
      var prefixedName = this.getIndex(name);
      var body = {
        mappings: {}
      };
      body.mappings[name] = map;

      _logger["default"].info("creating index: ".concat(prefixedName));

      return this.es.indices.create({
        index: prefixedName,
        body: body
      });
    }
  }, {
    key: "updateIndexes",
    value: function updateIndexes() {
      var indexMappings = this.getIndexMappings();
      var promises = [];

      for (var _i2 = 0, _Object$keys2 = Object.keys(indexMappings); _i2 < _Object$keys2.length; _i2++) {
        var name = _Object$keys2[_i2];
        promises.push(this.updateIndex(name, indexMappings[name]));
      }

      return Promise.all(promises);
    }
  }, {
    key: "updateIndex",
    value: function updateIndex(name, map) {
      var prefixedName = this.getIndex(name);

      _logger["default"].info("updating index: ".concat(prefixedName));

      return this.es.indices.putMapping({
        index: prefixedName,
        type: name,
        body: map
      });
    }
  }, {
    key: "deleteIndexes",
    value: function deleteIndexes() {
      var _this24 = this;

      _logger["default"].info('deleting all elasticsearch indexes');

      return new Promise(function (resolve) {
        _this24.es.indices["delete"]({
          index: _this24.esPrefix + '*'
        }).then(function () {
          _logger["default"].info('deleted indexes');

          resolve();
        })["catch"](function (err) {
          _logger["default"].warn('indexes delete failed: ' + err);

          resolve();
        });
      });
    }
  }, {
    key: "getIndexMappings",
    value: function getIndexMappings() {
      return {
        settings: {
          properties: {
            type: {
              type: 'keyword'
            },
            appKey: {
              type: 'keyword'
            },
            appSecret: {
              type: 'keyword'
            }
          }
        },
        user: {
          properties: {
            type: {
              type: 'keyword'
            },
            places: {
              type: 'keyword'
            }
          }
        },
        search: {
          properties: {
            id: {
              type: 'keyword'
            },
            type: {
              type: 'keyword'
            },
            title: {
              type: 'text'
            },
            description: {
              type: 'text'
            },
            created: {
              type: 'date',
              format: 'date_time'
            },
            creator: {
              type: 'keyword'
            },
            active: {
              type: 'boolean'
            },
            saved: {
              type: 'boolean'
            },
            'query.type': {
              type: 'keyword'
            },
            'query.value': {
              type: 'keyword'
            }
          }
        },
        place: {
          properties: {
            id: {
              type: 'keyword'
            },
            type: {
              type: 'keyword'
            },
            name: {
              type: 'text'
            },
            country: {
              type: 'text'
            },
            countryCode: {
              type: 'keyword'
            },
            parentId: {
              type: 'keyword'
            }
          }
        },
        trend: {
          properties: {
            id: {
              type: 'keyword'
            },
            type: {
              type: 'keyword'
            },
            'trends.name': {
              type: 'keyword'
            },
            'trends.tweets': {
              type: 'integer'
            }
          }
        },
        twuser: {
          properties: {
            id: {
              type: 'keyword'
            },
            type: {
              type: 'keyword'
            },
            screenName: {
              type: 'keyword'
            },
            created: {
              type: 'date',
              format: 'date_time'
            },
            updated: {
              type: 'date',
              format: 'date_time'
            }
          }
        },
        tweet: {
          properties: {
            id: {
              type: 'keyword'
            },
            type: {
              type: 'keyword'
            },
            search: {
              type: 'keyword'
            },
            retweetCount: {
              type: 'integer'
            },
            likeCount: {
              type: 'integer'
            },
            created: {
              type: 'date',
              format: 'date_time'
            },
            client: {
              type: 'keyword'
            },
            hashtags: {
              type: 'keyword'
            },
            mentions: {
              type: 'keyword'
            },
            geo: {
              type: 'geo_shape'
            },
            videos: {
              type: 'keyword'
            },
            images: {
              type: 'keyword'
            },
            animatedGifs: {
              type: 'keyword'
            },
            emojis: {
              type: 'keyword'
            },
            country: {
              type: 'keyword'
            },
            countryCode: {
              type: 'keyword'
            },
            boundingBox: {
              type: 'geo_shape'
            },
            'urls.short': {
              type: 'keyword'
            },
            'urls.long': {
              type: 'keyword'
            },
            'urls.hostname': {
              type: 'keyword'
            },
            'user.screenName': {
              type: 'keyword'
            },
            'quote.user.screenName': {
              type: 'keyword'
            },
            'retweet.user.screenName': {
              type: 'keyword'
            }
          }
        }
      };
    }
  }, {
    key: "mergeIndexes",
    value: function () {
      var _mergeIndexes = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee8() {
        var results;
        return _regenerator["default"].wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _context8.next = 2;
                return this.es.indices.forcemerge({
                  index: '_all'
                });

              case 2:
                results = _context8.sent;
                return _context8.abrupt("return", results);

              case 4:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, this);
      }));

      function mergeIndexes() {
        return _mergeIndexes.apply(this, arguments);
      }

      return mergeIndexes;
    }()
  }, {
    key: "getSystemStats",
    value: function () {
      var _getSystemStats = (0, _asyncToGenerator2["default"])(
      /*#__PURE__*/
      _regenerator["default"].mark(function _callee9() {
        var result, tweetCount, twitterUserCount, userCount;
        return _regenerator["default"].wrap(function _callee9$(_context9) {
          while (1) {
            switch (_context9.prev = _context9.next) {
              case 0:
                _context9.next = 2;
                return this.es.search({
                  index: this.getIndex(TWEET),
                  type: TWEET,
                  body: {
                    query: {
                      match_all: {}
                    }
                  }
                });

              case 2:
                result = _context9.sent;
                tweetCount = result.hits.total;
                _context9.next = 6;
                return this.es.search({
                  index: this.getIndex(TWUSER),
                  type: TWUSER,
                  body: {
                    query: {
                      match_all: {}
                    }
                  }
                });

              case 6:
                result = _context9.sent;
                twitterUserCount = result.hits.total;
                _context9.next = 10;
                return this.es.search({
                  index: this.getIndex(USER),
                  type: USER,
                  body: {
                    query: {
                      match_all: {}
                    }
                  }
                });

              case 10:
                result = _context9.sent;
                userCount = result.hits.total;
                return _context9.abrupt("return", {
                  tweetCount: tweetCount,
                  twitterUserCount: twitterUserCount,
                  userCount: userCount
                });

              case 13:
              case "end":
                return _context9.stop();
            }
          }
        }, _callee9, this);
      }));

      function getSystemStats() {
        return _getSystemStats.apply(this, arguments);
      }

      return getSystemStats;
    }()
  }]);
  return Database;
}();

exports.Database = Database;