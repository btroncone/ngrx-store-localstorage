import deepmerge from "deepmerge";

// Cannot import from the @ngrx/store package due to a module resolution issue.
// See Issue #206.
const INIT_ACTION = "@ngrx/store/init";
const UPDATE_ACTION = "@ngrx/store/update-reducers";

function dateOrDefault(dateString: string): Date | string {
  const maybeDate = new Date(dateString);
  if (maybeDate.toString() === "Invalid Date") {
    return dateString;
  } else {
    return maybeDate;
  }
}

// correctly parse dates from local storage
export const dateReviver = (_key: string, value: any) => {
  if (typeof value === "string") {
    return dateOrDefault(value);
  } else {
    return value;
  }
};

const dummyReviver = (_key: string, value: any) => value;

const checkIsBrowserEnv = () => {
  return typeof window !== "undefined";
};

const validateStateKeys = (keys: Keys) => {
  return (keys as any[]).map((key) => {
    let attr = key;

    if (typeof key === "object") {
      attr = Object.keys(key)[0];
    }

    if (typeof attr !== "string") {
      throw new TypeError(
        `localStorageSync Unknown Parameter Type: ` +
          `Expected type of string, got ${typeof attr}`,
      );
    }
    return key;
  });
};

export const rehydrateApplicationState = ({
  keys,
  storage,
  storageKeySerializer,
  restoreDates,
}: {
  keys: Keys;
  storage: Storage;
  storageKeySerializer: (key: string) => string;
  restoreDates: boolean;
}) => {
  return (keys as any[]).reduce((acc, curr) => {
    let key = curr;
    let reviver = restoreDates ? dateReviver : dummyReviver;
    let deserialize: (arg0: string) => any;
    let decrypt: (arg0: string) => string;

    if (typeof key === "object") {
      key = Object.keys(key)[0];
      // use the custom reviver function
      if (typeof curr[key] === "function") {
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
          typeof curr[key].encrypt === "function" &&
          typeof curr[key].decrypt === "function"
        ) {
          decrypt = curr[key].decrypt;
        } else {
          console.error(
            `Either encrypt or decrypt is not a function on '${curr[key]}' key object.`,
          );
        }
      } else if (curr[key].encrypt || curr[key].decrypt) {
        // Let know that one of the encryption functions is not provided
        console.error(
          `Either encrypt or decrypt function is not present on '${curr[key]}' key object.`,
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

        const isObjectRegex = new RegExp("{|\\[");
        let raw = stateSlice;

        if (
          stateSlice === "null" ||
          stateSlice === "true" ||
          stateSlice === "false" ||
          isObjectRegex.test(stateSlice.charAt(0))
        ) {
          raw = JSON.parse(stateSlice, reviver);
        }

        return Object.assign({}, acc, {
          [key]: deserialize ? deserialize(raw) : raw,
        });
      }
    }
    return acc;
  }, {});
};

// Recursively traverse all properties of the existing slice as defined by the `filter` argument,
// and output the new object with extraneous properties removed.
function createStateSlice(
  existingSlice: any,
  filter: (string | number | KeyConfiguration | Options)[],
) {
  return filter.reduce(
    (
      memo: { [x: string]: any; [x: number]: any },
      attr: string | number | KeyConfiguration | Options,
    ) => {
      if (typeof attr === "string" || typeof attr === "number") {
        const value = existingSlice?.[attr];
        if (value !== undefined) {
          memo[attr] = value;
        }
      } else {
        for (const key in attr) {
          if (Object.prototype.hasOwnProperty.call(attr, key)) {
            const element = attr[key];
            memo[key] = createStateSlice(existingSlice[key], element);
          }
        }
      }
      return memo;
    },
    {},
  );
}

