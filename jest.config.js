'use strict';

// Integrationstests gegen eine echte, gebootete Strapi-Instanz (SQLite-Testdatei).
// Seriell (eine Instanz), großzügiges Timeout für den Boot.
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/helpers/env.js'],
  testTimeout: 60000,
  maxWorkers: 1,
  forceExit: true,
};
