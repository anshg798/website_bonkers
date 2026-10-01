import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

/** A single navigation menu item. Exported for typing consumer arrays. */
export interface LiquidNavMenuItem {
    label: string
    link: string
}

/** Logo image descriptor (src/srcSet/alt). */
export interface LiquidNavLogo {
    src?: string
    srcSet?: string
    alt?: string
}

/** Local font-config shape (replaces the Framer `Font` control). */
export interface LiquidNavFontConfig {
    fontSize?: string | number
    lineHeight?: string | number
    letterSpacing?: string | number
    textAlign?: "left" | "center" | "right"
    fontWeight?: number
    fontStyle?: "normal" | "italic"
    fontFamily?: string
}

export interface LiquidNavProps {
    /** Menu items. Falls back to a sensible default set when empty. */
    menuItems?: LiquidNavMenuItem[]
    /** Logo image; when `src` is absent, `logoText` renders instead. */
    logo?: LiquidNavLogo
    /** Brand text shown when no logo image is set. */
    logoText?: string
    /** CTA button label. */
    ctaLabel?: string
    /** CTA button link. */
    ctaLink?: string
    /** Color of the liquid pill indicator. */
    indicatorColor?: string
    /** Nav bar background. */
    barBackground?: string
    /** Backdrop blur (px) for the bar. */
    blurIntensity?: number
    /** Contract the bar (padding/margins/scale) once the page scrolls. */
    contractOnScroll?: boolean
    /** Indicator "stiffness" — higher = snappier settle + more stretch. */
    morphStiffness?: number
    /** Primary text color. */
    textColor?: string
    /** Logo font config. */
    logoFont?: LiquidNavFontConfig
    /** Menu item font config. */
    menuFont?: LiquidNavFontConfig
    /** CTA font config. */
    ctaFont?: LiquidNavFontConfig
    /** Controlled active index. */
    activeIndex?: number
    /** Uncontrolled initial active index. */
    defaultActiveIndex?: number
    /** Fired when the active item changes (click / compact-menu select). */
    onActiveIndexChange?: (index: number, item: LiquidNavMenuItem) => void
    /** Render prop for links (e.g. your router's Link). Defaults to `<a>`. */
    renderLink?: (
        href: string,
        children: ReactNode,
        props: { role?: string; style?: CSSProperties; onClick?: () => void }
    ) => ReactNode
    style?: CSSProperties
    className?: string
}

const DEFAULT_MENU: LiquidNavMenuItem[] = [
    { label: "Home", link: "/" },
    { label: "Features", link: "/features" },
    { label: "Pricing", link: "/pricing" },
    { label: "About", link: "/about" },
]

const DEFAULT_LOGO: LiquidNavLogo = {
    src: "https://framerusercontent.com/images/f9RiWoNpmlCMqVRIHz8l8wYfeI.jpg",
    alt: "Gradient 5 - Green",
}

function scaleFontValue(
    value: string | number | undefined,
    factor: number
): string | number | undefined {
    if (typeof value === "number") return Math.max(10, value * factor)
    if (typeof value === "string") {
        const parsed = Number.parseFloat(value)
        if (!Number.isNaN(parsed) && value.trim().endsWith("px")) {
            return `${Math.max(10, parsed * factor)}px`
        }
    }
    return value
}

/**
 * LiquidNav — a sticky glass navigation bar with a liquid pill indicator that
 * springs between the hovered/active item and stretches with travel speed. The
 * bar contracts on scroll, and collapses to a hamburger + dropdown on phones.
 * Sizing is driven by the measured container width (not the window), and the
 * indicator geometry is re-derived from the live rects on every resize.
 *
 * Springs are approximated: the nav scale/margin contract and the indicator
 * x/width use an overshoot `cubic-bezier(.34,1.56,.64,1)`; the stretch "settle"
 * is reproduced by snapping `scaleX` back to 1 shortly after a move.
 */
