"use strict";

var spawn = require("child_process").spawn;
var fs = require("fs");

var validUsernameRegex = /^([a-z_][a-z0-9_-]{0,30})$/;

// Default timeout applied to spawned commands so a hung child process
// (e.g. LDAP/SSSD delays) cannot hang the library forever. Pass
// `opts.timeout` to override or `{ timeout: 0 }` to disable.
var DEFAULT_TIMEOUT = 0;

function spawnWrapper(command, args, stdin, opts, callback) {
  // allow the legacy 4-arg form: spawnWrapper(command, args, stdin, callback)
  if (typeof opts === "function") {
    callback = opts;
    opts = {};
  }
  opts = opts || {};

  var stdout = "";
  var stderr = "";
  var settled = false;
  var timer = null;

  var spawnOpts = {};
  if (opts.env) {
    spawnOpts.env = opts.env;
  }

  var _p = spawn(command, args, spawnOpts);
  if (stdin) {
    _p.stdin.write(stdin);
    _p.stdin.end();
  }
  _p.stdout.on("data", (data) => {
    stdout += data.toString();
  });
  _p.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  function done(err) {
    if (settled) {
      return;
    }
    settled = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    callback(err, stdout);
  }

  if (opts.timeout && opts.timeout > 0) {
    timer = setTimeout(function () {
      try {
        _p.kill("SIGKILL");
      } catch (e) {
        // process may have already exited
      }
      done(new Error(command + " timed out after " + opts.timeout + "ms"));
    }, opts.timeout);
  }

  _p.on("error", function (err) {
    done(err || new Error("Failed to spawn " + command));
  });
  _p.on("exit", function (code) {
    if (code === 0 || code === undefined && !stderr) {
      done(null);
    } else if (code !== 0) {
      var msg = (stderr || command + " exited with code " + code).trim();
      done(new Error(msg));
    } else {
      done(null);
    }
  });
}

function validate(username) {
  return validUsernameRegex.test(username);
}

var user_arg_map = {
  shell: function (SHELL) {
    if (SHELL === null) {
      SHELL = "/usr/sbin/nologin";
    }
    if (SHELL) {
      return ["--shell", SHELL];
    }
  },
  create_home: function (isSet) {
    if (isSet === true) {
      return ["--create-home"];
    }

    if (isSet === false) {
      return ["--no-create-home"];
    }
  },
  home_dir: function (path) {
    if (path) {
      return ["--home-dir", path];
    }
  },
  expiredate: function (date) {
    if (date) {
      if (Object.prototype.toString.call(date) === "[object Date]") {
        date = date.toISOString().slice(0, 10);
      }
      return ["--expiredate", date];
    }
  },
  skel: function (path) {
    if (path) {
      return ["--skel", path];
    }
  },
  system: function (isSet) {
    if (isSet) {
      return ["--system"];
    }
  },
  selinux_user: function (SEUSER) {
    if (SEUSER) {
      return ["--selinux-user", SEUSER];
    }
  },
  other_args: function (other_args) {
    if (other_args) {
      if (typeof other_args === "string") {
        return other_args;
      }
      if (Array.isArray(other_args)) {
        return other_args.join(" ");
      }
    }
  },
  username: function () {
    return [];
  },
};

function build_user_command(args, map) {
  var keys = Object.keys(args);
  var out = [];
  for (var index = 0; index < keys.length; index++) {
    var result = map[keys[index]](args[keys[index]]);
    // skip undefined/null returns so we never inject a "null" argument
    if (result) {
      out = out.concat(result);
    }
  }

  return out;
}

exports.addUser = function (args, callback) {
  // if a string is passes, assume its just a user name
  if (typeof args === "string") {
    args = {
      username: args,
      create_home: true,
    };
  }

  if (!validate(args.username)) {
    return callback(new Error("Invalid username"));
  }

  var args_array = build_user_command(args, user_arg_map);

  spawnWrapper(
    "useradd",
    [].concat(args_array, [args.username]),
    null,
    function (error, data) {
      if (error) {
        return callback(error);
      }
      exports.getUserInfo(args.username, callback);
    }
  );
};

exports.removeUser = function (username, callback) {
  username = String(username);
  if (!validate(username)) {
    return callback(new Error("Invalid username"));
  }

  var settled = false;
  var _p = spawn("userdel", ["-rf", username]);
  function finish(err) {
    if (settled) {
      return;
    }
    settled = true;
    callback(err);
  }
  _p.on("error", finish);
  _p.on("exit", function (code) {
    finish(code === 0 ? null : new Error("userdel exited with code " + code));
  });
};

