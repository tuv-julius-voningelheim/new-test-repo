import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  updateCart,
  addShippingMethod,
  fetchShippingOptions,
  createPaymentCollection,
  initPaymentSession,
  authorizePaymentSession,
  completeCart,
  forceNewCart,
  addToCart,
  clearStoredCartId,
  sendOrderConfirmation,
  fetchPaymentProviders,
  addPromoCode,
  removePromoCode,
  type MedusaAddress,
} from "../api/medusa-client";
import { IS_BACKEND_ENABLED } from "../api/config";
import { PromotionCodeInput } from "./PromotionCodeInput";
import { Link, useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  AlertCircle,
  Loader2,
  Store,
  ChevronUp,
  ChevronDown,
  Lock,
  Truck,
  ShieldCheck,
  Heart,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { useCart } from "../CartContext";
import { SEOHead } from "../SEOHead";
import { ImageWithFallback } from "../figma/ImageWithFallback";

// Payment methods configuration
const availablePaymentMethods = [
  {
    id: "vorkasse",
    label: "Vorkasse (Überweisung)",
    desc: "Zahlung vor Versand per Banküberweisung",
    icon: DollarSign,
  },
  {
    id: "paypal",
    label: "PayPal",
    desc: "Schnelle und sichere Zahlung",
    icon: CreditCard,
  },
  {
    id: "bar",
    label: "Barzahlung bei Abholung",
    desc: "Zahlung bei Abholung vor Ort in bar",
    icon: Store,
  },
];

import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

// Type definition kept for reference
interface PayPalButtonsProps {
  style?: { layout?: string; shape?: string; label?: string };
  createOrder: () => Promise<string>;
  onApprove: (data: any) => Promise<void>;
  onCancel: () => void;
  onError: (err: any) => void;
}

interface PayPalScriptProviderProps {
  options: { clientId: string; currency: string };
  children: React.ReactNode;
}

function CheckoutPage() {
  const navigate = useNavigate();

  // Cart Context
  const {
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
  } = useCart();

  // Lokale States
  const [step, setStep] = useState("form");
  const [processingSubStep, setProcessingSubStep] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    street: "",
    zip: "",
    city: "",
    country: "AT",
    notes: "",
  });
  const [errors, setErrors] = useState<any>({});
  const [payment, setPayment] = useState("paypal");
  const [deliveryMethod, setDeliveryMethod] = useState<"shipping" | "pickup">("shipping");
  // isPickup is derived: "bar" always pickup, otherwise user choice
  const isPickup = payment === "bar" || deliveryMethod === "pickup";
  const [showSummary, setShowSummary] = useState(false);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [backendShippingCost, setBackendShippingCost] = useState<number | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [cartPreparedFlag, setCartPreparedFlag] = useState(false);
  const [paypalCollectionId, setPaypalCollectionId] = useState<string | null>(null);
  const [paypalSessionId, setPaypalSessionId] = useState<string | null>(null);
  const [paypalCartId, setPaypalCartId] = useState<string | null>(null);
  const [appliedPromoCodes, setAppliedPromoCodes] = useState<string[]>([]);
  const [discountTotal, setDiscountTotal] = useState(0);

  // Refs & Konstanten
  const shippingOptionsCacheRef = useRef<Record<string, any[]>>({});
  const FREE_SHIPPING_MIN = 50;
  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";
  const PROCESSING_STEPS = [
    { key: "processing", label: "Bestellung wird verarbeitet…" },
  ];

  // Fun rotating messages for the loading animation
  const LOADING_MESSAGES = [
    "Bestellung wird angelegt…",
    "Oliven werden gepresst… 🫒",
    "Öl wird abgefüllt…",
    "Etikett wird aufgeklebt…",
    "Paket wird geschnürt… 📦",
    "Qualitätskontrolle läuft…",
    "Lieferadresse wird geprüft…",
    "Fast geschafft…",
  ];
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);

  useEffect(() => {
    if (step !== "processing") return;
    setLoadingMsgIdx(0);
    const interval = setInterval(() => {
      setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [step]);

  // --- Hilfsfunktionen & Handler ---

  // updateField für Formularfelder
  const updateField = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev: any) => ({ ...prev, [field]: undefined }));
  };

  // validate für Formularvalidierung
  const validate = () => {
    const newErrors: any = {};
    if (!form.firstName) newErrors.firstName = "Pflichtfeld";
    if (!form.lastName) newErrors.lastName = "Pflichtfeld";
    if (!form.email) newErrors.email = "Pflichtfeld";
    if (!isPickup) {
      if (!form.street) newErrors.street = "Pflichtfeld";
      if (!form.zip) newErrors.zip = "Pflichtfeld";
      if (!form.city) newErrors.city = "Pflichtfeld";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Berechne Gesamtsumme mit intelligenter Versandlogik
  const calculateShipping = (): number => {
    if (isPickup) return 0;
    // Kostenloser Versand bei >= 50€
    if (totalPrice >= FREE_SHIPPING_MIN) return 0;
    return shippingCost;
  };

  const finalShippingCost = calculateShipping();
  const grandTotal = totalPrice + finalShippingCost - discountTotal;

  // Load shipping options and auto-select based on cart total & pickup
  useEffect(() => {
    if (!IS_BACKEND_ENABLED || !medusaCartId) return;

    const loadShippingOptions = async () => {
      try {
        const options = await fetchShippingOptions(medusaCartId);
        if (options && options.length > 0) {
          shippingOptionsCacheRef.current[medusaCartId] = options;
          
          // Auto-select shipping: Backend sends amount already in EUR (e.g. 5.9 = 5,90€)
          // Find free shipping and standard shipping options
          const pickupOption = options.find((o: any) => o.name?.toLowerCase().includes("abhol") || o.name?.toLowerCase().includes("pickup"));
          const freeOption = options.find((o: any) => (o.amount === 0 || o.name?.toLowerCase().includes("kostenlos") || o.name?.toLowerCase().includes("free")) && o.id !== pickupOption?.id);
          const standardOption = options.find((o: any) => o.amount > 0 && !o.name?.toLowerCase().includes("abhol"));

          if (isPickup && pickupOption) {
            // Abholung → kostenlose Abholung
            setSelectedShippingId(pickupOption.id);
            setShippingCost(0);
          } else if (!isPickup && totalPrice >= FREE_SHIPPING_MIN && freeOption) {
            // >50€ → kostenloser Versand
            setSelectedShippingId(freeOption.id);
            setShippingCost(0);
          } else if (!isPickup && standardOption) {
            // <50€ → Standardversand (Backend liefert amount in EUR)
            setSelectedShippingId(standardOption.id);
            setShippingCost(standardOption.amount);
          } else if (options[0]) {
            // Fallback: erste Option
            setSelectedShippingId(options[0].id);
            setShippingCost(options[0].amount);
          }
        }
      } catch (err) {
        console.warn("[Checkout] Failed to load shipping options:", err);
      }
    };

    loadShippingOptions();
  }, [medusaCartId, isPickup, totalPrice]);

  // Serialized cart operation lock to prevent concurrent mutations
  const cartOpRef = useRef<Promise<void>>(Promise.resolve());

  // Prefetch: create payment collection as soon as checkout loads
  const prefetchedPayColRef = useRef<boolean>(false);
  const payColIdRef = useRef<string | null>(null);
  const [payColReady, setPayColReady] = useState(false);
  useEffect(() => {
    if (!IS_BACKEND_ENABLED || !medusaCartId || prefetchedPayColRef.current) return;
    prefetchedPayColRef.current = true;
    // Queue behind any existing operation
    cartOpRef.current = cartOpRef.current.then(() =>
      createPaymentCollection(medusaCartId).then((pc) => {
        if (pc) { payColIdRef.current = pc.id; setPayColReady(true); console.log("[Prefetch] Payment collection ready:", pc.id); }
      }).catch(() => {})
    );
  }, [medusaCartId]);

  // PayPal SDK is preloaded via PayPalScriptProvider when payment === "paypal"

  // Prefetch: update cart + add shipping in background when form is filled
  const cartPreparedRef = useRef<string>("");
  const prefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchingRef = useRef<Promise<void> | null>(null);
  useEffect(() => {
    if (!IS_BACKEND_ENABLED || !medusaCartId || step !== "form") return;
    // Only when required fields are filled
    const hasRequired = form.email && form.firstName && form.lastName &&
      (isPickup || (form.street && form.zip && form.city));
    if (!hasRequired) return;

    const key = `${form.email}|${form.firstName}|${form.lastName}|${form.street}|${form.zip}|${form.city}|${form.country}|${isPickup}|${selectedShippingId}`;
    if (cartPreparedRef.current === key) return;

    const timer = setTimeout(() => {
      // Queue behind payment collection creation
      const p = cartOpRef.current.then(async () => {
      try {
        const address = {
          first_name: form.firstName,
          last_name: form.lastName,
          address_1: form.street,
          city: form.city,
          postal_code: form.zip,
          country_code: form.country.toLowerCase(),
          phone: form.phone || undefined,
        };
        const pickupAddress = {
          first_name: form.firstName,
          last_name: form.lastName,
          address_1: "Abholung vor Ort",
          city: "Horia",
          postal_code: "1000",
          country_code: "at",
          phone: form.phone || undefined,
        };
        const updatedCart = await updateCart(medusaCartId, {
          email: form.email,
          shipping_address: isPickup ? pickupAddress : address,
          billing_address: isPickup ? pickupAddress : address,
        });
        if (!updatedCart) {
          console.log("[Prefetch] updateCart returned null (cart may be completed)");
          return;
        }
        // Only add shipping if cart doesn't already have the right option
        const currentShippingOptionId = updatedCart?.shipping_methods?.[0]?.shipping_option_id;
        if (selectedShippingId && (!currentShippingOptionId || currentShippingOptionId !== selectedShippingId)) {
          try {
            await addShippingMethod(medusaCartId, selectedShippingId);
          } catch (e) {
            console.log("[Prefetch] addShippingMethod failed (may already exist)");
          }
        }
        cartPreparedRef.current = key;
        setCartPreparedFlag(true);
        console.log("[Prefetch] Cart updated + shipping added in background");
      } catch (e) {
        // Silent fail - will retry on submit
      } finally {
        prefetchingRef.current = null;
      }
      });
      cartOpRef.current = p;
      prefetchingRef.current = p;
    }, 1500);
    prefetchTimerRef.current = timer;
    return () => { clearTimeout(timer); prefetchTimerRef.current = null; };
  }, [form.email, form.firstName, form.lastName, form.street, form.zip, form.city, form.country, isPickup, selectedShippingId, medusaCartId, step]);

  // Prefetch: create PayPal session as soon as cart is prepared + PayPal selected
  const paypalPrefetchedRef = useRef<boolean>(false);
  useEffect(() => {
    if (!IS_BACKEND_ENABLED || !medusaCartId || payment !== "paypal" || paypalPrefetchedRef.current) return;
    if (!payColIdRef.current || !cartPreparedFlag || paypalOrderId) return;
    paypalPrefetchedRef.current = true;
    cartOpRef.current = cartOpRef.current.then(async () => {
      try {
        const ps = await initPaymentSession(payColIdRef.current!, "pp_paypal_paypal");
        if (ps) {
          const ppOid = (ps.data as any)?.id;
          if (ppOid) {
            setPaypalOrderId(ppOid);
            setPaypalCollectionId(payColIdRef.current!);
            setPaypalSessionId(ps.id);
            setPaypalCartId(medusaCartId);
            console.log("[Prefetch] PayPal session ready:", ppOid);
          }
        }
      } catch (e) {
        console.log("[Prefetch] PayPal session prefetch failed");
        paypalPrefetchedRef.current = false;
      }
    });
  }, [payment, medusaCartId, paypalOrderId, cartPreparedFlag, payColReady]);

  // Versandoptionen-Handler
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setSelectedShippingId(id);
    const options = shippingOptionsCacheRef.current[medusaCartId || ""] || [];
    const selected = options.find((opt: any) => opt.id === id);
    if (selected) {
      const baseAmount = selected.amount;
      // Nur berechnen wenn nicht kostenlos durch Mindestbestellwert
      if (totalPrice >= FREE_SHIPPING_MIN) {
        setShippingCost(0);
      } else {
        setShippingCost(baseAmount);
      }
    }
  };

  // handleMedusaCheckout – if prefetched, only complete; otherwise send all data
  const handleMedusaCheckout = async (cartId: string) => {
    try {
      const ft0 = Date.now();
      const ftick = (l: string) => console.log(`[FE] ${l}: ${Date.now() - ft0}ms`);
      setStep("processing");
      setProcessingSubStep("processing");

      // Cancel pending prefetch timer and wait for in-flight prefetch (max 3s)
      if (prefetchTimerRef.current) { clearTimeout(prefetchTimerRef.current); prefetchTimerRef.current = null; }
      if (prefetchingRef.current) {
        await Promise.race([prefetchingRef.current, new Promise(r => setTimeout(r, 3000))]);
        prefetchingRef.current = null;
      }
      ftick("prefetchWait");

      const isPrepared = !!cartPreparedRef.current;
      ftick(`isPrepared=${isPrepared}`);

      const address: MedusaAddress = {
        first_name: form.firstName,
        last_name: form.lastName,
        address_1: form.street,
        city: form.city,
        postal_code: form.zip,
        country_code: form.country.toLowerCase(),
        phone: form.phone || undefined,
      };

      // If prefetched, only send cart_id + payment_method (cart already updated)
      const order = await completeCart(cartId, isPrepared ? {
        payment_method: payment,
      } : {
        email: form.email,
        shipping_address: isPickup ? { first_name: form.firstName, last_name: form.lastName, address_1: "Abholung vor Ort", city: "Horia", postal_code: "1000", country_code: "at", phone: form.phone || undefined } : address,
        billing_address: isPickup ? { first_name: form.firstName, last_name: form.lastName, address_1: "Abholung vor Ort", city: "Horia", postal_code: "1000", country_code: "at", phone: form.phone || undefined } : address,
        shipping_option_id: selectedShippingId || undefined,
        payment_method: payment,
      });
      ftick("completeCartDone");

      if (order) {
        // Send confirmation email fire-and-forget (don't block navigation)
        sendOrderConfirmation({
          order_id: (order as any)._was409 ? undefined : order.id,
          email: form.email,
          payment_method: payment,
          is_pickup: isPickup,
          billing_address: { first_name: form.firstName, last_name: form.lastName, address_1: form.street, postal_code: form.zip, city: form.city, country_code: form.country.toLowerCase() },
          _was409: (order as any)._was409,
        }).catch((e) => console.warn("[Email] Failed:", e));

        clearCart();
        navigate("/bestellung-bestaetigt", {
          state: {
            orderNumber: (order as any)._was409
              ? `TGO-${Date.now().toString(36).toUpperCase()}`
              : `TGO-${order.display_id || order.id.slice(-8).toUpperCase()}`,
            orderId: (order as any)._was409 ? undefined : order.id,
            displayId: (order as any)._was409 ? undefined : order.display_id,
            payment,
            total: grandTotal,
            email: form.email,
            isPickup,
            firstName: form.firstName,
            fromMedusa: true,
          },
        });
      } else {
        throw new Error("Bestellung konnte nicht erstellt werden.");
      }
    } catch (err: any) {
      setStep("error");
      setCheckoutError(err?.message || "Checkout-Fehler.");
    }
  };

  // Fallback: Local-only checkout (when backend unavailable)
  const handleLocalCheckout = () => {
    setStep("processing");
    setTimeout(() => {
      clearCart();
      navigate("/bestellung-bestaetigt", {
        state: {
          orderNumber: `TGO-${Date.now().toString(36).toUpperCase()}`,
          payment,
          total: grandTotal,
          email: form.email,
          isPickup,
          firstName: form.firstName,
          fromMedusa: false,
        },
      });
    }, 600);
  };

  // --- PayPal: prepare cart and redirect to PayPal ---
  const handlePayPalCheckout = async (cartId: string) => {
    try {
      setStep("processing");
      setProcessingSubStep("processing");

      // Cancel pending prefetch timer and wait for in-flight prefetch (max 3s)
      if (prefetchTimerRef.current) { clearTimeout(prefetchTimerRef.current); prefetchTimerRef.current = null; }
      if (prefetchingRef.current) {
        await Promise.race([prefetchingRef.current, new Promise(r => setTimeout(r, 3000))]);
        prefetchingRef.current = null;
      }

      // If cart wasn't prefetch-updated, do it now
      if (!cartPreparedRef.current) {
        const address: MedusaAddress = {
          first_name: form.firstName,
          last_name: form.lastName,
          address_1: form.street,
          city: form.city,
          postal_code: form.zip,
          country_code: form.country.toLowerCase(),
          phone: form.phone || undefined,
        };
        const pickupAddr = { first_name: form.firstName, last_name: form.lastName, address_1: "Abholung vor Ort", city: "Horia", postal_code: "1000", country_code: "at", phone: form.phone || undefined };
        const updatedCart = await updateCart(cartId, {
          email: form.email,
          shipping_address: isPickup ? pickupAddr : address,
          billing_address: isPickup ? pickupAddr : address,
        });
        if (!updatedCart) throw new Error("Warenkorb konnte nicht aktualisiert werden.");

        if (selectedShippingId && !(updatedCart.shipping_methods?.length)) {
          const shippedCart = await addShippingMethod(cartId, selectedShippingId);
          if (!shippedCart) throw new Error("Versandoption konnte nicht hinzugefügt werden.");
        }
      }

      // If PayPal session was already prefetched, skip directly to approval
      if (paypalOrderId && paypalCollectionId && paypalSessionId && paypalCartId) {
        console.log("[PayPal] Reusing prefetched session:", paypalOrderId);
        setStep("paypal-approve");
        return;
      }

      // Reuse prefetched payment collection, only create if missing
      let pcId = payColIdRef.current;
      if (!pcId) {
        const paymentCollection = await createPaymentCollection(cartId);
        if (!paymentCollection) throw new Error("Zahlungssammlung konnte nicht erstellt werden.");
        pcId = paymentCollection.id;
      }

      // 4. Init PayPal payment session
      const paymentSession = await initPaymentSession(pcId, "pp_paypal_paypal");
      if (!paymentSession) throw new Error("PayPal-Sitzung konnte nicht erstellt werden.");

      // 5. Use PayPal Order ID for inline approval via PayPal JS SDK buttons
      const ppOrderId = (paymentSession.data as any)?.id;

      if (ppOrderId) {
        setPaypalOrderId(ppOrderId);
        setPaypalCollectionId(pcId);
        setPaypalSessionId(paymentSession.id);
        setPaypalCartId(cartId);
        setStep("paypal-approve");
      } else {
        throw new Error("PayPal-Sitzung enthält keine Order-ID.");
      }
    } catch (err: any) {
      setStep("error");
      setCheckoutError(err?.message || "PayPal-Checkout fehlgeschlagen.");
    }
  };

  // --- PayPal: after user approves in PayPal popup ---
  const handlePayPalApprove = async () => {
    if (!paypalCollectionId || !paypalSessionId || !paypalCartId) return;

    try {
      setStep("processing");
      setProcessingSubStep("processing");
      setCheckoutError(null);

      // Complete the cart → backend handles authorization + order creation internally
      const order = await completeCart(paypalCartId, { payment_method: "paypal" });

      if (order) {
        const was409 = (order as any)._was409 === true;
        sendOrderConfirmation({
          order_id: was409 ? undefined : order.id,
          email: form.email,
          payment_method: "paypal",
          is_pickup: isPickup,
          billing_address: { first_name: form.firstName, last_name: form.lastName, address_1: form.street, postal_code: form.zip, city: form.city, country_code: form.country.toLowerCase() },
          _was409: was409,
        }).catch((e) => console.warn("[Email] Failed:", e));
        clearCart();
        navigate("/bestellung-bestaetigt", {
          state: {
            orderNumber: was409
              ? `TGO-${Date.now().toString(36).toUpperCase()}`
              : `TGO-${order.display_id || order.id.slice(-8).toUpperCase()}`,
            orderId: was409 ? undefined : order.id,
            displayId: was409 ? undefined : order.display_id,
            payment: "paypal",
            total: was409 ? grandTotal : (order.total || grandTotal),
            email: form.email,
            isPickup,
            firstName: form.firstName,
            fromMedusa: true,
          },
        });
      } else {
        // Still try to send confirmation (admin needs notification)
        sendOrderConfirmation({
          email: form.email,
          payment_method: "paypal",
          is_pickup: isPickup,
          billing_address: { first_name: form.firstName, last_name: form.lastName, address_1: form.street, postal_code: form.zip, city: form.city, country_code: form.country.toLowerCase() },
          _was409: true,
        }).catch((e) => console.warn("[Email] Failed:", e));
        clearCart();
        navigate("/bestellung-bestaetigt", {
          state: {
            orderNumber: `TGO-${Date.now().toString(36).toUpperCase()}`,
            payment: "paypal",
            total: grandTotal,
            email: form.email,
            isPickup,
            firstName: form.firstName,
            fromMedusa: true,
            warning: "Bestellung wurde möglicherweise erstellt – bitte E-Mail prüfen.",
          },
        });
      }
    } catch (err: any) {
      setStep("error");
      setCheckoutError(err?.message || "PayPal-Zahlung fehlgeschlagen.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (IS_BACKEND_ENABLED) {
        const cartId = medusaCartId || (await ensureMedusaCart());
        if (cartId) {
          if (payment === "paypal") {
            await handlePayPalCheckout(cartId);
          } else {
            await handleMedusaCheckout(cartId);
          }
        } else {
          handleLocalCheckout();
        }
      } else {
        handleLocalCheckout();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0 && step !== "processing" && step !== "paypal-approve") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-cream">
        <SEOHead title="Kasse" canonical="/checkout" />
        <div className="text-center px-4">
          <h1
            className="text-2xl mb-3"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Dein Warenkorb ist leer
          </h1>
          <p className="text-muted-foreground mb-6">
            Füge Produkte hinzu, bevor du zur Kasse gehst.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center gap-2 bg-olive-500 text-white px-6 py-3 rounded-lg hover:bg-olive-600 transition-colors"
          >
            Zum Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream min-h-screen">
      <SEOHead title="Kasse" canonical="/checkout" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back */}
        <Link
          to="/shop"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-olive-500 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Weiter einkaufen
        </Link>

        <h1
          className="text-3xl sm:text-4xl mb-8"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Kasse
        </h1>

        {/* Error banner */}
        {checkoutError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-800">{checkoutError}</p>
              <button
                onClick={() => {
                  setStep("form");
                  setCheckoutError(null);
                }}
                className="text-sm text-red-600 underline hover:text-red-800 mt-1"
              >
                Nochmal versuchen
              </button>
            </div>
          </motion.div>
        )}

        {/* Syncing indicator */}
        {syncing && (
          <div className="bg-olive-50 border border-olive-200 rounded-lg px-4 py-2 mb-4 flex items-center gap-2 text-sm text-olive-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            Warenkorb wird synchronisiert...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-2 space-y-8">
              {/* Contact */}
              <section className="bg-white rounded-xl p-6 shadow-sm">
                <h2
                  className="text-lg mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Kontaktdaten
                </h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1.5 text-muted-foreground">
                      Vorname *
                    </label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={(e) => updateField("firstName", e.target.value)}
                      disabled={step === "processing"}
                      className={`w-full px-4 py-3 rounded-lg border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50 ${
                        errors.firstName ? "border-destructive" : "border-border"
                      }`}
                      placeholder="Maria"
                    />
                    {errors.firstName && (
                      <p className="text-xs text-destructive mt-1">{errors.firstName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5 text-muted-foreground">
                      Nachname *
                    </label>
                    <input
                      type="text"
                      value={form.lastName}
                      onChange={(e) => updateField("lastName", e.target.value)}
                      disabled={step === "processing"}
                      className={`w-full px-4 py-3 rounded-lg border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50 ${
                        errors.lastName ? "border-destructive" : "border-border"
                      }`}
                      placeholder="Muster"
                    />
                    {errors.lastName && (
                      <p className="text-xs text-destructive mt-1">{errors.lastName}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5 text-muted-foreground">
                      E-Mail-Adresse *
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => updateField("email", e.target.value)}
                      disabled={step === "processing"}
                      className={`w-full px-4 py-3 rounded-lg border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50 ${
                        errors.email ? "border-destructive" : "border-border"
                      }`}
                      placeholder="maria@beispiel.at"
                    />
                    {errors.email && (
                      <p className="text-xs text-destructive mt-1">{errors.email}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm mb-1.5 text-muted-foreground">
                      Telefon (optional)
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      disabled={step === "processing"}
                      className="w-full px-4 py-3 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50"
                      placeholder="+43 664 ..."
                    />
                  </div>
                </div>
              </section>

              {/* Shipping Address */}
              <section className="bg-white rounded-xl p-6 shadow-sm">
                <h2
                  className="text-lg mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {isPickup ? "Abholadresse" : "Lieferadresse"}
                </h2>

                {isPickup ? (
                  <div className="bg-olive-50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Store className="w-5 h-5 text-olive-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm">
                          <strong>Die Werkstatt – Direktverkauf Innsbruck</strong>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Baeckerbuehelgasse 14, 6020 Innsbruck
                          <br />
                          Bitte rufen Sie uns vorher unter{" "}
                          <a
                            href="tel:+4366455555577"
                            className="text-olive-500 hover:underline"
                          >
                            +43 664 55555 77
                          </a>{" "}
                          an, um einen Abholtermin zu vereinbaren.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm mb-1.5 text-muted-foreground">
                        Straße & Hausnummer *
                      </label>
                      <input
                        type="text"
                        value={form.street}
                        onChange={(e) => updateField("street", e.target.value)}
                        disabled={step === "processing"}
                        className={`w-full px-4 py-3 rounded-lg border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50 ${
                          errors.street ? "border-destructive" : "border-border"
                        }`}
                        placeholder="Musterstraße 1"
                      />
                      {errors.street && (
                        <p className="text-xs text-destructive mt-1">{errors.street}</p>
                      )}
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm mb-1.5 text-muted-foreground">
                          PLZ *
                        </label>
                        <input
                          type="text"
                          value={form.zip}
                          onChange={(e) => updateField("zip", e.target.value)}
                          disabled={step === "processing"}
                          className={`w-full px-4 py-3 rounded-lg border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50 ${
                            errors.zip ? "border-destructive" : "border-border"
                          }`}
                          placeholder="6020"
                        />
                        {errors.zip && (
                          <p className="text-xs text-destructive mt-1">{errors.zip}</p>
                        )}
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm mb-1.5 text-muted-foreground">
                          Ort *
                        </label>
                        <input
                          type="text"
                          value={form.city}
                          onChange={(e) => updateField("city", e.target.value)}
                          disabled={step === "processing"}
                          className={`w-full px-4 py-3 rounded-lg border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50 ${
                            errors.city ? "border-destructive" : "border-border"
                          }`}
                          placeholder="Innsbruck"
                        />
                        {errors.city && (
                          <p className="text-xs text-destructive mt-1">{errors.city}</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm mb-1.5 text-muted-foreground">
                        Land
                      </label>
                      <select
                        value={form.country}
                        onChange={(e) => updateField("country", e.target.value)}
                        disabled={step === "processing"}
                        className="w-full px-4 py-3 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors disabled:opacity-50"
                      >
                        <option value="AT">Österreich</option>
                        <option value="DE">Deutschland</option>
                        <option value="CH">Schweiz</option>
                        <option value="IT">Italien</option>
                      </select>
                    </div>
                  </div>
                )}
              </section>

              {/* Delivery Method */}
              {payment !== "bar" && (
                <section className="bg-white rounded-xl p-6 shadow-sm">
                  <h2 className="text-lg mb-4" style={{ fontFamily: "var(--font-heading)" }}>
                    Versandart
                  </h2>
                  <div className="space-y-3">
                    {(() => {
                      const opts = shippingOptionsCacheRef.current[medusaCartId || ""] || [];
                      const stdOpt = opts.find((o: any) => o.amount > 0 && !o.name?.toLowerCase().includes("abhol"));
                      const stdPrice = stdOpt ? stdOpt.amount : 5.9;
                      return [
                        { id: "shipping" as const, label: "Versand", desc: totalPrice >= FREE_SHIPPING_MIN ? "Kostenloser Versand (ab 50 €)" : `Standardversand (${stdPrice.toFixed(2).replace(".", ",")} €)`, icon: Truck },
                        { id: "pickup" as const, label: "Abholung vor Ort", desc: "Kostenlose Abholung", icon: Store },
                      ];
                    })().map((dm) => {
                      const Icon = dm.icon;
                      const isActive = deliveryMethod === dm.id;
                      return (
                        <label
                          key={dm.id}
                          className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isActive ? "border-olive-500 bg-olive-50" : "border-border hover:border-olive-300"
                          } ${step === "processing" ? "opacity-50 pointer-events-none" : ""}`}
                        >
                          <input type="radio" name="delivery" value={dm.id} checked={isActive}
                            onChange={() => setDeliveryMethod(dm.id)}
                            disabled={step === "processing"} className="sr-only" />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${isActive ? "border-olive-500" : "border-border"}`}>
                            {isActive && <div className="w-2.5 h-2.5 rounded-full bg-olive-500" />}
                          </div>
                          <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-olive-500" : "text-muted-foreground"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{dm.label}</p>
                            <p className="text-xs text-muted-foreground">{dm.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Payment */}
              <section className="bg-white rounded-xl p-6 shadow-sm">
                <h2
                  className="text-lg mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Zahlungsart
                </h2>
                <div className="space-y-3">
                  {availablePaymentMethods.map((pm) => {
                    const Icon = pm.icon;
                    const isActive = payment === pm.id;
                    return (
                      <label
                        key={pm.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isActive
                            ? "border-olive-500 bg-olive-50"
                            : "border-border hover:border-olive-300"
                        } ${step === "processing" ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={pm.id}
                          checked={isActive}
                          onChange={() => {
                            setPayment(pm.id);
                            if (pm.id === "bar") setDeliveryMethod("pickup");
                          }}
                          disabled={step === "processing"}
                          className="sr-only"
                        />
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isActive ? "border-olive-500" : "border-border"
                          }`}
                        >
                          {isActive && (
                            <div className="w-2.5 h-2.5 rounded-full bg-olive-500" />
                          )}
                        </div>
                        <Icon
                          className={`w-5 h-5 shrink-0 ${
                            isActive ? "text-olive-500" : "text-muted-foreground"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">{pm.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {pm.desc}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {payment === "vorkasse" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 p-4 bg-gold-50 rounded-lg border border-gold-200"
                  >
                    <p className="text-sm">
                      <strong>Bankverbindung:</strong>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Girardi M.u.Mitges.
                      <br />
                      IBAN: AT57 3600 0000 0421 8830
                      <br />
                      BIC: RZTIAT22
                      <br />
                      Verwendungszweck: Ihre Bestellnummer
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Die Ware wird nach Zahlungseingang versandt (2–3 Werktage).
                    </p>
                  </motion.div>
                )}

                {payment === "paypal" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200"
                  >
                    {PAYPAL_CLIENT_ID ? (
                      <p className="text-sm text-blue-800">
                        Nach Prüfung deiner Daten erscheint der PayPal-Button zur Zahlung.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-800">
                        PayPal ist derzeit nicht verfügbar. Bitte wähle eine andere Zahlungsart.
                      </p>
                    )}
                  </motion.div>
                )}
              </section>
              <section className="bg-white rounded-xl p-6 shadow-sm">
                <h2
                  className="text-lg mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Anmerkungen (optional)
                </h2>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  disabled={step === "processing"}
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-cream text-sm focus:outline-none focus:ring-2 focus:ring-olive-500/30 focus:border-olive-500 transition-colors resize-none disabled:opacity-50"
                  placeholder="Lieferhinweise, Geschenkverpackung, etc."
                />
              </section>
            </div>

            {/* Right: Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm sticky top-24">
                {/* Mobile toggle */}
                <button
                  type="button"
                  onClick={() => setShowSummary(!showSummary)}
                  className="w-full flex items-center justify-between p-5 lg:hidden"
                >
                  <span
                    className="text-base"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Bestellübersicht ({items.length})
                  </span>
                  {showSummary ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                <div
                  className={`${showSummary ? "block" : "hidden"} lg:block`}
                >
                  <div className="p-5 pt-0 lg:pt-5">
                    <h2
                      className="text-lg mb-4 hidden lg:block"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      Bestellübersicht
                    </h2>

                    {/* Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {items.map((item) => (
                        <div
                          key={item.product.id}
                          className="flex gap-3 items-center"
                        >
                          <div className="relative shrink-0">
                            <ImageWithFallback
                              src={item.product.image}
                              alt={item.product.name}
                              className="w-14 h-14 rounded-lg object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{item.product.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.product.size}
                            </p>
                            <div className="flex items-center gap-1.5 mt-1">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                                disabled={step === "processing"}
                                className="w-5 h-5 flex items-center justify-center rounded border border-border text-xs hover:bg-cream transition-colors disabled:opacity-50"
                              >
                                −
                              </button>
                              <span className="text-xs min-w-[1.2rem] text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                                disabled={step === "processing"}
                                className="w-5 h-5 flex items-center justify-center rounded border border-border text-xs hover:bg-cream transition-colors disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <p className="text-sm shrink-0">
                            {(item.product.price * item.quantity)
                              .toFixed(2)
                              .replace(".", ",")}{" "}
                            €
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border mt-4 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Zwischensumme
                        </span>
                        <span>{totalPrice.toFixed(2).replace(".", ",")} €</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Versand</span>
                        <span>
                          {finalShippingCost === 0 ? (
                            <span className="text-olive-500">Kostenlos</span>
                          ) : (
                            `${finalShippingCost.toFixed(2).replace(".", ",")} €`
                          )}
                        </span>
                      </div>
                      {discountTotal > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-olive-500">Rabatt</span>
                          <span className="text-olive-500">-{discountTotal.toFixed(2).replace(".", ",")} €</span>
                        </div>
                      )}
                      {!isPickup && backendShippingCost === null && totalPrice < 50 && (
                        <p className="text-xs text-muted-foreground">
                          Noch{" "}
                          {(50 - totalPrice)
                            .toFixed(2)
                            .replace(".", ",")}{" "}
                          € bis zum kostenlosen Versand
                        </p>
                      )}
                    </div>

                    {/* Versandinfo (automatisch gewählt) */}
                    {selectedShippingId && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">
                          {isPickup ? "Kostenlose Abholung vor Ort" : totalPrice >= FREE_SHIPPING_MIN ? "Kostenloser Versand ab 50 €" : "Standardversand"}
                        </p>
                      </div>
                    )}
                    <div className="border-t border-border mt-4 pt-4">
                      <div className="flex justify-between items-baseline">
                        <span
                          className="text-base"
                          style={{ fontFamily: "var(--font-heading)" }}
                        >
                          Gesamt
                        </span>
                        <div className="text-right">
                          <span
                            className="text-xl text-olive-500"
                            style={{ fontFamily: "var(--font-heading)" }}
                          >
                            {grandTotal.toFixed(2).replace(".", ",")} €
                          </span>
                          <p className="text-xs text-muted-foreground">
                            inkl. MwSt.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Promotion Code Eingabe */}
                    <div className="mt-6">
                      <PromotionCodeInput
                        cartId={medusaCartId}
                        onCartUpdate={async () => {
                          if (medusaCartId) {
                            try {
                              const { validateCart } = await import("../api/medusa-client");
                              const cart = await validateCart(medusaCartId);
                              if (cart) {
                                setDiscountTotal(cart.discount_total || 0);
                              }
                            } catch (e) { console.warn("[Promo] Cart reload failed", e); }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="p-5 border-t border-border">
                  {/* Pre-mount PayPal SDK provider when PayPal is selected */}
                  {payment === "paypal" && PAYPAL_CLIENT_ID && (
                    <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "EUR", intent: "capture" }}>
                      {step === "paypal-approve" && paypalOrderId ? (
                        <div className="space-y-3">
                          <p className="text-sm text-center text-muted-foreground mb-2">
                            Bitte bestätige die Zahlung über PayPal:
                          </p>
                          <PayPalButtons
                            style={{ layout: "vertical", shape: "rect", label: "pay" }}
                            createOrder={() => Promise.resolve(paypalOrderId || "")}
                            onApprove={async () => {
                              await handlePayPalApprove();
                            }}
                            onCancel={() => {
                              setStep("form");
                              setCheckoutError("PayPal-Zahlung wurde abgebrochen.");
                            }}
                            onError={(err) => {
                              console.error("PayPal Error:", err);
                              setStep("error");
                              setCheckoutError("PayPal-Zahlung fehlgeschlagen. Bitte versuche es erneut.");
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setStep("form");
                              setPaypalOrderId(null);
                            }}
                            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Zurück zur Zahlungsauswahl
                          </button>
                        </div>
                      ) : null}
                    </PayPalScriptProvider>
                  )}
                  {!(step === "paypal-approve" && paypalOrderId && PAYPAL_CLIENT_ID) && (
                  <button
                    type="submit"
                    disabled={step === "processing" || syncing || isSubmitting}
                    className="w-full bg-olive-500 text-white py-3.5 rounded-lg hover:bg-olive-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {step === "processing" ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                        />
                        <span>Bestellung wird verarbeitet...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        {payment === "paypal"
                          ? "Weiter zu PayPal"
                          : payment === "vorkasse"
                          ? "Zahlungspflichtig bestellen"
                          : "Bestellung abschließen"}
                      </>
                    )}
                  </button>
                  )}

                  {/* Processing olive animation */}
                  {step === "processing" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-4 bg-olive-50 rounded-xl p-6 flex flex-col items-center"
                    >
                      {/* Olive dropping into cart animation */}
                      <div className="relative w-20 h-20 mb-4">
                        {/* Cart */}
                        <motion.div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-3xl">
                          🛒
                        </motion.div>
                        {/* Bouncing olive */}
                        <motion.div
                          className="absolute left-1/2 -translate-x-1/2 text-2xl"
                          animate={{
                            y: [0, 40, 30, 40],
                            opacity: [1, 1, 1, 0.6],
                          }}
                          transition={{
                            duration: 1.6,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        >
                          🫒
                        </motion.div>
                      </div>
                      {/* Rotating fun messages */}
                      <motion.p
                        key={loadingMsgIdx}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="text-sm text-olive-700 font-medium text-center"
                      >
                        {LOADING_MESSAGES[loadingMsgIdx]}
                      </motion.p>
                      {/* Progress bar */}
                      <div className="w-full mt-3 h-1.5 bg-olive-200 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-olive-500 rounded-full"
                          initial={{ width: "5%" }}
                          animate={{ width: "90%" }}
                          transition={{ duration: 15, ease: "easeOut" }}
                        />
                      </div>
                    </motion.div>
                  )}

                  <div className="flex items-center justify-center gap-4 mt-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      SSL-verschlüsselt
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Truck className="w-3.5 h-3.5" />
                      {isPickup ? "Abholung" : "2–3 Tage"}
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground text-center mt-3 leading-relaxed">
                    Mit Ihrer Bestellung akzeptieren Sie unsere{" "}
                    <Link to="/agb" className="underline hover:text-olive-500">
                      AGB
                    </Link>{" "}
                    und{" "}
                    <Link
                      to="/datenschutz"
                      className="underline hover:text-olive-500"
                    >
                      Datenschutzerklärung
                    </Link>
                    .
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CheckoutPage;