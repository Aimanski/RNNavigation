// Nutrition

export type OffProduct = {
  name: string;
  imageUrl: string | null;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
};

export async function lookupBarcodeProduct(barcode: string): Promise<OffProduct | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode
    )}.json?fields=product_name,nutriments,image_url`
  );
  if (!res.ok) return null;

  const data = await res.json();
  if (data?.status !== 1 || !data.product) return null;

  const n = data.product.nutriments || {};
  const caloriesPer100g = n["energy-kcal_100g"];
  if (caloriesPer100g == null) return null; // Fallback

  return {
    name: data.product.product_name?.trim() || "Unknown product",
    imageUrl: data.product.image_url || null,
    caloriesPer100g: Math.round(caloriesPer100g),
    proteinPer100g: Math.round((n["proteins_100g"] ?? 0) * 10) / 10,
    carbsPer100g: Math.round((n["carbohydrates_100g"] ?? 0) * 10) / 10,
    fatPer100g: Math.round((n["fat_100g"] ?? 0) * 10) / 10,
  };
}

// Barcode
export function looksLikeBarcode(value: string): boolean {
  return /^[0-9]{6,14}$/.test(value.trim());
}
