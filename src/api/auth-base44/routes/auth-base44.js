'use strict';

/**
 * Custom-Route für die Auth-Brücke.
 * `auth: false` -> öffentlich erreichbar, da die Nutzerin beim Token-Tausch
 * noch KEINE Strapi-Identität hat (sie kommt mit ihrem Base44-Token).
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/auth/base44',
      handler: 'auth-base44.exchange',
      config: {
        auth: false,
      },
    },
  ],
};
