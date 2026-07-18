# Issue Report: linux-sys-user

This document details issues found during code review of the linux-sys-user module.

---

## 1. Inconsistent Error Handling in `spawnWrapper`

**Location**: `lib/user.js:26-31`

**Problem**: The `spawnWrapper` function has inconsistent behavior between spawn errors and normal exit:

```javascript
_p.on("error", function () {
  callback(stderr || true, stdout);  // Returns: (stderr || true, stdout)
});
_p.on("exit", function () {
  callback(stderr, stdout);         // Returns: (stderr, stdout)
});
```

When a spawn error occurs, `callback` is called with `stderr || true` - ensuring a truthy first argument. But on normal exit, `callback` receives `stderr` directly, which may be an empty string (falsy).

**Impact**:
- Calling code cannot reliably distinguish between a spawn failure and a successful command that produced no stderr output.
- Functions that check `if (error) callback(error)` will behave inconsistently.

**Recommendation**: Normalize error handling to always return a consistent format. Consider creating an `Error` object or using a consistent sentinel value:

```javascript
_p.on("error", function (err) {
  callback(new Error(err.message || "Process spawn failed"), stdout);
});
```

---

## 2. TypeScript Type Mismatch for `selinux_user`

**Location**: `lib/user.js:79-81` and `index.d.ts:11`

**Problem**: The TypeScript definition types `selinux_user` as `boolean`, but the implementation passes it as a string argument to `useradd`:

```javascript
// lib/user.js:79-81
selinux_user: function (SEUSER) {
  if (SEUSER) {
    return ["--selinux-user", SEUSER];  // SEUSER is used as a string
  }
},
```

```typescript
// index.d.ts:11
selinux_user?: boolean;  // Typed as boolean
```

**Impact**: TypeScript users will receive type errors when passing a valid string value like `"staff_u"`.

**Recommendation**: Fix the type definition:

```typescript
selinux_user?: string;
```

---

## 3. Fragile Date Parsing in `getExpiration`

**Location**: `lib/user.js:331-350`

**Problem**: The `getExpiration` function parses `chage --list` output by splitting on newlines and colons, assuming a specific output format:

```javascript
data = {
  changed: new Date(data[0].split(": ")[1]),
  passwordExpires:
    data[1].split(": ")[1] === "never"
      ? null
      : new Date(data[1].split(": ")[1]),
  // ... assumes data[0] through data[6] exist with exact format
};
```

**Impact**:
- Output format may vary by `chage` version or system locale/language settings.
- If `data` array lacks expected indices, will throw `TypeError: Cannot read property 'split' of undefined`.
- Date strings in different locales may not parse correctly with `new Date()`.

**Recommendation**: Add defensive checks and locale-aware parsing:

```javascript
if (!data || data.length < 7) {
  return callback(new Error("Unexpected chage output format"));
}

var parseDate = function(str) {
  if (!str || str.trim() === "never") return null;
  // Handle locale-specific date formats if needed
  return new Date(str);
};
```

---

## 4. Unreliable Password Setting via Stdin

**Location**: `lib/user.js:210-217`

**Problem**: The `setPassword` function writes to `passwd`'s stdin but may not work reliably:

```javascript
var _p = spawn("passwd", [username]);
_p.stdin.write(password + "\n");
_p.stdin.write(password + "\n");
_p.stdin.end();
```

Some `passwd` implementations may not accept password via stdin, or may behave differently depending on PAM configuration, security policies, or whether stdin is a terminal.

**Impact**: Password changes may silently fail or behave unexpectedly on some systems.

**Recommendation**: Consider using `chpasswd` which is designed for non-interactive password input:

```javascript
var _p = spawn("chpasswd", []);
_p.stdin.write(username + ":" + password + "\n");
_p.stdin.end();
```

Alternatively, document that this method requires specific system configuration to work.

---

## 5. Potential Command Injection in `addSSHtoUser`

**Location**: `lib/user.js:387-398`

**Problem**: The `addSSHtoUser` function uses `exec` with a format string built from user data:

```javascript
var commands = [
  util.format("mkdir %s/.ssh;", info.homedir),
  util.format("touch %s/.ssh/authorized_keys;", info.homedir),
  util.format("chown 700 %s/.ssh;", info.homedir),
  util.format("chmod 600 %s/.ssh/authorized_keys;", info.homedir),
  util.format("chown %s:%s %s/.ssh -R;", info.username, info.username, info.homedir),
].join(" ");
```

The comment claims this is safe because "we are not taking any user input data", but `info.homedir` comes from `/etc/passwd` parsing.

**Impact**: If `/etc/passwd` is compromised or contains malicious data, command injection could occur.

**Recommendation**: Validate paths before use:

```javascript
var safePath = function(path) {
  // Only allow absolute paths under /home or /root
  if (!path || !path.match(/^\/(home|root)\/[\w.-]+$/)) {
    return false;
  }
  return path;
};

if (!safePath(info.homedir)) {
  return callback(new Error("Unsafe home directory path"));
}
```

