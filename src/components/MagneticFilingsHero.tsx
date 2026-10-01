// MagneticFilingsHero — a full-bleed hero with thousands of iron-filing line particles on one canvas: idle flow,
// cursor-driven magnetic bending, a CTA-focused field hotspot, an optional headline formed from filings that
// scatters and reforms, and a pulsing glow, over headline/subheadline/CTA. The particle field is pure canvas +
// rAF (with an in-view gate) and kept intact; the conversion strips Framer property controls, swaps Framer's
// `Link`→<a>, useInView→IntersectionObserver, and useIsStaticRenderer→prefers-reduced-motion. No Framer dependency.
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    startTransition,
    type CSSProperties,
    type PointerEvent as ReactPointerEvent,
} from "react";

export interface MagneticFilingsHeroProps {
    headline?: string;
    subheadline?: string;
    ctaLabel?: string;
    ctaHref?: string;
    filingDensity?: number;
    accentGlow?: string;
    fieldStrength?: number;
    cursorMagnet?: boolean;
    headlineFromFilings?: boolean;
    reformSpeed?: number;
    background?: string;
    filingColor?: string;
    textColor?: string;
    style?: CSSProperties;
}

type FilingParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    angle: number;
    length: number;
    targetX?: number;
    targetY?: number;
    scatter: number;
    role: "normal" | "headline";
};

/** Respects the user's reduced-motion preference (replaces Framer's static-render check). */
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false);
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const update = () => setReduced(mq.matches);
        update();
        if (mq.addEventListener) mq.addEventListener("change", update);
        else mq.addListener(update);
        return () => {
            if (mq.removeEventListener) mq.removeEventListener("change", update);
            else mq.removeListener(update);
        };
    }, []);
    return reduced;
}

