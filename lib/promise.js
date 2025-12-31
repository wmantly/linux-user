"use strict";

var promise = function (promise_fn) {
  var lib = require("./user");

  if (!promise_fn) {
    var util = require("util");
    promise_fn = util.promisify;
  }

  var out = {};

  Object.keys(lib).forEach(function (key) {
    out[key] = promise_fn(lib[key]);
  });

  return out;
};

module.exports = promise;
