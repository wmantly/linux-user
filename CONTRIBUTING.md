# Contributing to linux-sys-user

Thank you for your interest in contributing to linux-sys-user! This document provides guidelines and information for contributors.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/linux-user.git`
3. Install dependencies: `npm install`
4. Run tests: `npm test`
5. Run linting: `npm run lint`

## Requirements

- Node.js >= 6.0.0
- Linux operating system
- Root access (for most operations)

## Code Style

- Use JSHint for code linting: `npm run lint`
- Follow existing code patterns and style
- Use meaningful variable and function names
- Add comments for complex logic

## Testing

- Write tests for new features
- Ensure all tests pass: `npm test`
- Run linting: `npm run lint`
- Test coverage: `npm run test-coverage`

**Note**: Most tests require root privileges. Some tests may fail if not running as root, which is expected behavior.

## Submitting Changes

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Add tests for your changes
4. Ensure linting passes: `npm run lint`
5. Commit your changes: `git commit -m "Add your feature"`
6. Push to your fork: `git push origin feature/your-feature-name`
7. Submit a pull request

## Pull Request Guidelines

- Provide a clear description of the changes
- Reference any related issues
- Ensure all tests pass
- Follow the existing code style
- Add tests for new functionality

## Issues

When reporting issues, please include:

- Node.js version (`node --version`)
- Linux distribution and version
- Steps to reproduce the problem
- Expected vs actual behavior
- Any error messages

## Security

This module requires root privileges to function properly. Please be mindful of:

- Input validation and sanitization
- Secure handling of passwords and sensitive data
- Proper error handling to avoid information disclosure

## License

By contributing, you agree that your contributions will be licensed under the MIT License.