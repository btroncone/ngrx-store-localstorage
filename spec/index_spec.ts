declare var it, describe, expect;
require('es6-shim');
import * as CryptoJS from 'crypto-js';
import deepmerge from 'deepmerge';
import 'localstorage-polyfill';
import {
    dateReviver,
    localStorageSync,
    rehydrateApplicationState,
    syncStateUpdate,
} from '../projects/lib/src/public_api';

const INIT_ACTION = '@ngrx/store/init';

// Very simple classes to test serialization options.  They cover string, number, date, and nested classes
// The top level class has static functions to help test reviver, replacer, serialize and deserialize
class TypeB {
    constructor(public afield: string) {}
}

class TypeA {
    static reviver(key: string, value: any): any {
        if (typeof value === 'object') {
            if (value.afield) {
                return new TypeB(value.afield);
            } else {
                return new TypeA(value.astring, value.anumber, value.aboolean, value.adate, value.aclass);
            }
        }
        return dateReviver(key, value);
    }

    static replacer(key: string, value: any) {
        if (key === 'anumber' || key === 'aboolean' || key === 'adate') {
            return undefined;
        }
        return value;
    }

    static serialize(a: TypeA): string {
        return JSON.stringify(a);
    }

    static deserialize(json: any): TypeA {
        return new TypeA(json.astring, json.anumber, json.aboolean, json.adate, new TypeB(json.aclass.afield));
    }

    constructor(
        public astring: string = undefined,
        public anumber: number = undefined,
        public aboolean: boolean = undefined,
        public adate: Date = undefined,
        public aclass: TypeB = undefined
    ) {}
}

class TypeC extends TypeA {
    static key = 's3cret';

    static encrypt(message: string) {
        let secret = CryptoJS.AES.encrypt(message, TypeC.key);
        return secret.toString();
    }

    static decrypt(message: string) {
        let decoded = CryptoJS.AES.decrypt(message, TypeC.key);
        return decoded.toString(CryptoJS.enc.Utf8);
    }
}

class MockStorage implements Storage {
    public length: number;
    public clear(): void {
        throw 'Not Implemented';
    }
    public getItem(key: string): string | null {
        return this[key] ? this[key] : null;
    }
    key(index: number): string | null {
        throw 'Not Implemented';
    }
    removeItem(key: string): void {
        this[key] = undefined;
    }
    setItem(key: string, data: string): void {
        this[key] = data;
    }
    [key: string]: any;
    [index: number]: string;
}

function mockStorageKeySerializer(key) {
    return key;
}

