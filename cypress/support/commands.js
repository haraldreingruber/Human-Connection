// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })

/* globals Cypress cy */
import "cypress-file-upload";
import helpers from "./helpers";
import users from "../fixtures/users.json";

const switchLang = name => {
  cy.get(".locale-menu").click();
  cy.contains(".locale-menu-popover a", name).click();
};


Cypress.Commands.add("switchLanguage", (name, force) => {
  const { code } = helpers.getLangByName(name);
  if (force) {
    switchLang(name);
  } else {
    cy.get("html").then($html => {
      if ($html && $html.attr("lang") !== code) {
        switchLang(name);
      }
    });
  }
});

Cypress.Commands.add("login", ({ email, password }) => {
  cy.visit(`/login`);
  cy.get("input[name=email]")
    .trigger("focus")
    .type(email);
  cy.get("input[name=password]")
    .trigger("focus")
    .type(password);
  cy.get("button[name=submit]")
    .as("submitButton")
    .click();
  cy.get(".iziToast-message").should("contain", "You are logged in!");
  cy.get(".iziToast-close").click();
});

Cypress.Commands.add("logout", (email, password) => {
  cy.visit(`/logout`);
  cy.location("pathname").should("contain", "/login"); // we're out
});

Cypress.Commands.add("openPage", page => {
  if (page === "landing") {
    page = "";
  }
  cy.visit(`/${page}`);
});

Cypress.Commands.add("createCategories", (id, slug) => {
  cy.neode()
    .create("Category", {
      id: `${id}`,
      name: "Just For Fun",
      slug: `${slug}`,
      icon: "smile"
    })
    .create("Category", {
      id: `${id}1`,
      name: "Happiness & Values",
      icon: "heart-o"
    })
    .create("Category", {
      id: `${id}2`,
      name: "Health & Wellbeing",
      icon: "medkit"
    });
});
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
