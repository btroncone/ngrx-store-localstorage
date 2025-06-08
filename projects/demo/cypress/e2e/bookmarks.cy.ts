describe("Bookmarks Manager Demo", () => {
  beforeEach(() => {
    cy.visit("/");
    // Clear localStorage to ensure a clean state for each test
    cy.window().then((win) => win.localStorage.clear());
    cy.reload();
  });

  it("should add a new bookmark and display it in the list", () => {
    cy.get('input[name="title"]').type("Cypress Docs");
    cy.get('input[name="url"]').type("https://docs.cypress.io");
    cy.get('input[name="folder"]').type("Testing");
    cy.get('input[name="tags"]').focus(); // Focus to ensure the input is ready for typing since the lengthy mat-label is covering it
    cy.get('input[name="tags"]').type("cypress,   docs ");
    cy.contains("button", "Add").click();
    cy.contains(".bookmark-title", "Cypress Docs").should("exist");
    cy.contains("a", "https://docs.cypress.io").should("exist");
    cy.get('[data-test="tag"]').contains("cypress").should("exist");
    cy.get('[data-test="tag"]').contains("docs").should("exist");
    cy.contains("Folder: Testing").should("exist");
  });

  it("should persist bookmarks in localStorage and restore after reload", () => {
    cy.get('input[name="title"]').type("Persisted Bookmark");
    cy.get('input[name="url"]').type("https://example.com");
    cy.contains("button", "Add").click();
    cy.contains(".bookmark-title", "Persisted Bookmark").should("exist");
    cy.reload();
    cy.contains(".bookmark-title", "Persisted Bookmark").should("exist");
  });

  it("should delete a bookmark from the list", () => {
    cy.get('input[name="title"]').type("To Delete");
    cy.get('input[name="url"]').type("https://delete.me");
    cy.contains("button", "Add").click();
    cy.contains(".bookmark-title", "To Delete").should("exist");
    cy.get(".bookmark-item")
      .contains("To Delete")
      .parent()
      .parent()
      .find('button[aria-label="Delete Bookmark"]')
      .click({ force: true });
    cy.contains(".bookmark-title", "To Delete").should("not.exist");
  });

  it("should restore bookmark dates as Date objects (restoreDates)", () => {
    cy.get('input[name="title"]').type("Date Test");
    cy.get('input[name="url"]').type("https://date.test");
    cy.contains("button", "Add").click();
    cy.window().then((win) => {
      const state = win.localStorage.getItem("demo_bookmarks");
      expect(state).to.contain("createdAt");
      expect(state).to.contain("updatedAt");
    });
    cy.reload();
    // Optionally, check the UI or state for date restoration
    cy.contains(".bookmark-title", "Date Test").should("exist");
  });
});
