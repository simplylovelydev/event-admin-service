# Tech Club Events

Next.js event portal with Supabase-backed events, team registrations and submissions, an authenticated admin dashboard, and Google Sheets synchronization.

## Local setup

1. Copy `.env.example` to `.env.local` and set the Supabase service-role key, admin token, webhook secret, Google service-account email/private key, and Drive folder ID. Never commit `.env.local` or expose the service-role key in browser code.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). The script creates the tables and adds the event metadata required by the pages; it does not delete existing rows.
3. In Supabase **Database → Webhooks**, create `POST` webhooks for `team_registrations` and `submissions` inserts. Point both to `https://YOUR_DOMAIN/api/sync-sheet` and send `Authorization: Bearer YOUR_SUPABASE_WEBHOOK_SECRET` plus `Content-Type: application/json`.
4. In Google Cloud, enable the Drive and Sheets APIs. Share the target Drive folder with the service-account email as an Editor.
5. Start the app with `npm run dev`.

The admin portal is at `/admin`. Sign in with the `ADMIN_API_TOKEN` value. Create events there, manage registration/submission windows, search registrations, and create each event's workbook. Public event and team pages only show active events.

## Validation and deployment

Run `npm run lint` and `npm run build` before deployment. Add the same environment variables to the hosting provider, then configure Supabase webhooks with the deployed HTTPS domain. Localhost is not reachable by Supabase; use a public tunnel for local webhook testing.
