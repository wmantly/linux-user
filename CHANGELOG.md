# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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