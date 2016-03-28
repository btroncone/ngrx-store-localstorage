import {provide, Provider} from 'angular2/core';
import {Observable} from 'rxjs/Observable';
import {POST_MIDDLEWARE, INITIAL_STATE} from '@ngrx/store';

const validateStateKeys = (keys: string[]) => {
    return keys.map(key => {
            if(typeof(key) !== 'string'){
        throw new TypeError(
            `localStorageMiddleware Unknown Parameter Type: `
            + `Expected type of string, got ${typeof key}`
        );
    }
    return key;
});
};

const rehydrateApplicationState = (keys: string[]) => {
    let rehydratedState = keys.reduce((acc, curr) => {
        let stateSlice = localStorage.getItem(curr);
        if(typeof(stateSlice) !== 'undefined'){
            return Object.assign({}, acc, { [curr]: JSON.parse(stateSlice) })
        }
        return acc;
    }, {});

    return provide(INITIAL_STATE, { useValue: rehydratedState });
};

const createLocalStorageMiddleware = (keys : string[]) => {
    const stateKeys = validateStateKeys(keys);
    return (obs:Observable<any>) => {
        return obs.do(state => {
            stateKeys.forEach(key => {
                let stateSlice = state[key];
                if (typeof(stateSlice) !== 'undefined') {
                    localStorage.setItem(key, JSON.stringify(state[key]));
                }
            });
        });
    }
};

export const localStorageMiddleware = (keys : string[], rehydrateState : string[]) => {
    const middleware = createLocalStorageMiddleware(keys);
    const localStorageProvider = provide(POST_MIDDLEWARE, {
        multi: true,
        useValue: middleware
    });

    return rehydrateState
        ? [localStorageProvider, keyCheck(keys, rehydrateState)]
        : [localStorageProvider]
};

const keyCheck = (keys, rehydrateState) => {
    const result = rehydrateState.filter(state => {
        return keys.filter(key => key === state).length > 0;
    });
    
    if (result.length === rehydrateState.length) {        
        rehydrateApplicationState(result);
    } else {
        const failedKey = rehydrateState.filter(state => {
            return !(keys.filter(key => key === state).length > 0);
        });
        console.log("The following keys are erroneous:");
        console.log(failedKey);
    }
};
