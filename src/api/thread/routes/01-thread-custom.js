'use strict';

/**
 * Custom-Routen für Thread (zusätzlich zu den Core-Routen).
 * toggle-like: Like der eingeloggten Nutzerin umschalten.
 */

module.exports = {
  routes: [
    {
      method: 'POST',
      path: '/threads/:id/toggle-like',
      handler: 'thread.toggleLike',
    },
  ],
};
