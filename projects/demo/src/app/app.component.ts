import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";

import { MatCardModule } from "@angular/material/card";
import { MatToolbarModule } from "@angular/material/toolbar";

@Component({
  selector: "app-root",
  imports: [RouterOutlet, MatCardModule, MatToolbarModule],
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
})
export class AppComponent {}
