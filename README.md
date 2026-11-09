# Valises pédagogiques — réservation pour les écoles

Application web de réservation de matériel pédagogique (valises) pour les écoles.

- **Périodes** = temps de classe entre deux vacances scolaires (zone B par défaut), lues automatiquement sur
  [service-public.gouv.fr](https://www.service-public.gouv.fr/particuliers/vosdroits/F31952) puis **validées par l'admin**.
- **Premier réservé, premier servi** : une valise = une école par période, garanti par la base de données.
- **Confirmation par e-mail** : la réservation est bloquée 30 min (réglable) en attente du clic de confirmation,
  puis un second e-mail « réservation faite » est envoyé (avec fichier agenda `.ics`).
- **Décalage** : l'école déplace sa réservation vers une autre période libre, tant que la période n'a pas commencé.
- **Accès** : connexion sans mot de passe par lien e-mail, limitée à une **liste blanche** (adresses ou domaines).
- **Espace admin** : planning global, attribution/décalage/annulation, valises, périodes, écoles, liste blanche,
  feuille de livraison (impression + CSV), journal des e-mails, réglages (zone, plafond par école, notifications…).

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL + Drizzle ORM · Nodemailer (SMTP) · Vitest.

---

## Mise en ligne (Vercel + Neon, gratuit)

1. **Vercel** → *Add New → Project* → importer ce dépôt GitHub (laisser les réglages par défaut).
2. Dans le projet Vercel : **Storage → Create Database → Neon (Postgres)** → *Connect*.
   La variable `DATABASE_URL` est ajoutée automatiquement.
3. **Settings → Environment Variables**, ajouter :

   | Variable | Valeur |
   |---|---|
   | `AUTH_SECRET` | 32+ caractères aléatoires (`openssl rand -base64 32`) |
   | `ADMIN_EMAILS` | votre adresse (plusieurs : séparées par des virgules) |
   | `CRON_SECRET` | une autre chaîne aléatoire |
   | `SMTP_HOST` / `SMTP_PORT` | ex. Gmail : `smtp.gmail.com` / `465` |
   | `SMTP_USER` / `SMTP_PASS` | l'adresse et un **mot de passe d'application** ([Gmail](https://myaccount.google.com/apppasswords)) |
   | `MAIL_FROM` | `Valises pédagogiques <votre.adresse@gmail.com>` |
   | `APP_URL` | (facultatif) l'adresse publique si vous utilisez un nom de domaine |

4. **Redéployer**. Les tables sont créées automatiquement à chaque déploiement (`npm run build` applique les migrations).
5. Se connecter avec l'adresse admin, puis :
   - **Périodes** → *Lire les dates maintenant* → vérifier → *Appliquer ces dates* ;
   - **Valises** → ajouter le matériel ;
   - **Écoles** → ajouter les adresses ou domaines autorisés (ex. `@ac-amiens.fr`) ;
   - envoyer le lien du site aux écoles.

Les tâches planifiées (`vercel.json`) lisent les dates de vacances chaque lundi et nettoient les réservations non confirmées chaque nuit.

### Tester en ligne avant d'avoir configuré l'envoi des e-mails

Sans `SMTP_HOST`, aucun e-mail ne part (ils restent visibles dans **Admin → E-mails**). Pour pouvoir quand même se connecter,
ajoutez temporairement `TEST_MODE=1` : les liens s'affichent alors à l'écran.
⚠️ **À retirer avant d'envoyer le lien aux écoles** : en mode test, n'importe qui pourrait se connecter avec une adresse autorisée.

---

## Développement local

```bash
cp .env.example .env          # puis compléter DATABASE_URL, AUTH_SECRET, ADMIN_EMAILS
npm install
npm run db:migrate
npm run db:seed               # données de démonstration (facultatif)
npm run dev
```

Sans SMTP en local, le mode test est actif : les liens s'affichent à l'écran et dans la console.
Données de démo : connectez-vous avec `jules-ferry@ecole-demo.fr` (école) ou l'adresse de `ADMIN_EMAILS`.

```bash
npm test                      # tests (base PostgreSQL de test : TEST_DATABASE_URL, défaut valises_test)
npm run typecheck
npm run lint
```

## Règles métier

| Règle | Détail |
|---|---|
| Unicité | Index unique partiel `(valise, période)` sur les réservations *en attente* ou *confirmées* |
| Attente | Une réservation non confirmée dans le délai expire et libère la case |
| Plafond | Réglage « valises par école et par période » (0 = illimité) |
| Décalage / annulation | Par l'école tant que la période n'a pas commencé ; par l'admin à tout moment |
| Périodes | Lues sur service-public.gouv.fr, appliquées seulement après validation ; une période **verrouillée** n'est jamais modifiée automatiquement |
| Liens e-mail | Connexion : 20 min, usage unique. Les liens ouvrent une page avec un bouton, pour que les antivirus de messagerie ne les consomment pas |

## Structure

```
src/
  app/(app)/           planning, mes réservations, fiche école
  app/admin/           espace administrateur
  app/connexion/       connexion par lien e-mail
  app/confirmer/       confirmation d'une réservation
  app/api/cron/        tâches planifiées
  lib/reservations.ts  règles de réservation
  lib/periods/         lecture service-public + calcul des périodes
  lib/mail.ts          e-mails (gabarit, .ics, SMTP)
  db/schema.ts         schéma de la base
drizzle/               migrations SQL
tests/                 tests Vitest
```
