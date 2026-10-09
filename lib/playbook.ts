// What a partnership means depends on who the seed is (PLAN.md section 1: any entity in). One table keyed by seed
// type feeds the ranking prompt, the brief prompt and headings, the outreach framing, and the UI labels.
// No runtime imports: the browser uses the labels too.

export type SeedKind = "brand" | "artist" | "tv_show" | "movie" | "person";

export type Playbook = {
  noun: string; // how prompts name the seed
  slateSubtitle: string; // under "Partners for X"
  briefTitle: string; // panel eyebrow
  partnerRole: string; // what a brand partner is to this seed
  rankGuidance: string; // added to the ranking system prompt
  launchHeading: string; // the brief's launch section heading
  launchGuidance: string; // what the launch section contains
  venueQuery: string | null; // extra place tag to look up for venues (union with restaurants and bars)
  outreachFrom: string; // who writes the email
  outreachTo: string; // who receives it
};

const PLAYBOOKS: Record<SeedKind, Playbook> = {
  brand: {
    noun: "brand",
    slateSubtitle: "Brands, creators, shows and places this brand's fans already love",
    briefTitle: "Partnership brief",
    partnerRole: "co-brand partner: a joint product, drop, or activation",
    rankGuidance: "The seed is a brand. A good partner is one it could co-brand a product, drop, or activation with.",
    launchHeading: "Launch plan",
    launchGuidance:
      "the launch market with both over-index numbers; three venues for the launch, one line each; an activation line with the moment (when and what happens), the channel, and one KPI.",
    venueQuery: null,
    outreachFrom: "the seed brand's partnerships lead",
    outreachTo: "the partner's partnerships team",
  },
  artist: {
    noun: "artist",
    slateSubtitle: "Brands whose fans already love this artist",
    briefTitle: "Tour partner brief",
    partnerRole: "sponsor or tour partner",
    rankGuidance:
      "The seed is a music artist. For brands, prefer brands that plausibly sponsor music, tours, or live events (drinks, apparel, audio, travel, lifestyle). For other domains, prefer partners that fit a tour or a release.",
    launchHeading: "Tour stop plan",
    launchGuidance:
      "the overlap market as the tour stop, with both over-index numbers; three venues that fit a live show or an after-show (music venues and bars first), one line each; an activation at the show, with the moment, the channel, and one KPI such as on-site conversion or merch attach rate.",
    venueQuery: "live music venue",
    outreachFrom: "the artist's management",
    outreachTo: "the brand's partnerships team",
  },
  tv_show: {
    noun: "TV show",
    slateSubtitle: "Brands whose fans already love this show",
    briefTitle: "Licensing partner brief",
    partnerRole: "merchandising or licensing partner (a co-branded product tied to the show)",
    rankGuidance:
      "The seed is a TV show. For brands, prefer brands that could make a licensed or co-branded product tied to the show, the way Netflix paired Bridgerton with a coffee brand.",
    launchHeading: "Launch plan",
    launchGuidance:
      "the overlap market with both over-index numbers; three venues for a product launch or pop-up, one line each; an activation line with the moment (tied to a season or episode), the channel, and one KPI such as sell-through.",
    venueQuery: null,
    outreachFrom: "the studio's consumer products team",
    outreachTo: "the brand's partnerships team",
  },
  movie: {
    noun: "film",
    slateSubtitle: "Brands whose fans already love this film",
    briefTitle: "Licensing partner brief",
    partnerRole: "merchandising or licensing partner (a co-branded product tied to the film)",
    rankGuidance: "The seed is a film. For brands, prefer brands that could make a licensed or co-branded product tied to the film or its anniversary or sequel.",
    launchHeading: "Launch plan",
    launchGuidance:
      "the overlap market with both over-index numbers; three venues for a product launch, screening, or pop-up, one line each; an activation line with the moment, the channel, and one KPI such as sell-through.",
    venueQuery: null,
    outreachFrom: "the studio's consumer products team",
    outreachTo: "the brand's partnerships team",
  },
  person: {
    noun: "public figure",
    slateSubtitle: "Brands whose fans already love this person",
    briefTitle: "Ambassador brief",
    partnerRole: "ambassador or product-line partner",
    rankGuidance: "The seed is a public figure. For brands, prefer brands that could sign them as an ambassador or build a product line with them.",
    launchHeading: "Appearance plan",
    launchGuidance:
      "the overlap market with both over-index numbers; three venues for an appearance or product drop, one line each; an activation line with the moment, the channel, and one KPI.",
    venueQuery: null,
    outreachFrom: "the person's management",
    outreachTo: "the brand's partnerships team",
  },
};

// "urn:entity:artist" or "artist" -> its playbook. Proxy mode and anything unknown are brands.
export function playbookFor(type: string | undefined): Playbook & { kind: SeedKind } {
  const kind = (type ?? "").replace("urn:entity:", "") as SeedKind;
  return kind in PLAYBOOKS ? { kind, ...PLAYBOOKS[kind] } : { kind: "brand", ...PLAYBOOKS.brand };
}
