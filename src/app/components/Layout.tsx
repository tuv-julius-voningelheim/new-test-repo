import { Outlet, Link, useLocation } from "react-router";
import { Suspense } from "react";
import { ShoppingBag, Menu, X, MapPin, Phone, Mail } from "lucide-react";
import { useState, useEffect } from "react";
import { useCart } from "./CartContext";
import { CartDrawer } from "./CartDrawer";
import { motion, AnimatePresence } from "motion/react";

const LOGO_URL = "https://ik.imagekit.io/iu69j6qea/logo-des-herstellers-von-extra-nativem-griechischem-oliven%C3%B6l-bio.png";

const navLinks = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/unsere-tradition", label: "Unsere Geschichte" },
  { to: "/kontakt", label: "Kontakt" },
];

export function Layout() {
  const { totalItems, setIsOpen } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHome = location.pathname === "/";

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top banner */}
      <div className="bg-olive-500 text-white text-center text-xs py-2 px-4">
        Kostenloser Versand ab 50 € Bestellwert innerhalb Österreichs
      </div>

      {/* Header */}
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "bg-white/95 backdrop-blur-md shadow-sm"
            : isHome
            ? "bg-transparent"
            : "bg-white"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Mobile menu button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 -ml-2"
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Logo */}
            <Link
              to="/"
              className="flex items-center gap-3 absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0"
            >
              <img
                src={LOGO_URL}
                alt="1000 Horia"
                className="h-11 sm:h-14 w-auto"
              />
              <div className="hidden sm:flex flex-col">
                <span
                  className="text-lg sm:text-xl tracking-wide text-olive-500"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  The Girardi Oil
                </span>
                <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground leading-tight">
                  1000 Horia · Griechisches Olivenöl
                </span>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`text-sm tracking-wide transition-colors hover:text-olive-500 ${
                    location.pathname === link.to
                      ? "text-olive-500"
                      : "text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Cart */}
            <button
              onClick={() => setIsOpen(true)}
              className="relative p-2"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-0.5 -right-0.5 bg-gold-400 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full"
                >
                  {totalItems}
                </motion.span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="lg:hidden overflow-hidden bg-white border-t border-border"
            >
              <nav className="px-4 py-4 space-y-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`block py-3 px-4 rounded-lg text-sm transition-colors ${
                      location.pathname === link.to
                        ? "bg-olive-50 text-olive-500"
                        : "text-foreground hover:bg-cream-dark"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Main content */}
      <main className="flex-1">
        <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center"><div className="w-8 h-8 border-2 border-olive-500/30 border-t-olive-500 rounded-full animate-spin" /></div>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="bg-olive-800 text-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            {/* Brand */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img
                  src={LOGO_URL}
                  alt="1000 Horia"
                  className="h-12 w-auto brightness-0 invert opacity-80"
                />
                <span
                  className="text-lg text-white"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  The Girardi Oil
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/60">
                Griechisches Olivenöl der feinen Art. Von der Frucht bis zur
                Flasche – alles in unserer Hand.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-sm uppercase tracking-widest text-gold-400 mb-4">
                Shop
              </h4>
              <div className="space-y-2.5">
                <Link to="/shop" className="block text-sm hover:text-white transition-colors">
                  Alle Produkte
                </Link>
                <Link to="/shop?cat=bio" className="block text-sm hover:text-white transition-colors">
                  BIO Olivenöl
                </Link>
                <Link to="/shop?cat=extra-nativ" className="block text-sm hover:text-white transition-colors">
                  Extra Nativ
                </Link>
                <Link to="/shop?cat=aroma" className="block text-sm hover:text-white transition-colors">
                  Mit Aroma
                </Link>
              </div>
            </div>

            {/* Info */}
            <div>
              <h4 className="text-sm uppercase tracking-widest text-gold-400 mb-4">
                Information
              </h4>
              <div className="space-y-2.5">
                <Link to="/unsere-tradition" className="block text-sm hover:text-white transition-colors">
                  Unsere Geschichte
                </Link>
                <Link to="/kontakt" className="block text-sm hover:text-white transition-colors">
                  Kontakt
                </Link>
                <Link to="/impressum" className="block text-sm hover:text-white transition-colors">
                  Impressum
                </Link>
                <Link to="/datenschutz" className="block text-sm hover:text-white transition-colors">
                  Datenschutz
                </Link>
                <Link to="/agb" className="block text-sm hover:text-white transition-colors">
                  AGB
                </Link>
                <Link to="/widerruf" className="block text-sm hover:text-white transition-colors">
                  Widerrufsbelehrung
                </Link>
              </div>
            </div>

            {/* Contact */}
            <div>
              <h4 className="text-sm uppercase tracking-widest text-gold-400 mb-4">
                Die Werkstatt
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 mt-0.5 text-gold-400 shrink-0" />
                  <p className="text-sm">
                    Direktverkauf in Innsbruck
                    <br />
                    <a
                      href="https://maps.app.goo.gl/y3ZhkDwwvE7yL1sZ7"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gold-400 hover:text-gold-300 transition-colors"
                    >
                      Wegbeschreibung →
                    </a>
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gold-400 shrink-0" />
                  <a href="tel:+4366455555577" className="text-sm hover:text-white transition-colors">
                    +43 664 55555 77
                  </a>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-gold-400 shrink-0" />
                  <a href="mailto:info@1000horia.at" className="text-sm hover:text-white transition-colors">
                    info@1000horia.at
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/40">
              © {new Date().getFullYear()} Monika Girardi & Mitgesellschafter. Alle Rechte vorbehalten.
            </p>
            <p className="text-xs text-white/40">
              1000 Horia – Griechisches Olivenöl der feinen Art
            </p>
          </div>
        </div>
      </footer>

      <CartDrawer />
    </div>
  );
}
