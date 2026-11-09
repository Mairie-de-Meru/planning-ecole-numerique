/**
 * Données de démonstration : mallettes, périodes zone B, liste blanche et écoles fictives.
 * Usage : npm run db:seed
 * Les dates 2026-2027 sont saisies à la main (à vérifier) : utilisez « Lire les dates maintenant »
 * dans Admin → Périodes pour les remplacer par celles de service-public.gouv.fr.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  await sql`insert into settings (id) values (1) on conflict do nothing`;

  const items: [string, string, string, string | null][] = [
    [
      "Mallette tablettes",
      "16 tablettes et leur chariot de recharge",
      "16 tablettes 10 pouces avec coques, chariot mobile de rangement et de recharge sécurisé, guide d'utilisation.",
      "/mallettes/tablettes.webp",
    ],
    [
      "Robots de sol",
      "6 robots programmables · cycles 1 et 2",
      "6 robots transparents programmables par boutons, station de recharge, tapis quadrillés, fiches défis.",
      "/mallettes/robots.webp",
    ],
    [
      "Programmation tactile",
      "Coder sans écran avec des cartes",
      "2 lecteurs de cartes et 120 cartes (flèches, pause, répétition), à utiliser avec les robots de sol.",
      "/mallettes/programmation.webp",
    ],
    [
      "Solides géométriques",
      "Cartes et solides · cycles 2 et 3",
      "25 grandes cartes illustrées (cubes, pavés, prismes, cylindres, cônes, sphères) et solides à manipuler.",
      "/mallettes/solides.webp",
    ],
    ["Mallette lecture CP", "Albums et jeux de lecture", "30 albums jeunesse, jeux de syllabes, étiquettes-mots.", null],
  ];
  let order = 0;
  for (const [name, description, contents, photo] of items) {
    await sql`insert into items (name, description, contents, photo_url, sort_order)
              select ${name}, ${description}, ${contents}, ${photo}, ${order++}
              where not exists (select 1 from items where name = ${name})`;
  }

  const periods: [string, number, string, string, string][] = [
    ["2025-2026", 1, "Rentrée → Toussaint", "2025-09-01", "2025-10-17"],
    ["2025-2026", 2, "Toussaint → Noël", "2025-11-03", "2025-12-19"],
    ["2025-2026", 3, "Noël → Hiver", "2026-01-05", "2026-02-13"],
    ["2025-2026", 4, "Hiver → Printemps", "2026-03-02", "2026-04-10"],
    ["2025-2026", 5, "Printemps → Été", "2026-04-27", "2026-07-03"],
    ["2026-2027", 1, "Rentrée → Toussaint", "2026-09-01", "2026-10-16"],
    ["2026-2027", 2, "Toussaint → Noël", "2026-11-02", "2026-12-18"],
    ["2026-2027", 3, "Noël → Hiver", "2027-01-04", "2027-02-19"],
    ["2026-2027", 4, "Hiver → Printemps", "2027-03-08", "2027-04-16"],
    ["2026-2027", 5, "Printemps → Été", "2027-05-03", "2027-07-02"],
  ];
  for (const [y, pos, label, s, e] of periods) {
    await sql`insert into periods (school_year, position, label, start_date, end_date, zone, source)
              values (${y}, ${pos}, ${label}, ${s}, ${e}, 'B', 'manual')
              on conflict (school_year, position, zone) do nothing`;
  }

  for (const p of ["@ecole-demo.fr"]) await sql`insert into allowlist (pattern) values (${p}) on conflict do nothing`;

  const schools = [
    ["jules-ferry@ecole-demo.fr", "École élémentaire Jules Ferry", "12 rue des Écoles\n60110 Méru", "Mme Martin", "03 44 00 00 01"],
    ["les-tilleuls@ecole-demo.fr", "École primaire Les Tilleuls", "4 allée des Tilleuls\n60110 Méru", "M. Bernard", "03 44 00 00 02"],
  ];
  for (const [email, name, address, contact, phone] of schools) {
    await sql`insert into schools (email, name, address, contact_name, phone) values (${email}, ${name}, ${address}, ${contact}, ${phone})
              on conflict (email) do nothing`;
  }

  // Une réservation confirmée de démonstration
  await sql`insert into reservations (item_id, period_id, school_id, status, confirmed_at)
            select i.id, p.id, s.id, 'confirmed', now()
            from items i, periods p, schools s
            where i.name = 'Robots de sol' and p.school_year = '2026-2027' and p.position = 3
              and s.email = 'les-tilleuls@ecole-demo.fr'
            on conflict do nothing`;

  await sql.end();
  console.log("Données de démonstration insérées.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
