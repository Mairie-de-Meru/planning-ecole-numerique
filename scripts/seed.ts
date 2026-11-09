/**
 * Données initiales : mallettes, périodes zone B, écoles maternelles de Méru et liste blanche de démonstration.
 * Usage : npm run db:seed
 * Les dates 2026-2027 sont saisies à la main (à vérifier) : utilisez « Lire les dates maintenant »
 * dans Admin → Périodes pour les remplacer par celles de service-public.gouv.fr.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false });
  await sql`insert into settings (id) values (1) on conflict do nothing`;

  // Matériel en circulation : 2 mallettes de tablettes et 1 sac robotique.
  // Inventaires à compléter depuis les conventions papier (Admin → Mallettes).
  const tabletInventory = [
    "1 mallette de transport et de recharge à roulettes, avec sa clé",
    "Tablettes numériques avec coque de protection",
    "1 câble d'alimentation de la mallette",
  ].join("\n");
  const items: [string, string, string, string, string | null, string][] = [
    [
      "Mallette tablettes n°1",
      "Tablettes numériques et leur mallette de recharge",
      "Mallette à roulettes qui transporte, range et recharge les tablettes de la classe.",
      tabletInventory,
      "/mallettes/tablettes.webp",
      "encre",
    ],
    [
      "Mallette tablettes n°2",
      "Tablettes numériques et leur mallette de recharge",
      "Mallette à roulettes qui transporte, range et recharge les tablettes de la classe.",
      tabletInventory,
      "/mallettes/tablettes.webp",
      "lagon",
    ],
    [
      "Sac robotique",
      "Robots, lecteur de programmation et tapis de jeu",
      "Un sac de sport noir qui réunit les robots de sol, la tablette (lecteur) de programmation avec ses cartes plastifiées d'instructions pour diriger le robot, et les tapis de jeu.",
      [
        "1 sac de transport noir",
        "Robots de sol programmables et leurs câbles de recharge",
        "1 lecteur de cartes de programmation",
        "1 jeu de cartes plastifiées d'instructions (avancer, reculer, tourner, pause…)",
        "Tapis de jeu quadrillés",
      ].join("\n"),
      "/mallettes/sac-robotique.webp",
      "tomate",
    ],
  ];
  let order = 0;
  for (const [name, description, contents, inventory, photo, color] of items) {
    await sql`insert into items (name, description, contents, inventory, photo_url, color, sort_order)
              select ${name}, ${description}, ${contents}, ${inventory}, ${photo}, ${color}, ${order++}
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

  // Écoles maternelles de Méru (source : ville-meru.fr/nos-ecoles, novembre 2026).
  // Sans adresse e-mail : chaque école se rattache à sa fiche à sa première connexion.
  const schools: [string, string, string, string, string][] = [
    ["École maternelle Bellonte", "1 rue Bellonte\n60110 Méru", "Estelle MENDES", "Directrice", "03 44 52 39 25"],
    ["École maternelle Gambetta", "1 rue Camille Desmoulins\n60110 Méru", "Coralinda RIOJA", "Directrice", "03 44 52 34 50"],
    ["École maternelle Jean Macé", "13 rue Salentin\n60110 Méru", "Marie-Renée PELARD", "Directrice", "03 44 52 35 68"],
    ["École maternelle Jean Moulin", "1 rue Jean Moulin\n60110 Méru", "Christine POIRION", "Directrice", "03 44 52 34 44"],
    ["École maternelle Jules Verne", "2 avenue Molière\n60110 Méru", "Stéphanie VERDELET", "Directrice", "03 44 52 36 47"],
    ["École maternelle Pasteur", "2 boulevard Pablo Picasso\n60110 Méru", "M. BOSSER", "Directeur", "03 44 52 35 66"],
  ];
  for (const [name, address, director, title, phone] of schools) {
    await sql`insert into schools (name, address, director_name, director_title, phone)
              select ${name}, ${address}, ${director}, ${title}, ${phone}
              where not exists (select 1 from schools where name = ${name})`;
  }

  await sql.end();
  console.log("Données initiales insérées.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
