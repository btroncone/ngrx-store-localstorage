declare var beforeEachProviders, it, describe, expect, inject;
require('es6-shim');
import { syncStateUpdate, rehydrateApplicationState, dateReviver, mergePartialStates } from '../src/index';
import *  as CryptoJS from 'crypto-js';

// Very simple classes to test serialization options.  They cover string, number, date, and nested classes
// The top level class has static functions to help test reviver, replacer, serialize and deserialize
class TypeB {
    constructor(public afield: string) { }
}

class TypeA {
    static reviver(key: string, value: any): any {
        if (typeof value === 'object') {
            if (value.afield) {
                return new TypeB(value.afield);
            }
            else {
                return new TypeA(value.astring, value.anumber, value.adate, value.aclass);
            }
        }
        return dateReviver(key, value);
    }

    static replacer(key: string, value: any) {
        if (key === 'anumber' || key === 'adate') {
            return undefined;
        }
        return value;
    }

    static serialize(a: TypeA): string {
        return JSON.stringify(a);
    }

    static deserialize(json: any): TypeA {
        return new TypeA(json.astring, json.anumber, json.adate, new TypeB(json.aclass.afield));
    }

    constructor(
        public astring: string = undefined,
        public anumber: number = undefined,
        public adate: Date = undefined,
        public aclass: TypeB = undefined
    ) { }
}

class TypeC extends TypeA {
    static key = 's3cret';

    static encrypt(message: string) {
        let secret = CryptoJS.AES.encrypt(message, TypeC.key);
        return secret.toString();
    }

    static decrypt(message: string) {
        let decoded = CryptoJS.AES.decrypt(message, TypeC.key);
        decoded = decoded.toString(CryptoJS.enc.Utf8);

        return decoded;
    }
}

class MockStorage implements Storage {
    public length: number;
    public clear(): void { throw 'Not Implemented'; }
    public getItem(key: string): string | null {
        return this[key] ? this[key] : null;
    }
    key(index: number): string | null { throw 'Not Implemented'; }
    removeItem(key: string): void { this[key] = undefined; }
    setItem(key: string, data: string): void {
        this[key] = data;
    }
    [key: string]: any;
    [index: number]: string;
}

function mockStorageKeySerializer(key) { return key; }


describe('ngrxLocalStorage', () => {
    let t1 = new TypeA(
        'Testing',
        3.14159,
        new Date('1968-11-16T12:30:00Z'),
        new TypeB('Nested Class'));

    let t1Json = JSON.stringify(t1);

    let t1Filtered = new TypeA(
        'Testing',
        undefined,
        undefined,
        new TypeB('Nested Class'));

    let t1FilteredJson = JSON.stringify(t1Filtered);

    let t1Simple = { astring: 'Testing', adate: '1968-11-16T12:30:00.000Z', anumber: 3.14159 };

    let initialState = { state: t1 };

    let initialStateJson = JSON.stringify(initialState);

    let undefinedState = { state: undefined };

    let undefinedStateJson = JSON.stringify(undefinedState);

    const primitiveStr = 'string is not an object';
    const initialStatePrimitiveStr = { state: primitiveStr };

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
        const s = new MockStorage();
        const skr = mockStorageKeySerializer;

        syncStateUpdate(initialStatePrimitiveStr, ['state'], s, skr, false);

        const raw = s.getItem('state');
        expect(raw).toEqual(primitiveStr);

        const finalState: any = rehydrateApplicationState(['state'], s, skr, true);
        expect(finalState.state).toEqual(primitiveStr);
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
        expect(raw.replace(/\r?\n|\r/g, '')).toEqual('{  "astring": "Testing",  "adate": "1968-11-16T12:30:00.000Z",  "anumber": 3.14159\}');

        let finalState: any = rehydrateApplicationState(keys, s, skr, true);

        expect(JSON.stringify(finalState)).toEqual('{"replacer":{"astring":"Testing","adate":"1968-11-16T12:30:00.000Z","anumber":3.14159}}');

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
        const initalState = {state: t1Simple};

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
        console.log(skr('a'));
        syncStateUpdate(initialState, ['state'], s, skr, false);

        let raw = s.getItem('1232342');
        expect(raw).toBeNull();

        let finalState: any = rehydrateApplicationState(['state'], s, skr, true);
        expect(JSON.stringify(finalState)).toEqual(initialStateJson);

        expect(t1 instanceof TypeA).toBeTruthy();
        expect(finalState.simple instanceof TypeA).toBeFalsy();
    });

    it('merges partial states', () => {
        const keyDef = ['foo', { bar: ['baz'] }];
      expect(true).toEqual(false);
        expect(
          mergePartialStates(
            keyDef,
            { bar: {baz: 123, nitch: 456} },
            { foo: 'hello', bar: {baz: 1} },
          )
        ).toEqual({
          foo: 'hello',
          bar: {
            baz: 1,
            nitch: 456
          }
        });
    });
});
