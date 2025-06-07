import { createFeatureSelector, createSelector } from "@ngrx/store";
import { BookmarksState } from "./bookmarks.actions";

export const selectBookmarksState =
  createFeatureSelector<BookmarksState>("bookmarks");

export const selectAllBookmarks = createSelector(
  selectBookmarksState,
  (state) => state.bookmarks,
);

export const selectAllFolders = createSelector(
  selectBookmarksState,
  (state) => state.folders,
);

export const selectAllTags = createSelector(
  selectBookmarksState,
  (state) => state.tags,
);
