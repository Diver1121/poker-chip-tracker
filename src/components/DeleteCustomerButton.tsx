"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomer } from "@/app/(app)/customers/actions";

export function DeleteCustomerButton({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        `「${customerName}」を削除しますか？関連する取引履歴もすべて削除され、元に戻せません。`,
      )
    ) {
      return;
    }
    const formData = new FormData();
    formData.set("customerId", customerId);
    startTransition(async () => {
      await deleteCustomer(formData);
      router.push("/customers");
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "削除中…" : "客を削除"}
    </button>
  );
}
