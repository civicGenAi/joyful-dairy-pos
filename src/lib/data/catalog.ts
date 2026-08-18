import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: the public product catalog, backed by public_catalog(), the
// third deliberately anon-callable RPC in this schema (alongside
// verify_invoice and submit_feedback). No auth: this is what the /catalog
// page calls for the "our products" QR code.

export interface CatalogProduct {
  id: string;
  name: string;
  swName: string;
  category: string;
  unit: string;
  priceTZS: number;
}

interface CatalogRow {
  id: string;
  name: string;
  sw_name: string;
  category: string;
  unit: string;
  price_tzs: number;
}

export const catalogKeys = {
  all: ["catalog"] as const,
};

export const catalogRepo = {
  async list(): Promise<CatalogProduct[]> {
    const rows = unwrap(await supabase.rpc("public_catalog")) as CatalogRow[];
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      swName: r.sw_name,
      category: r.category,
      unit: r.unit,
      priceTZS: Number(r.price_tzs),
    }));
  },
};
