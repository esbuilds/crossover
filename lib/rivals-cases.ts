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