export const syncStateUpdate = ({
  state,
  keys,
  storage,
  storageKeySerializer,
  removeOnUndefined,
  syncCondition,
}: {
  state: any;
  keys: Keys;
  storage: Storage;
  storageKeySerializer: (key: string) => string;
  removeOnUndefined: boolean;
  syncCondition?: (state: any) => any;
}) => {
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

  keys.forEach(
    (
      key:
        | string
        | KeyConfiguration
        | Options
        | ((key: string, value: any) => any),
    ): void => {
      let stateSlice = state[key as string];
      let replacer;
      let space: string | number;
      let encrypt;

      if (typeof key === "object") {
        let name = Object.keys(key)[0];
        stateSlice = state[name];

        if (typeof stateSlice !== "undefined" && key[name]) {
          // use serialize function if specified.
          if (key[name].serialize) {
            stateSlice = key[name].serialize(stateSlice);
          } else {
            // if serialize function is not specified filter on fields if an array has been provided.
            let filter: KeyConfiguration[];
            if (key[name].reduce) {
              filter = key[name];
            } else if (key[name].filter) {
              filter = key[name].filter;
            }
            if (filter) {
              stateSlice = createStateSlice(stateSlice, filter);
            }

            // Check if encrypt and decrypt are present, also checked at this#rehydrateApplicationState()
            if (key[name].encrypt && key[name].decrypt) {
              if (typeof key[name].encrypt === "function") {
                encrypt = key[name].encrypt;
              }
            } else if (key[name].encrypt || key[name].decrypt) {
              // If one of those is not present, then let know that one is missing
              console.error(
                `Either encrypt or decrypt function is not present on '${key[name]}' key object.`,
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

      if (typeof stateSlice !== "undefined" && storage !== undefined) {
        try {
          if (encrypt) {
            // ensure that a string message is passed
            stateSlice = encrypt(
              typeof stateSlice === "string"
                ? stateSlice
                : JSON.stringify(stateSlice, replacer, space),
            );
          }
          storage.setItem(
            storageKeySerializer(key as string),
            typeof stateSlice === "string"
              ? stateSlice
              : JSON.stringify(stateSlice, replacer, space),
          );
        } catch (e) {
          console.warn("Unable to save state to localStorage:", e);
        }
      } else if (
        typeof stateSlice === "undefined" &&
        removeOnUndefined &&
        storage !== undefined
      ) {
        try {
          storage.removeItem(storageKeySerializer(key as string));
        } catch (e) {
          console.warn(
            `Exception on removing/cleaning undefined '${key}' state`,
            e,
          );
        }
      }
    },
  );
};

// Default merge strategy is a full deep merge.
export const defaultMergeReducer = (
  state: any,
  rehydratedState: any,
  action: any,
) => {
  if (
    (action.type === INIT_ACTION || action.type === UPDATE_ACTION) &&
    rehydratedState
  ) {
    const overwriteMerge = (
      destinationArray: any,
      sourceArray: any,
      options: any,
    ) => sourceArray;
    const options: deepmerge.Options = {
      arrayMerge: overwriteMerge,
    };

    state = deepmerge(state, rehydratedState, options);
  }

  return state;
};

export const localStorageSync =
  (config: LocalStorageConfig) => (reducer: any) => {
    if (
      (config.storage === undefined && !config.checkStorageAvailability) ||
      (config.checkStorageAvailability && checkIsBrowserEnv())
    ) {
      config.storage = localStorage || window.localStorage;
    }

    if (config.storageKeySerializer === undefined) {
      config.storageKeySerializer = (key) => key;
    }

    if (config.restoreDates === undefined) {
      config.restoreDates = true;
    }

    // Use default merge reducer.
    let mergeReducer = config.mergeReducer;

    if (mergeReducer === undefined || typeof mergeReducer !== "function") {
      mergeReducer = defaultMergeReducer;
    }

    const keys = validateStateKeys(config.keys);
    const { storage, storageKeySerializer, restoreDates } = config;
    const rehydratedState = config.rehydrate
      ? rehydrateApplicationState({
          keys,
          storage,
          storageKeySerializer,
          restoreDates,
        })
      : undefined;

    return function (state: any, action: any) {
      let nextState: any;

      // If state arrives undefined, we need to let it through the supplied reducer
      // in order to get a complete state as defined by user
      if (action.type === INIT_ACTION && !state) {
        nextState = reducer(state, action);
      } else {
        nextState = { ...state };
      }

      // Merge the store state with the rehydrated state using
      // either a user-defined reducer or the default.
      nextState = mergeReducer(nextState, rehydratedState, action);

      nextState = reducer(nextState, action);

      if (action.type !== INIT_ACTION) {
        const {
          storage,
          storageKeySerializer,
          removeOnUndefined,
          syncCondition,
        } = config;

        syncStateUpdate({
          state: nextState,
          keys,
          storage,
          storageKeySerializer,
          removeOnUndefined,
          syncCondition,
        });
      }

      return nextState;
    };
  };

export interface LocalStorageConfig {
  keys: Keys;
  rehydrate?: boolean;
  storage?: Storage;
  removeOnUndefined?: boolean;
  restoreDates?: boolean;
  storageKeySerializer?: (key: string) => string;
  syncCondition?: (state: any) => any;
  checkStorageAvailability?: boolean;
  mergeReducer?: (state: any, rehydratedState: any, action: any) => any;
}

interface KeyConfiguration {
  [key: string]:
    | string[]
    | number[]
    | KeyConfiguration[]
    | Options
    | ((key: string, value: any) => any);
}

interface Options {
  serialize?: (state: any) => any;
  deserialize?: (state: any) => any;
  reviver?: (key: string, value: any) => any;
  replacer?: ((key: string, value: any) => any) | string[];
  encrypt?: (message: string) => string;
  decrypt?: (message: string) => string;
  filter?: string[];
  space?: string | number;
}

export type Keys = (KeyConfiguration | Options | string)[];
