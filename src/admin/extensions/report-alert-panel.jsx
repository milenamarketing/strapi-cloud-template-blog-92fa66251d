import * as React from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import { Alert } from '@strapi/design-system';

// Schwelle: mehr als so viele BESTÄTIGTE Meldungen (verdict=justified) in 7 Tagen → Warnung.
const THRESHOLD = 10;
const USER_UID = 'plugin::users-permissions.user';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Edit-View-Side-Panel: zeigt nur im User-Profil ein rotes Alert, wenn der Nutzer in den
 * letzten 7 Tagen mehr als THRESHOLD bestätigte Meldungen erhalten hat.
 * Zählt zuverlässig über das denormalisierte Feld `reported_user_base44_id` (User-Relationen
 * sind in der API ausgeblendet).
 */
const ReportAlertPanel = ({ model, documentId, document }) => {
  const { get } = useFetchClient();
  const [count, setCount] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    async function run() {
      if (model !== USER_UID) return;
      try {
        // base44_id aus dem geladenen Dokument oder per Nachladen ermitteln.
        let base44 = document && document.base44_id;
        if (!base44 && documentId) {
          const u = await get(
            `/content-manager/collection-types/${USER_UID}/${documentId}`
          );
          base44 = u && u.data && u.data.base44_id;
        }
        if (!base44) return;

        const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
        const res = await get(`/content-manager/collection-types/api::report.report`, {
          params: {
            filters: {
              reported_user_base44_id: { $eq: base44 },
              verdict: { $eq: 'justified' },
              createdAt: { $gte: since },
            },
            page: 1,
            pageSize: 1,
          },
        });
        const total =
          (res && res.data && res.data.pagination && res.data.pagination.total) || 0;
        if (!cancelled) setCount(total);
      } catch (e) {
        if (!cancelled) setCount(null);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [model, documentId, document, get]);

  if (model !== USER_UID) return null;
  if (count === null || count <= THRESHOLD) return null;

  return {
    title: '⚠️ Warnung (Warnung)',
    content: (
      <Alert variant="danger" title="Zu viele bestätigte Meldungen (Too many confirmed reports)">
        {`Dieser Nutzer hat in den letzten 7 Tagen ${count} bestätigte Meldungen erhalten ` +
          `(Schwelle: ${THRESHOLD}). Bitte prüfen, ob eine Sperre nötig ist.`}
      </Alert>
    ),
  };
};

export default ReportAlertPanel;
