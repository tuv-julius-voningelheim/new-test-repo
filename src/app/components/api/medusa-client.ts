// =============================================================================
// MEDUSA.JS STORE API CLIENT
// =============================================================================
// Wraps the Medusa Store API for cart management, products, and checkout.
// All methods gracefully fail when backend is not available.
// =============================================================================

import {
  STORE_API,
  MEDUSA_PUBLISHABLE_KEY,
  IS_BACKEND_ENABLED,
  STORE_HEALTH_ENDPOINT,
  DACH_REGION_ID,
} from "./config";

// ---------------------------------------------------------------------------
// Types matching Medusa v2 Store API responses
// ---------------------------------------------------------------------------

export interface MedusaProduct {
  id: string;
  title: string;
  description: string;
  handle: string;
  thumbnail: string;
  variants: MedusaVariant[];
  metadata?: Record<string, string>;
  collection?: { id: string; title: string; handle: string };
  tags?: { id: string; value: string }[];
  images?: { id: string; url: string }[];
}

export interface MedusaVariant {
  id: string;
  title: string;
  prices: { amount: number; currency_code: string }[];
  calculated_price?: {
    calculated_amount: number;
    currency_code: string;
  };
  inventory_quantity?: number;
  manage_inventory?: boolean;
  metadata?: Record<string, string>;
}

export interface MedusaLineItem {
  id: string;
  variant_id: string;
  quantity: number;
  unit_price: number;
  title: string;
  thumbnail: string;
  variant: MedusaVariant;
}

export interface MedusaCart {
  id: string;
  items: MedusaLineItem[];
  total: number;
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  region_id: string;
  email?: string;
  shipping_address?: MedusaAddress;
  billing_address?: MedusaAddress;
  payment_sessions?: MedusaPaymentSession[];
  payment_collection?: {
    id: string;
    payment_sessions?: MedusaPaymentSession[];
  };
}

export interface MedusaAddress {
  first_name: string;
  last_name: string;
  address_1: string;
  city: string;
  postal_code: string;
  country_code: string;
  phone?: string;
}

export interface MedusaPaymentSession {
  id: string;
  provider_id: string;
  status: string;
}

export interface MedusaOrder {
  id: string;
  display_id: number;
  status: string;
  total: number;
  email: string;
}

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------

