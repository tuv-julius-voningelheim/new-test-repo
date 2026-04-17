import { Link } from "react-router";
import { motion } from "motion/react";
import { ArrowRight, Leaf, Award, Truck, Heart } from "lucide-react";
import { IK } from "../productData";
import { useMedusaProducts } from "../hooks/useMedusaProducts";
import { ProductCard } from "../ProductCard";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import React, { useRef, useEffect, useState } from "react";
import { SEOHead } from "../SEOHead";

const IMG_HERO = IK.hero1;
const IMG_STORY = IK.family;
const IMG_WERKSTATT = IK.werkstatt;

const features = [
  {
    icon: Leaf,
    title: "100% Natürlich",
    text: "Keine Zusätze, keine Konservierungsstoffe. Nur pure Olive.",
  },
  {
    icon: Award,
    title: "EU-BIO Zertifiziert",
    text: "Unsere Haine tragen das europäische BIO-Zertifikat.",
  },
  {
    icon: Truck,
    title: "Gratis ab 50 €",
    text: "Kostenloser Versand innerhalb Österreichs ab 50 € Bestellwert.",
  },
  {
    icon: Heart,
    title: "Familienbetrieb",
    text: "Seit 2012 mit Leidenschaft und Handarbeit.",
  },
];

export function HomePage() {
  const { products } = useMedusaProducts();
  const featured = products.filter((p) =>
    ["bio-1000", "en-1000", "aroma-trueffel", "balsam-feige"].includes(p.id)
  );

  // Parallax State
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      if (!parallaxRef.current) return;
      const rect = parallaxRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      if (rect.top < windowHeight && rect.bottom > 0) {
        const scrollY = window.scrollY || window.pageYOffset;
        setOffset(scrollY * 0.3); // Parallax speed
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div>
      <SEOHead canonical="/" />
      {/* Hero */}
      <section ref={parallaxRef} className="relative h-[85vh] min-h-[600px] flex items-center overflow-hidden">
        <div className="absolute inset-0 will-change-transform" style={{ transform: `translateY(${offset * 0.5}px)` }}>
          <ImageWithFallback
            src={IMG_HERO}
            alt="Olivenhaine auf dem Peloponnes"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-olive-900/80 via-olive-900/50 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-xl"
          >
            <span className="inline-block text-gold-300 text-sm tracking-[0.25em] uppercase mb-4">
              Peloponnes · Griechenland
            </span>
            <h1
              className="text-4xl sm:text-5xl lg:text-6xl text-white mb-6"
              style={{ fontFamily: "var(--font-heading)", lineHeight: 1.15 }}
            >
              Olivenöl der
              <br />
              <span className="text-gold-300">feinen Art</span>
            </h1>
            <p className="text-white/80 text-lg mb-8 max-w-md leading-relaxed">
              Von den sonnenverwöhnten Hügeln der Navarino-Bucht direkt zu
              Ihnen. Handgeerntet, kalt gepresst, extra nativ.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 bg-gold-400 text-white px-7 py-3.5 rounded-lg hover:bg-gold-500 transition-colors"
              >
                Jetzt entdecken
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/unsere-tradition"
                className="inline-flex items-center gap-2 border border-white/30 text-white px-7 py-3.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                Unsere Geschichte
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 bg-olive-50 rounded-full flex items-center justify-center mx-auto mb-3">
                  <f.icon className="w-5 h-5 text-olive-500" />
                </div>
                <h3
                  className="text-sm mb-1"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {f.title}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {f.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="py-20 bg-cream">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="text-gold-500 text-sm tracking-[0.2em] uppercase">
              Unsere Auswahl
            </span>
            <h2
              className="text-3xl sm:text-4xl mt-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Beliebte Produkte
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 text-olive-500 hover:text-olive-600 transition-colors text-sm"
            >
              Alle Produkte ansehen
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="relative">
                <ImageWithFallback
                  src="https://ik.imagekit.io/iu69j6qea/1763317156.jpg"
                  alt="Olivenernte in Handarbeit"
                  className="w-full rounded-2xl object-cover aspect-[4/5]"
                />
                <div className="absolute -bottom-6 -right-6 bg-gold-400 text-white p-6 rounded-xl hidden lg:block">
                  <p
                    className="text-3xl"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    Seit 2012
                  </p>
                  <p className="text-sm text-white/80">Familienbetrieb</p>
                </div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-gold-500 text-sm tracking-[0.2em] uppercase">
                Unsere Geschichte
              </span>
              <h2
                className="text-3xl sm:text-4xl mt-2 mb-6"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Von der Frucht
                <br />
                bis zur Flasche
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Alles begann als Monika Girardi einen griechischen Freund
                  unterstützen wollte und sein Olivenöl nach Tirol brachte.
                  Schon bald darauf gründete sie 2012 die Firma Monika Girardi &
                  Mitgesellschafter.
                </p>
                <p>
                  Heute pflegen wir, die Familie Girardi, unsere eigenen
                  Olivenbäume der Sorte Koroneiki auf dem Peloponnes – in
                  echter Handarbeit und mit tiefem Respekt vor der Natur.
                </p>
                <p>
                  Wir wissen genau, woher jede Olive kommt. Wir ernten selbst,
                  pressen und füllen gemeinsam ab und behalten jede Charge im
                  Blick.
                </p>
              </div>
              <Link
                to="/unsere-tradition"
                className="inline-flex items-center gap-2 mt-6 text-olive-500 hover:text-olive-600 transition-colors"
              >
                Mehr erfahren
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Werkstatt CTA */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0">
          <ImageWithFallback
            src={IMG_WERKSTATT}
            alt="Innsbruck, Tirol"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-olive-900/70" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="text-gold-300 text-sm tracking-[0.2em] uppercase">
              Direktverkauf in Innsbruck
            </span>
            <h2
              className="text-3xl sm:text-4xl text-white mt-3 mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Die „Werkstatt"
            </h2>
            <p className="text-white/70 mb-3 max-w-lg mx-auto leading-relaxed">
              Besuchen Sie uns in Innsbruck und verkosten Sie unsere
              Produktpalette vor Ort. Da wir keine fixen Öffnungszeiten haben,
              rufen Sie uns bitte vorher an.
            </p>
            <p className="text-gold-300 text-lg mb-8" style={{ fontFamily: "var(--font-heading)" }}>
              +43 664 55555 77
            </p>
            <a
              href="https://maps.app.goo.gl/y3ZhkDwwvE7yL1sZ7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gold-400 text-white px-7 py-3.5 rounded-lg hover:bg-gold-500 transition-colors"
            >
              Zur Wegbeschreibung
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>
        </div>
      </section>
    </div>
  );
}