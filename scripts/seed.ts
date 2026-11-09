/**
 * Données initiales : mallettes, périodes zone B, écoles maternelles de Méru et liste blanche de démonstration.
 * Usage : npm run db:seed
 * Les dates 2026-2027 sont saisies à la main (à vérifier) : utilisez « Lire les dates maintenant »
 * dans Admin → Périodes pour les remplacer par celles de service-public.gouv.fr.
 */
import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, prepare: false, onnotice: () => {} });
  await sql`insert into settings (id) values (1) on conflict do nothing`;

  // Données initiales seulement sur une base vide (jamais d'écrasement des modifications de l'admin).
  const [{ n }] = await sql`select count(*)::int as n from items`;
  if (n > 0 && process.env.SEED_FORCE !== "1") {
    console.log("Base déjà initialisée : données initiales ignorées.");
    await sql.end();
    return;
  }

  // Matériel en circulation, repris des conventions papier (fiches de prêt, juin 2026).
  // Format : Désignation | N° de série | Qté | État
  const ipadAir = [
    ["1", "SDMPS85SQG5W2"], ["2", "SDMPS85J5G5W2"], ["3", "SDMPS85CEG5W2"], ["4", "SDMPS84T2G5W2"], ["5", "SDMPS85EXG5W2"],
    ["6", "SDMPS84W1G5W2"], ["7", "SDMPS84XSG5W2"], ["9", "SDMPS856SG5W2"], ["10", "SDMPS85B0G5W2"],
  ].map(([n, sn]) => `iPad Air 2 Wi-Fi 128 Go silver (${n}) | ${sn} | 1 | État correct`);
  const ipad9 = [
    "KC63HM7H4G", "GHM46KKQ29", "K2RNPN946R", "DV9XWY9J3V", "LXKQ2CYVT4", "KMWL3HF5YC", "G1WQYDH46P", "LQMHQ9RXHW", "J9GQ123VK1", "J9YGRY3VVR",
  ].map((sn, i) => `iPad 9e génération (${i + 1}) | ${sn} | 1 | Très bon état`);
  const items: [string, string, string, string, string | null, string][] = [
    [
      "Mallette pédagogique A",
      "9 iPad Air 2 dans leur valise de transport Wi-Fi",
      "une valise de transport contenant 9 iPad Air 2, leurs protections et des lingettes désinfectantes",
      [...ipadAir, "Valise de transport Nao Case avec Wi-Fi | N/A | 1 | État correct", "Protection iPad Urban Kids Shell | N/A | 7 | État correct", "Lingettes désinfectantes | N/A | 1"].join("\n"),
      "/mallettes/tablettes.webp",
      "encre",
    ],
    [
      "Mallette pédagogique B",
      "10 iPad 9e génération dans leur valise de transport",
      "une valise de transport contenant 10 iPad 9e génération, leurs protections et des lingettes désinfectantes",
      [...ipad9, "Valise de transport | N/A | 1 | Très bon état", "Protection iPad Urban Kids Shell | N/A | 7 | Très bon état", "Lingettes désinfectantes | N/A | 1"].join("\n"),
      "/mallettes/tablettes.webp",
      "lagon",
    ],
    [
      "Robots Bluebots",
      "6 robots, lecteur de programmation et tapis de jeu",
      "un dispositif d'initiation à la programmation réuni dans un sac de transport noir : 6 robots Bluebots et leur station de recharge, un lecteur de programmation avec ses cartes plastifiées d'instructions pour diriger le robot, et trois tapis de jeu",
      [
        ...[1, 2, 3, 4, 5, 6].map((n) => `Robot Bluebots ${n} | RBLUEBOT${n} | 1 | Bon état`),
        "Lecteur de programmation | TR1 | 1 | Bon état",
        "Cartes de programmation plastifiées (jeu) | N/A | 1 | Bon état",
        "Tapis de jeu formes 3D | N/A | 1 | Bon état",
        "Tapis de jeu transparent | N/A | 1 | Bon état",
        "Tapis de jeu alphabet | N/A | 1 | Bon état",
        "Station de recharge | DR1 | 1 | Bon état",
        "Sac de transport noir | N/A | 1 | Bon état",
        "Lingettes nettoyantes | N/A | 1",
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

  // 2025-2026 : périodes des conventions papier. 2026-2027 : calendrier officiel zone B, juin découpé.
  const periods: [string, number, string, string, string][] = [
    ["2025-2026", 1, "Rentrée → Toussaint", "2025-09-16", "2025-10-17"],
    ["2025-2026", 2, "Toussaint → Noël", "2025-11-03", "2025-12-19"],
    ["2025-2026", 3, "Noël → Hiver", "2026-01-06", "2026-02-06"],
    ["2025-2026", 4, "Hiver → Printemps", "2026-03-03", "2026-04-10"],
    ["2025-2026", 5, "Printemps → Juin", "2026-04-28", "2026-05-29"],
    ["2025-2026", 6, "Juin → Été", "2026-06-01", "2026-07-03"],
    ["2026-2027", 1, "Rentrée → Toussaint", "2026-09-01", "2026-10-16"],
    ["2026-2027", 2, "Toussaint → Noël", "2026-11-02", "2026-12-18"],
    ["2026-2027", 3, "Noël → Hiver", "2027-01-04", "2027-02-19"],
    ["2026-2027", 4, "Hiver → Printemps", "2027-03-08", "2027-04-16"],
    ["2026-2027", 5, "Printemps → Juin", "2027-05-03", "2027-05-28"],
    ["2026-2027", 6, "Juin → Été", "2027-05-31", "2027-07-02"],
  ];
  for (const [y, pos, label, s, e] of periods) {
    await sql`insert into periods (school_year, position, label, start_date, end_date, zone, source)
              values (${y}, ${pos}, ${label}, ${s}, ${e}, 'B', 'manual')
              on conflict (school_year, position, zone) do nothing`;
  }

  // Domaine de démonstration (tests locaux uniquement)
  if (process.env.SEED_DEMO === "1" || process.env.NODE_ENV !== "production")
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
