import { toast } from "sonner";
import { useT } from "@/lib/i18n";
import { storeErrorMessage, useMyStores, useSwitchStore } from "@/lib/stores";

/** Dropdown to move between an owner's stores. Hidden when the user has only one store. */
export function StoreSwitcher({ className = "" }: { className?: string }) {
  const { t } = useT();
  const { data: stores } = useMyStores();
  const switchStore = useSwitchStore();
  if (!stores || stores.length < 2) return null;
  const current = stores.find((s) => s.is_current)?.shop_id ?? stores[0].shop_id;
  return (
    <select
      aria-label={t("stores.switch")}
      value={current}
      onChange={async (e) => {
        try { await switchStore(e.target.value); toast.success(t("stores.switched")); }
        catch (err) { toast.error(storeErrorMessage(err, t)); }
      }}
      className={`h-9 max-w-[9rem] truncate rounded-lg border border-border bg-background px-2 text-xs font-medium ${className}`}
    >
      {stores.map((s) => <option key={s.shop_id} value={s.shop_id}>{s.shop_name}</option>)}
    </select>
  );
}
