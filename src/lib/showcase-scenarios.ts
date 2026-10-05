import { Coffee, Drum, Scissors, Store, UtensilsCrossed, type LucideIcon } from "lucide-react";

export type ShowcaseSlug = "coffee-shop" | "laundry" | "beauty-parlor" | "cafe" | "restaurant";
export type ShowcaseTheme = "coffeehouse" | "laundry" | "beauty" | "cafe" | "fiesta";
export type ScenarioCategory = { name: { en: string; tl: string }; sales: number; margin: number };
export type BusinessScenario = {
  slug: ShowcaseSlug;
  theme: ShowcaseTheme;
  icon: LucideIcon;
  name: { en: string; tl: string };
  sampleName: string;
  tagline: { en: string; tl: string };
  story: { en: string; tl: string };
  customer: { en: string; tl: string };
  growth: number;
  averageTicket: number;
  categories: ScenarioCategory[];
  alerts: { level: "warning" | "success" | "info"; text: { en: string; tl: string } }[];
};

export const SHOWCASE_SCENARIOS: BusinessScenario[] = [
  {
    slug: "coffee-shop", theme: "coffeehouse", icon: Coffee,
    name: { en: "Coffee Shop", tl: "Coffee Shop" }, sampleName: "Brew & Bloom",
    tagline: { en: "Track morning rushes, drink margins, and ingredient stock.", tl: "Subaybayan ang morning rush, tubo sa inumin, at sangkap." },
    story: { en: "A specialty coffee shop near a university serving students and remote workers.", tl: "Specialty coffee shop malapit sa unibersidad para sa students at remote workers." },
    customer: { en: "Best for coffee shops balancing busy hours, recipes, pastries, and retail beans.", tl: "Bagay sa coffee shop na minamanage ang busy hours, recipes, pastries, at coffee beans." },
    growth: 12, averageTicket: 195,
    categories: [
      { name: { en: "Espresso drinks", tl: "Espresso drinks" }, sales: 26400, margin: 66 },
      { name: { en: "Pastries", tl: "Pastries" }, sales: 12000, margin: 52 },
      { name: { en: "Bottled brews", tl: "Bottled brews" }, sales: 7200, margin: 61 },
      { name: { en: "Retail beans", tl: "Coffee beans" }, sales: 2400, margin: 42 },
    ],
    alerts: [
      { level: "warning", text: { en: "Oat milk is low — about 2 days left.", tl: "Paubos ang oat milk — mga 2 araw na lang." } },
      { level: "info", text: { en: "Friday 2 PM is likely to be the busiest period.", tl: "Posibleng pinakamatao sa Biyernes, 2 PM." } },
    ],
  },
  {
    slug: "laundry", theme: "laundry", icon: Drum,
    name: { en: "Laundry", tl: "Laundry" }, sampleName: "Linis Express",
    tagline: { en: "See loads completed, service mix, and supply needs.", tl: "Tingnan ang natapos na loads, serbisyo, at kailangang supplies." },
    story: { en: "A drop-off and self-service laundry beside a busy condominium community.", tl: "Drop-off at self-service laundry sa tabi ng mataong condominium." },
    customer: { en: "Best for laundries tracking loads, machine care, detergent, and add-on services.", tl: "Bagay sa laundry na sumusubaybay sa loads, makina, detergent, at dagdag na serbisyo." },
    growth: 8, averageTicket: 240,
    categories: [
      { name: { en: "Wash & dry", tl: "Wash & dry" }, sales: 21125, margin: 74 },
      { name: { en: "Drop-off service", tl: "Drop-off service" }, sales: 8125, margin: 70 },
      { name: { en: "Detergent", tl: "Detergent" }, sales: 1950, margin: 42 },
      { name: { en: "Pressing", tl: "Plantsa" }, sales: 1300, margin: 68 },
    ],
    alerts: [
      { level: "warning", text: { en: "Machine 4 lint-filter cleaning is due today.", tl: "Kailangang linisin ang lint filter ng Machine 4 ngayon." } },
      { level: "info", text: { en: "Reorder commercial softener before the weekend.", tl: "Mag-reorder ng commercial softener bago mag-weekend." } },
    ],
  },
  {
    slug: "beauty-parlor", theme: "beauty", icon: Scissors,
    name: { en: "Beauty Parlor", tl: "Beauty Parlor" }, sampleName: "Ganda Hub",
    tagline: { en: "Compare services, stylist demand, and product sales.", tl: "Ikumpara ang serbisyo, demand sa stylist, at product sales." },
    story: { en: "A neighborhood salon offering hair, nail, and skincare services with retail products.", tl: "Neighborhood salon na may hair, nail, skincare, at retail products." },
    customer: { en: "Best for salons managing appointments, service margins, staff demand, and retail stock.", tl: "Bagay sa salon na minamanage ang appointments, tubo, staff demand, at retail stock." },
    growth: 15, averageTicket: 650,
    categories: [
      { name: { en: "Hair services", tl: "Hair services" }, sales: 22000, margin: 62 },
      { name: { en: "Nail care", tl: "Nail care" }, sales: 13200, margin: 59 },
      { name: { en: "Skincare", tl: "Skincare" }, sales: 5280, margin: 51 },
      { name: { en: "Retail products", tl: "Retail products" }, sales: 3520, margin: 38 },
    ],
    alerts: [
      { level: "success", text: { en: "Saturday appointments are already 90% booked.", tl: "90% booked na ang appointments sa Sabado." } },
      { level: "warning", text: { en: "Keratin repair serum is out of stock.", tl: "Out of stock ang keratin repair serum." } },
    ],
  },
  {
    slug: "cafe", theme: "cafe", icon: Store,
    name: { en: "Café", tl: "Kapehan" }, sampleName: "Tambayan Nook",
    tagline: { en: "Balance meals, merienda, coffee, and seasonal demand.", tl: "Balansehin ang meals, merienda, kape, at seasonal demand." },
    story: { en: "An affordable neighborhood café serving silog meals, Barako coffee, and merienda.", tl: "Abot-kayang kapehan na may silog meals, Barako coffee, at merienda." },
    customer: { en: "Best for cafés combining prepared meals, beverages, ingredients, and table service.", tl: "Bagay sa café na may meals, inumin, sangkap, at table service." },
    growth: -4, averageTicket: 145,
    categories: [
      { name: { en: "Silog meals", tl: "Silog meals" }, sales: 34100, margin: 43 },
      { name: { en: "Local coffee", tl: "Lokal na kape" }, sales: 15500, margin: 67 },
      { name: { en: "Merienda", tl: "Merienda" }, sales: 8680, margin: 49 },
      { name: { en: "Cold drinks", tl: "Malamig na inumin" }, sales: 3720, margin: 54 },
    ],
    alerts: [
      { level: "warning", text: { en: "Only one sack of rice remains.", tl: "Isang sako na lang ang natitirang bigas." } },
      { level: "info", text: { en: "Tapa demand is highest from 7–9 AM.", tl: "Pinakamataas ang demand sa tapa mula 7–9 AM." } },
    ],
  },
  {
    slug: "restaurant", theme: "fiesta", icon: UtensilsCrossed,
    name: { en: "Restaurant", tl: "Restaurant" }, sampleName: "Lutong Bahay",
    tagline: { en: "Watch dining sales, food cost, and payday peaks.", tl: "Bantayan ang dining sales, food cost, at payday peaks." },
    story: { en: "A family restaurant serving Filipino platters and group meals for celebrations.", tl: "Family restaurant na may Filipino platters at group meals para sa salu-salo." },
    customer: { en: "Best for restaurants tracking food cost, table sales, platters, and kitchen supplies.", tl: "Bagay sa restaurant na minamanage ang food cost, table sales, platters, at kitchen supplies." },
    growth: 22, averageTicket: 980,
    categories: [
      { name: { en: "Main platters", tl: "Main platters" }, sales: 108500, margin: 34 },
      { name: { en: "Beverages", tl: "Inumin" }, sales: 23250, margin: 61 },
      { name: { en: "Desserts", tl: "Desserts" }, sales: 15500, margin: 48 },
      { name: { en: "Add-ons", tl: "Add-ons" }, sales: 7750, margin: 52 },
    ],
    alerts: [
      { level: "warning", text: { en: "Beef market prices increased by 15% this week.", tl: "Tumaas ng 15% ang presyo ng beef ngayong linggo." } },
      { level: "info", text: { en: "LPG refill is scheduled tomorrow at 9 AM.", tl: "Naka-schedule ang LPG refill bukas, 9 AM." } },
    ],
  },
];

export function getShowcaseScenario(slug: string) {
  return SHOWCASE_SCENARIOS.find((scenario) => scenario.slug === slug);
}