async function medusaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T | null> {
  if (!IS_BACKEND_ENABLED) return null;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(MEDUSA_PUBLISHABLE_KEY
        ? { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY }
        : {}),
    };

    const url = `${STORE_API}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    if (!res.ok) {
      let errorBody = "";
      try {
        const errJson = await res.json();
        errorBody = JSON.stringify(errJson);
      } catch {
        try { errorBody = await res.text(); } catch { /* ignore */ }
      }
      console.warn(`[Medusa] ${res.status} ${res.statusText} – ${path}`, errorBody);
      return null;
    }

    return (await res.json()) as T;
  } catch (err) {
    console.warn(`[Medusa] Network error – ${path}`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export async function checkBackendHealth(): Promise<{
  online: boolean;
  latency: number;
}> {
  if (!IS_BACKEND_ENABLED) return { online: false, latency: 0 };

  const start = Date.now();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(STORE_HEALTH_ENDPOINT, {
        method: "GET",
        headers: { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) return { online: true, latency: Date.now() - start };
    } catch {
      // retry
    }
    if (attempt < 1) await new Promise((r) => setTimeout(r, 2000));
  }
  return { online: false, latency: Date.now() - start };
}

// ---------------------------------------------------------------------------
// PRODUCTS
// ---------------------------------------------------------------------------

export async function fetchProducts(): Promise<MedusaProduct[] | null> {
  const data = await medusaFetch<{ products: MedusaProduct[] }>(
    `/products?limit=100&region_id=${DACH_REGION_ID}&fields=+thumbnail,+metadata,*images,*variants,*variants.calculated_price,*variants.prices`
  );
  return data?.products || null;
}

export async function fetchProduct(
  handle: string
): Promise<MedusaProduct | null> {
  const data = await medusaFetch<{ products: MedusaProduct[] }>(
    `/products?handle=${handle}&region_id=${DACH_REGION_ID}&fields=+thumbnail,+metadata,*images,*variants,*variants.calculated_price,*variants.prices`
  );
  return data?.products?.[0] || null;
}

// ---------------------------------------------------------------------------
// CART
// ---------------------------------------------------------------------------

const CART_ID_KEY = "tgo_medusa_cart_id";

function getStoredCartId(): string | null {
  return localStorage.getItem(CART_ID_KEY);
}

function storeCartId(id: string) {
  localStorage.setItem(CART_ID_KEY, id);
}

export function clearStoredCartId() {
  localStorage.removeItem(CART_ID_KEY);
}

/** Create a new cart */
export async function createCart(): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>("/carts", {
    method: "POST",
    body: JSON.stringify({}),
  });
  if (data?.cart) storeCartId(data.cart.id);
  return data?.cart || null;
}

/** Get or create cart */
export async function getOrCreateCart(): Promise<MedusaCart | null> {
  const existingId = getStoredCartId();

  if (existingId) {
    const data = await medusaFetch<{ cart: MedusaCart }>(
      `/carts/${existingId}`
    );
    if (data?.cart) return data.cart;
    clearStoredCartId();
  }

  return createCart();
}

/** Validate that a cart still exists and is not completed. */
export async function validateCart(
  cartId: string
): Promise<MedusaCart | null> {
  if (!IS_BACKEND_ENABLED || !cartId) return null;
  const data = await medusaFetch<{ cart: MedusaCart & { completed_at?: string | null } }>(
    `/carts/${cartId}`
  );
  const cart = data?.cart;
  if (!cart) return null;
  if ((cart as any).completed_at) return null;
  return cart;
}

/** Force-create a brand new cart, ignoring any stored ID. */
export function forceNewCart(): Promise<MedusaCart | null> {
  clearStoredCartId();
  return createCart();
}

/** Add item to cart */
export async function addToCart(
  cartId: string,
  variantId: string,
  quantity: number = 1
): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>(
    `/carts/${cartId}/line-items`,
    {
      method: "POST",
      body: JSON.stringify({ variant_id: variantId, quantity }),
    }
  );
  return data?.cart || null;
}

/** Update line item quantity */
export async function updateLineItem(
  cartId: string,
  lineItemId: string,
  quantity: number
): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>(
    `/carts/${cartId}/line-items/${lineItemId}`,
    {
      method: "POST",
      body: JSON.stringify({ quantity }),
    }
  );
  return data?.cart || null;
}

/** Remove line item */
export async function removeLineItem(
  cartId: string,
  lineItemId: string
): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>(
    `/carts/${cartId}/line-items/${lineItemId}`,
    { method: "DELETE" }
  );
  return data?.cart || null;
}

// ---------------------------------------------------------------------------
// PROMOTIONS
// ---------------------------------------------------------------------------

/** Apply promo codes to a cart */
export async function addPromoCode(
  cartId: string,
  promoCodes: string[]
): Promise<MedusaCart | null> {
  if (!IS_BACKEND_ENABLED) return null;

  const url = `${STORE_API}/apply-promo`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(MEDUSA_PUBLISHABLE_KEY
        ? { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY }
        : {}),
    },
    body: JSON.stringify({ cart_id: cartId, promo_codes: promoCodes }),
  });

  if (!res.ok) {
    let msg = "Code ungültig oder nicht anwendbar.";
    try {
      const err = await res.json();
      if (err.message) msg = err.message;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = await res.json();
  return data?.cart || null;
}

/** Remove promo codes from a cart */
export async function removePromoCode(
  cartId: string,
  promoCodes: string[]
): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>(
    `/carts/${cartId}/promotions`,
    { method: "DELETE", body: JSON.stringify({ promo_codes: promoCodes }) }
  );
  return data?.cart || null;
}

// ---------------------------------------------------------------------------
// CHECKOUT
// ---------------------------------------------------------------------------

/** Update cart with customer info and shipping address */
export async function updateCart(
  cartId: string,
  payload: {
    email?: string;
    shipping_address?: MedusaAddress;
    billing_address?: MedusaAddress;
  }
): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>(`/carts/${cartId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data?.cart || null;
}

