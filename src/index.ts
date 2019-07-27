import * as deepmerge from 'deepmerge';

const INIT_ACTION = '@ngrx/store/init';
const UPDATE_ACTION = '@ngrx/store/update-reducers';
const detectDate = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

// correctly parse dates from local storage
export const dateReviver = (key: string, value: any) => {
  if (typeof value === 'string' && detectDate.test(value)) {
    return new Date(value);
  }
  return value;
};

const dummyReviver = (key: string, value: any) => value;

const checkIsBrowserEnv = () => {
  return typeof window !== 'undefined';
};

const validateStateKeys = (keys: any[]) => {
  return keys.map(key => {
    let attr = key;

    if (typeof key === 'object') {
      attr = Object.keys(key)[0];
    }

    if (typeof attr !== 'string') {
      throw new TypeError(
        `localStorageSync Unknown Parameter Type: ` +
          `Expected type of string, got ${typeof attr}`
      );
    }
    return key;
  });
};

export const rehydrateApplicationState = (
  keys: any[],
  storage: Storage,
  storageKeySerializer: (key: string) => string,
  restoreDates: boolean
) => {
  return keys.reduce((acc, curr) => {
    let key = curr;
    let reviver = restoreDates ? dateReviver : dummyReviver;
    let deserialize;
    let decrypt;

    if (typeof key === 'object') {
      key = Object.keys(key)[0];
      // use the custom reviver function
      if (typeof curr[key] === 'function') {
        reviver = curr[key];
      } else {
        // use custom reviver function if available
        if (curr[key].reviver) {
          reviver = curr[key].reviver;
        }
        // use custom serialize function if available
        if (curr[key].deserialize) {
          deserialize = curr[key].deserialize;
        }
      }

      // Ensure that encrypt and decrypt functions are both present
      if (curr[key].encrypt && curr[key].decrypt) {
        if (
          typeof curr[key].encrypt === 'function' &&
          typeof curr[key].decrypt === 'function'
        ) {
          decrypt = curr[key].decrypt;
        } else {
          console.error(
            `Either encrypt or decrypt is not a function on '${
              curr[key]
            }' key object.`
          );
        }
      } else if (curr[key].encrypt || curr[key].decrypt) {
        // Let know that one of the encryption functions is not provided
        console.error(
          `Either encrypt or decrypt function is not present on '${
            curr[key]
          }' key object.`
        );
      }
    }
    if (storage !== undefined) {
      let stateSlice = storage.getItem(storageKeySerializer(key));
      if (stateSlice) {
        // Use provided decrypt function
        if (decrypt) {
          stateSlice = decrypt(stateSlice);
        }

        const isObjectRegex = new RegExp('{|\\[');
        let raw = stateSlice;

        if (stateSlice === 'null' || isObjectRegex.test(stateSlice.charAt(0))) {
          raw = JSON.parse(stateSlice, reviver);
        }

        return Object.assign({}, acc, {
          [key]: deserialize ? deserialize(raw) : raw
        });
      }
    }
    return acc;
  }, {});
};

