module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 1337),
  app: {
    keys: env.array('APP_KEYS'),
  },
  webhooks: {
    populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
  },
  // Täglicher Cron für die report_alert-Warn-Markierung (7-Tage-Fenster).
  cron: {
    enabled: true,
    tasks: require('./cron'),
  },
});
