import { salesRepo, type SaleLineInput, type Sale } from "@/lib/data/sales";
import type { PriceTier } from "@/mock/types";

// A durable, localStorage-backed queue for van sales made while offline.
// Each entry carries a stable clientRef (see complete_sale's p_client_ref)
// so replaying it after reconnect can never double-charge a customer even
// if an earlier attempt actually reached the server before the response
// was lost.

export interface QueuedSale {
  clientRef: string;
  queuedAt: string;
  input: {
    channel: "counter" | "route";
    payment: Sale["payment"];
    tier: PriceTier;
    lines: SaleLineInput[];
    customerId?: string;
    locationId?: string;
    customerName?: string;
    receiptUrl?: string;
  };
}

function storageKey(userId: string): string {
  return `ajd:van:sales-queue:${userId}`;
}

function read(userId: string): QueuedSale[] {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as QueuedSale[]) : [];
  } catch {
    return [];
  }
}

function write(userId: string, queue: QueuedSale[]): void {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(queue));
  } catch {
    /* quota or privacy mode, the sale still exists in memory for this tab */
  }
}

export function newClientRef(): string {
  return crypto.randomUUID();
}

export const salesQueue = {
  list: read,

  enqueue(userId: string, entry: QueuedSale): void {
    const queue = read(userId);
    queue.push(entry);
    write(userId, queue);
  },

  /** Replays queued sales in order, stopping at the first failure so a
   *  still-offline connection doesn't burn through every item as an error.
   *  Returns how many synced and, if any, the error that stopped it. */
  async flush(
    userId: string,
    onSynced?: (entry: QueuedSale) => void,
  ): Promise<{ synced: number; remaining: number; error?: string }> {
    const queue = read(userId);
    let synced = 0;
    while (queue.length > 0) {
      const entry = queue[0];
      try {
        await salesRepo.complete({ ...entry.input, clientRef: entry.clientRef });
        queue.shift();
        write(userId, queue);
        synced += 1;
        onSynced?.(entry);
      } catch (e) {
        return { synced, remaining: queue.length, error: (e as Error).message };
      }
    }
    return { synced, remaining: 0 };
  },
};
