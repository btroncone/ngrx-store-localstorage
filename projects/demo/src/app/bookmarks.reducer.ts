import { createReducer, on } from "@ngrx/store";
import * as BookmarksActions from "./bookmarks.actions";

export const initialState: BookmarksActions.BookmarksState = {
  bookmarks: [],
  folders: [],
  tags: [],
};

export const bookmarksReducer = createReducer(
  initialState,
  on(BookmarksActions.addBookmark, (state, { bookmark }) => ({
    ...state,
    bookmarks: [...state.bookmarks, bookmark],
  })),
  on(BookmarksActions.updateBookmark, (state, { bookmark }) => ({
    ...state,
    bookmarks: state.bookmarks.map((b) =>
      b.id === bookmark.id ? bookmark : b,
    ),
  })),
  on(BookmarksActions.deleteBookmark, (state, { id }) => ({
    ...state,
    bookmarks: state.bookmarks.filter((b) => b.id !== id),
  })),
  on(BookmarksActions.addFolder, (state, { folder }) => ({
    ...state,
    folders: [...state.folders, folder],
  })),
  on(BookmarksActions.deleteFolder, (state, { id }) => ({
    ...state,
    folders: state.folders.filter((f) => f.id !== id),
    bookmarks: state.bookmarks.filter((b) => b.folder !== id),
  })),
  on(BookmarksActions.addTag, (state, { tag }) => ({
    ...state,
    tags: state.tags.includes(tag) ? state.tags : [...state.tags, tag],
  })),
  on(BookmarksActions.removeTag, (state, { tag }) => ({
    ...state,
    tags: state.tags.filter((t) => t !== tag),
    bookmarks: state.bookmarks.map((b) => ({
      ...b,
      tags: b.tags.filter((t) => t !== tag),
    })),
  })),
  on(BookmarksActions.clearAll, () => initialState),
);
