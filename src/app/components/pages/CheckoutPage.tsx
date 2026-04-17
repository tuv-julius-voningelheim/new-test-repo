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

// Type definition for PayPal components (for proper typing)
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

// Stub for PayPal components (will use dynamic import in real setup)
const PayPalScriptProvider = ({ children }: PayPalScriptProviderProps) => <>{children}</>;
const PayPalButtons = ({ onApprove, onCancel, onError, createOrder }: PayPalButtonsProps) => (
  <button
    onClick={() => createOrder().then(() => onApprove?.({})).catch((e) => onError?.(e))}
    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
  >
    Mit PayPal zahlen
  </button>
);

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
  const [isPickup, setIsPickup] = useState(false);
  const [payment, setPayment] = useState("vorkasse");
  const [showSummary, setShowSummary] = useState(false);
  const [selectedShippingId, setSelectedShippingId] = useState<string | null>(null);
  const [shippingCost, setShippingCost] = useState(0);
  const [backendShippingCost, setBackendShippingCost] = useState<number | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paypalCollectionId, setPaypalCollectionId] = useState<string | null>(null);
  const [paypalSessionId, setPaypalSessionId] = useState<string | null>(null);
  const [paypalCartId, setPaypalCartId] = useState<string | null>(null);
  const [appliedPromoCodes, setAppliedPromoCodes] = useState<string[]>([]);

  // Refs & Konstanten
  const shippingOptionsCacheRef = useRef<Record<string, any[]>>({});
  const FREE_SHIPPING_MIN = 50;
  const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID || "";
  const PROCESSING_STEPS = [
    { key: "creating", label: "Warenkorb wird erstellt" },
    { key: "shipping", label: "Versandoption wird hinzugefügt" },
    { key: "payment", label: "Zahlung wird vorbereitet" },
    { key: "completing", label: "Bestellung wird abgeschlossen" },
  ];

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
  const grandTotal = totalPrice + finalShippingCost;

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
          const freeOption = options.find((o: any) => o.amount === 0 || o.name?.toLowerCase().includes("kostenlos") || o.name?.toLowerCase().includes("free"));
          const pickupOption = options.find((o: any) => o.name?.toLowerCase().includes("abhol") || o.name?.toLowerCase().includes("pickup"));
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

  // Versandoptionen-Handler
  const handleShippingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const id = e.target.value;
    setSelectedShippingId(id);
    const options = shippingOptionsCacheRef.current[medusaCartId || ""] || [];
    const selected = options.find((opt: any) => opt.id === id);
    if (selected) {
      const baseAmount = selected.amount / 100;
      // Nur berechnen wenn nicht kostenlos durch Mindestbestellwert
      if (totalPrice >= FREE_SHIPPING_MIN) {
        setShippingCost(0);
      } else {
        setShippingCost(baseAmount);
      }
    }
  };

  // handleMedusaCheckout mit vollständiger Logik
  const handleMedusaCheckout = async (cartId: string) => {
    try {
      setStep("processing");
      setProcessingSubStep("creating");

      // 1. Update cart with customer data
      setProcessingSubStep("creating");
      const address: MedusaAddress = {
        first_name: form.firstName,
        last_name: form.lastName,
        address_1: form.street,
        city: form.city,
        postal_code: form.zip,
        country_code: form.country.toLowerCase(),
        phone: form.phone || undefined,
      };

      const updatedCart = await updateCart(cartId, {
        email: form.email,
        shipping_address: isPickup ? undefined : address,
        billing_address: isPickup ? undefined : address,
      });

      if (!updatedCart) {
        throw new Error("Warenkorb konnte nicht aktualisiert werden.");
      }

      // 2. Add shipping method if not pickup
      setProcessingSubStep("shipping");
      if (!isPickup && selectedShippingId) {
        const shippedCart = await addShippingMethod(cartId, selectedShippingId);
        if (!shippedCart) {
          throw new Error("Versandoption konnte nicht hinzugefügt werden.");
        }
      }

      // 3. Create payment collection
      setProcessingSubStep("payment");
      const paymentCollection = await createPaymentCollection(cartId);
      if (!paymentCollection) {
        throw new Error("Zahlungssammlung konnte nicht erstellt werden.");
      }

      // 4. Initialize payment session (required by Medusa v2)
      const paymentSession = await initPaymentSession(
        paymentCollection.id,
        "pp_system_default"
      );
      if (!paymentSession) {
        throw new Error("Zahlungssitzung konnte nicht initialisiert werden.");
      }

      // 5. Authorize payment session (required before cart completion)
      const authResult = await authorizePaymentSession(
        paymentCollection.id,
        paymentSession.id
      );
      if (!authResult) {
        throw new Error("Zahlungssitzung konnte nicht autorisiert werden.");
      }

      // 6. Complete the cart → creates order
      setProcessingSubStep("completing");
      const order = await completeCart(cartId);

      if (order) {
        // Send confirmation email
        await sendOrderConfirmation({
          order_id: (order as any)._was409 ? undefined : order.id,
          email: form.email,
          _was409: (order as any)._was409,
        });

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

  // --- PayPal: after user approves in PayPal popup ---
  const handlePayPalApprove = async () => {
    if (!paypalCollectionId || !paypalSessionId || !paypalCartId) return;

    try {
      setStep("processing");
      setProcessingSubStep("completing");
      setCheckoutError(null);

      // 1. Authorize the payment session at Medusa
      const authResult = await authorizePaymentSession(paypalCollectionId, paypalSessionId);
      if (!authResult) {
        throw new Error("PayPal-Zahlung konnte nicht autorisiert werden.");
      }

      // 2. Complete the cart → creates order
      const order = await completeCart(paypalCartId);

      if (order) {
        const was409 = (order as any)._was409 === true;
        // persistOrder entfernt: Funktion nicht definiert, nicht benötigt
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
          await handleMedusaCheckout(cartId);
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
                          onChange={() => setPayment(pm.id)}
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
                      Monika Girardi & Mitgesellschafter
                      <br />
                      IBAN: AT00 0000 0000 0000 0000
                      <br />
                      BIC: XXXXATAXX
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
                          // Optional: Cart neu laden, falls benötigt
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <div className="p-5 border-t border-border">
                  {step === "paypal-approve" && paypalOrderId && PAYPAL_CLIENT_ID ? (
                    <div className="space-y-3">
                      <p className="text-sm text-center text-muted-foreground mb-2">
                        Bitte bestätige die Zahlung über PayPal:
                      </p>
                      <PayPalScriptProvider options={{ clientId: PAYPAL_CLIENT_ID, currency: "EUR" }}>
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
                      </PayPalScriptProvider>
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
                  ) : (
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

                  {/* Processing progress steps */}
                  {step === "processing" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-3 bg-olive-50 rounded-lg p-3"
                    >
                      <div className="space-y-1.5">
                        {PROCESSING_STEPS.map((ps, idx) => {
                          const currentIdx = PROCESSING_STEPS.findIndex(
                            (s) => s.key === processingSubStep
                          );
                          const isDone = idx < currentIdx;
                          const isActive = idx === currentIdx;
                          return (
                            <div
                              key={ps.key}
                              className={`flex items-center gap-2 text-xs transition-colors ${
                                isDone
                                  ? "text-olive-600"
                                  : isActive
                                  ? "text-olive-700"
                                  : "text-olive-400"
                              }`}
                            >
                              {isDone ? (
                                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M8 0a8 8 0 110 16A8 8 0 018 0zm3.78 5.22a.75.75 0 00-1.06 0L7 8.94 5.28 7.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06z" />
                                </svg>
                              ) : isActive ? (
                                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" />
                              ) : (
                                <div className="w-3.5 h-3.5 shrink-0 rounded-full border border-current" />
                              )}
                              <span>{ps.label}</span>
                            </div>
                          );
                        })}
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