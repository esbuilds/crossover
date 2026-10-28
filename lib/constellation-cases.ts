// Prepared categories for the constellation. No server imports: the front door links them.
export type Brand = { name: string; id: string };
// absent: no Qloo brand entity. leaders: the three camp heads for the "who leads each city" map, with
// why when the choice isn't obvious; an aisle without leaders failed its gate and has no map.
export type Category = { slug: string; title: string; brands: Brand[]; absent?: string[]; leaders?: { names: [string, string, string]; why?: string } };

// Ids from /search on Oct 12. Qloo has no brand entity for Alani Nu, Ghost, Prime,
// Culture Pop or San Pellegrino, and "Topo Chico" finds only the hard seltzer, so they're left out (the page says so).
export const CATEGORIES: Category[] = [
  {
    slug: "energy-drinks",
    title: "Energy drinks",
    leaders: { names: ["Red Bull", "Monster Energy", "Celsius"] },
    absent: ["Alani Nu", "Ghost", "Prime"],
    brands: [
      { name: "Red Bull", id: "409FAF5A-BC5F-4DC3-943D-E3B5F20B471D" },
      { name: "Monster Energy", id: "8376EDE4-3EA9-440B-B424-6BBFB13EB6F0" },
      { name: "Celsius", id: "D64DC967-F529-4A3F-9F89-774CE5118EF4" },
      { name: "Rockstar", id: "785995B1-45EE-4A93-AE26-7E190EDA7683" },
      { name: "Bang", id: "6D658357-3155-4983-947A-3E450570F879" },
      { name: "C4 Energy", id: "849A4730-E426-46DF-A3FC-D301F71236EE" },
      { name: "Reign", id: "AE366930-7BD7-4E8D-80D0-F3C290434144" },
      { name: "5-hour Energy", id: "52B57FB5-2C81-4CCF-9234-B4D68CBA86F5" },
      { name: "ZOA Energy", id: "487DBD74-7D2F-44B9-9D55-75BAA94C0F18" },
    ],
  },
  {
    slug: "soda-and-sparkling-water",
    title: "Better-for-you soda and sparkling water",
    leaders: {
      names: ["Olipop", "LaCroix", "Simply Pop"],
      why: "Simply Pop stands for the prebiotic side: Poppi's map shares only 1,961 cells with Olipop and LaCroix, under the 3,000-cell floor, and Simply Pop shares 4,681.",
    },
    absent: ["Culture Pop", "San Pellegrino", "Topo Chico (only the hard seltzer)"],
    brands: [
      { name: "Olipop", id: "6647FB92-9390-4B58-885B-86D96FF5BB6D" },
      { name: "Poppi", id: "8D1C70F5-AECA-4309-8BBF-B2B5A5AEFE59" },
      { name: "Zevia", id: "4A64547B-9F90-4CEE-B04C-CFB018E00E0D" },
      { name: "Health-Ade", id: "E95AEC3D-1FB3-49E4-AEF2-EF75A86F29CB" },
      { name: "Simply Pop", id: "B5BC1D3B-26E7-4BD8-B7D7-60454AEE3291" },
      { name: "LaCroix", id: "7D33F70F-60D7-485F-8B1C-454B7B50E849" },
      { name: "Bubly", id: "45617653-55F8-44CD-949D-2D16ECD8C2DD" },
      { name: "Spindrift", id: "AB20E24F-7B08-4215-BA29-ED341192FE3F" },
      { name: "Perrier", id: "6DED2E11-2AA3-498A-9D67-E59326147EA2" },
    ],
  },
  {
    slug: "outdoor-apparel",
    title: "Outdoor apparel",
    brands: [
      { name: "Patagonia", id: "DB4CE34E-3A63-4947-946F-9D52502C5762" },
      { name: "The North Face", id: "DB03F250-64F3-47AB-8756-BC1C4E13EBFD" },
      { name: "Arc'teryx", id: "B2A2238B-5FDC-46CD-B6F9-A32DB1474C70" },
      { name: "Columbia", id: "DD982800-A3A4-40A6-A30D-276B7FEA74A3" },
      { name: "REI", id: "205AF33F-118E-4C49-9721-6BDBAF981DA0" },
      { name: "Cotopaxi", id: "4F0F8472-9240-4573-93BE-C6DB118FD65A" },
      { name: "Outdoor Voices", id: "011DFDA5-F5A7-461A-9D96-E28E4964E7FB" },
      { name: "Marmot", id: "9EF335BD-7564-41DA-862F-099A5742BC02" },
      { name: "Fjällräven", id: "1BFF764A-D06D-48CA-9075-1E0F2A3FCE3D" },
      { name: "Carhartt", id: "2D69DB33-B4DF-4879-B3DC-308E3402A1FD" },
      { name: "L.L.Bean", id: "0E3A4DBB-917E-47D7-8147-6A36213A40D7" },
      { name: "Vuori", id: "D619A0B2-F0ED-4DD3-97D9-00BDC4F32E7C" },
    ],
  },
];
