"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

const HERO_IMAGE = "/HERO_IMAGE.webp";
const OBSERVATION_IMAGE = "/OBSERVATION_IMAGE.webp";
const PRIVACY_IMAGE = "/PRIVACY_IMAGE.webp";
const SKY_STATUSES = [
  "Cielobservable",
  "Conditions optimales",
  "Nuit claire détectée",
  "Prêt pour l'observation",
];

type Star = {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  twinkle: number;
  phase: number;
};

function Logo() {
  return (
    <a href="#" className="logo" aria-label="SkyQuest, retour en haut">
      <span className="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 28 28">
          <circle className="star" cx="14" cy="6" r="1.5" />
          <circle className="star" cx="8" cy="18" r="1" />
          <circle className="star" cx="22" cy="16" r="1.2" />
          <path
            d="M14 6 L8 18 L22 16 Z"
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.5"
          />
        </svg>
      </span>
      SkyQuest
    </a>
  );
}

function ArrowIcon() {
  return (
    <svg
      className="arrow"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <motion.div
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -50px 0px" }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.8, ease: "easeOut" }}
      whileHover={
        !prefersReducedMotion && className.includes("feature-card") ? { y: -4 } : undefined
      }
    >
      {children}
    </motion.div>
  );
}

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [skyStatus, setSkyStatus] = useState(SKY_STATUSES[0]);
  const [skyStatusVisible, setSkyStatusVisible] = useState(true);

  useEffect(() => {
    const previousScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
    };
  }, []);

  useEffect(() => {
    const nav = document.getElementById("marketing-nav");
    const updateNav = () => {
      if (!nav) return;
      nav.style.padding = window.scrollY > 40 ? "12px 0" : "18px 0";
      nav.style.background =
        window.scrollY > 40 ? "rgba(10, 10, 11, 0.92)" : "rgba(10, 10, 11, 0.7)";
    };

    window.addEventListener("scroll", updateNav, { passive: true });
    updateNav();
    return () => window.removeEventListener("scroll", updateNav);
  }, []);

  useEffect(() => {
    let statusIndex = 0;
    let revealTimeout = 0;
    const interval = window.setInterval(() => {
      statusIndex = (statusIndex + 1) % SKY_STATUSES.length;
      setSkyStatusVisible(false);
      revealTimeout = window.setTimeout(() => {
        setSkyStatus(SKY_STATUSES[statusIndex]);
        setSkyStatusVisible(true);
      }, 300);
    }, 3500);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(revealTimeout);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    let animationFrame = 0;
    let stars: Star[] = [];
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.5 + 0.2,
        twinkle: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    const animateStars = (time: number) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach((star) => {
        const opacity = star.opacity + Math.sin(time * star.twinkle + star.phase) * 0.15;
        context.beginPath();
        context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        context.fillStyle = `rgba(255, 255, 255, ${Math.max(0, opacity)})`;
        context.fill();
      });
      animationFrame = window.requestAnimationFrame(animateStars);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    animationFrame = window.requestAnimationFrame(animateStars);
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  const showInstallInstructions = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.alert(
      "SkyQuest PWA — ajoute cette page à ton écran d'accueil depuis le menu de ton navigateur.",
    );
  };

  const heroContainerVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : { hidden: {}, visible: { transition: { delayChildren: 0.2, staggerChildren: 0.12 } } };
  const heroItemVariants: Variants = prefersReducedMotion
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" } },
      };

  return (
    <main className="marketing-landing">
      <motion.nav
        id="marketing-nav"
        initial={prefersReducedMotion ? false : { opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: "easeOut" }}
      >
        <div className="nav-inner">
          <Logo />
          <div className="nav-links">
            <a href="#features">Fonctionnalités</a>
            <a href="#observation">Observation</a>
            <a href="#privacy">Confidentialité</a>
            <a href="#access">Accès</a>
            <a href="#cta" className="nav-cta">
              Commencer
            </a>
          </div>
        </div>
      </motion.nav>

      <header className="hero">
        <div className="hero-bg">
          <img src={HERO_IMAGE} alt="Ciel nocturne étoilé" />
          <canvas ref={canvasRef} />
        </div>
        <motion.div
          className="hero-content"
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div className="hero-eyebrow" variants={heroItemVariants}>
            <span className="dot" />
            Ciel actuel · Conseils simples
          </motion.div>
          <motion.h1 variants={heroItemVariants}>
            Le ciel a quelque chose
            <br />à <span className="accent">te montrer</span>
          </motion.h1>
          <motion.p variants={heroItemVariants}>
            Des observations choisies selon ta position, la météo et ce qui est réellement visible.
            Ton compagnon de poche pour explorer la voûte céleste.
          </motion.p>
          <motion.div className="hero-cta" variants={heroItemVariants}>
            <a href="#cta" className="btn btn-primary">
              {"Ajouter à l'écran d'accueil"} <ArrowIcon />
            </a>
            <a href="#features" className="btn btn-secondary">
              Découvrir
            </a>
          </motion.div>
        </motion.div>
      </header>

      <motion.div
        className="stats-bar"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.4 }}
        variants={heroContainerVariants}
      >
        <motion.div className="stat" variants={heroItemVariants}>
          <div className="stat-num">88</div>
          <div className="stat-label">Constellations</div>
        </motion.div>
        <motion.div className="stat" variants={heroItemVariants}>
          <div className="stat-num">0</div>
          <div className="stat-label">Télémétrie</div>
        </motion.div>
        <motion.div className="stat" variants={heroItemVariants}>
          <div className="stat-num">100%</div>
          <div className="stat-label">Local</div>
        </motion.div>
        <motion.div className="stat" variants={heroItemVariants}>
          <div className="stat-num">24/7</div>
          <div className="stat-label">Disponible</div>
        </motion.div>
      </motion.div>

      <section id="features">
        <div className="container">
          <Reveal>
            <div className="section-label">Fonctionnalités</div>
            <h2 className="section-title">
              Tout ce dont tu as besoin,
              <br />
              rien de superflu
            </h2>
            <p className="section-desc">
              SkyQuest reste volontairement simple. Pas de cartes complexes ni de jargon technique —
              juste le ciel, ta position, et ce que tu peux vraiment voir ce soir.
            </p>
          </Reveal>
          <div className="features-grid">
            <Reveal className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              </div>
              <h3>Ciel en temps réel</h3>
              <p>
                {
                  "Voici ce que tu peux voir maintenant, calculé d'après ta position et l'heure exacte. Pas de théorie — uniquement le ciel réel au-dessus de ta tête."
                }
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
                  <circle cx="12" cy="12" r="4" />
                </svg>
              </div>
              <h3>Conseils météo</h3>
              <p>
                {
                  "Cloudiness, humidité, phases lunaires — SkyQuest filtre intelligemment pour ne te montrer que les bonnes fenêtres d'observation."
                }
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3>Guidage 2D</h3>
              <p>
                {
                  "Pointe ton téléphone vers le ciel. La caméra et les capteurs d'orientation te guident directement vers les objets visibles, pas à pas."
                }
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M3 9h18M9 21V9" />
                </svg>
              </div>
              <h3>Minimaliste par design</h3>
              <p>
                Une interface épurée, pensée pour la nuit. Pas de fioritures, pas de distractions —
                juste toi et les étoiles.
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 1 0 10 10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h3>Maintenant &amp; futur</h3>
              <p>
                {
                  "Planifie tes soirées d'observation. Regarde ce qui sera visible plus tard ce soir, cette semaine, ou lors du prochain événement céleste."
                }
              </p>
            </Reveal>
            <Reveal className="feature-card">
              <div className="feature-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3>Installable</h3>
              <p>
                {
                  "Ajoute SkyQuest à ton écran d'accueil. Une vraie app, sans store d'applications — légère, instantanée, toujours prête."
                }
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="observation" className="observation-section">
        <div className="container">
          <div className="showcase">
            <Reveal className="showcase-image">
              <img
                src={OBSERVATION_IMAGE}
                alt="Téléphone affichant une constellation devant le ciel nocturne"
              />
            </Reveal>
            <Reveal className="showcase-content">
              <div className="section-label">Observation</div>
              <h2 className="section-title">
                Lève les yeux.
                <br />
                {"Le ciel s'illumine."}
              </h2>
              <p className="section-desc">
                SkyQuest traduit le ciel en quelque chose de simple. Pointe, observe, apprends —
                sans équipement, sans experience préalable.
              </p>
              <ul className="showcase-features">
                <li>
                  <span className="check" />
                  Carte du ciel adaptée à ta position GPS
                </li>
                <li>
                  <span className="check" />
                  Filtrage par conditions météo en temps réel
                </li>
                <li>
                  <span className="check" />
                  {"Guidage par caméra et capteurs d'orientation"}
                </li>
                <li>
                  <span className="check" />
                  {"Journal d'observation personnel, stocké localement"}
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="privacy" className="privacy">
        <div className="container">
          <div className="privacy-grid">
            <Reveal className="privacy-visual">
              <img src={PRIVACY_IMAGE} alt="Personne observant les étoiles depuis une colline" />
              <div className="privacy-badge">
                <span className="dot" />
                On-device · Zero tracking
              </div>
            </Reveal>
            <Reveal className="privacy-content">
              <div className="section-label">Confidentialité</div>
              <h2 className="section-title">
                Tes données restent
                <br />
                tes données
              </h2>
              <p className="section-desc">
                SkyQuest ne collecte rien. Pas de comptes, pas de serveurs, pas de télémétrie. Ta
                position et ton journal restent sur ton appareil — point final.
              </p>
              <div className="privacy-points">
                <div className="privacy-point">
                  <div className="privacy-point-icon">
                    <svg viewBox="0 0 24 24">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <div>
                    <h3>Local par défaut</h3>
                    <p>
                      {
                        "Position et journal d'observation restent sur ton appareil. Aucune donnée n'est envoyée ailleurs."
                      }
                    </p>
                  </div>
                </div>
                <div className="privacy-point">
                  <div className="privacy-point-icon">
                    <svg viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4l3 3" />
                    </svg>
                  </div>
                  <div>
                    <h3>Accès à la demande</h3>
                    <p>
                      {
                        "Rien en arrière-plan. Les capteurs s'activent uniquement quand tu ouvres l'app — et se ferment quand tu la quittes."
                      }
                    </p>
                  </div>
                </div>
                <div className="privacy-point">
                  <div className="privacy-point-icon">
                    <svg viewBox="0 0 24 24">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                      <path d="M22 4L12 14.01l-3-3" />
                    </svg>
                  </div>
                  <div>
                    <h3>Aucun compte requis</h3>
                    <p>
                      {
                        "Pas d'inscription, pas d'email, pas de mot de passe. Ouvre SkyQuest et commence à observer immédiatement."
                      }
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="access">
        <div className="container">
          <Reveal>
            <div className="section-label">Permissions</div>
            <h2 className="section-title">
              Trois accès,
              <br />
              rien de plus
            </h2>
            <p className="section-desc">
              SkyQuest demande le strict minimum. Chaque permission a un rôle précis — et tu gardes
              le contrôle total.
            </p>
          </Reveal>
          <div className="access-grid">
            <Reveal className="access-card">
              <div className="access-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h3>Position</h3>
              <p>
                Pour adapter le ciel à ton lieu exact et afficher les objets visibles depuis ta
                position.
              </p>
              <span className="tag">À la demande</span>
            </Reveal>
            <Reveal className="access-card">
              <div className="access-icon">
                <svg viewBox="0 0 24 24">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                  <circle cx="12" cy="13" r="4" />
                </svg>
              </div>
              <h3>Caméra</h3>
              <p>
                Pour le guidage 2D en réalité augmentée — superposer les constellations sur le ciel
                réel.
              </p>
              <span className="tag">À la demande</span>
            </Reveal>
            <Reveal className="access-card">
              <div className="access-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2L12 22M2 12L22 12" />
                  <path d="M12 2a1515 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
                </svg>
              </div>
              <h3>Orientation</h3>
              <p>
                Pour indiquer où tourner ton téléphone et trouver les objets dans la bonne
                direction.
              </p>
              <span className="tag">À la demande</span>
            </Reveal>
          </div>
        </div>
      </section>

      <section id="cta" className="cta-section">
        <div className="container">
          <Reveal className="cta-content">
            <h2>
              {"Le ciel t'attend"}
              <br />
              <span className="accent">ce soir</span>
            </h2>
            <p>
              {
                "Aucune installation, aucun compte. Ajoute SkyQuest à ton écran d'accueil et regarde vers le haut."
              }
            </p>
            <div className="hero-cta">
              <a href="#" className="btn btn-primary" onClick={showInstallInstructions}>
                {"Ajouter à l'écran d'accueil"} <ArrowIcon />
              </a>
              <a href="#features" className="btn btn-secondary">
                En savoir plus
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <footer>
        <div className="container">
          <div className="footer-inner">
            <div className="footer-brand">
              <Logo />
              <p>
                {
                  "Ton compagnon d'observation du ciel. Simple, privé, gratuit. Le ciel a quelque chose à te montrer — il suffit de lever les yeux."
                }
              </p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h2>App</h2>
                <a href="#features">Fonctionnalités</a>
                <a href="#observation">Observation</a>
                <a href="#access">Permissions</a>
              </div>
              <div className="footer-col">
                <h2>Vie privée</h2>
                <a href="#privacy">Confidentialité</a>
                <a href="#">Données locales</a>
                <a href="#">Aucun tracking</a>
              </div>
              <div className="footer-col">
                <h2>Ressources</h2>
                <a href="#">{"Guide d'observation"}</a>
                <a href="#">FAQ</a>
                <a href="#">Contact</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 SkyQuest · Fait sous les étoiles</span>
            <div className="sky-state">
              <span className="dot" />
              <span className={skyStatusVisible ? "status-visible" : "status-hidden"}>
                {skyStatus}
              </span>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