export const syncStateUpdate = (
  state: any,
  keys: any[],
  storage: Storage,
  storageKeySerializer: (key: string) => string,
  removeOnUndefined: boolean,
  syncCondition?: (state: any) => any
) => {
  if (syncCondition) {
    try {
      if (syncCondition(state) !== true) {
        return;
      }
    } catch (e) {
      // Treat TypeError as do not sync
      if (e instanceof TypeError) {
        return;
      }
      throw e;
    }
  }
  keys.forEach(key => {
    let stateSlice = state[key];
    let replacer;
    let space;
    let encrypt;

    if (typeof key === 'object') {
      let name = Object.keys(key)[0];
      stateSlice = state[name];

      if (typeof stateSlice !== 'undefined' && key[name]) {
        // use serialize function if specified.
        if (key[name].serialize) {
          stateSlice = key[name].serialize(stateSlice);
        } else {
          // if serialize function is not specified filter on fields if an array has been provided.
          let filter;
          if (key[name].reduce) {
            filter = key[name];
          } else if (key[name].filter) {
            filter = key[name].filter;
          }
          if (filter) {
            stateSlice = filter.reduce((memo, attr) => {
              memo[attr] = stateSlice[attr];
              return memo;
            }, {});
          }

          // Check if encrypt and decrypt are present, also checked at this#rehydrateApplicationState()
          if (key[name].encrypt && key[name].decrypt) {
            if (typeof key[name].encrypt === 'function') {
              encrypt = key[name].encrypt;
            }
          } else if (key[name].encrypt || key[name].decrypt) {
            // If one of those is not present, then let know that one is missing
            console.error(
              `Either encrypt or decrypt function is not present on '${
                key[name]
              }' key object.`
            );
          }
        }

        /*
          Replacer and space arguments to pass to JSON.stringify.
          If these fields don't exist, undefined will be passed.
        */
        replacer = key[name].replacer;
        space = key[name].space;
      }

      key = name;
    }

    if (typeof stateSlice !== 'undefined' && storage !== undefined) {
      try {
        if (encrypt) {
          // ensure that a string message is passed
          stateSlice = encrypt(
            typeof stateSlice === 'string'
              ? stateSlice
              : JSON.stringify(stateSlice, replacer, space)
          );
        }
        storage.setItem(
          storageKeySerializer(key),
          typeof stateSlice === 'string'
            ? stateSlice
            : JSON.stringify(stateSlice, replacer, space)
        );
      } catch (e) {
        console.warn('Unable to save state to localStorage:', e);
      }
    } else if (typeof stateSlice === 'undefined' && removeOnUndefined) {
      try {
        storage.removeItem(storageKeySerializer(key));
      } catch (e) {
        console.warn(
          `Exception on removing/cleaning undefined '${key}' state`,
          e
        );
      }
    }
  });
};

// Default merge strategy is a full deep merge.
export const defaultMergeReducer = (state: any, rehydratedState: any, action: any) => {
  const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray;
  const options: deepmerge.Options = {
    arrayMerge: overwriteMerge
  };
  if (action.type === INIT_ACTION && rehydratedState) {
    state = deepmerge(state, rehydratedState, options);
  } else if (action.type === UPDATE_ACTION && rehydratedState) {
    Object.keys(rehydratedState).forEach(partialState => {
      state[partialState] = deepmerge(state[partialState] || {}, rehydratedState[partialState], options);
    });
  }

  return state;
};

export const localStorageSync = (config: LocalStorageConfig) => (
  reducer: any
) => {
  if (config.storage === undefined &&
      !config.checkStorageAvailability || (config.checkStorageAvailability && checkIsBrowserEnv())
  ) {
    config.storage = localStorage || window.localStorage;
  }

  if (config.storageKeySerializer === undefined) {
    config.storageKeySerializer = key => key;
  }

  if (config.restoreDates === undefined) {
    config.restoreDates = true;
  }

  // Use default merge reducer.
  let mergeReducer = config.mergeReducer;

  if (mergeReducer === undefined || typeof(mergeReducer) !== 'function') {
    mergeReducer = defaultMergeReducer;
  }

  const stateKeys = validateStateKeys(config.keys);
  const rehydratedState = config.rehydrate
    ? rehydrateApplicationState(
        stateKeys,
        config.storage,
        config.storageKeySerializer,
        config.restoreDates
      )
    : undefined;

  return function (state, action: any) {
    let nextState;

    // If state arrives undefined, we need to let it through the supplied reducer
    // in order to get a complete state as defined by user
    if ((action.type === INIT_ACTION) && !state) {
      nextState = reducer(state, action);
    } else {
      nextState = { ...state };
    }

    // Merge the store state with the rehydrated state using
    // either a user-defined reducer or the default.
    nextState = mergeReducer(nextState, rehydratedState, action);

    nextState = reducer(nextState, action);

    if (action.type !== INIT_ACTION) {
      syncStateUpdate(
        nextState,
        stateKeys,
        config.storage,
        config.storageKeySerializer,
        config.removeOnUndefined,
        config.syncCondition,
      );
    }

    return nextState;
  };
};

export interface LocalStorageConfig {
  keys: any[];
  rehydrate?: boolean;
  storage?: Storage;
  removeOnUndefined?: boolean;
  restoreDates?: boolean;
  storageKeySerializer?: (key: string) => string;
  syncCondition?: (state: any) => any;
  checkStorageAvailability?: boolean;
  mergeReducer?: (state: any, rehydratedState: any, action: any) => any;
}
