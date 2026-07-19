import { getChatMessages } from "@/lib/data";
import { getCurrentUserName } from "@/lib/require-auth";
import { ChatCommandInput } from "@/components/ChatCommandInput";

export default async function ChatPage() {
  const [messages, currentUserName] = await Promise.all([
    getChatMessages(),
    getCurrentUserName(),
  ]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-gray-900">チャット</h1>
      <p className="text-sm text-gray-500">
        「客名　種別＋額面」の形式で入力すると取引を登録します。履歴は「営業終了・まとめて退店」を押すまで残ります。
      </p>
      <ChatCommandInput
        currentUserName={currentUserName ?? ""}
        initialHistory={messages.map((m) => ({
          id: m.id,
          kind: m.kind,
          text: m.text,
          ok: m.ok ?? undefined,
          warning: m.warning ?? undefined,
          commandId: m.command_id,
          transactionId: m.transaction_id ?? undefined,
          cancelled: m.cancelled,
          senderName: m.sender_name ?? undefined,
          category: m.category ?? undefined,
        }))}
      />
    </div>
  );
}