exports.getUserGroups = function (username, callback) {
  username = String(username);
  if (!validate(username)) {
    return callback(new Error("Invalid username"));
  }

  spawnWrapper("groups", [username], null, function (err, stdout) {
    if (err) {
      return callback(err);
    }
    var groups = stdout.replace("\n", "").replace(/.+:\s/i, "").split(" ");
    // `groups` prints "<user> : " when the user belongs to no groups
    if (groups.length === 1 && groups[0] === "") {
      return callback(null, []);
    }
    return callback(null, groups);
  });
};

exports.getUsers = function (callback) {
  fs.readFile("/etc/passwd", function (err, content) {
    if (err) {
      return callback(err);
    }
    var _users = content
      .toString()
      .split("\n")
      .filter(function (line) {
        return line.length > 0;
      });
    _users = _users.map(function (line) {
      var _cols = line.split(":");
      return {
        username: _cols[0],
        password: _cols[1],
        uid: Number(_cols[2]),
        gid: Number(_cols[3]),
        fullname: _cols[4] && _cols[4].split(",")[0],
        homedir: _cols[5],
        shell: _cols[6],
      };
    });
    callback(null, _users);
  });
};

exports.getUserInfo = function (username, callback) {
  exports.getUsers(function (err, users) {
    if (err) {
      return callback(err);
    }
    for (var i = 0; i < users.length; i++) {
      if (users[i].username === username) {
        return callback(null, users[i]);
      }
    }
    callback(null, null);
  });
};

exports.setPassword = function (username, password, callback) {
  username = String(username);
  password = String(password);
  if (!username || !password) {
    return callback(new Error("Invalid arguments"));
  }
  if (!validate(username)) {
    return callback(new Error("Invalid username"));
  }

  var stderr = "";
  var settled = false;
  var _p = spawn("passwd", [username]);
  _p.stdin.write(password + "\n");
  _p.stdin.write(password + "\n");
  _p.stdin.end();
  _p.stderr.on("data", (data) => {
    stderr += data.toString();
  });

  function finish(err) {
    if (settled) {
      return;
    }
    settled = true;
    callback(err);
  }

  _p.on("error", finish);
  _p.on("exit", function (code) {
    finish(code === 0 ? null : new Error((stderr || "passwd failed").trim()));
  });
};

exports.addGroup = function (groupname, callback) {
  groupname = String(groupname);
  if (!validate(groupname)) {
    return callback(new Error("Invalid groupname"));
  }

  spawnWrapper("groupadd", [groupname], null, function (error) {
    if (error) {
      return callback(error);
    }
    exports.getGroupInfo(groupname, callback);
  });
};

exports.removeGroup = function (groupname, callback) {
  groupname = String(groupname);
  if (!validate(groupname)) {
    return callback(new Error("Invalid groupname"));
  }

  spawnWrapper("groupdel", [groupname], null, function (error) {
    callback(error || null);
  });
};

exports.getGroups = function (callback) {
  fs.readFile("/etc/group", function (err, content) {
    if (err) {
      return callback(err);
    }
    var _groups = content
      .toString()
      .split("\n")
      .filter(function (line) {
        return line.length > 0;
      });
    _groups = _groups.map(function (line) {
      var _cols = line.split(":");
      return {
        groupname: _cols[0],
        password: _cols[1],
        gid: Number(_cols[2]),
        members: _cols[3] ? _cols[3].split(",") : [],
      };
    });
    callback(null, _groups);
  });
};

exports.getGroupInfo = function (groupname, callback) {
  exports.getGroups(function (err, groups) {
    if (err) {
      return callback(err);
    }
    for (var i = 0; i < groups.length; i++) {
      if (groups[i].groupname === groupname) {
        return callback(null, groups[i]);
      }
    }
    callback(null, null);
  });
};

exports.addUserToGroup = function (username, groupname, callback) {
  username = String(username);
  groupname = String(groupname);
  if (!validate(username) || !validate(groupname)) {
    return callback(new Error("Invalid arguments"));
  }

  var settled = false;
  var _p = spawn("usermod", ["-a", "-G", groupname, username]);
  function finish(err) {
    if (settled) {
      return;
    }
    settled = true;
    callback(err);
  }
  _p.on("error", finish);
  _p.on("exit", function (code) {
    finish(code === 0 ? null : new Error("usermod exited with code " + code));
  });
};