describe('ngrxLocalStorage', () => {
    let t1 = new TypeA('Testing', 3.14159, true, new Date('1968-11-16T12:30:00Z'), new TypeB('Nested Class'));

    let t1Json = JSON.stringify(t1);

    let t1Filtered = new TypeA('Testing', undefined, undefined, undefined, new TypeB('Nested Class'));

    let t1Simple = { astring: 'Testing', adate: '1968-11-16T12:30:00.000Z', anumber: 3.14159, aboolean: true };

    let initialState = { state: t1 };

    let initialStateJson = JSON.stringify(initialState);

    let undefinedState = { state: undefined };

    beforeEach(() => {
        localStorage.clear();
    });

    it('simple', () => {
        // This tests a very simple state object syncing to mock Storage
        // Since we're not specifiying anything for rehydration, the roundtrip
        // loses type information...

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;

        syncStateUpdate(initialState, ['state'], s, skr, false);

        let raw = s.getItem('state');
        expect(raw).toEqual(t1Json);

        let finalState: any = rehydrateApplicationState(['state'], s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(initialStateJson);

        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.simple instanceof TypeA).toBeFalsy();
    });

    it('simple string', () => {
        const primitiveStr = 'string is not an object';
        const initialStatePrimitiveStr = { state: primitiveStr };

        const s = new MockStorage();
        const skr = mockStorageKeySerializer;

        syncStateUpdate(initialStatePrimitiveStr, ['state'], s, skr, false);

        const raw = s.getItem('state');
        expect(raw).toEqual(primitiveStr);

        const finalState: any = rehydrateApplicationState(['state'], s, skr, true);
        expect(finalState.state).toEqual(primitiveStr);
    });

    [true, false].forEach((bool) => {
        it(`simple ${bool} boolean`, () => {
            const primitiveBool = bool;
            const initialStatePrimitiveBool = { state: primitiveBool };

            const s = new MockStorage();
            const skr = mockStorageKeySerializer;

            syncStateUpdate(initialStatePrimitiveBool, ['state'], s, skr, false);

            const raw = s.getItem('state');
            expect(JSON.parse(raw)).toEqual(primitiveBool);

            const finalState: any = rehydrateApplicationState(['state'], s, skr, true);
            expect(finalState.state).toEqual(primitiveBool);
        });
    });

    it('filtered', () => {
        // Use the filter by field option to round-trip an object while
        // filtering out the anumber and adate filed
        // Since we're not specifiying anything for rehydration, the roundtrip
        // loses type information...

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { state: t1 };
        let keys = [{ state: ['astring', 'aclass'] }];

        syncStateUpdate(initialState, keys, s, skr, false);

        let raw = s.getItem('state');
        expect(raw).toEqual(JSON.stringify(t1Filtered));

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(JSON.stringify({ state: t1Filtered }));

        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.state instanceof TypeA).toBeFalsy();
    });

    it('filtered - multiple keys at root - should properly revive partial state', function () {
        const s = new MockStorage();
        const skr = mockStorageKeySerializer;

        // state at any given moment, subject to sync selectively
        const nestedState = {
            app: { app1: true, app2: [1, 2], app3: { any: 'thing' } },
            feature1: { slice11: true, slice12: [1, 2], slice13: { any: 'thing' } },
            feature2: { slice21: true, slice22: [1, 2], slice23: { any: 'thing' } },
        };

        // test selective write to storage
        syncStateUpdate(
            nestedState,
            [{ feature1: ['slice11', 'slice12'] }, { feature2: ['slice21', 'slice22'] }],
            s,
            skr,
            false
        );

        const raw1 = s.getItem('feature1');
        expect(raw1).toEqual(JSON.stringify({ slice11: true, slice12: [1, 2] }));

        const raw2 = s.getItem('feature2');
        expect(raw2).toEqual(JSON.stringify({ slice21: true, slice22: [1, 2] }));
    });

    it('reviver', () => {
        // Use the reviver option to restore including classes

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { state: t1 };
        let keys = [{ state: TypeA.reviver }];

        syncStateUpdate(initialState, keys, s, skr, false);

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(JSON.stringify(initialState));
        expect(finalState.state instanceof TypeA).toBeTruthy();
        expect(finalState.state.aclass instanceof TypeB).toBeTruthy();
    });

    it('reviver-object', () => {
        // Use the reviver in the object options to restore including classes

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { state: t1 };
        let keys = [{ state: { reviver: TypeA.reviver } }];

        syncStateUpdate(initialState, keys, s, skr, false);

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(JSON.stringify(initialState));
        expect(finalState.state instanceof TypeA).toBeTruthy();
        expect(finalState.state.aclass instanceof TypeB).toBeTruthy();
    });

    it('filter-object', () => {
        // Use the filter by field option to round-trip an object while
        // filtering out the anumber and adate filed

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { filtered: t1 };
        let keys = [{ filtered: { filter: ['astring', 'aclass'] } }];

        syncStateUpdate(initialState, keys, s, skr, false);

        let raw = s.getItem('filtered');
        expect(raw).toEqual(JSON.stringify(t1Filtered));

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(JSON.stringify({ filtered: t1Filtered }));

        // Since we're not specifiying anything for rehydration, the roundtrip
        //  loses type information...
        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.filtered instanceof TypeA).toBeFalsy();
    });

    it('replacer-function', () => {
        // Use the replacer function to filter

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { replacer: t1 };
        let keys = [{ replacer: { reviver: TypeA.replacer } }];

        syncStateUpdate(initialState, keys, s, skr, false);

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(JSON.stringify({ replacer: t1Filtered }));

        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.replacer instanceof TypeA).toBeFalsy();
    });

    it('replacer-array', () => {
        // Use the replacer option to do some custom filtering of the class
        // Note that this completely loses the idea that the revived object ever contained the
        //  fields not specified by the replacer, so we have to do some custom comparing

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { replacer: t1 };
        let keys = [{ replacer: { replacer: ['astring', 'adate', 'anumber'], space: 2 } }];

        syncStateUpdate(initialState, keys, s, skr, false);

        // We want to validate the space parameter, but don't want to trip up on OS specific newlines, so filter the newlines out and
        //  compare against the literal string.
        let raw = s.getItem('replacer');
        expect(raw.replace(/\r?\n|\r/g, '')).toEqual(
            '{  "astring": "Testing",  "adate": "1968-11-16T12:30:00.000Z",  "anumber": 3.14159}'
        );

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);

        expect(JSON.stringify(finalState)).toEqual(
            '{"replacer":{"astring":"Testing","adate":"1968-11-16T12:30:00.000Z","anumber":3.14159}}'
        );

        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.replacer instanceof TypeA).toBeFalsy();
    });

    it('serializer', () => {
        // Use the serialize/deserialize options to save and restore including classes

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { state: t1 };
        let keys = [{ state: { serialize: TypeA.serialize, deserialize: TypeA.deserialize } }];

        syncStateUpdate(initialState, keys, s, skr, false);

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(initialStateJson);
        expect(finalState.state instanceof TypeA).toBeTruthy();
        expect(finalState.state.aclass instanceof TypeB).toBeTruthy();
    });

    it('removeOnUndefined', () => {
        // This tests that the state slice is removed when the state it's undefined
        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        syncStateUpdate(initialState, ['state'], s, skr, true);

        // do update
        let raw = s.getItem('state');
        expect(raw).toEqual(t1Json);

        // ensure that it's erased
        syncStateUpdate(undefinedState, ['state'], s, skr, true);
        raw = s.getItem('state');
        expect(raw).toBeFalsy();
    });

    it('keepOnUndefined', () => {
        // This tests that the state slice is keeped when the state it's undefined
        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        syncStateUpdate(initialState, ['state'], s, skr, false);

        // do update
        let raw = s.getItem('state');
        expect(raw).toEqual(t1Json);

        // test update doesn't erase when it's undefined
        syncStateUpdate(undefinedState, ['state'], s, skr, false);
        raw = s.getItem('state');
        expect(raw).toEqual(t1Json);
    });

    it('not restoreDates', () => {
        // Tests that dates are not revived when the flag is set to false

        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        const initalState = { state: t1Simple };

        syncStateUpdate(initalState, ['state'], s, skr, false);

        let finalState: any = rehydrateApplicationState(['state'], s, skr, false);
        expect(finalState).toEqual(initalState, 'rehydrated state should equal initial state');
    });

    it('encrypt-decrypt', () => {
        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { state: t1 };
        let keys = [{ state: { encrypt: TypeC.encrypt, decrypt: TypeC.decrypt } }];

        syncStateUpdate(initialState, keys, s, skr, false);
        // Decript stored value and compare with the on-memory state
        let raw = s.getItem('state');
        expect(TypeC.decrypt(raw)).toEqual(JSON.stringify(initialState.state));

        // Retrieve the stored state with the rehydrateApplicationState function and
        let storedState = rehydrateApplicationState(keys, s, skr, true);
        expect(initialStateJson).toEqual(JSON.stringify(storedState));
    });

    it('encrypt-decrypt-are-required', () => {
        let s = new MockStorage();
        let skr = mockStorageKeySerializer;
        let initialState = { state: t1 };
        let keys;
        keys = [{ state: { encrypt: TypeC.encrypt } }];

        syncStateUpdate(initialState, keys, s, skr, false);
        // Stored value must not be encripted due to decrypt function is not present, so must be equal to the on-memory state
        let raw = s.getItem('state');
        expect(raw).toEqual(JSON.stringify(initialState.state));

        // Stored value must not be encripted, if one of the encryption functions are not present
        keys = [{ state: { decrypt: TypeC.decrypt } }];
        syncStateUpdate(initialState, keys, s, skr, false);
        raw = s.getItem('state');
        expect(raw).toEqual(JSON.stringify(initialState.state));
    });

    it('storageKeySerializer', () => {
        // This tests that storage key serializer are working.
        let s = new MockStorage();
        let skr = (key) => `this_key` + key;
        syncStateUpdate(initialState, ['state'], s, skr, false);

        let raw = s.getItem('1232342');
        expect(raw).toBeNull();

        let finalState: any = rehydrateApplicationState(['state'], s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(initialStateJson);

        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.simple instanceof TypeA).toBeFalsy();
    });

    it('syncCondition', () => {
        // Test that syncCondition can selectively trigger a sync state update
        let s = new MockStorage();
        let skr = mockStorageKeySerializer;

        // Selector always returns false - meaning it should never sync
        const shouldNotSyncSelector = (state: any) => {
            return false;
        };

        syncStateUpdate(initialState, ['state'], s, skr, false, shouldNotSyncSelector);

        let raw = s.getItem('state');
        expect(raw).toEqual(null);

        let finalState: any = rehydrateApplicationState(['state'], s, skr, true);
        expect(JSON.stringify(finalState)).toEqual('{}');

        // Selector should error - so still no sync
        const errorSelector = (state: any) => {
            return state.doesNotExist;
        };

        syncStateUpdate(initialState, ['state'], s, skr, false, errorSelector);

        raw = s.getItem('state');
        expect(raw).toEqual(null);

        // Selector always returns true - so it should sync
        const shouldSyncSelector = (state: any) => {
            return true;
        };

        syncStateUpdate(initialState, ['state'], s, skr, false, shouldSyncSelector);

        raw = s.getItem('state');
        expect(raw).toEqual(t1Json);

        finalState = rehydrateApplicationState(['state'], s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(initialStateJson);
    });

    it('merge initial state and rehydrated state', () => {
        // localStorage starts out in a "bad" state. This could happen if our application state schema
        // changes. End users may have the old schema and a software update has the new schema.
        localStorage.setItem('state', JSON.stringify({ oldstring: 'foo' }));

        // Set up reducers
        const reducer = (state = initialState, action) => state;
        const metaReducer = localStorageSync({ keys: ['state'], rehydrate: true });
        const action = { type: INIT_ACTION };

        // Resultant state should merge the oldstring state and our initual state
        const finalState = metaReducer(reducer)(initialState, action);
        expect(finalState.state.astring).toEqual(initialState.state.astring);
    });

    it('should merge selectively saved state and rehydrated state', () => {
        const initialState = {
            app: { app1: false, app2: [], app3: {} },
            feature1: { slice11: false, slice12: [], slice13: {} },
            feature2: { slice21: false, slice22: [], slice23: {} },
        };

        // A legit case where state is saved in chunks rather than as a single object
        localStorage.setItem('feature1', JSON.stringify({ slice11: true, slice12: [1, 2] }));
        localStorage.setItem('feature2', JSON.stringify({ slice21: true, slice22: [1, 2] }));

        // Set up reducers
        const reducer = (state = initialState, action) => state;
        const metaReducer = localStorageSync({
            keys: [{ feature1: ['slice11', 'slice12'] }, { feature2: ['slice21', 'slice22'] }],
            rehydrate: true,
        });

        const action = { type: INIT_ACTION };

        // Resultant state should merge the rehydrated partial state and our initial state
        const finalState = metaReducer(reducer)(initialState, action);
        expect(finalState).toEqual({
            app: { app1: false, app2: [], app3: {} },
            feature1: { slice11: true, slice12: [1, 2], slice13: {} },
            feature2: { slice21: true, slice22: [1, 2], slice23: {} },
        });
    });

    it('should enable a complex merge of rehydrated storage and state (with mergeReducer)', () => {
        const initialState = {
            app: { app1: false, app2: [], app3: {} },
            feature1: { slice11: false, slice12: [], slice13: {} },
            feature2: { slice21: false, slice22: [], slice23: {} },
        };

        // A legit case where state is saved in chunks rather than as a single object
        localStorage.setItem('feature1', JSON.stringify({ slice11: true, slice12: [1, 2] }));
        localStorage.setItem('feature2', JSON.stringify({ slice21: true, slice22: [1, 2] }));

        // Set up reducers
        const reducer = (state = initialState, action) => state;
        const mergeReducer = (state, rehydratedState, action) => {
            // Perform a merge where we only want a single property from feature1
            // but a deepmerge with feature2

            return {
                ...state,
                feature1: {
                    slice11: rehydratedState.feature1.slice11,
                },
                feature2: deepmerge(state.feature2, rehydratedState.feature2),
            };
        };
        const metaReducer = localStorageSync({
            keys: [{ feature1: ['slice11', 'slice12'] }, { feature2: ['slice21', 'slice22'] }],
            rehydrate: true,
            mergeReducer,
        });

        const action = { type: INIT_ACTION };

        // Resultant state should merge the rehydrated partial state and our initial state
        const finalState = metaReducer(reducer)(initialState, action);
        expect(finalState).toEqual({
            app: { app1: false, app2: [], app3: {} },
            feature1: { slice11: true },
            feature2: { slice21: true, slice22: [1, 2], slice23: {} },
        });
    });

    it('should save targeted infinite depth to localStorage', () => {
        // Configure to only save feature1.slice11.slice11_1 and feature2.slice12,
        // ignore all other properties
        const metaReducer = localStorageSync({
            keys: [{ feature1: [{ slice11: ['slice11_1'], slice14: ['slice14_2'] }] }, { feature2: ['slice21'] }],
        });

        // Execute action
        metaReducer((state: any, _action: any) => state)(
            // Initial state with lots of unrelated properties
            {
                feature1: {
                    slice11: { slice11_1: 'good_value', slice11_2: 'bad_value' },
                    slice12: [],
                    slice13: false,
                    slice14: { slice14_1: true, slice14_2: 'other_good_value' },
                },
                feature2: {
                    slice21: 'third_good_value',
                },
            },
            { type: 'SomeAction' }
        );

        // Local storage should match expect values
        expect(JSON.parse(localStorage['feature1'])).toEqual({
            slice11: { slice11_1: 'good_value' },
            slice14: { slice14_2: 'other_good_value' },
        });
        expect(JSON.parse(localStorage['feature2'])).toEqual({ slice21: 'third_good_value' });
    });

    it('should allow a mix of partial and full state in keys', () => {
        // given
        const metaReducer = localStorageSync({
            keys: [
                // partial state - object
                { feature1: [{ slice11: ['slice11_1'], slice14: ['slice14_2'] }] },

                // full state - string
                'feature2',
            ],
        });

        // when
        metaReducer((state: any, _action: any) => state)(
            {
                feature1: {
                    slice11: { slice11_1: 'good_value', slice11_2: 'bad_value' },
                    slice12: [],
                    slice13: false,
                    slice14: { slice14_1: true, slice14_2: 'other_good_value' },
                },
                feature2: {
                    slice21: 'third_good_value',
                    slice22: 'fourth_good_value',
                },
            },
            { type: 'SomeAction' }
        );

        // then
        expect(JSON.parse(localStorage['feature1'])).toEqual({
            slice11: { slice11_1: 'good_value' },
            slice14: { slice14_2: 'other_good_value' },
        });
        expect(JSON.parse(localStorage['feature2'])).toEqual({
            slice21: 'third_good_value',
            slice22: 'fourth_good_value',
        });
    });
    it('should allow various valid date formats when parsing string', () => {
        // given
        const sampleDateTimes = [
            '2025/04/15', // yyyy/mm/dd
            '2025-04-15', // yyyy-mm-dd (ISO 8601)
            '12/04/2025', // dd/mm/yyyy
            '12-04-2025', // dd-mm-yyyy
            '04/15/2025', // mm/dd/yyyy (US)
            '04-15-2025', // mm-dd-yyyy (US)
            'Apr 15, 2025', // short month format
            '15 Apr 2025', // day short month year
            'April 15, 2025', // full month format
            '15 April 2025', // day full month year
            '2025.04.15', // dot-separated
            '2025-Apr-15', // ISO variation
            '2025-April-15', // verbose ISO
            'Tuesday, April 15, 2025', // full day name
            'Tue, 15 Apr 2025', // RFC 2822 format
            '2025-04-12T00:00:00', // ISO with time
            '2025-04-12T00:00:00Z', // ISO UTC
            '2025-04-12T00:00:00+02:00', // ISO with timezone
        ];

        // then
        sampleDateTimes.forEach(date => expect(dateReviver(null, date)).toEqual(new Date(date)));
    });
    it('should disallow various invalid date formats when parsing string', () => {
        // given
        const sampleDateTimes = [
            '2025fdsa/04/15', // yyyy/mm/dd
            '2025fdsa-04-15', // yyyy-mm-dd (ISO 8601)
            '12fdsa/04/2025', // dd/mm/yyyy
            '12fdsa-04-2025', // dd-mm-yyyy
            '04fdsa/15/2025', // mm/dd/yyyy (US)
            '04fdsa-15-2025', // mm-dd-yyyy (US)
            'Apr fdsa15, 2025', // short month format
            '15 Apr fdsa2025', // day short month year
            'April fdsa15, 2025', // full month format
            '15 April fdsa2025', // day full month year
            '2025.fdsa04.15', // dot-separated
            '2025-Apr-1fdsa5', // ISO variation
            '2025-Afdsailpr-15', // verbose ISO
            'Tuesday, fdsaApril 15, 2025', // full day name
            'Tue, 15 Apr fdsa2025', // RFC 2822 format
            '2025-04-12Tfdsa00:00:00', // ISO with time
            '2025-04-12Tfdsa00:00:00Z', // ISO UTC
            '2025-04-fdsa12T00:00:00+02:00', // ISO with timezone
            '{ "nestedDate": "2025-04-12T00:00:00Z" }' // nested json date
        ];

        // then
        sampleDateTimes.forEach(date => expect(dateReviver(null, date)).toEqual(date));
    });
});