/** Add shipping method to cart */
export async function addShippingMethod(
  cartId: string,
  optionId: string
): Promise<MedusaCart | null> {
  const data = await medusaFetch<{ cart: MedusaCart }>(
    `/carts/${cartId}/shipping-methods`,
    {
      method: "POST",
      body: JSON.stringify({ option_id: optionId }),
    }
  );
  return data?.cart || null;
}

/** Complete checkout – creates the order */
export async function completeCart(
  cartId: string,
  opts?: {
    email?: string;
    shipping_address?: MedusaAddress;
    billing_address?: MedusaAddress;
    shipping_option_id?: string;
    payment_method?: string;
  }
): Promise<MedusaOrder | null> {
  if (!IS_BACKEND_ENABLED) return null;

  // Use custom complete-checkout endpoint which handles everything in one call
  const url = `${STORE_API}/complete-checkout`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(MEDUSA_PUBLISHABLE_KEY
      ? { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY }
      : {}),
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ cart_id: cartId, ...opts }),
    });
  } catch (err) {
    console.warn("[Medusa] completeCart network error:", err);
    return null;
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  // Success: 200 OK
  if (res.ok && json) {
    if (json._timings) console.log("[Checkout Timings]", json._timings);
    const order = json.order || json.data;
    if (order?.id) {
      clearStoredCartId();
      return order as MedusaOrder;
    }
  }

  // 409 Conflict: cart was already completed (double-submit or race condition).
  if (res.status === 409) {
    clearStoredCartId();
    const order409 = json?.order || json?.data;
    if (order409?.id) {
      console.log("[Medusa] 409 – extracted order from response:", order409.id);
      return order409 as MedusaOrder;
    }
    console.log("[Medusa] 409 – order already created, proceeding without order data");
    return {
      id: cartId,
      display_id: 0,
      status: "pending",
      total: 0,
      email: "",
      _was409: true,
    } as MedusaOrder & { _was409?: boolean };
  }

  console.warn("[Medusa] completeCart failed:", res.status, json);
  return null;
}

// ---------------------------------------------------------------------------
// REGIONS
// ---------------------------------------------------------------------------

export interface MedusaRegion {
  id: string;
  name: string;
  currency_code: string;
  countries: { iso_2: string; name: string }[];
}

export async function fetchRegions(): Promise<MedusaRegion[] | null> {
  const data = await medusaFetch<{ regions: MedusaRegion[] }>("/regions");
  return data?.regions || null;
}

/** Get shipping options for a cart */
export async function fetchShippingOptions(
  cartId: string
): Promise<{ id: string; name: string; amount: number; data?: Record<string, unknown> }[] | null> {
  const data = await medusaFetch<{
    shipping_options: { id: string; name: string; amount: number; data?: Record<string, unknown> }[];
  }>(`/shipping-options?cart_id=${cartId}`);
  return data?.shipping_options || null;
}

/** Get available payment providers for a region */
export async function fetchPaymentProviders(
  regionId: string = DACH_REGION_ID
): Promise<{ id: string; is_enabled: boolean }[] | null> {
  const data = await medusaFetch<{
    payment_providers: { id: string; is_enabled: boolean }[];
  }>(`/payment-providers?region_id=${regionId}`);
  return data?.payment_providers || null;
}
// ---------------------------------------------------------------------------

/**
 * Create a payment collection for a cart.
 * In Medusa v2.13+, payment collections are NOT auto-created.
 */
export async function createPaymentCollection(
  cartId: string
): Promise<{ id: string } | null> {
  const data = await medusaFetch<{
    payment_collection: { id: string; payment_sessions?: unknown[] };
  }>(`/payment-collections`, {
    method: "POST",
    body: JSON.stringify({ cart_id: cartId }),
  });
  return data?.payment_collection?.id ? data.payment_collection : null;
}

