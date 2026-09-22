# Backend Security Audit

## Summary

`npm audit --omit=dev` was run after remediation to verify the backend runtime dependency state.

## Remediation completed

- `morgan` and `qs` were fixed.
- The unused direct `uuid` dependency was removed.

## Remaining vulnerability

The remaining vulnerability is `tar` (critical), which is a transitive dependency in the chain:

- `bcrypt -> @mapbox/node-pre-gyp -> tar`

`npm audit fix` was attempted, but the `tar` advisory remains. This is a transitive dependency issue and is not a direct application code issue.

`npm audit fix --force` was intentionally not used because it can introduce breaking dependency changes.

## Verification

The backend was verified after the remediation steps:

- Test files: 17 passed
- Tests: 102 passed
- TypeScript build: passed
