"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var merge = require("lodash.merge");
var INIT_ACTION = '@ngrx/store/init';
var UPDATE_ACTION = '@ngrx/store/update-reducers';
var detectDate = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
// correctly parse dates from local storage
exports.dateReviver = function (key, value) {
    if (typeof value === 'string' && detectDate.test(value)) {
        return new Date(value);
    }
    return value;
};
var dummyReviver = function (key, value) { return value; };
var validateStateKeys = function (keys) {
    return keys.map(function (key) {
        var attr = key;
        if (typeof key === 'object') {
            attr = Object.keys(key)[0];
        }
        if (typeof attr !== 'string') {
            throw new TypeError("localStorageSync Unknown Parameter Type: " +
                ("Expected type of string, got " + typeof attr));
        }
        return key;
    });
};
exports.rehydrateApplicationState = function (keys, storage, storageKeySerializer, restoreDates) {
    return keys.reduce(function (acc, curr) {
        var _a;
        var key = curr;
        var reviver = restoreDates ? exports.dateReviver : dummyReviver;
        var deserialize = undefined;
        var decrypt = undefined;
        if (typeof key === 'object') {
            key = Object.keys(key)[0];
            // use the custom reviver function
            if (typeof curr[key] === 'function') {
                reviver = curr[key];
            }
            else {
                // use custom reviver function if available
                if (curr[key].reviver) {
                    reviver = curr[key].reviver;
                }
                // use custom serialize function if available
                if (curr[key].deserialize) {
                    deserialize = curr[key].deserialize;
                }
            }
            // Ensure that encrypt and decrypt functions are both presents
            if (curr[key].encrypt && curr[key].decrypt) {
                if (typeof curr[key].encrypt === 'function' &&
                    typeof curr[key].decrypt === 'function') {
                    decrypt = curr[key].decrypt;
                }
                else {
                    console.error("Either encrypt or decrypt is not a function on '" + curr[key] + "' key object.");
                }
            }
            else if (curr[key].encrypt || curr[key].decrypt) {
                // Let know that one of the encryption functions is not provided
                console.error("Either encrypt or decrypt function is not present on '" + curr[key] + "' key object.");
            }
        }
        var stateSlice = storage.getItem(storageKeySerializer(key));
        if (stateSlice) {
            // Use provided decrypt function
            if (decrypt) {
                stateSlice = decrypt(stateSlice);
            }
            var isObjectRegex = new RegExp('{|\\[');
            var raw = stateSlice;
            if (stateSlice === 'null' || isObjectRegex.test(stateSlice.charAt(0))) {
                raw = JSON.parse(stateSlice, reviver);
            }
            return Object.assign({}, acc, (_a = {},
                _a[key] = deserialize ? deserialize(raw) : raw,
                _a));
        }
        return acc;
    }, {});
};
exports.syncStateUpdate = function (state, keys, storage, storageKeySerializer, removeOnUndefined, syncCondition) {
    if (syncCondition) {
        try {
            if (syncCondition(state) !== true) {
                return;
            }
        }
        catch (e) {
            // Treat TypeError as do not sync
            if (e instanceof TypeError) {
                return;
            }
            throw e;
        }
    }
    keys.forEach(function (key) {
        var stateSlice = state[key];
        var replacer = undefined;
        var space = undefined;
        var encrypt = undefined;
        if (typeof key === 'object') {
            var name_1 = Object.keys(key)[0];
            stateSlice = state[name_1];
            if (typeof stateSlice !== 'undefined' && key[name_1]) {
                // use serialize function if specified.
                if (key[name_1].serialize) {
                    stateSlice = key[name_1].serialize(stateSlice);
                }
                else {
                    // if serialize function is not specified filter on fields if an array has been provided.
                    var filter = undefined;
                    if (key[name_1].reduce) {
                        filter = key[name_1];
                    }
                    else if (key[name_1].filter) {
                        filter = key[name_1].filter;
                    }
                    if (filter) {
                        stateSlice = filter.reduce(function (memo, attr) {
                            memo[attr] = stateSlice[attr];
                            return memo;
                        }, {});
                    }
                    // Check if encrypt and decrypt are present, also checked at this#rehydrateApplicationState()
                    if (key[name_1].encrypt && key[name_1].decrypt) {
                        if (typeof key[name_1].encrypt === 'function') {
                            encrypt = key[name_1].encrypt;
                        }
                    }
                    else if (key[name_1].encrypt || key[name_1].decrypt) {
                        // If one of those is not present, then let know that one is missing
                        console.error("Either encrypt or decrypt function is not present on '" + key[name_1] + "' key object.");
                    }
                }
                /*
                            Replacer and space arguments to pass to JSON.stringify.
                            If these fields don't exist, undefined will be passed.
                        */
                replacer = key[name_1].replacer;
                space = key[name_1].space;
            }
            key = name_1;
        }
        if (typeof stateSlice !== 'undefined') {
            try {
                if (encrypt) {
                    // ensure that a string message is passed
                    stateSlice = encrypt(typeof stateSlice === 'string'
                        ? stateSlice
                        : JSON.stringify(stateSlice, replacer, space));
                }
                storage.setItem(storageKeySerializer(key), typeof stateSlice === 'string'
                    ? stateSlice
                    : JSON.stringify(stateSlice, replacer, space));
            }
            catch (e) {
                console.warn('Unable to save state to localStorage:', e);
            }
        }
        else if (typeof stateSlice === 'undefined' && removeOnUndefined) {
            try {
                storage.removeItem(storageKeySerializer(key));
            }
            catch (e) {
                console.warn("Exception on removing/cleaning undefined '" + key + "' state", e);
            }
        }
    });
};
exports.localStorageSync = function (config) { return function (reducer) {
    if (config.storage === undefined) {
        config.storage = localStorage || window.localStorage;
    }
    if (config.storageKeySerializer === undefined) {
        config.storageKeySerializer = function (key) { return key; };
    }
    if (config.restoreDates === undefined) {
        config.restoreDates = true;
    }
    return function (state, action) {
        var nextState;
        // If state arrives undefined, we need to let it through the supplied reducer
        // in order to get a complete state as defined by user
        if ((action.type === INIT_ACTION) && !state) {
            nextState = reducer(state, action);
        }
        else {
            nextState = __assign({}, state);
        }
        var stateKeys = validateStateKeys(config.keys);
        var rehydratedState = config.rehydrate
            ? exports.rehydrateApplicationState(stateKeys, config.storage, config.storageKeySerializer, config.restoreDates)
            : undefined;
        if ((action.type === INIT_ACTION || action.type === UPDATE_ACTION) && rehydratedState) {
            nextState = merge({}, nextState, rehydratedState);
        }
        nextState = reducer(nextState, action);
        if (action.type !== INIT_ACTION) {
            exports.syncStateUpdate(nextState, stateKeys, config.storage, config.storageKeySerializer, config.removeOnUndefined, config.syncCondition);
        }
        return nextState;
    };
}; };
/*
    @deprecated: Use localStorageSync(LocalStorageConfig)

    Wraps localStorageSync functionality acepting the removeOnUndefined boolean parameter in order
    to clean/remove the state from the browser on situations like state reset or logout.
    Defines localStorage as default storage.
*/
exports.localStorageSyncAndClean = function (keys, rehydrate, removeOnUndefined) {
    if (rehydrate === void 0) { rehydrate = false; }
    if (removeOnUndefined === void 0) { removeOnUndefined = false; }
    return function (reducer) {
        var config = {
            keys: keys,
            rehydrate: rehydrate,
            storage: localStorage,
            removeOnUndefined: removeOnUndefined
        };
        return _this.localStorageSync(config);
    };
};
//# sourceMappingURL=index.js.map