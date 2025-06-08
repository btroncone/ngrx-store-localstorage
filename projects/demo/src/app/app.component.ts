import type { Signal, WritableSignal } from "@angular/core";
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { RouterOutlet } from "@angular/router";

import { Store } from "@ngrx/store";

import { v4 as uuidv4 } from "uuid";

import * as BookmarksActions from "./bookmarks.actions";
import * as BookmarksSelectors from "./bookmarks.selectors";

import { MatButtonModule } from "@angular/material/button";
import { MatCardModule } from "@angular/material/card";
import { MatChipsModule } from "@angular/material/chips";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatIconModule } from "@angular/material/icon";
import { MatInputModule } from "@angular/material/input";
import { MatToolbarModule } from "@angular/material/toolbar";

import type { AppState } from "./app.config";
import type { Bookmark } from "./bookmarks.actions";

@Component({
  selector: "app-root",
  imports: [
    FormsModule,
    RouterOutlet,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatToolbarModule,
  ],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly store = inject<Store<AppState>>(Store);

  protected bookmarks: Signal<Bookmark[]> = toSignal(
    this.store.select(BookmarksSelectors.selectAllBookmarks),
    {
      initialValue: [],
    },
  );
  protected newBookmark: {
    title: WritableSignal<string>;
    url: WritableSignal<string>;
    folder: WritableSignal<string>;
    tags: WritableSignal<string>;
  } = {
    title: signal(""),
    url: signal(""),
    folder: signal(""),
    tags: signal(""),
  };

  protected addBookmark() {
    if (!this.newBookmark.title || !this.newBookmark.url) return;
    const tags = this.newBookmark.tags()
      ? this.newBookmark
          .tags()
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];
    // TODO(dates): Investigate serialization of dates
    // const now = new Date();
    const now = new Date().toISOString();
    this.store.dispatch(
      BookmarksActions.addBookmark({
        bookmark: {
          id: uuidv4(),
          title: this.newBookmark.title(),
          url: this.newBookmark.url(),
          folder: this.newBookmark.folder(),
          tags,
          createdAt: now,
          updatedAt: now,
        },
      }),
    );
    this.newBookmark.title.set("");
    this.newBookmark.url.set("");
    this.newBookmark.folder.set("");
    this.newBookmark.tags.set("");
  }

  protected deleteBookmark(id: string) {
    this.store.dispatch(BookmarksActions.deleteBookmark({ id }));
  }
}
