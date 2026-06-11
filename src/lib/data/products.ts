import { supabase, unwrap } from "@/lib/api/client";
import { recordAudit } from "@/lib/data/audit";
import type { PriceMatrix, PriceTier, Product, ProductCategory, Unit } from "@/mock/types";

// BACKEND: products + price-history repository. Replaces PRODUCTS / PRICE_MATRIX.

interface ProductRow {
  id: string;
  name: string;
  sw_name: string;
  category: ProductCategory;
  unit: Unit;
  conversion_note: string | null;
  active: boolean;
}

function toProduct(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    swName: r.sw_name,
    category: r.category,
    unit: r.unit,
    conversionNote: r.conversion_note ?? undefined,
    active: r.active,
  };
}

export interface PriceHistoryEntry {
  id: string;
  productId: string;
  tier: PriceTier;
  value: number;
  effectiveFrom: string;
  byName?: string;
}

export const productKeys = {
  all: ["products"] as const,
  list: () => ["products", "list"] as const,
  prices: () => ["products", "prices"] as const,
  priceHistory: () => ["products", "priceHistory"] as const,
};

export const productsRepo = {
  async list(): Promise<Product[]> {
    const rows = unwrap(await supabase.from("products").select("*").order("name")) as ProductRow[];
    return rows.map(toProduct);
  },

  /** Current prices in the PriceMatrix shape every screen already consumes. */
  async priceMatrix(): Promise<PriceMatrix> {
    const rows = unwrap(
      await supabase.from("current_prices").select("product_id, tier, value"),
    ) as { product_id: string; tier: PriceTier; value: number }[];
    const matrix: PriceMatrix = {};
    for (const r of rows) {
      matrix[r.product_id] = matrix[r.product_id] ?? { own: 0, bottle: 0, bulk: 0 };
      matrix[r.product_id][r.tier] = Number(r.value);
    }
    return matrix;
  },

  async priceHistory(): Promise<PriceHistoryEntry[]> {
    const rows = unwrap(
      await supabase
        .from("price_list")
        .select("id, product_id, tier, value, effective_from, profiles(name)")
        .order("effective_from", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120),
    ) as unknown as {
      id: string;
      product_id: string;
      tier: PriceTier;
      value: number;
      effective_from: string;
      profiles: { name: string } | null;
    }[];
    return rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      tier: r.tier,
      value: Number(r.value),
      effectiveFrom: r.effective_from,
      byName: r.profiles?.name,
    }));
  },

  async create(input: {
    name: string;
    swName: string;
    category: ProductCategory;
    unit: Unit;
    conversionNote?: string;
    prices: Record<PriceTier, number>;
  }): Promise<Product> {
    const row = unwrap(
      await supabase
        .from("products")
        .insert({
          name: input.name,
          sw_name: input.swName,
          category: input.category,
          unit: input.unit,
          conversion_note: input.conversionNote ?? null,
        })
        .select("*")
        .single(),
    ) as ProductRow;
    unwrap(
      await supabase
        .from("price_list")
        .insert(
          (Object.entries(input.prices) as [PriceTier, number][]).map(([tier, value]) => ({
            product_id: row.id,
            tier,
            value,
          })),
        )
        .select("id"),
    );
    await recordAudit(
      "create",
      "products",
      `Ameongeza bidhaa mpya (${input.name})`,
      `Added a new product (${input.name})`,
    );
    return toProduct(row);
  },

  async setActive(id: string, name: string, active: boolean): Promise<void> {
    unwrap(await supabase.from("products").update({ active }).eq("id", id).select("id"));
    await recordAudit(
      "edit",
      "products",
      active ? `Amewasha bidhaa (${name})` : `Amezima bidhaa (${name})`,
      active ? `Activated product (${name})` : `Deactivated product (${name})`,
    );
  },

  /** Price changes append to price_list so history stays first-class. */
  async setPrice(input: {
    productId: string;
    productName: string;
    tier: PriceTier;
    oldValue: number;
    value: number;
  }): Promise<void> {
    unwrap(
      await supabase
        .from("price_list")
        .insert({ product_id: input.productId, tier: input.tier, value: input.value })
        .select("id"),
    );
    await recordAudit(
      "price-change",
      "products",
      `Amebadilisha bei ya ${input.productName} (${input.tier}) ${input.oldValue} kuwa ${input.value}`,
      `Changed ${input.productName} price (${input.tier}) ${input.oldValue} to ${input.value}`,
    );
  },
};