export const LiquidNav = ({
    menuItems = DEFAULT_MENU,
    logo = DEFAULT_LOGO,
    logoText = "Aurora",
    ctaLabel = "Get Started",
    ctaLink = "/",
    indicatorColor = "#C8D2DE",
    barBackground = "rgba(10,12,16,0.55)",
    blurIntensity = 16,
    contractOnScroll = true,
    morphStiffness = 180,
    textColor = "#FFFFFF",
    logoFont,
    menuFont,
    ctaFont,
    activeIndex,
    defaultActiveIndex = 0,
    onActiveIndexChange,
    renderLink,
    style,
    className,
}: LiquidNavProps) => {
    const reducedMotion = usePrefersReducedMotion()

    const safeMenuItems = useMemo<LiquidNavMenuItem[]>(
        () => (menuItems.length > 0 ? menuItems : DEFAULT_MENU),
        [menuItems]
    )

    const navRef = useRef<HTMLElement | null>(null)
    const containerRef = useRef<HTMLDivElement | null>(null)
    const menuRailRef = useRef<HTMLDivElement | null>(null)
    const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])
    const resizeObserverRef = useRef<ResizeObserver | null>(null)
    const containerObserverRef = useRef<ResizeObserver | null>(null)
    const settleTimeoutRef = useRef<number | null>(null)

    const isControlled = activeIndex !== undefined
    const [internalActive, setInternalActive] = useState(() =>
        Math.max(0, Math.min(defaultActiveIndex, safeMenuItems.length - 1))
    )
    const currentActive = isControlled
        ? Math.max(0, Math.min(activeIndex as number, safeMenuItems.length - 1))
        : internalActive

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [indicatorX, setIndicatorX] = useState(0)
    const [indicatorWidth, setIndicatorWidth] = useState(0)
    const [indicatorStretch, setIndicatorStretch] = useState(1)
    const [isContracted, setIsContracted] = useState(false)
    const [containerWidth, setContainerWidth] = useState(1200)
    const [isMenuOpen, setIsMenuOpen] = useState(false)
    const [inView, setInView] = useState(true)

    const isTablet = containerWidth < 768 && containerWidth >= 480
    const isPhone = containerWidth < 480
    const isCompactMode = isPhone

    const targetIndex = hoveredIndex ?? currentActive
    const previousTargetRef = useRef<{ x: number; width: number }>({
        x: 0,
        width: 0,
    })

    const updateIndicatorTarget = useCallback(
        (index: number) => {
            const rail = menuRailRef.current
            const node = itemRefs.current[index]
            if (!rail || !node) return
            const railRect = rail.getBoundingClientRect()
            const itemRect = node.getBoundingClientRect()
            const nextX = Math.max(0, itemRect.left - railRect.left)
            const nextWidth = Math.max(28, itemRect.width)
            const previous = previousTargetRef.current
            const travel = Math.abs(nextX - previous.x)
            const pseudoVelocity = (travel * Math.max(40, morphStiffness)) / 180
            const stretchPeak = Math.min(1.42, 1 + pseudoVelocity / 400)
            previousTargetRef.current = { x: nextX, width: nextWidth }
            setIndicatorX(nextX)
            setIndicatorWidth(nextWidth)
            setIndicatorStretch(reducedMotion ? 1 : stretchPeak)
        },
        [morphStiffness, reducedMotion]
    )

    useEffect(() => {
        updateIndicatorTarget(targetIndex)
    }, [targetIndex, updateIndicatorTarget, safeMenuItems])

    useEffect(() => {
        if (reducedMotion) return
        if (!inView) return
        if (typeof window === "undefined") return
        if (settleTimeoutRef.current != null) {
            window.clearTimeout(settleTimeoutRef.current)
        }
        settleTimeoutRef.current = window.setTimeout(() => {
            setIndicatorStretch(1)
        }, 80)
        return () => {
            if (
                typeof window !== "undefined" &&
                settleTimeoutRef.current != null
            ) {
                window.clearTimeout(settleTimeoutRef.current)
            }
        }
    }, [indicatorX, indicatorWidth, inView, reducedMotion])

    const measureAll = useCallback(() => {
        updateIndicatorTarget(targetIndex)
    }, [targetIndex, updateIndicatorTarget])

    const measureContainer = useCallback(() => {
        const nextWidth = containerRef.current?.clientWidth ?? 1200
        setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth))
    }, [])

    useEffect(() => {
        if (typeof window === "undefined") return
        const rafA = window.requestAnimationFrame(measureAll)
        const rafB = window.requestAnimationFrame(() => {
            window.requestAnimationFrame(measureAll)
        })
        return () => {
            window.cancelAnimationFrame(rafA)
            window.cancelAnimationFrame(rafB)
        }
    }, [measureAll, safeMenuItems, logoText, ctaLabel])

    useEffect(() => {
        if (typeof window === "undefined") return
        const onResize = () => measureAll()
        window.addEventListener("resize", onResize)
        if (typeof ResizeObserver !== "undefined") {
            resizeObserverRef.current?.disconnect()
            resizeObserverRef.current = new ResizeObserver(() => measureAll())
            if (menuRailRef.current)
                resizeObserverRef.current.observe(menuRailRef.current)
            itemRefs.current.forEach((node) => {
                if (node) resizeObserverRef.current?.observe(node)
            })
        }
        return () => {
            window.removeEventListener("resize", onResize)
            resizeObserverRef.current?.disconnect()
        }
    }, [measureAll, safeMenuItems])

    useEffect(() => {
        if (typeof window === "undefined") return
        measureContainer()
        if (typeof ResizeObserver !== "undefined") {
            containerObserverRef.current?.disconnect()
            containerObserverRef.current = new ResizeObserver(() => {
                measureContainer()
            })
            if (containerRef.current)
                containerObserverRef.current.observe(containerRef.current)
        }
        const onResize = () => measureContainer()
        window.addEventListener("resize", onResize)
        return () => {
            window.removeEventListener("resize", onResize)
            containerObserverRef.current?.disconnect()
        }
    }, [measureContainer])

    useEffect(() => {
        if (typeof document !== "undefined" && (document as any).fonts?.ready) {
            ;(document as any).fonts.ready.then(() => measureAll())
        }
    }, [measureAll])

    // In-view tracking (replaces framer-motion useInView).
    useEffect(() => {
        if (typeof window === "undefined") return
        const node = navRef.current
        if (!node || typeof IntersectionObserver === "undefined") return
        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { rootMargin: "-20% 0px -20% 0px" }
        )
        observer.observe(node)
        return () => observer.disconnect()
    }, [])

    useEffect(() => {
        if (!contractOnScroll) {
            setIsContracted(false)
            return
        }
        if (typeof window === "undefined") return
        let ticking = false
        const threshold = 18
        const onScroll = () => {
            if (ticking) return
            ticking = true
            window.requestAnimationFrame(() => {
                const next = window.scrollY > threshold
                setIsContracted((prev) => (prev === next ? prev : next))
                ticking = false
            })
        }
        window.addEventListener("scroll", onScroll, { passive: true })
        onScroll()
        return () => window.removeEventListener("scroll", onScroll)
    }, [contractOnScroll])

    useEffect(() => {
        if (!isCompactMode && isMenuOpen) setIsMenuOpen(false)
    }, [isCompactMode, isMenuOpen])

    const selectActive = useCallback(
        (index: number) => {
            if (!isControlled) setInternalActive(index)
            onActiveIndexChange?.(index, safeMenuItems[index])
        },
        [isControlled, onActiveIndexChange, safeMenuItems]
    )

    const responsiveFactor = isPhone ? 0.72 : isTablet ? 0.86 : 1
    const dynamicBlur =
        (contractOnScroll && isContracted ? blurIntensity + 8 : blurIntensity) *
        (isPhone ? 0.92 : isTablet ? 0.96 : 1)
    const currentPaddingY =
        (contractOnScroll && isContracted ? 8 : 12) * responsiveFactor
    const currentPaddingX =
        (contractOnScroll && isContracted ? 16 : 20) * responsiveFactor
    const currentMarginX =
        (contractOnScroll && isContracted ? 10 : 16) * responsiveFactor
    const currentScale = contractOnScroll && isContracted ? 0.985 : 1
    const navGap = isPhone ? 6 : isTablet ? 8 : 12
    const railGap = isPhone ? 1 : isTablet ? 2 : 4
    const railPadding = isPhone ? 1 : 2
    const logoSize = isPhone ? 26 : isTablet ? 30 : 34
    const itemPadding = isPhone ? "8px 10px" : isTablet ? "9px 12px" : "10px 14px"
    const ctaPadding = isPhone ? "8px 10px" : isTablet ? "9px 12px" : "10px 14px"

    const navTransition = reducedMotion
        ? "none"
        : "transform 0.5s cubic-bezier(.34,1.56,.64,1), margin 0.5s cubic-bezier(.34,1.56,.64,1)"

    const indicatorTransition = reducedMotion
        ? "none"
        : "transform 0.45s cubic-bezier(.34,1.56,.64,1), width 0.5s cubic-bezier(.34,1.56,.64,1)"

    const defaultRenderLink = useCallback(
        (
            href: string,
            children: ReactNode,
            linkProps: {
                role?: string
                style?: CSSProperties
                onClick?: () => void
            }
        ): ReactNode => (
            <a href={href || "/"} {...linkProps}>
                {children}
            </a>
        ),
        []
    )
    const linkRenderer = renderLink || defaultRenderLink

    return (
        <div
            ref={containerRef}
            className={className}
            style={{
                position: "relative",
                width: "100%",
                maxWidth: "100%",
                boxSizing: "border-box",
                paddingTop: 10,
                overflowX: "clip",
                ...style,
            }}
        >
            <nav
                ref={navRef}
                aria-label="Primary"
                style={{
                    position: "sticky",
                    top: isPhone ? 8 : 12,
                    zIndex: 30,
                    width: isPhone || isTablet ? "100%" : "auto",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    borderRadius: 999,
                    padding: `${currentPaddingY}px ${currentPaddingX}px`,
                    marginLeft: currentMarginX,
                    marginRight: currentMarginX,
                    transform: `scale(${currentScale})`,
                    transition: navTransition,
                    background: barBackground,
                    backdropFilter: `blur(${dynamicBlur}px)`,
                    WebkitBackdropFilter: `blur(${dynamicBlur}px)`,
                    boxShadow:
                        "0 12px 30px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.16)",
                    display: "grid",
                    gridTemplateColumns: isCompactMode
                        ? "1fr auto"
                        : "1fr auto 1fr",
                    alignItems: "center",
                    gap: navGap,
                    overflow: isCompactMode ? "visible" : "hidden",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        justifySelf: "start",
                        minWidth: 0,
                    }}
                >
                    {logo?.src ? (
                        <img
                            src={logo.src}
                            srcSet={logo.srcSet}
                            alt={logo.alt || "Logo"}
                            style={{
                                width: logoSize,
                                height: logoSize,
                                borderRadius: 999,
                                objectFit: "cover",
                                boxShadow: "0 6px 16px rgba(0,0,0,0.22)",
                            }}
                        />
                    ) : (
                        <span
                            style={{
                                color: textColor,
                                minWidth: "max-content",
                                fontSize: scaleFontValue(
                                    logoFont?.fontSize,
                                    responsiveFactor
                                ),
                                lineHeight: logoFont?.lineHeight,
                                letterSpacing: logoFont?.letterSpacing,
                                textAlign: logoFont?.textAlign,
                                fontWeight: logoFont?.fontWeight,
                                fontFamily: logoFont?.fontFamily,
                                fontStyle: logoFont?.fontStyle,
                            }}
                        >
                            {logoText}
                        </span>
                    )}
                </div>

                <div
                    ref={menuRailRef}
                    style={{
                        display: isCompactMode ? "none" : "flex",
                        position: "relative",
                        alignItems: "center",
                        gap: railGap,
                        justifySelf: "center",
                        padding: railPadding,
                        minWidth: 0,
                    }}
                >
                    <div
                        aria-hidden
                        style={{
                            position: "absolute",
                            left: 0,
                            top: 2,
                            bottom: 2,
                            width: indicatorWidth,
                            transform: `translateX(${indicatorX}px) scaleX(${
                                inView ? indicatorStretch : 1
                            })`,
                            transition: indicatorTransition,
                            borderRadius: 999,
                            transformOrigin: "center center",
                            background: `linear-gradient(135deg, rgba(255,255,255,0.65) 0%, ${indicatorColor} 45%, rgba(255,255,255,0.38) 100%)`,
                            boxShadow: `0 8px 20px rgba(0,0,0,0.35), 0 0 14px ${indicatorColor}55, inset 0 1px 0 rgba(255,255,255,0.7)`,
                            filter: "saturate(1.08) blur(0.25px)",
                            pointerEvents: "none",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                                borderRadius: 999,
                                background:
                                    "radial-gradient(circle at 22% 26%, rgba(255,255,255,0.78), rgba(255,255,255,0.08) 52%, rgba(255,255,255,0) 70%)",
                                mixBlendMode: "screen",
                            }}
                        />
                    </div>

                    {safeMenuItems.map((item, index) => {
                        const isCurrent = index === currentActive
                        const isHovered = hoveredIndex === index
                        return (
                            <a
                                key={`${item.label}-${index}`}
                                ref={(node) => {
                                    itemRefs.current[index] = node
                                }}
                                href={item.link || "#"}
                                onMouseEnter={() => setHoveredIndex(index)}
                                onMouseLeave={() => setHoveredIndex(null)}
                                onFocus={() => setHoveredIndex(index)}
                                onBlur={() => setHoveredIndex(null)}
                                onClick={() => selectActive(index)}
                                style={{
                                    position: "relative",
                                    zIndex: 2,
                                    textDecoration: "none",
                                    color: textColor,
                                    padding: itemPadding,
                                    borderRadius: 999,
                                    whiteSpace: "nowrap",
                                    minWidth: "max-content",
                                    fontSize: scaleFontValue(
                                        menuFont?.fontSize,
                                        responsiveFactor
                                    ),
                                    lineHeight: menuFont?.lineHeight,
                                    letterSpacing: menuFont?.letterSpacing,
                                    textAlign: menuFont?.textAlign,
                                    fontWeight: menuFont?.fontWeight,
                                    fontFamily: menuFont?.fontFamily,
                                    fontStyle: menuFont?.fontStyle,
                                    opacity: isCurrent ? 1 : 0.9,
                                    transform:
                                        isHovered && !reducedMotion
                                            ? "translateY(-1.5px)"
                                            : "translateY(0)",
                                    filter:
                                        isHovered && !reducedMotion
                                            ? "brightness(1.1)"
                                            : "none",
                                    transition: reducedMotion
                                        ? "none"
                                        : "transform 0.25s cubic-bezier(.34,1.56,.64,1), filter 0.25s ease",
                                }}
                            >
                                {item.label}
                            </a>
                        )
                    })}
                </div>

                <div style={{ justifySelf: "end" }}>
                    {isCompactMode ? (
                        <button
                            aria-label={
                                isMenuOpen
                                    ? "Close navigation menu"
                                    : "Open navigation menu"
                            }
                            aria-expanded={isMenuOpen}
                            onClick={() => setIsMenuOpen((prev) => !prev)}
                            style={{
                                border: "1px solid rgba(255,255,255,0.24)",
                                background: "rgba(255,255,255,0.08)",
                                color: textColor,
                                borderRadius: 999,
                                padding: "8px 12px",
                                minWidth: "max-content",
                                cursor: "pointer",
                                fontSize: scaleFontValue(menuFont?.fontSize, 0.88),
                                lineHeight: menuFont?.lineHeight,
                                letterSpacing: menuFont?.letterSpacing,
                                fontWeight: menuFont?.fontWeight,
                                fontFamily: menuFont?.fontFamily,
                                fontStyle: menuFont?.fontStyle,
                            }}
                        >
                            {"☰"}
                        </button>
                    ) : (
                        linkRenderer(ctaLink || "/", ctaLabel, {
                            role: "button",
                            style: {
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                textDecoration: "none",
                                color: "#000000",
                                background: "#FFFFFF",
                                padding: ctaPadding,
                                borderRadius: 999,
                                border: "1px solid rgba(255,255,255,0.5)",
                                boxShadow: "0 8px 18px rgba(0,0,0,0.24)",
                                minWidth: "max-content",
                                fontSize: scaleFontValue(
                                    ctaFont?.fontSize,
                                    responsiveFactor
                                ),
                                lineHeight: ctaFont?.lineHeight,
                                letterSpacing: ctaFont?.letterSpacing,
                                fontWeight: ctaFont?.fontWeight,
                                fontFamily: ctaFont?.fontFamily,
                                fontStyle: ctaFont?.fontStyle,
                            },
                        })
                    )}
                </div>

                {isCompactMode && isMenuOpen ? (
                    <div
                        role="menu"
                        aria-label="Navigation menu"
                        style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            left: 0,
                            right: 0,
                            borderRadius: 18,
                            padding: 8,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                            background: barBackground,
                            backdropFilter: `blur(${dynamicBlur}px)`,
                            WebkitBackdropFilter: `blur(${dynamicBlur}px)`,
                            border: "1px solid rgba(255,255,255,0.16)",
                            boxShadow: "0 14px 30px rgba(0,0,0,0.32)",
                            boxSizing: "border-box",
                            overflow: "hidden",
                        }}
                    >
                        {safeMenuItems.map((item, index) => {
                            const isCurrent = index === currentActive
                            return (
                                <a
                                    key={`compact-${item.label}-${index}`}
                                    role="menuitem"
                                    href={item.link || "#"}
                                    onClick={() => {
                                        selectActive(index)
                                        setIsMenuOpen(false)
                                    }}
                                    style={{
                                        textDecoration: "none",
                                        color: textColor,
                                        borderRadius: 12,
                                        padding: "10px 12px",
                                        background: isCurrent
                                            ? "rgba(255,255,255,0.14)"
                                            : "transparent",
                                        fontSize: scaleFontValue(
                                            menuFont?.fontSize,
                                            0.9
                                        ),
                                        lineHeight: menuFont?.lineHeight,
                                        letterSpacing: menuFont?.letterSpacing,
                                        textAlign: "left",
                                        fontWeight: menuFont?.fontWeight,
                                        fontFamily: menuFont?.fontFamily,
                                        fontStyle: menuFont?.fontStyle,
                                        whiteSpace: "nowrap",
                                        width: "100%",
                                        boxSizing: "border-box",
                                    }}
                                >
                                    {item.label}
                                </a>
                            )
                        })}
                        {linkRenderer(ctaLink || "/", ctaLabel, {
                            role: "menuitem",
                            onClick: () => setIsMenuOpen(false),
                            style: {
                                display: "block",
                                textDecoration: "none",
                                color: "#000000",
                                background: "#FFFFFF",
                                borderRadius: 12,
                                padding: "10px 12px",
                                marginTop: 4,
                                fontSize: scaleFontValue(ctaFont?.fontSize, 0.9),
                                lineHeight: ctaFont?.lineHeight,
                                letterSpacing: ctaFont?.letterSpacing,
                                textAlign: "center",
                                fontWeight: ctaFont?.fontWeight,
                                fontFamily: ctaFont?.fontFamily,
                                fontStyle: ctaFont?.fontStyle,
                                width: "100%",
                                boxSizing: "border-box",
                                boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
                            },
                        })}
                    </div>
                ) : null}
            </nav>
        </div>
    )
}

/**
 * Tracks `prefers-reduced-motion: reduce`. SSR-safe (returns false until mount).
 */
function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReduced(mq.matches)
        update()
        mq.addEventListener?.("change", update)
        return () => mq.removeEventListener?.("change", update)
    }, [])
    return reduced
}
