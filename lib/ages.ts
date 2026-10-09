// Qloo age brackets (signal.demographics.age). Client-safe: no server imports, so the brief panel can use the labels.
export const AGES = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"] as const;
export type Age = (typeof AGES)[number];
export const AGE_LABEL: Record<Age, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25 to 29",
  "30_to_34": "30 to 34",
  "35_to_44": "35 to 44",
  "45_to_54": "45 to 54",
  "55_and_older": "55 and over",
};
