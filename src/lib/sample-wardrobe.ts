// Clearly-labelled demo wardrobe. Inserted only when the user asks for it.
import type { Category } from "./domain";

export interface SampleItem {
  sample_key: string;
  name: string;
  category: Category;
  main_color: string;
  pattern: string;
  style: string;
  fit: string;
  seasons: string[];
}

export const SAMPLE_WARDROBE: SampleItem[] = [
  { sample_key: "white-tee", name: "White crew tee", category: "top", main_color: "white", pattern: "solid", style: "casual", fit: "regular", seasons: ["spring", "summer"] },
  { sample_key: "grey-knit", name: "Charcoal merino knit", category: "top", main_color: "grey", pattern: "textured", style: "smart-casual", fit: "regular", seasons: ["autumn", "winter"] },
  { sample_key: "oxford-shirt", name: "Light blue oxford shirt", category: "shirt", main_color: "light blue", pattern: "solid", style: "smart-casual", fit: "slim", seasons: ["spring", "autumn"] },
  { sample_key: "beige-chinos", name: "Beige chinos", category: "trousers", main_color: "beige", pattern: "solid", style: "smart-casual", fit: "slim", seasons: ["spring", "summer", "autumn"] },
  { sample_key: "black-trousers", name: "Black tailored trousers", category: "trousers", main_color: "black", pattern: "solid", style: "formal", fit: "tailored", seasons: ["autumn", "winter", "spring"] },
  { sample_key: "indigo-jeans", name: "Indigo straight jeans", category: "jeans", main_color: "denim", pattern: "solid", style: "casual", fit: "regular", seasons: ["spring", "autumn", "winter"] },
  { sample_key: "white-sneakers", name: "White leather sneakers", category: "shoes", main_color: "white", pattern: "solid", style: "casual", fit: "regular", seasons: ["spring", "summer", "autumn"] },
  { sample_key: "brown-loafers", name: "Brown penny loafers", category: "shoes", main_color: "brown", pattern: "solid", style: "smart-casual", fit: "regular", seasons: ["spring", "autumn", "winter"] },
  { sample_key: "camel-trench", name: "Camel trench coat", category: "outerwear", main_color: "camel", pattern: "solid", style: "smart-casual", fit: "relaxed", seasons: ["autumn", "spring", "winter"] },
  { sample_key: "navy-blazer", name: "Navy cotton blazer", category: "outerwear", main_color: "navy", pattern: "solid", style: "formal", fit: "tailored", seasons: ["spring", "autumn"] },
  { sample_key: "leather-watch", name: "Gold watch, brown strap", category: "accessory", main_color: "brown", pattern: "solid", style: "smart-casual", fit: "regular", seasons: [] },
];
