import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { Product } from "./productData";
import { IS_BACKEND_ENABLED } from "./api/config";
import {
  getOrCreateCart,
  addToCart,
  updateLineItem,
  removeLineItem,
  clearStoredCartId,
  validateCart,
} from "./api/medusa-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CartItem {
  product: Product;
  quantity: number;
  /** Medusa line-item ID (set when synced with backend) */
  _lineItemId?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  /** Medusa cart ID (null if backend not available) */
  medusaCartId: string | null;
  /** Whether the cart is currently syncing with Medusa */
  syncing: boolean;
  /** Ensure Medusa cart exists and is synced – call before checkout */
  ensureMedusaCart: () => Promise<string | null>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helper: get variant ID from product (stored by useMedusaProducts)
// ---------------------------------------------------------------------------

function getVariantId(product: Product): string | undefined {
  return (product as Product & { _variantId?: string })._variantId;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const CART_ITEMS_KEY = "tgo_cart_items";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_ITEMS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);
  const [medusaCartId, setMedusaCartId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Queue for pending Medusa operations to prevent race conditions
  const opQueue = useRef<Promise<void>>(Promise.resolve());

  // Enqueue a Medusa operation
  const enqueue = useCallback((fn: () => Promise<void>) => {
    opQueue.current = opQueue.current.then(fn).catch(() => {
      // Medusa sync error – silently handled
    });
  }, []);

  // Debounce timers for quantity updates (prevents 3 API calls on rapid +++)
  const qtyTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Ensure we have a Medusa cart (lazy-create on first add)
  const ensureMedusaCart = useCallback(async (): Promise<string | null> => {
    if (!IS_BACKEND_ENABLED) return null;

    setSyncing(true);
    try {
      // 1. If we have an existing cart ID, validate it's still alive
      if (medusaCartId) {
        const existingCart = await validateCart(medusaCartId);
        if (existingCart) {
          setSyncing(false);
          return medusaCartId;
        }
        // Cart is gone (404/completed/expired) – clear and recreate
        clearStoredCartId();
        setMedusaCartId(null);
      }

      // 2. Create a fresh cart
      const newCart = await getOrCreateCart();
      if (!newCart) {
        return null;
      }

      const newCartId = newCart.id;
      setMedusaCartId(newCartId);

      // Re-add all local items to the new cart
      // We need to read items from the current state snapshot
      const currentItems = items;
      if (currentItems.length > 0) {
        for (const item of currentItems) {
          const variantId = getVariantId(item.product);
          if (!variantId) continue;
          try {
            const updatedCart = await addToCart(newCartId, variantId, item.quantity);
            if (updatedCart) {
              // Update line item ID for this product
              const lineItem = updatedCart.items?.find(
                (li: any) => li.variant_id === variantId || li.variant?.id === variantId
              );
              if (lineItem) {
                setItems((prev) =>
                  prev.map((i) =>
                    i.product.id === item.product.id
                      ? { ...i, _lineItemId: lineItem.id }
                      : i
                  )
                );
              }
            }
          } catch {
            // skip failed items
          }
        }
      }

      return newCartId;
    } catch {
      return null;
    } finally {
      setSyncing(false);
    }
  }, [medusaCartId, items]);

  // On mount: restore cart from localStorage if backend is enabled
  useEffect(() => {
    if (!IS_BACKEND_ENABLED) return;

    const stored = localStorage.getItem("tgo_medusa_cart_id");
    if (stored) {
      // Validate cart is still active before using it
      validateCart(stored).then((cart) => {
        if (cart) {
          setMedusaCartId(stored);
        } else {
          // Cart is completed/expired — clear it
          localStorage.removeItem("tgo_medusa_cart_id");
          console.log("[Cart] Stale cart cleared:", stored);
        }
      }).catch(() => {
        setMedusaCartId(stored); // Offline fallback: use stored ID
      });
    }
  }, []);

  // Persist cart items to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(CART_ITEMS_KEY, JSON.stringify(items));
    } catch {
      // storage full or unavailable
    }
  }, [items]);

  // --- ADD ITEM ---
  const addItem = useCallback(
    (product: Product) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.product.id === product.id);
        if (existing) {
          return prev.map((i) =>
            i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
          );
        }
        return [...prev, { product, quantity: 1 }];
      });
      setIsOpen(true);

      // Sync with Medusa
      const variantId = getVariantId(product);
      if (IS_BACKEND_ENABLED && variantId) {
        enqueue(async () => {
          setSyncing(true);
          try {
            let cartId = medusaCartId;
            if (!cartId) {
              const cart = await getOrCreateCart();
              if (cart) {
                cartId = cart.id;
                setMedusaCartId(cart.id);
              }
            }
            if (!cartId) return;

            const updatedCart = await addToCart(cartId, variantId, 1);
            if (updatedCart) {
              // Find the line item for this variant and store its ID
              const lineItem = updatedCart.items?.find(
                (li: any) => li.variant_id === variantId || li.variant?.id === variantId
              );
              if (lineItem) {
                setItems((prev) =>
                  prev.map((i) =>
                    i.product.id === product.id
                      ? { ...i, _lineItemId: lineItem.id }
                      : i
                  )
                );
              }
            }
          } catch {
            // sync error – local state is still correct
          } finally {
            setSyncing(false);
          }
        });
      }
    },
    [medusaCartId, enqueue]
  );

  // --- REMOVE ITEM ---
  const removeItem = useCallback(
    (productId: string) => {
      const item = items.find((i) => i.product.id === productId);
      setItems((prev) => prev.filter((i) => i.product.id !== productId));

      if (IS_BACKEND_ENABLED && medusaCartId && item?._lineItemId) {
        enqueue(async () => {
          try {
            await removeLineItem(medusaCartId!, item._lineItemId!);
          } catch {
            // sync error
          }
        });
      }
    },
    [items, medusaCartId, enqueue]
  );

  // --- UPDATE QUANTITY (debounced Medusa sync) ---
  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      const item = items.find((i) => i.product.id === productId);

      // Clear any pending debounce for this product
      if (qtyTimers.current[productId]) {
        clearTimeout(qtyTimers.current[productId]);
        delete qtyTimers.current[productId];
      }

      if (quantity <= 0) {
        setItems((prev) => prev.filter((i) => i.product.id !== productId));
        if (IS_BACKEND_ENABLED && medusaCartId && item?._lineItemId) {
          enqueue(async () => {
            try {
              await removeLineItem(medusaCartId!, item._lineItemId!);
            } catch {
              // sync error
            }
          });
        }
      } else {
        setItems((prev) =>
          prev.map((i) =>
            i.product.id === productId ? { ...i, quantity } : i
          )
        );
        if (IS_BACKEND_ENABLED && medusaCartId && item?._lineItemId) {
          const lineItemId = item._lineItemId;
          const cartId = medusaCartId;
          qtyTimers.current[productId] = setTimeout(() => {
            delete qtyTimers.current[productId];
            enqueue(async () => {
              try {
                await updateLineItem(cartId, lineItemId, quantity);
              } catch {
                // sync error
              }
            });
          }, 400);
        }
      }
    },
    [items, medusaCartId, enqueue]
  );

  // --- CLEAR CART ---
  const clearCart = useCallback(() => {
    setItems([]);
    setMedusaCartId(null);
    clearStoredCartId();
    try { localStorage.removeItem(CART_ITEMS_KEY); } catch { /* ignore */ }
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isOpen,
        setIsOpen,
        medusaCartId,
        syncing,
        ensureMedusaCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}