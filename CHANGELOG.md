# Change Log

## 8.0.0

### Potentially breaking changes

- Switched from lodash to deepmerge to keep bundle size small and avoid lodash security issues. This is intended to have no impact. However we cannot guarantee merging old state from localstorage with new state will function 100% the same. See [#126](https://github.com/btroncone/ngrx-store-localstorage/pull/126) for more info.
- Objects will now lose their function definitions when rehydrated. Using such was already against the [Redux way](https://redux.js.org/faq/organizing-state#can-i-put-functions-promises-or-other-non-serializable-items-in-my-store-state) but was previously supported.

### Features

- Angular Universal support [#127](https://github.com/btroncone/ngrx-store-localstorage/pull/127)
- Slightly reduced bundle size by avoiding lodash.merge

## 5.0.0 (2018-02-17)

### Bug Fixes

- Support rehydration for feature modules

### Features

- Upgrade @ngrx/store peer dependency to v5
