export const demoObjects = [
  {
    id: "broken-cup",
    label: "broken cup",
    path: "/sample-broken-cup.jpg",
    name: "sample-broken-cup.jpg",
  },
  {
    id: "desk-lamp",
    label: "desk lamp",
    path: "/fallback-lamp.webp",
    name: "sample-desk-lamp.webp",
  },
] as const;

export const demoObjectIds = ["broken-cup", "desk-lamp"] as const;

export type DemoObjectId = (typeof demoObjectIds)[number];
