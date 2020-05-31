# ngrx-store-localstorage

Simple syncing between ngrx store and local storage.

## Dependencies

`ngrx-store-localstorage` depends on [@ngrx/store](https://github.com/ngrx/store) and [Angular 2+](https://github.com/angular/angular).

## Usage

```bash
npm install ngrx-store-localstorage --save
```

1. Wrap localStorageSync in an exported function.
2. Include in your meta-reducers array in `StoreModule.forRoot`.

```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { StoreModule, ActionReducerMap, ActionReducer, MetaReducer } from '@ngrx/store';
import { localStorageSync } from 'ngrx-store-localstorage';
import { reducers } from './reducers';


const reducers: ActionReducerMap<IState> = {todos, visibilityFilter};

export function localStorageSyncReducer(reducer: ActionReducer<any>): ActionReducer<any> {
  return localStorageSync({keys: ['todos']})(reducer);
}
const metaReducers: Array<MetaReducer<any, any>> = [localStorageSyncReducer];

@NgModule({
  imports: [
    BrowserModule,
    StoreModule.forRoot(
        reducers,
        {metaReducers}
    )
  ]
})
export class MyAppModule {}
```

## API

### `localStorageSync(config: LocalStorageConfig): Reducer`

Provide state (reducer) keys to sync with local storage. *Returns a meta-reducer*.

#### Arguments

* `config` An object that matches with the `LocalStorageConfig` interface, `keys` is the only required property.

### **LocalStorageConfig**

An interface defining the configuration attributes to bootstrap `localStorageSync`. The following are properties which compose `LocalStorageConfig`:
* `keys` (required) State keys to sync with local storage. The keys can be defined in two different formats:
    * `string[]`: Array of strings representing the state (reducer) keys. Full state will be synced (e.g. `localStorageSync({keys: ['todos']})`).

    * `object[]`: Array of objects where for each object the key represents the state key and the value represents custom serialize/deserialize options. This can be one of the following:

        * An array of properties which should be synced. This allows for the partial state sync (e.g. `localStorageSync({keys: [{todos: ['name', 'status'] }, ... ]})`). Note: this config cannot go any deeper. So you cannot specify another object inside of the `todos` array for example.

        * A reviver function as specified in the [JSON.parse documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

        * An object with properties that specify one or more of the following:

            * `serialize`: A function that takes a state object and returns a plain json object to pass to json.stringify.

            * `deserialize`: A function that takes that takes the raw JSON from JSON.parse and builds a state object.

            * `replacer`: A replacer function as specified in the [JSON.stringify documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify).

            * `space`: The space value to pass JSON.stringify.

            * `reviver`: A reviver function as specified in the [JSON.parse documentation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse).

            * `filter`: An array of properties which should be synced (same format as the stand-alone array specified above).

            * `encrypt`: A function that takes a state string and returns an encrypted version of that string.
            e.g. `(state: string) => btoa(state)`

            * `decrypt`: A function that takes a state string and returns a decrypted version of that string.
            e.g. `(state: string) => atob(state)`

* `rehydrate` (optional) `boolean`: Pull initial state from local storage on startup, this will default to `false`.
* `storage` (optional) `Storage`: Specify an object that conforms to the [Web Storage API interface](https://developer.mozilla.org/en-US/docs/Web/API/Storage) to use, this will default to `localStorage`.
* `removeOnUndefined` (optional) `boolean`: Specify if the state is removed from the storage when the new value is undefined, this will default to `false`.
* `storageKeySerializer` (optional) `(key: string) => string`: Custom serialize function for storage keys, used to avoid Storage conflicts.
* `restoreDates` \(*boolean? = true*): Restore serialized date objects. If you work directly with ISO date strings, set this option to `false`.
* `syncCondition` (optional) `(state) => boolean`: When set, sync to storage medium will only occur when this function returns a true boolean. Example: `(state) => state.config.syncToStorage` will check the state tree under config.syncToStorage and if true, it will sync to the storage. If undefined or false it will not sync to storage. Often useful for "remember me" options in login.
* `checkStorageAvailability` \(*boolean? = false*): Specify if the storage availability checking is expected, i.e. for server side rendering / Universal.
* `mergeReducer` (optional) `(state: any, rehydratedState: any, action: any) => any`: Defines the reducer to use to merge the rehydrated state from storage with the state from the ngrx store. If unspecified, defaults to performing a full deepmerge on an `INIT_ACTION` or an `UPDATE_ACTION`.

Usage: `localStorageSync({keys: ['todos', 'visibilityFilter'], storageKeySerializer: (key) => 'cool_' + key, ... })`. In this example `Storage` will use keys `cool_todos` and `cool_visibilityFilter` keys to store `todos` and `visibilityFilter` slices of state). The key itself is used by default - `(key) => key`.

## Release Notes / Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release notes (though it is missing a couple of versions).
