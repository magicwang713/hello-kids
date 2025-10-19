# Family Guard Privacy Notice (Parents & Children)

_Last updated: 2024-06-01_

## 1. Overview
Family Guard helps caregivers understand aggregated app usage on a paired child device. We only collect the minimum data required to generate daily and hourly usage trends. We never capture personal communications, screen content, contacts, photos, audio, or precise location.

This template covers deployments in the United States, European Union, United Kingdom, and mainland China. Customize jurisdiction-specific clauses with local counsel before launch.

## 2. Data We Collect
- **Aggregated usage metrics:** daily minutes and launch counts per application and category.
- **Hourly trend buckets:** minutes by category between 00:00–23:59 for trend analytics.
- **Device metadata:** non-unique installation identifier, OS version, and model for troubleshooting.
- **Anomaly signals:** uninstall attempts, permission revocations, heartbeat failures, and network status flags.

We do **not** collect content of messages, browsing history, photos, contacts, precise GPS, microphones, or advertising identifiers. Personalized advertising is disabled for all minors.

## 3. How We Use Data
- Display dashboards for authorized parents or guardians.
- Trigger privacy-preserving alerts when required permissions are revoked or monitoring is disabled.
- Generate aggregated insights and communication guidance. AI messaging is rules-based and never uses personal content.
- Improve reliability and safety of the service (e.g., debugging heartbeat outages).

## 4. Legal Bases & Parental Consent
- **United States:** COPPA – verified parental consent via the parent app login and confirmation email. No data is collected until consent is recorded.
- **European Union / UK:** GDPR – processing is based on legitimate interests of the parent controller and explicit consent. Data minimization and subject rights (access, export, erasure) are supported.
- **China:** compliance with PIPL – guardians provide explicit consent within the parent app, with clear opt-out and deletion controls.

## 5. Data Retention
- Daily aggregated logs retained for 90 days.
- Long-term trend summaries retained for up to 12 months.
- Parents may export or request deletion at any time from the settings page. Deletion propagates across all backups within 30 days.

## 6. Sharing & Transfers
- Data is stored on Supabase (PostgreSQL + storage) in the selected region. We do not sell or share data with advertisers.
- Cross-border transfers follow Standard Contractual Clauses (EU/UK) or other required safeguards.
- Third-party processors (e.g., Expo push service) receive only the minimum metadata required for notifications.

## 7. Security
- Device-to-cloud communication uses TLS with device-scoped API keys.
- Access is limited to authorized guardians through Supabase Auth.
- Regular audits ensure compliance with least-privilege access and data minimization.

## 8. Rights & Controls
- Parents can export, delete, or pause monitoring from the app.
- Requests can also be sent to privacy@familyguard.example.
- Guardians may withdraw consent at any time; monitoring stops immediately.

## 9. Contact
- **Email:** privacy@familyguard.example
- **Mailing Address:** 123 Example Avenue, Privacy City, USA

_Update the contact details and regulatory references for each launch country before publishing._
