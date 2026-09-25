import { useEffect, useState } from "react";

export type Account = { name: string; reminders: boolean };
const KEY = "rootsight.account";

function load(): Account {
  try {
    return { name: "", reminders: true, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { name: "", reminders: true };
  }
}

/** Local profile and preferences (this device only until accounts sync). */
export function useAccount() {
  const [account, setAccount] = useState(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(account));
    } catch {}
  }, [account]);
  return [account, (patch: Partial<Account>) => setAccount((a) => ({ ...a, ...patch }))] as const;
}