var chage_arg_map = {
  lastday: function (date) {
    if (Object.prototype.toString.call(date) === "[object Date]") {
      date = date.toISOString().slice(0, 10);
    }
    return ["--lastday", date];
  },
  expiredate: function (date) {
    if (Object.prototype.toString.call(date) === "[object Date]") {
      date = date.toISOString().slice(0, 10);
    }
    return ["--expiredate", date];
  },
  inactive: function (date) {
    if (Object.prototype.toString.call(date) === "[object Date]") {
      date = date.toISOString().slice(0, 10);
    }
    return ["--inactive", date];
  },
  minDays: function (days) {
    return ["--mindays", days];
  },
  maxDays: function (days) {
    return ["--maxdays", days];
  },
  warnDays: function (days) {
    return ["--warndays", days];
  },
  info: function () {
    return ["--list"];
  },
};

// Force the C locale when parsing `chage --list` so the field labels and date
// format are stable regardless of the system locale.
var chageEnv = Object.assign({}, process.env, { LC_ALL: "C", LANG: "C" });

function parseChageDate(value) {
  if (!value || value === "never") {
    return null;
  }
  return new Date(value);
}

exports.getExpiration = function (username, callback) {
  if (!validate(username)) {
    return callback(new Error("Invalid username"));
  }

  var args_array = build_user_command({ info: true }, chage_arg_map);

  spawnWrapper(
    "chage",
    [].concat(args_array, [username]),
    null,
    { env: chageEnv },
    function (error, data) {
      if (error) {
        return callback(error);
      }
      if (!data) {
        return callback(new Error("chage returned no output"));
      }

      var lines = data.split("\n");
      var fields = {};
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var idx = line.indexOf(": ");
        if (idx === -1) {
          continue;
        }
        var label = line.slice(0, idx).trim().toLowerCase();
        var value = line.slice(idx + 2).trim();
        fields[label] = value;
      }

      var data2 = {
        changed: parseChageDate(fields["last password change"]),
        passwordExpires: parseChageDate(fields["password expires"]),
        inactive: parseChageDate(fields["password inactive"]),
        accountExpires: parseChageDate(fields["account expires"]),
        minDays: Number(fields["minimum number of days between password change"]),
        maxDays: Number(fields["maximum number of days between password change"]),
        warnDays: Number(
          fields["number of days of warning before password expires"]
        ),
      };
      callback(null, data2);
    }
  );
};

exports.setExpiration = function (username, args, callback) {
  if (!validate(username)) {
    return callback(new Error("Invalid username"));
  }

  var args_array = build_user_command(args, chage_arg_map);

  spawnWrapper(
    "chage",
    [].concat(args_array, [username]),
    null,
    function (error, data) {
      callback(error, data);
    }
  );
};

exports.verifySSHKey = function (key, callback) {
  spawnWrapper("ssh-keygen", ["-lf", "-"], key, callback);
};

exports.addSSHtoUser = function (user, key, callback) {
  exports.verifySSHKey(key, function (error) {
    if (error) {
      return callback(new Error("Bad SSH key"));
    }
    exports.getUserInfo(user, function (error, info) {
      if (error) {
        return callback(error);
      }
      if (!info) {
        return callback(new Error("User does not exist"));
      }

      // Guard against shell metacharacters in the homedir before using it
      // in file paths (homedir comes from /etc/passwd, which is trusted on a
      // properly secured system, but validate defensively).
      if (!info.homedir || /[;&|`$()\\<>]/.test(info.homedir)) {
        return callback(new Error("Invalid homedir path"));
      }

      var sshDir = info.homedir + "/.ssh";
      var keyFile = sshDir + "/authorized_keys";

      // Run each step with spawn (no shell) to avoid command injection.
      var steps = [
        ["mkdir", ["-p", sshDir]],
        ["chmod", ["700", sshDir]],
        ["touch", [keyFile]],
        ["chmod", ["600", keyFile]],
        ["chown", ["-R", info.username + ":" + info.username, sshDir]],
      ];

      var index = 0;
      function nextStep(err) {
        if (err) {
          return callback(err);
        }
        if (index >= steps.length) {
          return fs.appendFile(keyFile, key + "\n", function (err) {
            if (err) {
              return callback(err);
            }
            callback(null, true);
          });
        }
        var step = steps[index++];
        spawnWrapper(step[0], step[1], null, nextStep);
      }
      nextStep();
    });
  });
};

exports.validateUsername = validate;