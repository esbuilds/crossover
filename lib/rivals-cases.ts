// Prepared rivals pairs (brief-oct13-vs ruling 5). Ids only, hand-picked in probe/VERIFY-4.md: "New York Yankees"
// searches at popularity 0.00, so a typed name would ask instead of landing.
const B = "urn:entity:brand", AR = "urn:entity:artist";
export type VsCase = { a: { name: string; id: string; type: string }; b: { name: string; id: string; type: string } };
export const VS_CASES: VsCase[] = [
  { a: { name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: B }, b: { name: "Celsius", id: "D64DC967-F529-4A3F-9F89-774CE5118EF4", type: B } },
  { a: { name: "Olipop", id: "6647FB92-9390-4B58-885B-86D96FF5BB6D", type: B }, b: { name: "Poppi", id: "8D1C70F5-AECA-4309-8BBF-B2B5A5AEFE59", type: B } },
  { a: { name: "Mt. Joy", id: "A6EAB02E-5AD7-46D1-9FD1-C70CBCF15C9A", type: AR }, b: { name: "Noah Kahan", id: "0A8052C7-2F56-43B5-B133-F59F8F2917E0", type: AR } },
  { a: { name: "Dodgers", id: "9B8B279C-B777-4293-8121-B8174970B57D", type: B }, b: { name: "Yankees", id: "709D89A7-455A-40E4-A0D3-E77201C1C630", type: B } },
];
export const vsHref = (c: VsCase) => `/vs/${c.a.id}/${c.b.id}?ta=${encodeURIComponent(c.a.type)}&tb=${encodeURIComponent(c.b.type)}`;

// "or try" pairs (brief-oct12-front list; brief-oct12-design ruling 1: Stanley by its warm-list id, D3D8956E, because
// typed "Stanley" asks brand or artist). Only pairs already warm are listed; the last four were warmed real Oct 12.
const TV = "urn:entity:tv_show";
export const VS_MORE: VsCase[] = [
  { a: { name: "Dr. Squatch", id: "F688F736-4F16-480A-84C4-08BBCC550375", type: B }, b: { name: "Manscaped", id: "461A4F35-1565-4372-916F-7A3E10903ED5", type: B } },
  { a: { name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: B }, b: { name: "Death Wish Coffee", id: "8E104A95-D942-4B31-88AC-07B26D1DE219", type: B } },
  // YETI first: that order is the one already warm (pair order is part of the cache keys)
  { a: { name: "YETI", id: "AA9DBB9A-DEE1-4D84-BC26-0FEBB34BB41B", type: B }, b: { name: "Stanley", id: "D3D8956E-4DE3-4C46-95E8-151CAB917DAA", type: B } },
  { a: { name: "Stranger Things", id: "07F1170E-BB69-4982-82C6-255F477EBBAD", type: TV }, b: { name: "Wednesday", id: "A0C54500-13CF-4193-A42E-FF0B72C42F88", type: TV } },
  { a: { name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: B }, b: { name: "Metallica", id: "C445C761-CB38-4FEE-B085-D35F444A04DF", type: AR } },
  { a: { name: "Allbirds", id: "78A44C09-E691-42DA-A553-5CDE6EE9B18A", type: B }, b: { name: "HOKA", id: "B7F13D5E-36A8-4AC4-A5A6-E949DED54050", type: B } },
  { a: { name: "Erewhon", id: "E87E45A7-080F-4C6E-B1B2-B7BE3A80DCAE", type: B }, b: { name: "Whole Foods", id: "1E5D90F5-5E0D-4486-B651-D0E7B8A6BE23", type: B } },
  { a: { name: "A24", id: "7E904879-87BC-4BA6-B4AB-6E380A4C250D", type: B }, b: { name: "Blumhouse", id: "10396284-FEE0-42F9-B176-EC6F407DA42B", type: B } },
  { a: { name: "Taylor Swift", id: "4BBEF799-A0C4-4110-AB01-39216993C312", type: AR }, b: { name: "Beyoncé", id: "F6754C46-B3E7-457F-8B7E-06C613597320", type: AR } },
];

// One worked case, hand-written from the cached numbers (planner brief, real Oct 12): what a partnerships lead does
// with Liquid Death vs Celsius. Only this pair; every number below is on the page above it.
export const PAIR_CASE = {
  a: "4DF7C265-52D9-4A99-8803-F62C2302D561",
  b: "D64DC967-F529-4A3F-9F89-774CE5118EF4",
  id: "what-a-lead-does",
  label: "What a partnerships lead does with this",
  paragraphs: [
    "The question. You run partnerships at Liquid Death, and Celsius keeps coming up as the comparison. Which audience is yours, and where would a first event land?",
    "What the page answers. The two audiences barely overlap: of 100 brands their fans favor, 44 sit closer to Liquid Death, 48 closer to Celsius, and 3 within 0.05 of both (Manscaped, Bella+canvas, Affliction Clothing). Liquid Death's side opens with Fallen Footwear (0.87 here, 0.51 under Celsius), 22Red and The Berrics; Celsius's side includes Pretty Girls Sweat (0.92 there, 0.58 under Liquid Death) and Yummy Spoonfuls. On the map, Liquid Death leads in Denver, Portland and Austin, Celsius in Miami, Tampa and Dallas, and Los Angeles and San Diego sit in both top fives.",
    "What changes. Three markets to test first: Denver, Portland and Austin, where Liquid Death's audience runs hotter. Two brands to call first: Fallen Footwear and 22Red, the strongest names on Liquid Death's side and each at least 0.30 weaker under Celsius, so their fans are measurably closer to yours. Los Angeles stays a shared market, worth a pitch only with a clear reason.",
    "What it doesn't settle. Budget, rights, availability, either company's objectives, or whether a deal makes money. These are measured taste affinities across an audience, not purchases or visits.",
  ],
};
