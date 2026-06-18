const path = require('path');

// Test-DB: immer SQLite auf eine eigene Wegwerf-Datei (.tmp/test.db),
// strikt getrennt von Dev (.tmp/data.db) und Prod.
module.exports = ({ env }) => ({
  connection: {
    client: 'sqlite',
    connection: {
      filename: path.join(__dirname, '..', '..', '..', env('DATABASE_FILENAME', '.tmp/test.db')),
    },
    useNullAsDefault: true,
    acquireConnectionTimeout: 60000,
  },
});