/**
 * Initialize a payment session on the cart's payment collection.
 * Note: Medusa v2.13+ does NOT accept a "context" field here.
 */
export async function initPaymentSession(
  paymentCollectionId: string,
  providerId: string = "pp_system_default"
): Promise<{ id: string; provider_id: string; status: string; data?: Record<string, any> } | null> {
  const data = await medusaFetch<{
    payment_collection: {
      payment_sessions: { id: string; provider_id: string; status: string; data?: Record<string, any> }[];
    };
  }>(`/payment-collections/${paymentCollectionId}/payment-sessions`, {
    method: "POST",
    body: JSON.stringify({ provider_id: providerId }),
  });
  const sessions = data?.payment_collection?.payment_sessions;
  return sessions?.find((s) => s.provider_id === providerId) || sessions?.[0] || null;
}

/**
 * Authorize a payment session (required after PayPal approval).
 */
export async function authorizePaymentSession(
  paymentCollectionId: string,
  sessionId: string
): Promise<{ id: string; status: string } | null> {
  const data = await medusaFetch<{
    payment_collection: {
      payment_sessions: { id: string; status: string }[];
    };
  }>(`/payment-collections/${paymentCollectionId}/payment-sessions/${sessionId}/authorize`, {
    method: "POST",
  });
  const sessions = data?.payment_collection?.payment_sessions;
  return sessions?.find((s) => s.id === sessionId) || sessions?.[0] || null;
}

// ---------------------------------------------------------------------------
// ORDER CONFIRMATION EMAIL
// ---------------------------------------------------------------------------

/**
 * Send order confirmation email via custom backend route.
 * Supports two modes:
 *  - order_id: direct lookup (normal flow)
 *  - email: looks up most recent order for that email (409 fallback)
 *
 * Requires x-publishable-api-key header since route is under /store/*.
 */
export async function sendOrderConfirmation(params: {
  order_id?: string;
  email?: string;
  payment_method?: string;
  is_pickup?: boolean;
  billing_address?: { first_name: string; last_name: string; address_1: string; postal_code: string; city: string; country_code: string };
  _was409?: boolean;
}): Promise<boolean> {
  if (!IS_BACKEND_ENABLED) return false;

  // Skip if we only have a cart ID (not a real order ID)
  if (params.order_id && params.order_id.startsWith("cart_")) {
    console.log("[Medusa] Skipping confirmation email for cart ID (using email fallback)");
    if (!params.email) return false;
    params = { email: params.email, _was409: true };
  }

  // If this is a 409 recovery, wait a few seconds for the order to fully commit
  if (params._was409) {
    console.log("[Medusa] 409 recovery – waiting 4s for order to commit before sending email...");
    await new Promise((r) => setTimeout(r, 4000));
  }

  // Don't send _was409 to the backend
  const body: Record<string, any> = {};
  if (params.order_id) body.order_id = params.order_id;
  if (params.email) body.email = params.email;
  if (params.payment_method) body.payment_method = params.payment_method;
  if (params.is_pickup !== undefined) body.is_pickup = params.is_pickup;
  if (params.billing_address) body.billing_address = params.billing_address;

  try {
    const res = await fetch(`${STORE_API}/send-confirmation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(MEDUSA_PUBLISHABLE_KEY
          ? { "x-publishable-api-key": MEDUSA_PUBLISHABLE_KEY }
          : {}),
      },
      body: JSON.stringify(body),
    });

    if (res.status === 409) {
      console.log("[Medusa] send-confirmation 409 – skipping (already sent or cart conflict)");
      return true; // treat as success
    }

    const result = await res.json().catch(() => null);
    if (res.ok) {
      console.log("[Medusa] Confirmation email sent:", result);
      return true;
    }

    console.warn("[Medusa] send-confirmation failed:", res.status, result);
    return false;
  } catch (err) {
    console.warn("[Medusa] send-confirmation network error:", err);
    return false;
  }
}