"use strict";

// Read-only import path for linux-user.
//
// Some functions in linux-user do not require root privileges (they read
// /etc/passwd and /etc/group, which are world-readable, or operate on the
// calling user). Importing this module instead of the main one:
//
//   * does NOT emit the "not running as root" warning, and
//   * exposes only the functions that are safe to call without root.
//
// Usage:
//   var linuxUser = require('linux-user/non-root');
//   linuxUser.getUsers(function (err, users) { ... });
//
// This still requires Linux -- the platform check is enforced.

if (process.platform !== "linux") {
  throw new Error("linux-user must be running on Linux");
}

var user = require("./lib/user");
var promise = require("./lib/promise");

module.exports = {
  getUsers: user.getUsers,
  getGroups: user.getGroups,
  getUserInfo: user.getUserInfo,
  getUserGroups: user.getUserGroups,
  getExpiration: user.getExpiration,
  validateUsername: user.validateUsername,
  verifySSHKey: user.verifySSHKey,
  promise: promise.nonRoot,
};