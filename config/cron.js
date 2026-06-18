'use strict';

const { recomputeAllReportAlerts } = require('../src/community-moderation');

/**
 * Täglicher Job: aktualisiert die Warn-Markierung (report_alert) aller Nutzer,
 * damit das 7-Tage-Fenster auch ohne neue Meldungen korrekt abläuft.
 */
module.exports = {
  dailyReportAlerts: {
    task: async () => {
      await recomputeAllReportAlerts();
    },
    options: {
      rule: '0 3 * * *', // täglich 03:00
    },
  },
};
