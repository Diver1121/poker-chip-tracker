import { getSupabaseClient } from "@/lib/supabase";
import type {
  ChatMessage,
  ChipTransaction,
  Customer,
  Denomination,
  Visit,
} from "@/lib/types";

const nameCollator = new Intl.Collator("ja");

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => nameCollator.compare(a.name, b.name));
}

export async function getDenominations(): Promise<Denomination[]> {
  const { data, error } = await getSupabaseClient()
    .from("denominations")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabaseClient().from("customers").select("*");
  if (error) throw error;
  return sortByName(data);
}

export async function getCheckedInCustomers(): Promise<Customer[]> {
  const { data, error } = await getSupabaseClient()
    .from("customers")
    .select("*")
    .not("checked_in_at", "is", null);
  if (error) throw error;
  return sortByName(data);
}

export async function getCustomer(id: string): Promise<Customer | null> {
  const { data, error } = await getSupabaseClient()
    .from("customers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getDenomination(id: string): Promise<Denomination | null> {
  const { data, error } = await getSupabaseClient()
    .from("denominations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllTransactions(): Promise<ChipTransaction[]> {
  const { data, error } = await getSupabaseClient()
    .from("chip_transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function getChatMessages(): Promise<ChatMessage[]> {
  const { data, error } = await getSupabaseClient()
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getAllVisits(): Promise<Visit[]> {
  const { data, error } = await getSupabaseClient()
    .from("visits")
    .select("*")
    .order("checked_in_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getTransactionsForCustomer(
  customerId: string,
): Promise<ChipTransaction[]> {
  const { data, error } = await getSupabaseClient()
    .from("chip_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