export const MagneticFilingsHero = (props: MagneticFilingsHeroProps) => {
    const {
        headline = "Magnetic Field Intelligence",
        subheadline = "Data, design, and motion align like filings around a living magnetic core.",
        ctaLabel = "Explore",
        ctaHref = "#",
        filingDensity = 1,
        accentGlow = "#39BDF8",
        fieldStrength = 1,
        cursorMagnet = true,
        headlineFromFilings = false,
        reformSpeed = 1,
        background = "#090A0D",
        filingColor = "#F5F5F5",
        textColor = "#FFFFFF",
        style,
    } = props;

    const containerRef = useRef<HTMLDivElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const particlesRef = useRef<FilingParticle[]>([]);
    const rafRef = useRef<number | null>(null);
    const pointerRef = useRef({ x: 0, y: 0, active: false });
    const sizeRef = useRef({ w: 1200, h: 720, dpr: 1 });
    const headlinePointsRef = useRef<Array<{ x: number; y: number }>>([]);
    const [containerWidth, setContainerWidth] = useState(1200);

    const isStatic = usePrefersReducedMotion();
    const [inView, setInView] = useState(false);
    const isTablet = containerWidth < 900;
    const isPhone = containerWidth < 520;
    const headlineFontSize = isPhone
        ? "clamp(26px, 9vw, 42px)"
        : isTablet
          ? "clamp(34px, 6vw, 64px)"
          : "clamp(34px, 7vw, 88px)";
    const subheadlineFontSize = isPhone
        ? "clamp(13px, 3.5vw, 16px)"
        : "clamp(14px, 1.9vw, 22px)";
    const containerPadding = isPhone
        ? "48px 20px"
        : isTablet
          ? "56px 28px"
          : "40px 24px";
    const contentWidth = isPhone ? "min(95%, 420px)" : "min(860px, 90%)";

    useEffect(() => {
        const node = containerRef.current;
        if (
            !node ||
            typeof window === "undefined" ||
            typeof IntersectionObserver === "undefined"
        )
            return;
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) setInView(entry.isIntersecting);
            },
            { threshold: 0.05, rootMargin: "200px" }
        );
        io.observe(node);
        return () => io.disconnect();
    }, []);

    const particleSpacing = useMemo(() => {
        const d = Math.max(0.2, Math.min(2, filingDensity));
        return Math.max(9, Math.round(16 / d));
    }, [filingDensity]);

    const generateHeadlinePoints = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { w, h } = sizeRef.current;
        if (w < 10 || h < 10 || !headlineFromFilings) {
            headlinePointsRef.current = [];
            return;
        }

        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d");
        if (!ctx) return;

        const fontPx = Math.max(42, Math.min(110, w * 0.082));
        const y = h * 0.3;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
        ctx.fillText(headline, w / 2, y);

        const image = ctx.getImageData(0, 0, w, h).data;
        const step = Math.max(4, Math.round(10 / Math.max(0.4, filingDensity)));
        const points: Array<{ x: number; y: number }> = [];
        for (let yy = 0; yy < h; yy += step) {
            for (let xx = 0; xx < w; xx += step) {
                const a = image[(yy * w + xx) * 4 + 3];
                if (a > 120) points.push({ x: xx, y: yy });
            }
        }
        headlinePointsRef.current = points;
    }, [filingDensity, headline, headlineFromFilings]);

    const initParticles = useCallback(() => {
        const { w, h } = sizeRef.current;
        const particles: FilingParticle[] = [];
        for (let y = particleSpacing / 2; y < h; y += particleSpacing) {
            for (let x = particleSpacing / 2; x < w; x += particleSpacing) {
                particles.push({
                    x: x + (Math.random() - 0.5) * particleSpacing * 0.7,
                    y: y + (Math.random() - 0.5) * particleSpacing * 0.7,
                    vx: (Math.random() - 0.5) * 0.1,
                    vy: (Math.random() - 0.5) * 0.1,
                    angle: Math.random() * Math.PI * 2,
                    length: 1.4 + Math.random() * 2.6,
                    scatter: 0,
                    role: "normal",
                });
            }
        }

        if (headlineFromFilings && headlinePointsRef.current.length > 0) {
            const points = headlinePointsRef.current;
            const sampleCount = Math.min(
                points.length,
                Math.floor(particles.length * 0.35)
            );
            for (let i = 0; i < sampleCount; i++) {
                const p = particles[i];
                const t = points[(i * 7) % points.length];
                p.targetX = t.x;
                p.targetY = t.y;
                p.role = "headline";
            }
        }
        particlesRef.current = particles;
    }, [headlineFromFilings, particleSpacing]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const resize = () => {
            const rect = container.getBoundingClientRect();
            const dpr = Math.min(2, window.devicePixelRatio || 1);
            sizeRef.current = {
                w: Math.max(1, Math.floor(rect.width)),
                h: Math.max(1, Math.floor(rect.height)),
                dpr,
            };
            startTransition(() =>
                setContainerWidth(Math.max(1, Math.floor(rect.width)))
            );
            canvas.width = sizeRef.current.w * dpr;
            canvas.height = sizeRef.current.h * dpr;
            canvas.style.width = `${sizeRef.current.w}px`;
            canvas.style.height = `${sizeRef.current.h}px`;
            const ctx = canvas.getContext("2d");
            if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            generateHeadlinePoints();
            initParticles();
        };

        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(container);
        return () => ro.disconnect();
    }, [generateHeadlinePoints, initParticles]);

    useEffect(() => {
        generateHeadlinePoints();
        initParticles();
    }, [generateHeadlinePoints, initParticles]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let t = 0;
        const draw = () => {
            rafRef.current = window.requestAnimationFrame(draw);
            if (isStatic || !inView) return;

            const { w, h } = sizeRef.current;
            t += 0.012;

            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, w, h);

            const hum = 0.72 + Math.sin(t * 0.55) * 0.12;
            const cursor = pointerRef.current;
            const ctaX = w * 0.5;
            const ctaY = h * 0.63;

            const particles = particlesRef.current;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                const idleA =
                    Math.sin((p.y + t * 95) * 0.008) +
                    Math.cos((p.x - t * 60) * 0.009);
                let fx = Math.cos(idleA) * 0.08;
                let fy = Math.sin(idleA) * 0.08;

                if (cursorMagnet && cursor.active) {
                    const dx = p.x - cursor.x;
                    const dy = p.y - cursor.y;
                    const d2 = Math.max(120, dx * dx + dy * dy);
                    const inv = (fieldStrength * 2600) / d2;
                    fx += (-dy * inv) / 35;
                    fy += (dx * inv) / 35;

                    if (p.role === "headline" && Math.sqrt(d2) < 120) {
                        p.scatter = 1;
                    }
                }

                const hdx = p.x - ctaX;
                const hdy = p.y - ctaY;
                const hD2 = Math.max(180, hdx * hdx + hdy * hdy);
                const hotspot = (fieldStrength * 2100) / hD2;
                fx += (-hdy * hotspot) / 48;
                fy += (hdx * hotspot) / 48;

                p.vx = p.vx * 0.94 + fx;
                p.vy = p.vy * 0.94 + fy;

                if (
                    headlineFromFilings &&
                    p.role === "headline" &&
                    p.targetX !== undefined &&
                    p.targetY !== undefined
                ) {
                    const reform =
                        (0.008 + reformSpeed * 0.01) * (1 - p.scatter * 0.75);
                    p.vx += (p.targetX - p.x) * reform;
                    p.vy += (p.targetY - p.y) * reform;
                    p.scatter *= 0.985 - Math.min(0.03, reformSpeed * 0.004);
                }

                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.92;
                p.vy *= 0.92;

                if (p.x < 0) p.x += w;
                if (p.y < 0) p.y += h;
                if (p.x > w) p.x -= w;
                if (p.y > h) p.y -= h;

                p.angle = Math.atan2(p.vy, p.vx);

                const distCTA = Math.hypot(p.x - ctaX, p.y - ctaY);
                const accentMix = Math.max(0, 1 - distCTA / 170);
                const alpha = Math.min(
                    0.95,
                    (0.26 + Math.abs(p.vx + p.vy) * 0.7) * hum
                );
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle =
                    accentMix > 0.7 && i % 11 === 0 ? accentGlow : filingColor;
                ctx.globalAlpha = alpha * (accentMix > 0.7 ? 0.95 : 0.72);
                ctx.fillRect(-p.length * 1.2, -0.45, p.length * 2.4, 0.9);
                ctx.restore();
            }

            const glowStrength = 0.06 + Math.max(0, Math.sin(t * 0.5)) * 0.08;
            const grad = ctx.createRadialGradient(
                w * 0.5,
                h * 0.6,
                10,
                w * 0.5,
                h * 0.6,
                Math.max(w, h) * 0.8
            );
            grad.addColorStop(0, `${accentGlow}22`);
            grad.addColorStop(1, `${accentGlow}00`);
            ctx.globalAlpha = glowStrength;
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1;
        };

        rafRef.current = window.requestAnimationFrame(draw);
        return () => {
            if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
        };
    }, [
        accentGlow,
        background,
        cursorMagnet,
        fieldStrength,
        filingColor,
        headlineFromFilings,
        inView,
        isStatic,
        reformSpeed,
    ]);

    const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        startTransition(() => {
            pointerRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
                active: true,
            };
        });
    }, []);

    const onPointerEnter = useCallback(() => {
        startTransition(() => {
            pointerRef.current.active = true;
        });
    }, []);

    const onPointerLeave = useCallback(() => {
        startTransition(() => {
            pointerRef.current.active = false;
        });
    }, []);

    return (
        <section
            ref={containerRef}
            onPointerMove={onPointerMove}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                background,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: containerPadding,
                ...style,
            }}
        >
            <canvas
                ref={canvasRef}
                aria-hidden
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                }}
            />

            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    width: contentWidth,
                    textAlign: "center",
                    color: textColor,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 14,
                }}
            >
                <h1
                    style={{
                        margin: 0,
                        fontSize: headlineFontSize,
                        letterSpacing: "-0.03em",
                        lineHeight: 0.95,
                        fontWeight: 300,
                        overflowWrap: "anywhere",
                        textShadow: `0 0 22px ${accentGlow}33`,
                    }}
                >
                    {headline}
                </h1>
                <p
                    style={{
                        margin: 0,
                        maxWidth: 700,
                        fontSize: subheadlineFontSize,
                        lineHeight: 1.35,
                        letterSpacing: "0.01em",
                        color: `${textColor}CC`,
                        overflowWrap: "break-word",
                    }}
                >
                    {subheadline}
                </p>
                <a
                    href={ctaHref}
                    aria-label={ctaLabel}
                    style={{
                        marginTop: 12,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textDecoration: "none",
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: accentGlow || "rgba(255,255,255,0.6)",
                        color: textColor,
                        background: `${accentGlow}1A`,
                        padding: "12px 20px",
                        borderRadius: 999,
                        fontSize: 13,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        boxShadow: `0 0 24px ${accentGlow}44, inset 0 0 12px ${accentGlow}22`,
                        backdropFilter: "blur(1px)",
                    }}
                >
                    {ctaLabel}
                </a>
            </div>
        </section>
    );
};
