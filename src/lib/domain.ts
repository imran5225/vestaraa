// Shared, browser-safe domain types and vocabularies for VÉSTARA.

export const CATEGORIES = [
  { value: "top", label: "T-shirts & tops" },
  { value: "shirt", label: "Shirts" },
  { value: "trousers", label: "Trousers & pants" },
  { value: "jeans", label: "Jeans" },
  { value: "shoes", label: "Shoes" },
  { value: "outerwear", label: "Jackets & outerwear" },
  { value: "accessory", label: "Accessories" },
] as const;
export type Category = (typeof CATEGORIES)[number]["value"];

export const SLOTS = ["top", "bottom", "shoes", "outerwear", "accessory"] as const;
export type Slot = (typeof SLOTS)[number];
export const REQUIRED_SLOTS: Slot[] = ["top", "bottom", "shoes"];
export const SLOT_LABELS: Record<Slot, string> = {
  top: "Top",
  bottom: "Bottom",
  shoes: "Footwear",
  outerwear: "Outerwear",
  accessory: "Accessory",
};

export const CATEGORY_SLOT: Record<Category, Slot> = {
  top: "top",
  shirt: "top",
  trousers: "bottom",
  jeans: "bottom",
  shoes: "shoes",
  outerwear: "outerwear",
  accessory: "accessory",
};

export const COLORS = [
  "white", "black", "grey", "navy", "blue", "light blue", "beige", "cream", "camel", "brown",
  "olive", "green", "red", "burgundy", "pink", "yellow", "orange", "purple", "denim",
] as const;
export const PATTERNS = ["solid", "striped", "checked", "printed", "floral", "textured"] as const;
export const STYLES = ["casual", "smart-casual", "formal", "streetwear", "athleisure", "party"] as const;
export const FITS = ["slim", "regular", "relaxed", "oversized", "tailored"] as const;
export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export const OCCASIONS = [
  { value: "college", label: "College" },
  { value: "casual", label: "Casual" },
  { value: "work", label: "Work" },
  { value: "evening", label: "Evening" },
  { value: "party", label: "Party" },
  { value: "travel", label: "Travel" },
] as const;

export type FeedbackAction = "love" | "dislike" | "swap" | "save" | "worn";

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  subcategory: string | null;
  main_color: string | null;
  secondary_colors: string[];
  pattern: string | null;
  style: string | null;
  fit: string | null;
  seasons: string[];
  image_path: string | null;
  sample_key: string | null;
  brand: string | null;
  notes: string | null;
  is_sample: boolean;
  created_at: string;
}

export type OutfitSlots = Partial<Record<Slot, string>>;

export interface WeatherContext {
  city: string;
  temperatureC: number;
  precipitationMm: number;
  description: string;
  fetchedAt: string;
}

export function isCategory(value: string): value is Category {
  return CATEGORIES.some((c) => c.value === value);
}

export function categoryLabel(value: string) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function occasionLabel(value: string) {
  return OCCASIONS.find((o) => o.value === value)?.label ?? value;
}
