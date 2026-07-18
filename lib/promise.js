"use strict";

// Functions that follow the (err, result) callback convention and can be
// promisified. `validateUsername` is synchronous (no callback) and must NOT be
// promisified -- util.promisify would inject a callback that is never invoked,
// producing a promise that never settles.
var ASYNC = [
  "addUser",
  "removeUser",
  "getUserGroups",
  "getUsers",
  "getUserInfo",
  "setPassword",
  "addGroup",
  "removeGroup",
  "getGroups",
  "getGroupInfo",
  "addUserToGroup",
  "getExpiration",
  "setExpiration",
  "verifySSHKey",
  "addSSHtoUser",
];

// Functions that are safe to use without root privileges (read-only or operate
// on the calling user). Exposed via `require('linux-user/non-root')`.
var NON_ROOT = [
  "getUsers",
  "getGroups",
  "getUserInfo",
  "getUserGroups",
  "getExpiration",
  "validateUsername",
  "verifySSHKey",
];

function build(promisifyFn, keys) {
  var lib = require("./user");
  if (!promisifyFn) {
    var util = require("util");
    promisifyFn = util.promisify;
  }

  var out = {};
  keys.forEach(function (key) {
    if (typeof lib[key] !== "function") {
      return;
    }
    if (ASYNC.indexOf(key) !== -1) {
      out[key] = promisifyFn(lib[key]);
    } else {
      // synchronous helpers are passed through unchanged
      out[key] = lib[key];
    }
  });
  return out;
}

var promise = function (promisifyFn) {
  // Use an explicit key list rather than Object.keys(lib) so properties
  // attached at the index level (promise, nonRoot) are not promisified.
  return build(promisifyFn, ASYNC.concat(["validateUsername"]));
};

promise.nonRoot = function (promisifyFn) {
  var full = promise(promisifyFn);
  var out = {};
  NON_ROOT.forEach(function (key) {
    if (full[key] !== undefined) {
      out[key] = full[key];
    }
  });
  return out;
};

module.exports = promise;