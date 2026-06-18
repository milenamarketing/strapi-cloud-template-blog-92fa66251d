'use strict';

// Wird von Jest VOR jeder Test-Datei geladen (setupFiles). Setzt die für den
// Strapi-Boot nötigen Secrets/DB-Variablen, damit die Testinstanz ohne echte
// .env startet – ausschließlich für die lokale SQLite-Testinstanz.
process.env.NODE_ENV = 'test';
process.env.DATABASE_CLIENT = 'sqlite';
process.env.DATABASE_FILENAME = process.env.DATABASE_FILENAME || '.tmp/test.db';

process.env.APP_KEYS = process.env.APP_KEYS || 'testKeyA==,testKeyB==';
process.env.API_TOKEN_SALT = process.env.API_TOKEN_SALT || 'test-api-token-salt';
process.env.ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'test-admin-jwt-secret';
process.env.TRANSFER_TOKEN_SALT = process.env.TRANSFER_TOKEN_SALT || 'test-transfer-token-salt';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789ab';
