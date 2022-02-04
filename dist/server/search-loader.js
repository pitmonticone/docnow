"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.SearchLoader = void 0;

var _regenerator = _interopRequireDefault(require("@babel/runtime/regenerator"));

var _asyncToGenerator2 = _interopRequireDefault(require("@babel/runtime/helpers/asyncToGenerator"));

var _classCallCheck2 = _interopRequireDefault(require("@babel/runtime/helpers/classCallCheck"));

var _createClass2 = _interopRequireDefault(require("@babel/runtime/helpers/createClass"));

var _logger = _interopRequireDefault(require("./logger"));

var _utils = require("./utils");

var _db = require("./db");

var _redis = require("./redis");

/*
 * SearchLoader connects will fetch search jobs from the queue and run them.
 */
var SearchLoader = /*#__PURE__*/function () {
  function SearchLoader() {
    var db = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : null;
    (0, _classCallCheck2["default"])(this, SearchLoader);
    this.db = db || new _db.Database();
    this.redisBlocking = this.db.redis.duplicate();
    this.twtr = null;
    this.active = false;
  }

  (0, _createClass2["default"])(SearchLoader, [{
    key: "start",
    value: function () {
      var _start = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee2() {
        var _this = this;

        var _loop;

        return _regenerator["default"].wrap(function _callee2$(_context3) {
          while (1) {
            switch (_context3.prev = _context3.next) {
              case 0:
                _logger["default"].info("starting SearchLoader");

                _context3.next = 3;
                return this.setupTwitterClient();

              case 3:
                this.active = true;
                _loop = /*#__PURE__*/_regenerator["default"].mark(function _loop() {
                  var job, opts;
                  return _regenerator["default"].wrap(function _loop$(_context2) {
                    while (1) {
                      switch (_context2.prev = _context2.next) {
                        case 0:
                          _context2.next = 2;
                          return _this.fetchSearchJob();

                        case 2:
                          job = _context2.sent;

                          if (!(job && job.ended === null && job.query.search.active)) {
                            _context2.next = 13;
                            break;
                          }

                          _context2.next = 6;
                          return (0, _utils.timer)(3000);

                        case 6:
                          opts = {
                            q: job.query.twitterQuery(),
                            all: true,
                            once: true
                          };

                          if (job.query.value.startDate) {
                            opts.startDate = job.query.value.StartDate;
                          }

                          if (job.query.value.endDate) {
                            opts.endDate = job.query.value.endDate;
                          }

                          if (job.nextToken) {
                            opts.nextToken = job.nextToken;
                          }

                          _this.twtr.search(opts, /*#__PURE__*/function () {
                            var _ref = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee(err, tweets, nextToken) {
                              return _regenerator["default"].wrap(function _callee$(_context) {
                                while (1) {
                                  switch (_context.prev = _context.next) {
                                    case 0:
                                      if (!err) {
                                        _context.next = 6;
                                        break;
                                      }

                                      _logger["default"].error(err);

                                      _context.next = 4;
                                      return (0, _utils.timer)(3000);

                                    case 4:
                                      _this.db.redis.lpushAsync(_redis.startSearchJobKey, job.id);

                                      return _context.abrupt("return");

                                    case 6:
                                      if (!(tweets == 0)) {
                                        _context.next = 8;
                                        break;
                                      }

                                      return _context.abrupt("return");

                                    case 8:
                                      if (!_this.active) {
                                        _context.next = 23;
                                        break;
                                      }

                                      _context.next = 11;
                                      return _this.db.loadTweets(job.query.search, tweets);

                                    case 11:
                                      if (!nextToken) {
                                        _context.next = 18;
                                        break;
                                      }

                                      _logger["default"].info("queueing next search job ".concat(job.id));

                                      _context.next = 15;
                                      return _this.db.updateSearchJob({
                                        id: job.id,
                                        nextToken: nextToken
                                      });

                                    case 15:
                                      _this.db.redis.lpushAsync(_redis.startSearchJobKey, job.id);

                                      _context.next = 21;
                                      break;

                                    case 18:
                                      _logger["default"].info("no more search results for search job ".concat(job.id));

                                      _context.next = 21;
                                      return _this.db.updateSearchJob({
                                        id: job.id,
                                        ended: new Date()
                                      });

                                    case 21:
                                      _context.next = 24;
                                      break;

                                    case 23:
                                      _logger["default"].warn('search loader callback received tweets when no longer active');

                                    case 24:
                                      return _context.abrupt("return", false);

                                    case 25:
                                    case "end":
                                      return _context.stop();
                                  }
                                }
                              }, _callee);
                            }));

                            return function (_x, _x2, _x3) {
                              return _ref.apply(this, arguments);
                            };
                          }());

                          _context2.next = 14;
                          break;

                        case 13:
                          if (job) {
                            _logger["default"].info("job ".concat(job.id, " is no longer active"));
                          }

                        case 14:
                        case "end":
                          return _context2.stop();
                      }
                    }
                  }, _loop);
                });

              case 5:
                if (!this.active) {
                  _context3.next = 9;
                  break;
                }

                return _context3.delegateYield(_loop(), "t0", 7);

              case 7:
                _context3.next = 5;
                break;

              case 9:
                _logger["default"].info("SearchLoader event loop stopping");

              case 10:
              case "end":
                return _context3.stop();
            }
          }
        }, _callee2, this);
      }));

      function start() {
        return _start.apply(this, arguments);
      }

      return start;
    }()
  }, {
    key: "fetchSearchJob",
    value: function () {
      var _fetchSearchJob = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee3() {
        var job, item, jobId;
        return _regenerator["default"].wrap(function _callee3$(_context4) {
          while (1) {
            switch (_context4.prev = _context4.next) {
              case 0:
                // wait up to 30 seconds for a new job
                job = null;
                _context4.next = 3;
                return this.redisBlocking.blpopAsync(_redis.startSearchJobKey, 30);

              case 3:
                item = _context4.sent;

                if (!item) {
                  _context4.next = 9;
                  break;
                }

                jobId = parseInt(item[1], 10);
                _context4.next = 8;
                return this.db.getSearchJob(jobId);

              case 8:
                job = _context4.sent;

              case 9:
                return _context4.abrupt("return", job);

              case 10:
              case "end":
                return _context4.stop();
            }
          }
        }, _callee3, this);
      }));

      function fetchSearchJob() {
        return _fetchSearchJob.apply(this, arguments);
      }

      return fetchSearchJob;
    }()
  }, {
    key: "stop",
    value: function () {
      var _stop = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee4() {
        return _regenerator["default"].wrap(function _callee4$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                this.active = false;
                this.db.close();
                this.redisBlocking.quit();

                _logger["default"].info("stopping SearchLoader");

              case 4:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee4, this);
      }));

      function stop() {
        return _stop.apply(this, arguments);
      }

      return stop;
    }()
  }, {
    key: "setupTwitterClient",
    value: function () {
      var _setupTwitterClient = (0, _asyncToGenerator2["default"])( /*#__PURE__*/_regenerator["default"].mark(function _callee5() {
        return _regenerator["default"].wrap(function _callee5$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                if (!(this.twtr === null)) {
                  _context6.next = 13;
                  break;
                }

                _logger["default"].info('attempting to get twitter client');

                _context6.next = 4;
                return this.db.getTwitterClientForApp();

              case 4:
                this.twtr = _context6.sent;

                if (this.twtr) {
                  _context6.next = 10;
                  break;
                }

                _context6.next = 8;
                return (0, _utils.timer)(20000);

              case 8:
                _context6.next = 11;
                break;

              case 10:
                _logger["default"].info('got twitter client!');

              case 11:
                _context6.next = 0;
                break;

              case 13:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee5, this);
      }));

      function setupTwitterClient() {
        return _setupTwitterClient.apply(this, arguments);
      }

      return setupTwitterClient;
    }()
  }]);
  return SearchLoader;
}();

exports.SearchLoader = SearchLoader;