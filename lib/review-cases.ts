// Prepared cases for the /review front door (Oct 11 brief). Request parameters only (names, Qloo ids, a buyer gate to
// try), never Qloo output: the page posts these to /api/review, which answers from the cache once warmed.
// Server-free on purpose: the client page imports it.
export type CaseName = { name: string; id: string; type: string };
export type PreparedCase = {
  key: string;
  seed: CaseName;
  noun: string; // what the seed is, for the try-your-own hint
  names: CaseName[];
  gate: { label: string; buyer: { exclude?: { name: string; reason: string }[]; excludeTags?: string[] } };
};

const brand = (name: string, id: string): CaseName => ({ name, id, type: "urn:entity:brand" });

export const CASES: PreparedCase[] = [
  {
    key: "mt-joy",
    seed: { name: "Mt. Joy", id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: "urn:entity:artist" },
    noun: "indie folk band",
    names: [
      brand("Allbirds", "78A44C09-E691-42DA-A553-5CDE6EE9B18A"),
      brand("REI", "205AF33F-118E-4C49-9721-6BDBAF981DA0"),
      brand("Patagonia", "DB4CE34E-3A63-4947-946F-9D52502C5762"),
      brand("Hydro Flask", "F1C9F511-D7FF-438F-80E4-DD02DDDF81FF"),
      brand("Airbnb", "A5269DD4-5BCE-4EC7-BD50-355B29F3079F"),
      brand("Red Bull", "409FAF5A-BC5F-4DC3-943D-E3B5F20B471D"),
      brand("Taco Bell", "29271B4D-CAD2-4DD4-A766-7338AEE5533D"),
      brand("Spotify", "99CBD9B1-F023-4034-97E7-E95A4A85BDD2"),
    ],
    gate: { label: "Exclude energy drinks", buyer: { excludeTags: ["energy drink"] } },
  },
  {
    key: "olipop",
    seed: { name: "Olipop", id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: "urn:entity:brand" },
    noun: "prebiotic soda",
    names: [
      brand("Trader Joe's", "096B986E-3D63-44F4-BE44-F85D52A2979D"),
      brand("Sweetgreen", "E515D012-5197-4B01-BFAD-5E5FAC25B525"),
      brand("Harley-Davidson", "8FD09C3A-7362-4749-BDCE-12C3933FDC25"),
      brand("Coca-Cola", "A539C8C9-4733-41A9-911A-11AC2B6D475A"),
      brand("Target", "BFC8D7B1-BDD2-478E-85AB-F4FEE868177A"),
      brand("Siete Foods", "3A0475BB-302E-46BD-BC0E-20A8C06725A6"),
      brand("Graza", "9AD1E13D-42AF-4798-BDF7-45E9C78AD952"),
      brand("Dove", "A7C316F1-F5DB-4708-8C41-48A6DE062B97"),
    ],
    gate: { label: "Exclude competing sodas", buyer: { exclude: [{ name: "Coca-Cola", reason: "competing soda" }] } },
  },
];
