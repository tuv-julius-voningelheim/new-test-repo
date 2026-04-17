# Giradi Oil Backend

Medusa v2 Backend fuer den Giradi Oil Store.

## Voraussetzungen

- Node 20.x
- npm 11.x
- PostgreSQL
- Redis

## Setup

1. Die Datei .env.template nach .env kopieren.
2. Die benoetigten Werte fuer Datenbank, Redis, Secrets und S3 eintragen.
3. Abhaengigkeiten installieren:

```bash
npm install
```

4. Backend lokal starten:

```bash
npm run dev
```

## Wichtige Umgebungsvariablen

- DATABASE_URL: PostgreSQL-Verbindung fuer Medusa.
- REDIS_URL: Standard-Redis-URL.
- EVENTS_REDIS_URL: Optionaler separater Redis-Endpunkt fuer den Event Bus. Wenn leer, wird REDIS_URL verwendet.
- STORE_CORS: Frontend-URLs, die Store API-Aufrufe machen duerfen.
- ADMIN_CORS: URLs fuer Medusa Admin.
- AUTH_CORS: URLs fuer Login, Cookies und Auth-Flows.
- JWT_SECRET: Secret fuer JWT.
- COOKIE_SECRET: Secret fuer Cookies.
- SUPABASE_S3_ACCESS_KEY: Access Key fuer das Supabase-S3-Bucket.
- SUPABASE_S3_SECRET_KEY: Secret Key fuer das Supabase-S3-Bucket.
- MEDUSA_BACKEND_URL: Oeffentliche Backend-URL, z. B. fuer Scripts wie seed-products.mjs.

## Vercel Frontend

Wenn das Frontend in einem neuen Vercel-Projekt laeuft, musst du im Backend mindestens diese Variablen anpassen:

- STORE_CORS=https://deine-neue-vercel-domain.vercel.app
- AUTH_CORS=https://deine-neue-vercel-domain.vercel.app,https://dein-backend-domain.tld

Im Vercel-Projekt selbst brauchst du getrennt davon mindestens diese Frontend-Variablen:

- NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://dein-backend-domain.tld
- NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=dein_medusa_publishable_key

Die Publishable Key Variable kann weiterverwendet werden, wenn das neue Backend auf dieselbe Medusa-Datenbank zeigt und der Key in derselben Datenbank existiert.

Wenn du Preview Deployments von Vercel verwenden willst, musst du entweder alle Preview-Domains explizit eintragen oder mit einer festen Production-Domain arbeiten.

## Render Deployment

Wenn du das Backend in ein neues GitHub-Repo verschoben hast, funktioniert Render Auto Deploy nicht automatisch weiter. Du musst in Render entweder:

1. den bestehenden Service auf das neue Repository umhaengen, oder
2. einen neuen Service aus dem neuen Repository erstellen.

Pruefe dabei insbesondere diese Punkte:

- Root Directory: .
- Build Command: npm install && npm run build
- Start Command: npm run start
- Node Version: 20
- Environment Variables: alle Werte aus .env ohne Anfuehrungszeichen in Render hinterlegen

Eine Render-Blueprint-Datei liegt in render.yaml. Damit kannst du den Service aus dem Repository anlegen und spaeter Auto Deploys auf Basis dieses Repos nutzen.

## Bestehende externe Dienste weiterverwenden

Du kannst diese externen Dienste in einem neuen Render- oder Vercel-Setup weiterverwenden:

- Neon PostgreSQL via DATABASE_URL
- Upstash Redis via EVENTS_REDIS_URL oder REDIS_URL
- Supabase Storage via SUPABASE_S3_ACCESS_KEY und SUPABASE_S3_SECRET_KEY
- Resend via RESEND_API_KEY und RESEND_FROM_EMAIL

Wichtig ist nur, dass du im neuen Deployment dieselben Secrets hinterlegst und die neuen Domains in STORE_CORS, ADMIN_CORS und AUTH_CORS eintraegst.

Hinweis zu Redis: Fuer Medusa sollte REDIS_URL oder EVENTS_REDIS_URL ein redis:// oder rediss:// Endpoint sein. Ein https:// Endpoint ist dafuer nicht korrekt.

## Seed Script

Das Script seed-products.mjs nutzt MEDUSA_BACKEND_URL und MEDUSA_API_TOKEN. Lokal faellt es standardmaessig auf http://localhost:9000 zurueck.