---

## 6. Username Validation Regex Too Restrictive

**Location**: `lib/user.js:8`

**Problem**: The username regex rejects valid Linux usernames on some systems:

```javascript
var validUsernameRegex = /^([a-z_][a-z0-9_-]{0,30})$/;
```

Linux allows usernames up to 32 characters (with recent glibc), but this regex:
- Rejects uppercase letters (though unusual, they are allowed in some configurations)
- Rejects usernames starting with numbers
- May reject legitimate edge cases

**Impact**: Users with valid system accounts may be unable to use this library.

**Recommendation**: Update regex to match modern Linux standards (POSIX says 1-255 chars, glibc uses 32 max):

```javascript
var validUsernameRegex = /^([a-z_][a-z0-9_-]{0,30})$/;
// Current: correct for most cases, but could expand to:
var validUsernameRegex = /^([a-z_][a-z0-9_-]{0,30}[a-z0-9_-]?|[a-z_])$/i;
```

Or at minimum, document the restriction clearly.

---

## 7. No Process Timeout Handling

**Location**: `lib/user.js:10-32` (`spawnWrapper`)

**Problem**: `spawnWrapper` has no mechanism to timeout or kill long-running processes. If a spawned process hangs (e.g., `passwd` prompting for something unexpected), the callback will never fire.

**Impact**: Applications may hang indefinitely waiting for a callback that never comes.

**Recommendation**: Add optional timeout support:

```javascript
function spawnWrapper(command, args, stdin, callback, timeoutMs) {
  var timer;
  if (timeoutMs) {
    timer = setTimeout(function() {
      _p.kill();
      callback(new Error("Process timed out"), "");
    }, timeoutMs);
  }
  // ... existing code ...
}
```

---

## 8. Module Structure Issue

**Location**: `lib/promise.js:4` vs `index.js:15`

**Problem**: When using `require('./lib/promise')` directly, it requires `./user` which triggers the platform check in `index.js` twice:

```javascript
// lib/promise.js
var lib = require("./user");  // This loads index.js, not lib/user.js directly
```

The `require("./user")` in `lib/promise.js` will resolve to `lib/user.js` (via Node's require resolution), but this means:
- The file is `lib/user.js` not `index.js`
- The platform/root checks in `index.js` are bypassed when using promise.js directly

**Impact**: If someone requires `require('linux-sys-user/lib/promise')` directly, they bypass platform checks. While unlikely, it creates an inconsistent entry point.

**Recommendation**: This is a minor issue. Consider if direct access to `lib/promise.js` should be supported or blocked.

---

## 9. Missing Error Handling in `addUser` Success Path

**Location**: `lib/user.js:128-131`

**Problem**: In `addUser`, if `getUserInfo` fails on line 130, the error is not propagated:

```javascript
spawnWrapper(
  "useradd",
  [].concat(args_array, [args.username]),
  null,
  function (error, data) {
    if (error) callback(error);
    exports.getUserInfo(args.username, callback);  // Error ignored here
  }
);
```

If `useradd` succeeds but `getUserInfo` fails, the error is silently lost and `callback` may be called twice (once with user info, once with error).

**Recommendation**:

```javascript
function (error, data) {
  if (error) return callback(error);
  exports.getUserInfo(args.username, function(err, user) {
    if (err) return callback(err);
    callback(null, user);
  });
}
```

---

## 10. SSH Key Addition Doesn't Respect Existing Keys

**Location**: `lib/user.js:406-415`

**Problem**: `addSSHtoUser` appends the key but doesn't check for duplicates:

```javascript
fs.appendFile(
  info.homedir + "/.ssh/authorized_keys",
  key,
  function (err) {
    // Appends regardless of existing entries
  }
);
```

**Impact**: The same SSH key can be added multiple times to `authorized_keys`.

**Recommendation**: Check for key existence before appending:

```javascript
fs.readFile(info.homedir + "/.ssh/authorized_keys", "utf8", function(err, existing) {
  if (err && err.code !== 'ENOENT') return callback(err);
  var keys = existing ? existing.split('\n') : [];
  if (keys.some(function(line) { return line.trim() === key.trim(); })) {
    return callback(null, true);  // Key already exists
  }
  fs.appendFile(/* ... */);
});
```

---

## Summary Table

| # | Issue | Severity | Effort |
|---|-------|----------|--------|
| 1 | Inconsistent error handling in spawnWrapper | Medium | Low |
| 2 | TypeScript boolean vs string for selinux_user | Low | Trivial |
| 3 | Fragile date parsing in getExpiration | Medium | Medium |
| 4 | Unreliable setPassword stdin handling | Medium | Medium |
| 5 | Potential path injection in addSSHtoUser | Medium | Low |
| 6 | Username regex too restrictive | Low | Trivial |
| 7 | No process timeout | Low | Low |
| 8 | Module structure issue | Low | N/A |
| 9 | Missing error handling in addUser | Medium | Low |
| 10 | Duplicate SSH keys not checked | Low | Low |
