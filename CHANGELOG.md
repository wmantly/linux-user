# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-07-16

### Added
- Non-root import path: `require('linux-user/non-root')` exposes only the
  read-only functions that do not require root and emits no root warning.
  Also available as `require('linux-user').nonRoot`.
- Read-only promise set via `.promise.nonRoot()` and the non-root module's
  `.promise()` factory.
- Optional timeout support for spawned commands (`opts.timeout`) to prevent
  hung child processes from blocking the library.

### Changed
- `spawnWrapper` now follows the Node.js `(err, result)` contract: errors are
  `Error` objects (or `null` on success), and a non-zero exit code is treated as
  a failure. Callbacks are now invoked at most once.
- `getExpiration` parses `chage --list` output under the `C` locale and is no
  longer order/index dependent, so it is robust against localized output.
- `addSSHtoUser` now uses `spawn` with argument arrays instead of a shell
  `exec` string, eliminating shell-injection risk from the home directory path.
- Tests now skip root-dependent cases automatically when not running as root.

### Fixed
- `addUser` no longer calls its callback twice or swallows the `useradd` error.
- `addGroup` now propagates the `groupadd` error instead of always fetching the
  group info.
- `addSSHtoUser` no longer crashes with `Cannot read properties of null` when
  the user does not exist; it returns an `Error`.
- `getExpiration` returns the error instead of throwing when `chage` fails.
- `setPassword` now reports a failure when `passwd` exits non-zero instead of
  calling back with no error.
- `removeUser` and `addUserToGroup` now pass `Error|null` instead of the raw
  numeric exit code as the callback's first argument.
- `promise()` no longer hangs on `validateUsername`; it is passed through as a
  synchronous function.
- `build_user_command` no longer injects `null` arguments when a flag map
  returns `undefined`.
- `getUsers`/`getGroups` no longer drop the last record when `/etc/passwd` or
  `/etc/group` has no trailing newline.
- TypeScript: `selinux_user` is now typed as `string` (it is passed to
  `--selinux-user <value>`), and `other_args` accepts `string | string[]`.
- Removed dead commented-out code from `setPassword`.

## [1.2.0] - 2024-01-09

### Added
- Promise support via `.promise()` method
- TypeScript definitions in `index.d.ts`
- SSH key management capabilities
- User expiration management (`getExpiration`, `setExpiration`)
- Comprehensive user and group management methods

### Changed
- Improved documentation structure
- Enhanced README with better examples and API documentation
- Added linting scripts to package.json
- Improved package.json with additional metadata

### Fixed
- Fixed `Array.isArray` usage in user.js (was incorrectly using `Arrays.isArray`)
- Added missing "use strict" to lib/promise.js
- Resolved JSHint linting errors

### Security
- Improved input validation
- Better error handling to prevent information disclosure

## [1.1.0] - Previous Release

### Added
- Basic user and group management functionality
- SSH key verification and management
- User expiration handling

## [1.0.0] - Initial Release

### Added
- User creation and removal
- Group management
- User information retrieval
- Password management
- SSH key management