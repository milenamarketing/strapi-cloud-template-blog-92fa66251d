module.exports = ({ env }) => [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  {
    name: 'strapi::cors',
    config: {
      // Erlaubte Frontend-Origins (LunaCycle). Per Env CORS_ORIGINS überschreibbar.
      // Auth läuft über Bearer-JWT (keine Cookies), daher keine credentials nötig.
      origin: env.array('CORS_ORIGINS', ['http://localhost:5173', 'http://localhost:1337']),
    },
  },
  'strapi::poweredBy',
  'strapi::query',
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
