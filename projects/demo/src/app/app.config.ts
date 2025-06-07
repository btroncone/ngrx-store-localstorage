import {
  ApplicationConfig,
  provideExperimentalZonelessChangeDetection,
} from "@angular/core";
import { provideRouter } from "@angular/router";

import { provideStore } from "@ngrx/store";

import { localStorageSync } from "projects/lib/src/lib";

import { routes } from "./app.routes";
import { bookmarksReducer } from "./bookmarks.reducer";

import type { ActionReducer, ActionReducerMap, MetaReducer } from "@ngrx/store";

import type { BookmarksState } from "./bookmarks.actions";

export type AppState = { bookmarks: BookmarksState };

const reducer: ActionReducerMap<AppState> = { bookmarks: bookmarksReducer };

export function localStorageSyncReducer(reducer: ActionReducer<AppState>) {
  return localStorageSync({
    keys: ["bookmarks"],
    // TODO(dates): Investigate serialization of dates
    // This throws on creation of new bookmarks in combination with `createdAt` and `updatedAt` fields being Date objects.
    // keys: [
    //   {
    //     bookmarks: {
    //       serialize: (state: BookmarksState) => ({
    //         ...state,
    //         bookmarks: state.bookmarks.map((b) => ({
    //           ...b,
    //           createdAt: b.createdAt.toISOString(),
    //           updatedAt: b.updatedAt.toISOString(),
    //         })),
    //       }),
    //       deserialize: (state: BookmarksState) => ({
    //         ...state,
    //         bookmarks: (state.bookmarks || []).map((b) => ({
    //           ...b,
    //           createdAt: b.createdAt ? b.createdAt : undefined,
    //           updatedAt: b.updatedAt ? b.updatedAt : undefined,
    //           // createdAt: b.createdAt ? new Date(b.createdAt) : undefined,
    //           // updatedAt: b.updatedAt ? new Date(b.updatedAt) : undefined,
    //         })),
    //       }),
    //     },
    //   },
    // ],
    rehydrate: true,
    restoreDates: true,
    removeOnUndefined: true,
    storageKeySerializer: (key) => `demo_${key}`,
  })(reducer);
}

export const metaReducers: MetaReducer[] = [localStorageSyncReducer];

export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes),
    provideStore(reducer, {
      metaReducers,
      runtimeChecks: {
        strictActionImmutability: true,
        strictActionSerializability: true,
        strictActionTypeUniqueness: true,
        strictStateImmutability: true,
        strictStateSerializability: true,
      },
    }),
    // provideStoreDevtools({
    //   maxAge: 25,
    //   logOnly: !isDevMode(),
    //   autoPause: true,
    //   connectInZone: false,
    // }),
  ],
};
