const INIT_ACTION = "@ngrx/store/init";
const detectDate = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;

//correctly parse dates from local storage
const dateReviver = (key : string, value : any) => {
    if (typeof value === 'string' && (detectDate.test(value))) {
        return new Date(value);
    }
    return value;
};

const validateStateKeys = (keys: any[]) => {
    return keys.map(key => {
        let attr = key;

        if (typeof key == 'object') {
          attr = Object.keys(key)[0];
        }

        if(typeof(attr) !== 'string'){
            throw new TypeError(
                `localStorageSync Unknown Parameter Type: `
                + `Expected type of string, got ${typeof attr}`
            );
        }
        return key;
    });
};

const rehydrateApplicationState = (keys: string[]) => {
    return keys.reduce((acc, curr) => {
        let key = curr;
        let reviver = dateReviver;
        let deserialize = undefined;

        if (typeof key == 'object') {
          key = Object.keys(key)[0];
          // Use the custom reviver function
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
        }

        let stateSlice = localStorage.getItem(key);
        if(stateSlice){
            let raw = JSON.parse(stateSlice,reviver);
            return Object.assign({}, acc, { [key]: deserialize ? deserialize(raw) : raw});
        }
        return acc;
    }, {});
};

const syncStateUpdate = (state : any, keys : string[]) => {
    keys.forEach(key => {

        let stateSlice = state[key];
        let replacer = undefined;
        let space = undefined;

        if (typeof key == 'object') {
            let name = Object.keys(key)[0];
            stateSlice = state[name];          

            if (key[name]) {
                // If a serialize function is specified us it
                if (key[name].serialize) {
                    stateSlice = key[name].serialize(stateSlice);
                }
                
                // If either the direct value is an array or if there is a filter member
                //  on the field object, only save off the fields specified by the filter 
                let filter = key[name];
                if (key[name].reduce) {
                    filter = key[name];
                }
                if (filter)
                {
                    stateSlice = filter.reduce((memo, attr) => {
                        memo[attr] = stateSlice[attr];
                        return memo;
                    }, {});
                }

                // replacer and space arguments to pass to JSON.stringify
                //  If these fields don't exist, undefined will just be passed
                replacer = key[name].replacer;
                space = key[name].space;
            }

            key = name;
        }

        if (typeof(stateSlice) !== 'undefined') {
            try{
                localStorage.setItem(key, typeof stateSlice == 'string' ? stateSlice : JSON.stringify(stateSlice,replacer));
            } catch(e){
                console.warn('Unable to save state to localStorage:', e);
            }
        }
    });
};

export const localStorageSync = (keys : any[], rehydrate : boolean = false) => (reducer : any) => {
    const stateKeys = validateStateKeys(keys);
    const rehydratedState = rehydrate ? rehydrateApplicationState(stateKeys) : undefined;

    return function(state = rehydratedState, action : any){
        /*
         Handle case where state is rehydrated AND initial state is supplied.
         Any additional state supplied will override rehydrated state for the given key.
         */
        if(action.type === INIT_ACTION && rehydratedState){
            state = Object.assign({}, state, rehydratedState);
        }
        const nextState = reducer(state, action);
        syncStateUpdate(nextState, stateKeys);
        return nextState;
    };
};
