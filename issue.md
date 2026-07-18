# Issue Report: linux-sys-user

This document details issues found during code review of the linux-sys-user codebase.

---

## 1. Inconsistent Error Handling in `spawnWrapper`

**Location**: `lib/user.js:10-32`

**Problem**: The `spawnWrapper` function has inconsistent error handling behavior.

```javascript
_p.on("error", function () {
  callback(stderr || true, stdout);  // Line 26-27
});
_p.on("exit", function () {
  callback(stderr, stdout);         // Line 29-30
});
```

When a spawn error occurs (e.g., command not found), it passes `stderr || true` to the callback's error parameter. When the process exits normally, it passes just `stderr`. This means:

- On spawn error: callback receives truthy error (boolean `true` if stderr is empty)
- On exit with error: callback receives stderr string
- On exit with success: callback receives empty string/falsy

**Impact**: Calling code cannot reliably distinguish between:
1. Process failed to spawn (command doesn't exist)
2. Process ran but returned an error
3. Process succeeded

**Recommendation**: Normalize error handling to always pass either an `Error` object or `null`:

```javascript
_p.on("error", function (err) {
  callback(err || new Error("Spawn failed"), stdout);
});
_p.on("exit", function (code) {
  if (code !== 0) {
    callback(new Error(stderr || `Process exited with code ${code}`), stdout);
  } else {
    callback(null, stdout);
  }
});
```

---

## 2. TypeScript Type Mismatch for `selinux_user`

**Location**: `lib/user.js:79-81` and `index.d.ts:11`

**Problem**: The TypeScript definition declares `selinux_user` as `boolean`, but the implementation treats it as a string.

```typescript
// index.d.ts line 11
selinux_user?: boolean;

// lib/user.js lines 79-81
selinux_user: function (SEUSER) {
  if (SEUSER) {
    return ["--selinux-user", SEUSER];
  }
},
```

The `useradd` command expects `--selinux-user <value>` where `<value>` is a SELinux user name (e.g., `staff_u`, `user_u`), not a boolean.

**Impact**: TypeScript users will receive incorrect type hints and may pass boolean values, which will fail at runtime or produce incorrect `useradd` arguments.

**Recommendation**: Fix the TypeScript type:

```typescript
selinux_user?: string;
```

---

## 3. `setPassword` Stdin Handling May Be Unreliable

**Location**: `lib/user.js:196-218`

**Problem**: The `setPassword` function writes to stdin of the `passwd` command:

```javascript
var _p = spawn("passwd", [username]);
_p.stdin.write(password + "\n");
_p.stdin.write(password + "\n");
_p.stdin.end();
```

This approach may fail because:
1. `passwd` may prompt for the current password before asking for a new one (depending on context and security settings)
2. stdin buffering may cause the password to be read after the prompt is displayed
3. Some systems have `pam_chauthtok` requirements that need full interactive password change flow

**Impact**: Password setting may fail silently or inconsistently across different Linux distributions and configurations.

**Recommendation**: Consider alternatives:
1. Use `chpasswd` command which accepts `username:password` format via stdin: `echo "user:pass" | chpasswd`
2. Use `openssl` to generate a salted hash and directly edit `/etc/shadow` (requires careful implementation)
3. Document this limitation clearly and note it requires specific system configurations

---

## 4. Fragile Date Parsing in `getExpiration`

**Location**: `lib/user.js:319-354`

**Problem**: The `getExpiration` function parses output from `chage --list` assuming a specific format:

```javascript
data = {
  changed: new Date(data[0].split(": ")[1]),
  passwordExpires: data[1].split(": ")[1] === "never" ? null : new Date(data[1].split(": ")[1]),
  // ...
};
```

This parsing is fragile because:
1. It assumes English output with `: ` delimiter
2. System locale changes could localize date strings causing `new Date()` to fail
3. Different `chage` implementations may format output differently

**Impact**: On non-English systems or systems with custom locale settings, this function will either throw an error or return invalid Date objects.

**Recommendation**: Either:
1. Document this as a known limitation requiring English locale
2. Use regex patterns that extract the value between `: ` and the newline, then use a locale-aware date parser
3. Parse `/etc/shadow` directly for more reliable data extraction

---

## 5. Potential Path Injection in `addSSHtoUser`

**Location**: `lib/user.js:377-419`

**Problem**: The `addSSHtoUser` function uses `exec` with string formatting for shell commands:

```javascript
var commands = [
  util.format("mkdir %s/.ssh;", info.homedir),
  util.format("touch %s/.ssh/authorized_keys;", info.homedir),
  util.format("chown 700 %s/.ssh;", info.homedir),
  // ...
].join(" ");
exec(commands, function (err, stdout, stderr) { ... });
```

While `info.homedir` comes from `/etc/passwd` parsing (trusted on a properly secured system), if an attacker could modify `/etc/passwd` or if there's a misconfiguration, the homedir could contain shell metacharacters.

**Impact**: Potential for command injection if homedir contains characters like `;`, `|`, `&`, etc.

**Recommendation**: Validate homedir path before use:

```javascript
if (!/^\/[a-zA-Z0-9_\/-]+$/.test(info.homedir)) {
  return callback(new Error("Invalid homedir path"));
}
```

Or use spawn with argument arrays instead of shell execution.

---

## 6. Commented-Out Code in `setPassword`

**Location**: `lib/user.js:206-208`

**Problem**: There is commented-out code suggesting a previous implementation approach:

```javascript
// spawnWrapper('password', [username], password+'\n'+password+'\n', function(error, data){
//   console.log(error, data)
// })
```

**Impact**: Dead code creates confusion about the intended implementation. This should either be removed or the approach should be documented.

**Recommendation**: Remove the commented code or document why it was abandoned.

---

## 7. `addUser` Always Calls `getUserInfo` on Error

**Location**: `lib/user.js:128-131`

**Problem**: In the `addUser` function:

```javascript
spawnWrapper("useradd", [].concat(args_array, [args.username]), null,
  function (error, data) {
    if (error) callback(error);
    exports.getUserInfo(args.username, callback);  // Called even when error occurred!
  }
);
```

When `useradd` fails, the error is passed to callback, but then `getUserInfo` is still called (and overwrites the error). If `useradd` fails, `getUserInfo` will return `null` as the user doesn't exist, and the actual error from `useradd` is lost.

**Impact**: Error messages from `useradd` failures are lost or overwritten.

**Recommendation**: Return early on error:

```javascript
if (error) return callback(error);
exports.getUserInfo(args.username, callback);
```

---

## 8. Same Issue in `addGroup`

**Location**: `lib/user.js:226-228`

**Problem**: Same pattern as issue #7:

```javascript
spawnWrapper("groupadd", [groupname], null, function () {
  exports.getGroupInfo(groupname, callback);  // No error handling!
});
```

Errors from `groupadd` are silently ignored. The callback receives whatever `getGroupInfo` returns.

**Impact**: Group creation failures are not reported to the caller.

**Recommendation**: Add error handling:

```javascript
spawnWrapper("groupadd", [groupname], null, function (error) {
  if (error) return callback(error);
  exports.getGroupInfo(groupname, callback);
});
```

---

## 9. No Timeout Handling

**Location**: All spawn-based functions

**Problem**: None of the `spawn` or `exec` calls implement timeouts. A hung process (e.g., due to system configuration issues, LDAP/SSSD delays, etc.) could cause the library to hang indefinitely.

**Impact**: Applications using this library may hang waiting for child processes that will never complete.

**Recommendation**: Add a timeout mechanism:

```javascript
function spawnWithTimeout(command, args, stdin, timeoutMs, callback) {
  var timer;
  var p = spawn(command, args);

  if (timeoutMs) {
    timer = setTimeout(function() {
      p.kill();
      callback(new Error("Process timed out"));
    }, timeoutMs);
  }

  // ... rest of spawnWrapper logic
  _p.on("exit", function() {
    if (timer) clearTimeout(timer);
    callback(stderr, stdout);
  });
}
```

---

## 10. Documentation vs Implementation: `addUser` String Argument

**Location**: `lib/user.js:109-116` and `README.md`

**Problem**: When `addUser` receives a string, it converts it to an object:

```javascript
if (typeof args === "string") {
  args = {
    username: args,
    create_home: true,
  };
}
```

This is documented in the README (line 51 shows passing an object), but the string shortcut is a convenience that isn't clearly documented.

**Impact**: Users may not know they can pass just a username string.

**Recommendation**: Either document this shortcut or remove it for API clarity.

---

## Summary Table

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | Inconsistent error handling in spawnWrapper | Medium | lib/user.js:26-30 |
| 2 | TypeScript type mismatch for selinux_user | Low | index.d.ts:11, lib/user.js:79-81 |
| 3 | setPassword stdin handling unreliable | Medium | lib/user.js:196-218 |
| 4 | Fragile date parsing in getExpiration | Medium | lib/user.js:319-354 |
| 5 | Potential path injection in addSSHtoUser | Medium | lib/user.js:387-398 |
| 6 | Commented-out dead code | Low | lib/user.js:206-208 |
| 7 | addUser loses error on failure | Medium | lib/user.js:128-131 |
| 8 | addGroup ignores errors | Medium | lib/user.js:226-228 |
| 9 | No timeout handling | Low | All spawn/exec calls |
| 10 | Undocumented string argument shortcut | Low | lib/user.js:109-116 |
