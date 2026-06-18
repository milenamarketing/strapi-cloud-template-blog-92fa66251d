'use strict';
const seedExampleApp = require("./bootstrap");
const { setupCommunity } = require("./community-setup");

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap() {
    // Blog-Template-Seed (nur beim ersten Start) – harmlos, bleibt vorerst erhalten.
    await seedExampleApp();
    // Community-Rollen & -Rechte bei jedem Start idempotent sicherstellen.
    await setupCommunity();
  },
};
