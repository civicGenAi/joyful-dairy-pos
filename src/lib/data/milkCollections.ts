import { supabase, unwrap } from "@/lib/api/client";

// BACKEND: Milk collections, a raw-milk-focused read of the same
// conservation ledger Day reconciliation keeps (opening + collected +
// produced = sold + separated + spoilt + closing), scoped to fresh milk
// and mtindi combined, with collected split into Baraka Farm vs every
// other farmer, and sold split into ordinary sales vs bills to monthly
// customers. This is a report over the existing ledger, not a second
// place that locks a day, see supabase/migrations/00063_milk_collections.

export interface MilkDay {
  date: string;
  barakaLitres: number;
  farmersLitres: number;
  opening: number;
  produced: number;
  soldOther: number;
  billsAuto: number;
  billsManual: number;
  separated: number;
  spoilt: number;
  closing: number;
}

export interface MilkBillLine {
  id: string;
  customerId: string;
  customerName: string;
  productId: string;
  productName: string;
  litres: number;
}

export interface MilkBillManual {
  id: string;
  date: string;
  litres: number;
  note: string | null;
}

export const milkCollectionsKeys = {
  all: ["milkCollections"] as const,
  summary: (from: string, to: string) => ["milkCollections", "summary", from, to] as const,
  billLines: (date: string) => ["milkCollections", "billLines", date] as const,
  manualBills: (date: string) => ["milkCollections", "manualBills", date] as const,
};

export const milkCollectionsRepo = {
  async summary(from: string, to: string): Promise<MilkDay[]> {
    const { data, error } = await supabase.rpc("milk_collections_summary", {
      p_from: from,
      p_to: to,
    });
    if (error) throw new Error(error.message);
    return (
      data as {
        date: string;
        baraka_litres: number;
        farmers_litres: number;
        opening: number;
        produced: number;
        sold_other: number;
        bills_auto: number;
        bills_manual: number;
        separated: number;
        spoilt: number;
        closing: number;
      }[]
    ).map((r) => ({
      date: r.date,
      barakaLitres: Number(r.baraka_litres),
      farmersLitres: Number(r.farmers_litres),
      opening: Number(r.opening),
      produced: Number(r.produced),
      soldOther: Number(r.sold_other),
      billsAuto: Number(r.bills_auto),
      billsManual: Number(r.bills_manual),
      separated: Number(r.separated),
      spoilt: Number(r.spoilt),
      closing: Number(r.closing),
    }));
  },

  /** The default-checked list of monthly-customer fresh/mtindi sales for
   *  one day, so the UI can let someone uncheck the odd one that should
   *  not count toward that day's Bills figure. */
  async billLines(date: string): Promise<MilkBillLine[]> {
    const { data, error } = await supabase.rpc("milk_bill_customer_lines", { p_date: date });
    if (error) throw new Error(error.message);
    return (
      data as {
        id: string;
        customer_id: string;
        customer_name: string;
        product_id: string;
        product_name: string;
        litres: number;
      }[]
    ).map((r) => ({
      id: r.id,
      customerId: r.customer_id,
      customerName: r.customer_name,
      productId: r.product_id,
      productName: r.product_name,
      litres: Number(r.litres),
    }));
  },

  async manualBills(date: string): Promise<MilkBillManual[]> {
    const rows = unwrap(
      await supabase
        .from("milk_bill_manual")
        .select("id, date, litres, note")
        .eq("date", date)
        .order("created_at", { ascending: false }),
    ) as { id: string; date: string; litres: number; note: string | null }[];
    return rows.map((r) => ({ id: r.id, date: r.date, litres: Number(r.litres), note: r.note }));
  },

  async recordManualBill(input: { date: string; litres: number; note?: string }): Promise<void> {
    const { error } = await supabase.rpc("record_milk_bill_manual", {
      p_date: input.date,
      p_litres: input.litres,
      p_note: input.note ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async deleteManualBill(id: string): Promise<void> {
    const { error } = await supabase.rpc("delete_milk_bill_manual", { p_id: id });
    if (error) throw new Error(error.message);
  },
};
