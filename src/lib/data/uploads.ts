import { supabase } from "@/lib/api/client";

// BACKEND: hard-copy scans (receipts, invoices) go to the public
// "receipts" storage bucket; the row stores the returned URL.

export async function uploadHardCopy(file: File, kind: "deposit" | "expense"): Promise<string> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from("receipts")
    .upload(path, file, { contentType: file.type || "image/jpeg" });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("receipts").getPublicUrl(path);
  return data.publicUrl;
}
