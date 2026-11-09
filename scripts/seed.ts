/**
 * Données de démonstration : valises, périodes zone B, liste blanche et écoles fictives.
 * Usage : npm run db:seed
 * Les dates 2026-2027 sont saisies à la main (à vérifier) : utilisez « Lire les dates maintenant »
 * dans Admin → Périodes pour les remplacer par celles de service-public.gouv.fr.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  await sql`insert into settings (id) values (1) on conflict do nothing`;

  const items = [
    ["Valise tablettes n°1", "16 tablettes · cycles 2 et 3", "16 tablettes 10 pouces, coques renforcées, chargeur multiple, guide d'utilisation."],
    ["Valise tablettes n°2", "16 tablettes · cycles 2 et 3", "16 tablettes 10 pouces, coques renforcées, chargeur multiple, guide d'utilisation."],
    ["Robots programmables", "6 robots · cycle 2", "6 robots de sol, cartes de programmation, tapis quadrillés, fiches activités."],
    ["Kit sciences – électricité", "Cycle 3", "Piles, ampoules, fils, interrupteurs, moteurs, fiches d'expériences."],
    ["Valise lecture CP", "Albums et jeux de lecture", "30 albums jeunesse, jeux de syllabes, étiquettes-mots."],
  ];
  let order = 0;
  for (const [name, description, contents] of items) {
    await sql`insert into items (name, description, contents, sort_order)
              select ${name}, ${description}, ${contents}, ${order++}
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
            where i.name = 'Robots programmables' and p.school_year = '2026-2027' and p.position = 3
              and s.email = 'les-tilleuls@ecole-demo.fr'
            on conflict do nothing`;

  await sql.end();
  console.log("Données de démonstration insérées.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
