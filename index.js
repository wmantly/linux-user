"use strict";

// ensure process is running on linux
if (process.platform !== "linux") {
  throw new Error("linux-user must be running on Linux");
}

// ensure process is running as root
if (!(process.getuid && process.getuid() === 0)) {
  console.warn(
    "linux-user is NOT running as root, some functions may not work!"
  );
}

var lib = require("./lib/user");
lib.promise = require("./lib/promise");

// Convenience accessor for the read-only (non-root safe) subset. For an import
// path that also suppresses the root warning, use `require('linux-user/non-root')`.
lib.nonRoot = require("./non-root");

module.exports = lib;
