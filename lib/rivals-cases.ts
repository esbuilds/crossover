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
// typed "Stanley" asks brand or artist). Only pairs already warm are listed; the Oct 14 warm pass adds Allbirds vs
// Hoka, Erewhon vs Whole Foods, A24 vs Blumhouse and Taylor Swift vs Beyoncé.
const TV = "urn:entity:tv_show";
export const VS_MORE: VsCase[] = [
  { a: { name: "Dr. Squatch", id: "F688F736-4F16-480A-84C4-08BBCC550375", type: B }, b: { name: "Manscaped", id: "461A4F35-1565-4372-916F-7A3E10903ED5", type: B } },
  { a: { name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: B }, b: { name: "Death Wish Coffee", id: "8E104A95-D942-4B31-88AC-07B26D1DE219", type: B } },
  // YETI first: that order is the one already warm (pair order is part of the cache keys)
  { a: { name: "YETI", id: "AA9DBB9A-DEE1-4D84-BC26-0FEBB34BB41B", type: B }, b: { name: "Stanley", id: "D3D8956E-4DE3-4C46-95E8-151CAB917DAA", type: B } },
  { a: { name: "Stranger Things", id: "07F1170E-BB69-4982-82C6-255F477EBBAD", type: TV }, b: { name: "Wednesday", id: "A0C54500-13CF-4193-A42E-FF0B72C42F88", type: TV } },
  { a: { name: "Liquid Death", id: "4DF7C265-52D9-4A99-8803-F62C2302D561", type: B }, b: { name: "Metallica", id: "C445C761-CB38-4FEE-B085-D35F444A04DF", type: AR } },
];
