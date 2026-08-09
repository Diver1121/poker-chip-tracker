"use server";

// OCEAN会員アプリ(ocean-app)との連携まわりのServer Action。
// customers/actions.tsとは別ファイルにして、ローヤリティアプリ連携だけをgrepしやすくしている。
// ocean-app側は電話番号の本人確認をしないため、なりすまし防止として
// 「アプリへの紐付け」は必ずここ(スタッフ操作)からのみ行う。

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAuth } from "@/lib/require-auth";

export async function linkMemberToApp(formData: FormData) {
  await requireAuth();
  const customerId = String(formData.get("customerId") ?? "");
  const phone = String(formData.get("phone") ?? "").trim();
  if (!customerId || !phone) {
    redirect(`/customers/${customerId}?error=ocean_phone_required`);
  }

  const supabase = getSupabaseClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError) throw customerError;
  if (!customer) {
    redirect(`/customers/${customerId}?error=ocean_customer_not_found`);
  }

  const { data: existingLink, error: linkError } = await supabase
    .from("ocean_members")
    .select("id")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (linkError) throw linkError;
  if (existingLink) {
    redirect(`/customers/${customerId}?error=ocean_already_linked`);
  }

  const { data: existingPhone, error: phoneError } = await supabase
    .from("ocean_members")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (phoneError) throw phoneError;
  if (existingPhone) {
    redirect(`/customers/${customerId}?error=ocean_phone_taken`);
  }

  const { error } = await supabase
    .from("ocean_members")
    .insert({ customer_id: customer.id, phone, name: customer.name });
  if (error) throw error;

  revalidatePath(`/customers/${customerId}`);
}

// パスワード未設定(紐付けただけでまだお客様が使い始めていない)の連携を取り消す。
// スタッフの電話番号入力ミスをやり直すため。パスワード設定済みの行は
// (お客様のポイント履歴を持つため)ここでは絶対に消さない — DB側のフィルタも安全網にする。
export async function unlinkMember(formData: FormData) {
  await requireAuth();
  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("ocean_members")
    .delete()
    .eq("customer_id", customerId)
    .is("password_hash", null);
  if (error) throw error;

  revalidatePath(`/customers/${customerId}`);
}

// お客様がパスワードを忘れた場合。未設定状態に戻し、現在ログイン中の端末も
// 即座に無効化する(端末紛失時などに古いログインを残したくないため)。
export async function resetMemberPassword(formData: FormData) {
  await requireAuth();
  const customerId = String(formData.get("customerId") ?? "");
  if (!customerId) return;

  const supabase = getSupabaseClient();

  const { data: member, error: findError } = await supabase
    .from("ocean_members")
    .select("id")
    .eq("customer_id", customerId)
    .maybeSingle();
  if (findError) throw findError;
  if (!member) return;

  const { error: updateError } = await supabase
    .from("ocean_members")
    .update({ password_hash: null, failed_login_attempts: 0, locked_until: null })
    .eq("id", member.id);
  if (updateError) throw updateError;

  const { error: sessionError } = await supabase
    .from("ocean_sessions")
    .delete()
    .eq("member_id", member.id);
  if (sessionError) throw sessionError;

  revalidatePath(`/customers/${customerId}`);
}
