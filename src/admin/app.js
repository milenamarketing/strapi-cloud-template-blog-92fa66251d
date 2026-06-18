import ReportAlertPanel from './extensions/report-alert-panel';

const config = {
  locales: [],
};

const bootstrap = (app) => {
  // Rotes Warn-Banner ganz oben im (rechten) Edit-View-Panel – nur beim User,
  // nur bei > 10 bestätigten Meldungen in 7 Tagen (Logik in der Komponente).
  app
    .getPlugin('content-manager')
    .apis.addEditViewSidePanel((panels) => [ReportAlertPanel, ...panels]);
};

export default {
  config,
  bootstrap,
};
