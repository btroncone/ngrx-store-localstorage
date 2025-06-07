import { createAction, props } from "@ngrx/store";

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  folder: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  // TODO(dates): Investigate serialization of dates
  //   createdAt: Date;
  //   updatedAt: Date;
}

export interface Folder {
  id: string;
  name: string;
}

export interface BookmarksState {
  bookmarks: Bookmark[];
  folders: Folder[];
  tags: string[];
}

export const addBookmark = createAction(
  "[Bookmarks] Add",
  props<{ bookmark: Bookmark }>(),
);
export const updateBookmark = createAction(
  "[Bookmarks] Update",
  props<{ bookmark: Bookmark }>(),
);
export const deleteBookmark = createAction(
  "[Bookmarks] Delete",
  props<{ id: string }>(),
);
export const addFolder = createAction(
  "[Folders] Add",
  props<{ folder: Folder }>(),
);
export const deleteFolder = createAction(
  "[Folders] Delete",
  props<{ id: string }>(),
);
export const addTag = createAction("[Tags] Add", props<{ tag: string }>());
export const removeTag = createAction(
  "[Tags] Remove",
  props<{ tag: string }>(),
);
export const clearAll = createAction("[Bookmarks] Clear All");
