import { useState } from "react";
import { addPromoCode, removePromoCode } from "../api/medusa-client";
import { useCart } from "../CartContext";

interface PromotionCodeInputProps {
  cartId: string | null;
  onCartUpdate?: () => void;
}

export function PromotionCodeInput({ cartId, onCartUpdate }: PromotionCodeInputProps) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [appliedCodes, setAppliedCodes] = useState<string[]>([]);
  const { ensureMedusaCart } = useCart();

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cartId || !code.trim()) return;
    
    setStatus("loading");
    setMessage(null);
    
    try {
      // Ensure cart exists
      const activeCartId = cartId || (await ensureMedusaCart());
      if (!activeCartId) {
        throw new Error("Warenkorb konnte nicht geladen werden.");
      }

      const result = await addPromoCode(activeCartId, [code.trim().toUpperCase()]);
      
      if (result) {
        // Medusa returns the updated cart if promo was accepted.
        // The cart response itself being non-null means the code was valid.
        // Check multiple possible response shapes from Medusa v2:
        const promotions = (result as any).promotions || [];
        const discountTotal = (result as any).discount_total || 0;
        const hasPromo = promotions.length > 0 || discountTotal > 0;
        
        // If we got a cart back, the code was accepted by the backend
        setStatus("success");
        const discountText = discountTotal > 0 ? ` (-${(discountTotal / 100).toFixed(2).replace(".", ",")}€)` : "";
        setMessage(`Promotion-Code "${code.trim().toUpperCase()}" erfolgreich angewendet!${discountText}`);
        setAppliedCodes(prev => [...prev, code.trim().toUpperCase()]);
        setCode("");
        // Trigger cart update without page reload
        onCartUpdate?.();
      } else {
        setStatus("error");
        setMessage("Code ungültig oder nicht anwendbar.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || "Fehler beim Anwenden des Codes.");
    } finally {
      // Reset status nach 4 Sekunden
      setTimeout(() => {
        setStatus("idle");
      }, 4000);
    }
  };

  const handleRemove = async (codeToRemove: string) => {
    if (!cartId) return;
    
    try {
      await removePromoCode(cartId, [codeToRemove]);
      setAppliedCodes(prev => prev.filter(c => c !== codeToRemove));
      setMessage(`Code "${codeToRemove}" wurde entfernt.`);
      onCartUpdate?.();
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage("Fehler beim Entfernen des Codes.");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={handleApply} className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">
          Promotion-Code eingeben
        </label>
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="z.B. TEST15"
            className="flex-1 px-3 py-2 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors min-w-0"
            disabled={status === "loading"}
          />
          <button
            type="submit"
            className={`bg-olive-500 text-white px-4 py-2 rounded-lg hover:bg-olive-600 transition-colors disabled:opacity-60 whitespace-nowrap w-full sm:w-auto ${
              status === "loading" ? "animate-pulse" : ""
            }`}
            disabled={status === "loading" || !code.trim()}
          >
            {status === "loading" ? "wird angewendet..." : "Anwenden"}
          </button>
        </div>
        {message && (
          <p
            className={`text-xs mt-1 ${
              status === "success"
                ? "text-olive-600 font-semibold"
                : status === "error"
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {message}
          </p>
        )}
      </form>

      {/* Applied codes display */}
      {appliedCodes.length > 0 && (
        <div className="mt-2 p-2 bg-olive-50 rounded-lg border border-olive-200">
          <p className="text-xs font-semibold text-olive-700 mb-1">Angewendete Codes:</p>
          <div className="flex flex-wrap gap-1">
            {appliedCodes.map((appliedCode) => (
              <div
                key={appliedCode}
                className="flex items-center gap-1 bg-olive-100 text-olive-700 px-2 py-1 rounded text-sm"
              >
                <span>{appliedCode}</span>
                <button
                  onClick={() => handleRemove(appliedCode)}
                  className="text-olive-600 hover:text-olive-800 font-bold cursor-pointer"
                  type="button"
                  title="Entfernen"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
