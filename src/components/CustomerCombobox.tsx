"use client";

import { useId, useState } from "react";

export function CustomerCombobox({
  name,
  customers,
  placeholder = "客を検索して選択",
  className,
}: {
  name: string;
  customers: { id: string; name: string }[];
  placeholder?: string;
  className?: string;
}) {
  const listId = useId();
  const [text, setText] = useState("");
  const match = customers.find((c) => c.name === text);

  return (
    <div>
      <input
        list={listId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete="off"
        className={className}
      />
      <datalist id={listId}>
        {customers.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <input type="hidden" name={name} value={match?.id ?? ""} />
    </div>
  );
}
