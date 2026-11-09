# Installation sur la VM de la ville (Cosmos Cloud)

L'application tourne dans trois conteneurs, décrits dans `docker-compose.yml` :

| Conteneur | Rôle |
|---|---|
| `mallettes-app` | l'application (port 3000, interne) |
| `mallettes-db` | la base PostgreSQL (volume `mallettes-db`) |
| `mallettes-cron` | lecture des vacances le lundi, nettoyage chaque nuit, **sauvegarde de la base chaque nuit** (volume `mallettes-backups`, 30 jours conservés) |

Au démarrage, `mallettes-app` met la base à jour tout seul. Sur une base vide, il charge aussi les données initiales : les 3 mallettes, les 6 écoles maternelles et les périodes.

---

## 1. Prérequis

1. **Une adresse pour le site**, par exemple `mallettes.ville-meru.fr` : un enregistrement DNS de type **A** qui pointe vers l'adresse IP publique de la VM.
2. **Ports 80 et 443** de la VM ouverts depuis Internet, car les écoles se connectent depuis l'extérieur.
3. La VM doit pouvoir **joindre Internet** : `ssl0.ovh.net` (port 465) pour les e-mails, `www.service-public.gouv.fr` pour les vacances et `ghcr.io` pour les mises à jour.
4. **Une boîte mail OVH** dédiée, par exemple `mallettes@votre-domaine.fr`, qui servira d'expéditeur.

## 2. Construction de l'image et accès depuis la VM

L'image est construite automatiquement par GitHub (fichier `.github/workflows/docker.yml`) à chaque mise à jour
de la branche `main` : onglet **Actions**, environ 5 minutes. Elle est publiée sous
`ghcr.io/mairie-de-meru/planning-ecole-numerique:latest`.

Comme le dépôt est privé, l'image l'est aussi. Pour que la VM puisse la télécharger, deux possibilités :

- **Simple** : GitHub → organisation *Mairie-de-Meru* → **Packages** → `planning-ecole-numerique` → *Package settings* → *Change visibility* → **Public**. L'image ne contient aucun secret : les mots de passe sont renseignés uniquement sur la VM.
- **Image privée** : créez sur GitHub un jeton *classic* avec le seul droit `read:packages`, puis, une fois, sur la VM :
  ```bash
  docker login ghcr.io -u VOTRE_COMPTE_GITHUB
  ```

## 3. Préparer le fichier compose

Copiez le contenu de `docker-compose.yml` et remplacez chaque `A_REMPLACER…` :

| Valeur | Quoi mettre |
|---|---|
| `A_REMPLACER_MOT_DE_PASSE_BASE` (3 fois, identique) | un mot de passe long, sans `@`, `:` ni `/` |
| `A_REMPLACER_ADRESSE_DU_SITE` | `mallettes.ville-meru.fr` (sans `https://`, déjà présent) |
| `A_REMPLACER_SECRET_LONG_ALEATOIRE` | 32 caractères aléatoires ou plus |
| `A_REMPLACER_AUTRE_SECRET_ALEATOIRE` (2 fois, identique) | un autre secret aléatoire |
| `A_REMPLACER_VOTRE_EMAIL` | votre adresse : elle aura l'accès administrateur |
| `A_REMPLACER_BOITE_MAIL_OVH` (2 fois) | l'adresse de la boîte OVH |
| `A_REMPLACER_MOT_DE_PASSE_BOITE_MAIL` | son mot de passe |

Pour générer un secret, depuis n'importe quel terminal :

```bash
openssl rand -base64 32
```

## 4. Installer dans Cosmos

1. **Marché** → **Importer le fichier Compose** → collez le fichier complété → installez.
2. **URLs** → nouvelle URL :
   - cible : conteneur `mallettes-app`, port **3000** ;
   - domaine : `mallettes.ville-meru.fr`, HTTPS activé (certificat automatique) ;
   - **désactivez « authentification requise »** : le site est public, il a sa propre connexion par lien e-mail.
3. Ouvrez `https://mallettes.ville-meru.fr`, connectez-vous avec votre adresse administrateur, puis :
   - **Périodes** → *Lire les dates maintenant* → vérifier → *Appliquer* ;
   - **Écoles** → ajouter les adresses ou domaines autorisés ;
   - **E-mails** → vérifier que les e-mails partent (statut « Envoyé ») ;
   - envoyer le lien du site aux directions.

## 5. Mettre à jour

Chaque modification poussée sur `main` produit une nouvelle image en quelques minutes. Dans Cosmos : **ServApps** → `mallettes-app` → mettre à jour, ou recréer avec la dernière image. Les migrations de base s'appliquent toutes seules au redémarrage. Vous pouvez aussi activer la mise à jour automatique du conteneur dans Cosmos.

## 6. Sauvegardes

- Chaque nuit à 2 h 30, une copie compressée de la base est écrite dans le volume `mallettes-backups` (30 jours conservés).
- Conseillé : faites aussi sauvegarder ce volume hors de la VM, avec **Sauvegardes** dans Cosmos ou la sauvegarde habituelle de la VM.
- Lancer une sauvegarde à la main :
  ```bash
  docker exec mallettes-cron mallettes-backup
  ```
- Restaurer une sauvegarde (remplace le contenu actuel) :
  ```bash
  docker exec -i mallettes-db sh -c 'dropdb -U mallettes mallettes && createdb -U mallettes mallettes'
  ```
  ```bash
  docker exec mallettes-cron sh -c 'gunzip -c /backups/mallettes-AAAA-MM-JJ.sql.gz' | docker exec -i mallettes-db psql -U mallettes -d mallettes
  ```
  puis redémarrez `mallettes-app`.

## 7. En cas de souci

- Journal de l'application : **ServApps** → `mallettes-app` → *Logs*.
- Les e-mails ne partent pas : **Admin → E-mails** affiche l'erreur exacte (souvent un mot de passe ou un port SMTP).
- Les dates de vacances ne se mettent pas à jour : **Admin → Périodes** affiche le résultat de la dernière lecture. Vous pouvez toujours saisir ou corriger les périodes à la main.
