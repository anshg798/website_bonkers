import {
    type CSSProperties,
    type FormEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"

/** A single footer link. Exported for typing consumer-supplied arrays. */
export interface FooterLinkItem {
    label: string
    href: string
}

/** A titled column of footer links. */
export interface FooterLinkColumn {
    title: string
    links: FooterLinkItem[]
}

/** Supported social platform identifiers (drives the built-in icon set). */
export type FooterSocialPlatform =
    | "X"
    | "Instagram"
    | "LinkedIn"
    | "GitHub"
    | "YouTube"
    | "Facebook"
    | "Dribbble"
    | "Threads"

/** A social link with platform (icon), label and href. */
export interface FooterSocialItem {
    platform: FooterSocialPlatform
    label: string
    href: string
}

export interface FooterProps {
    /** Brand wordmark text (also used for the oversized background wordmark). */
    wordmark?: string
    /** Short brand tagline paragraph. */
    tagline?: string
    /** Show the newsletter signup form. */
    showNewsletter?: boolean
    /** Newsletter label text. */
    newsletterLabel?: string
    /** Newsletter input placeholder. */
    newsletterPlaceholder?: string
    /** Optional form action URL; navigated to on a valid submit. */
    newsletterAction?: string
    /** Link columns. */
    linkColumns?: FooterLinkColumn[]
    /** Social links. */
    socials?: FooterSocialItem[]
    /** Legal/footer-bottom links. */
    legalLinks?: FooterLinkItem[]
    /** Copyright line. */
    copyright?: string
    /** Show the locale selector button. */
    showLocale?: boolean
    /** Locale button label. */
    localeLabel?: string
    /** Show the oversized background wordmark. */
    showBigWordmark?: boolean
    /** Animate the big wordmark on scroll into view. */
    wordmarkReveal?: boolean
    /** Accent color (brand dot, button, focus ring). */
    accentColor?: string
    /** Footer background color. */
    backgroundColor?: string
    /** Primary text color. */
    textColor?: string
    /** Called with the email when the newsletter form is submitted. */
    onNewsletterSubmit?: (email: string) => void
    /** Called when the locale button is clicked. */
    onLocaleClick?: () => void
    style?: CSSProperties
    className?: string
}

const DEFAULT_LINK_COLUMNS: FooterLinkColumn[] = [
    {
        title: "Product",
        links: [
            { label: "Overview", href: "/" },
            { label: "Features", href: "/" },
            { label: "Integrations", href: "/" },
            { label: "Pricing", href: "/" },
            { label: "Changelog", href: "/" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "About", href: "/" },
            { label: "Careers", href: "/" },
            { label: "Blog", href: "/" },
            { label: "Press", href: "/" },
        ],
    },
    {
        title: "Resources",
        links: [
            { label: "Documentation", href: "/" },
            { label: "Community", href: "/" },
            { label: "Support", href: "/" },
            { label: "Status", href: "/" },
        ],
    },
]

const DEFAULT_SOCIALS: FooterSocialItem[] = [
    { platform: "X", label: "X", href: "https://x.com" },
    { platform: "Instagram", label: "Instagram", href: "https://instagram.com" },
    { platform: "LinkedIn", label: "LinkedIn", href: "https://linkedin.com" },
    { platform: "GitHub", label: "GitHub", href: "https://github.com" },
    { platform: "YouTube", label: "YouTube", href: "https://youtube.com" },
]

const DEFAULT_LEGAL_LINKS: FooterLinkItem[] = [
    { label: "Privacy", href: "/" },
    { label: "Terms", href: "/" },
    { label: "Cookies", href: "/" },
]

function renderSocialIcon(platform: string): ReactNode {
    const common = {
        width: 18,
        height: 18,
        viewBox: "0 0 24 24",
        fill: "none",
        xmlns: "http://www.w3.org/2000/svg",
        "aria-hidden": true,
    } as const

    switch (platform) {
        case "X":
            return (
                <svg {...common}>
                    <path
                        d="M18.9 3H22l-6.8 7.8L23.2 21h-6.3l-4.9-6.3L6.5 21H3.4l7.3-8.3L1 3h6.5l4.4 5.8L18.9 3Z"
                        fill="white"
                    />
                </svg>
            )
        case "Instagram":
            return (
                <svg {...common}>
                    <rect
                        x="3.5"
                        y="3.5"
                        width="17"
                        height="17"
                        rx="5"
                        stroke="white"
                        strokeWidth="1.8"
                    />
                    <circle
                        cx="12"
                        cy="12"
                        r="4"
                        stroke="white"
                        strokeWidth="1.8"
                    />
                    <circle cx="17.3" cy="6.7" r="1.2" fill="white" />
                </svg>
            )
        case "LinkedIn":
            return (
                <svg {...common}>
                    <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                        stroke="white"
                        strokeWidth="1.8"
                    />
                    <path
                        d="M8 10.2V16M8 8.2V8.25M11.5 16V10.2H15.1C16.2 10.2 17 11 17 12.1V16"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                </svg>
            )
        case "GitHub":
            return (
                <svg {...common}>
                    <path
                        d="M12 3.2A8.8 8.8 0 0 0 3.2 12c0 3.9 2.5 7.2 5.9 8.3.4.1.6-.2.6-.5v-2c-2.4.5-2.9-1-2.9-1-.4-1-.9-1.3-.9-1.3-.8-.5 0-.5 0-.5.9.1 1.4.9 1.4.9.8 1.4 2.1 1 2.6.8.1-.6.3-1 .6-1.2-1.9-.2-3.9-.9-3.9-4.2 0-.9.3-1.7.9-2.3-.1-.2-.4-1.1.1-2.2 0 0 .7-.2 2.4.9a8.3 8.3 0 0 1 4.3 0c1.7-1.1 2.4-.9 2.4-.9.5 1.1.2 2 .1 2.2.6.6.9 1.4.9 2.3 0 3.2-2 4-3.9 4.2.3.3.6.8.6 1.6v2.4c0 .3.2.6.6.5A8.8 8.8 0 0 0 20.8 12 8.8 8.8 0 0 0 12 3.2Z"
                        fill="white"
                    />
                </svg>
            )
        case "YouTube":
            return (
                <svg {...common}>
                    <rect
                        x="3"
                        y="6"
                        width="18"
                        height="12"
                        rx="3"
                        stroke="white"
                        strokeWidth="1.8"
                    />
                    <path d="M10 9.6L15.2 12 10 14.4V9.6Z" fill="white" />
                </svg>
            )
        case "Facebook":
            return (
                <svg {...common}>
                    <path
                        d="M13.7 21V13.2H16.3L16.7 10.2H13.7V8.4C13.7 7.5 14 6.8 15.3 6.8H16.8V4.1C16.5 4.1 15.7 4 14.7 4C12.4 4 10.9 5.4 10.9 8V10.2H8.3V13.2H10.9V21H13.7Z"
                        fill="white"
                    />
                </svg>
            )
        case "Dribbble":
            return (
                <svg {...common}>
                    <circle
                        cx="12"
                        cy="12"
                        r="8.5"
                        stroke="white"
                        strokeWidth="1.8"
                    />
                    <path
                        d="M6 8.5C9.5 8.2 12.4 9.2 14.8 11.7M9.2 5.3C11.8 8.2 13.8 11.7 15 16.7M5.4 14.3C8.1 13.3 11.5 13.1 16.3 14.1M12 3.5C14.4 6.8 15.9 10.3 16.7 14.7"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                    />
                </svg>
            )
        case "Threads":
            return (
                <svg {...common}>
                    <path
                        d="M14.3 11.2C13.9 11 13.4 10.8 12.8 10.7C12.7 9.6 12.2 8.8 11.1 8.8C10 8.8 9.3 9.6 9.3 10.7C9.3 12 10.2 12.7 11.8 13.2C13.5 13.7 14.2 14.4 14.2 15.5C14.2 16.7 13.2 17.5 11.7 17.5C10.2 17.5 9.2 16.8 8.8 15.5M15.8 10.5C15.7 7.7 13.9 6 11 6C8 6 6 8.1 6 11.2C6 14.6 8.2 17 11.8 17C15.1 17 17 15 17 12.3C17 10.7 16.5 9.5 15.2 8.7"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                </svg>
            )
        default:
            return (
                <svg {...common}>
                    <circle
                        cx="12"
                        cy="12"
                        r="8.5"
                        stroke="white"
                        strokeWidth="1.8"
                    />
                    <path
                        d="M3.8 12H20.2M12 3.8C14.3 6 15.6 9 15.6 12C15.6 15 14.3 18 12 20.2M12 3.8C9.7 6 8.4 9 8.4 12C8.4 15 9.7 18 12 20.2"
                        stroke="white"
                        strokeWidth="1.5"
                    />
                </svg>
            )
    }
}

/** Anchor that brightens its color on hover/focus (replaces motion `whileHover`). */
function HoverLink({
    href,
    style,
    hoverColor = "#FFFFFF",
    children,
}: {
    href: string
    style: CSSProperties
    hoverColor?: string
    children: ReactNode
}) {
    const [hover, setHover] = useState(false)
    return (
        <a
            href={href}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
            style={{
                ...style,
                color: hover ? hoverColor : (style.color as string),
                transition: "color 0.2s ease",
            }}
        >
            {children}
        </a>
    )
}

/**
 * Footer — a responsive dark footer with brand column, newsletter form, link
 * columns, social icons, legal row, locale button and an oversized background
 * wordmark that reveals (translate + fade) as it scrolls into view. Layout uses
 * container queries; the scroll reveal is driven by IntersectionObserver +
 * scroll progress rather than framer-motion `useScroll`.
 */
export const Footer = ({
    wordmark = "NEBULA",
    tagline = "Design systems and product tooling for teams who ship with taste. Built for the next decade of the web.",
    showNewsletter = true,
    newsletterLabel = "Stay in the loop",
    newsletterPlaceholder = "you@company.com",
    newsletterAction,
    linkColumns = DEFAULT_LINK_COLUMNS,
    socials = DEFAULT_SOCIALS,
    legalLinks = DEFAULT_LEGAL_LINKS,
    copyright = "© 2025 Nebula Labs, Inc.",
    showLocale = true,
    localeLabel = "English (US)",
    showBigWordmark = true,
    wordmarkReveal = true,
    accentColor = "#4D8DFF",
    backgroundColor = "#08090C",
    textColor = "#FFFFFF",
    onNewsletterSubmit,
    onLocaleClick,
    style,
    className,
}: FooterProps) => {
    const uid = useMemo(() => Math.random().toString(36).slice(2), [])
    const containerRef = useRef<HTMLElement | null>(null)
    const wordmarkMaskRef = useRef<HTMLDivElement | null>(null)
    const [revealProgress, setRevealProgress] = useState(0)

    const [newsletterEmail, setNewsletterEmail] = useState("")
    const [newsletterFeedback, setNewsletterFeedback] = useState("")
    const [localeHover, setLocaleHover] = useState(false)

    const socialsHoverBackground = "rgba(77, 141, 255, 0.18)"

    // Scroll reveal: map the mask's "start end" -> "end end" window to 0..1.
    useEffect(() => {
        if (!wordmarkReveal || typeof window === "undefined") return
        const node = wordmarkMaskRef.current
        if (!node) return
        let raf = 0
        const compute = () => {
            raf = 0
            const rect = node.getBoundingClientRect()
            const vh = window.innerHeight || 1
            // start: top at viewport bottom (progress 0); end: bottom at viewport bottom (progress 1)
            const denom = rect.height || 1
            const p = (vh - rect.top) / denom
            setRevealProgress(Math.max(0, Math.min(1, p)))
        }
        const onScroll = () => {
            if (!raf) raf = window.requestAnimationFrame(compute)
        }
        compute()
        window.addEventListener("scroll", onScroll, { passive: true })
        window.addEventListener("resize", onScroll)
        return () => {
            window.removeEventListener("scroll", onScroll)
            window.removeEventListener("resize", onScroll)
            if (raf) window.cancelAnimationFrame(raf)
        }
    }, [wordmarkReveal])

    const handleNewsletterSubmit = useCallback(
        (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            const trimmed = newsletterEmail.trim()
            setNewsletterFeedback(
                trimmed.length > 0
                    ? "Thanks — you’re on the list."
                    : "Please enter an email address."
            )
            if (trimmed.length > 0) {
                onNewsletterSubmit?.(trimmed)
                if (newsletterAction && typeof window !== "undefined") {
                    window.location.assign(newsletterAction)
                }
            }
        },
        [newsletterAction, newsletterEmail, onNewsletterSubmit]
    )

    const resolveHref = useCallback((href?: string) => {
        if (typeof href === "string" && href.trim().length > 0) return href
        return "#"
    }, [])

    const resolvedLinkColumns = useMemo(() => {
        const sourceColumns =
            Array.isArray(linkColumns) && linkColumns.length > 0
                ? linkColumns
                : DEFAULT_LINK_COLUMNS
        return sourceColumns.map((column, index) => {
            const links =
                Array.isArray(column.links) && column.links.length > 0
                    ? column.links
                    : (DEFAULT_LINK_COLUMNS[index]?.links ?? [])
            return { ...column, links }
        })
    }, [linkColumns])

    // Reveal transforms (useTransform equivalents).
    const wordmarkTranslateY = wordmarkReveal
        ? `${110 - revealProgress * 110}%`
        : "0%"
    const wordmarkOpacity = wordmarkReveal
        ? revealProgress < 0.2
            ? (revealProgress / 0.2) * 0.5
            : 0.5 + ((revealProgress - 0.2) / 0.8) * 0.5
        : 1

    return (
        <footer
            ref={containerRef}
            className={className}
            style={{
                position: "relative",
                width: "100%",
                background: backgroundColor,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding:
                    "clamp(56px, 10cqw, 96px) clamp(16px, 5cqw, 48px) clamp(32px, 4cqw, 40px)",
                boxSizing: "border-box",
                overflowX: "hidden",
                containerType: "inline-size",
                ...style,
            }}
        >
            <style>{`
                .footer-root-${uid},
                .footer-root-${uid} * {
                    box-sizing: border-box;
                }
                .footer-top-region-${uid} {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    width: 100%;
                    gap: clamp(28px, 5cqw, 48px);
                    flex-direction: row;
                    flex-wrap: nowrap;
                }
                .footer-brand-column-${uid} {
                    width: min(380px, 100%);
                    max-width: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: clamp(20px, 2.5cqw, 28px);
                    flex-shrink: 0;
                }
                .footer-link-columns-${uid} {
                    display: grid;
                    align-items: flex-start;
                    gap: clamp(20px, 2.8cqw, 32px);
                    width: 100%;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                }
                .footer-newsletter-row-${uid} {
                    display: flex;
                    width: 100%;
                    gap: clamp(8px, 1.6cqw, 10px);
                    flex-direction: row;
                }
                .footer-tagline-${uid} {
                    text-wrap: balance;
                }
                .footer-big-wordmark-${uid} {
                    font-size: clamp(96px, 26cqw, 200px);
                }
                @container (max-width: 1023px) {
                    .footer-top-region-${uid} {
                        flex-direction: column;
                        gap: clamp(28px, 4.5cqw, 44px);
                        flex-wrap: wrap;
                    }
                    .footer-brand-column-${uid} {
                        width: 100%;
                    }
                    .footer-link-columns-${uid} {
                        grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
                    }
                    .footer-big-wordmark-${uid} {
                        font-size: min(180px, 20cqw);
                    }
                }
                @container (max-width: 599px) {
                    .footer-link-columns-${uid} {
                        grid-template-columns: 1fr;
                        gap: 28px;
                    }
                    .footer-newsletter-row-${uid} {
                        flex-direction: column;
                    }
                    .footer-big-wordmark-${uid} {
                        font-size: min(120px, 24cqw);
                    }
                }
                .footer-input-${uid}::placeholder {
                    color: rgba(255,255,255,0.35);
                }
                .footer-input-${uid}:focus {
                    border-color: ${accentColor};
                }
            `}</style>

            <div
                className={`footer-root-${uid}`}
                style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: "clamp(48px, 7cqw, 72px)",
                }}
            >
                <div className={`footer-top-region-${uid}`}>
                    <div className={`footer-brand-column-${uid}`}>
                        <div
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "clamp(9px, 1.2cqw, 12px)",
                            }}
                        >
                            <div
                                style={{
                                    width: 14,
                                    height: 14,
                                    borderRadius: 4,
                                    background: accentColor,
                                    flexShrink: 0,
                                }}
                            />
                            <div
                                style={{
                                    fontFamily:
                                        '"Clash Grotesk", "Inter", sans-serif',
                                    fontWeight: 600,
                                    fontSize: "clamp(16px, 2.4cqw, 20px)",
                                    letterSpacing: "0.01em",
                                    lineHeight: 1,
                                    color: textColor,
                                }}
                            >
                                {wordmark}
                            </div>
                        </div>

                        <p
                            className={`footer-tagline-${uid}`}
                            style={{
                                margin: 0,
                                fontFamily: '"Inter", sans-serif',
                                fontWeight: 400,
                                fontSize: "clamp(13px, 1.9cqw, 15px)",
                                lineHeight: 1.6,
                                color: "rgba(255,255,255,0.55)",
                            }}
                        >
                            {tagline}
                        </p>

                        {showNewsletter && (
                            <form
                                action={newsletterAction || undefined}
                                method="post"
                                onSubmit={handleNewsletterSubmit}
                                style={{
                                    width: "100%",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "clamp(9px, 1.4cqw, 12px)",
                                }}
                            >
                                <label
                                    style={{
                                        fontFamily: '"Inter", sans-serif',
                                        fontWeight: 500,
                                        fontSize: "clamp(11px, 1.6cqw, 13px)",
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                        color: "rgba(255,255,255,0.7)",
                                    }}
                                >
                                    {newsletterLabel}
                                </label>
                                <div className={`footer-newsletter-row-${uid}`}>
                                    <input
                                        className={`footer-input-${uid}`}
                                        type="email"
                                        placeholder={newsletterPlaceholder}
                                        value={newsletterEmail}
                                        required
                                        onChange={(event) => {
                                            const value = event.target.value
                                            setNewsletterEmail(value)
                                            if (newsletterFeedback)
                                                setNewsletterFeedback("")
                                        }}
                                        style={{
                                            flex: 1,
                                            minWidth: 0,
                                            height: 48,
                                            padding: "12px 14px",
                                            border: "1px solid rgba(255,255,255,0.1)",
                                            background: "rgba(255,255,255,0.05)",
                                            borderRadius: 12,
                                            fontFamily: '"Inter", sans-serif',
                                            fontWeight: 400,
                                            fontSize: 15,
                                            color: "#fff",
                                            outlineColor: accentColor,
                                            boxSizing: "border-box",
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        aria-label="Submit newsletter email"
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: 12,
                                            border: "none",
                                            background: accentColor,
                                            color: "#FFFFFF",
                                            fontSize: 18,
                                            cursor: "pointer",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flexShrink: 0,
                                        }}
                                    >
                                        {"→"}
                                    </button>
                                </div>
                                {newsletterFeedback && (
                                    <div
                                        role="status"
                                        aria-live="polite"
                                        style={{
                                            fontFamily: '"Inter", sans-serif',
                                            fontWeight: 400,
                                            fontSize: 13,
                                            lineHeight: 1.4,
                                            color: "rgba(255,255,255,0.72)",
                                        }}
                                    >
                                        {newsletterFeedback}
                                    </div>
                                )}
                            </form>
                        )}
                    </div>

                    <div className={`footer-link-columns-${uid}`}>
                        {resolvedLinkColumns.map((column, index) => (
                            <div
                                key={`${column.title}-${index}`}
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "clamp(12px, 1.6cqw, 16px)",
                                }}
                            >
                                <div
                                    style={{
                                        fontFamily: '"Inter", sans-serif',
                                        fontWeight: 600,
                                        fontSize: "clamp(11px, 1.4cqw, 12px)",
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        color: "rgba(255,255,255,0.4)",
                                    }}
                                >
                                    {column.title}
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "clamp(9px, 1.4cqw, 12px)",
                                    }}
                                >
                                    {(Array.isArray(column.links)
                                        ? column.links
                                        : []
                                    ).map((link, linkIndex) => (
                                        <HoverLink
                                            key={`${link.label}-${linkIndex}`}
                                            href={resolveHref(link.href)}
                                            style={{
                                                fontFamily:
                                                    '"Inter", sans-serif',
                                                fontWeight: 400,
                                                fontSize:
                                                    "clamp(13px, 1.9cqw, 15px)",
                                                lineHeight: 1.2,
                                                color: "rgba(255,255,255,0.55)",
                                                textDecoration: "none",
                                            }}
                                        >
                                            {link.label}
                                        </HoverLink>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div
                    style={{
                        display: "flex",
                        gap: "clamp(9px, 1.4cqw, 12px)",
                        alignItems: "center",
                        flexWrap: "wrap",
                    }}
                >
                    {socials.map((social, index) => (
                        <SocialTile
                            key={`${social.platform}-${index}`}
                            href={resolveHref(social.href)}
                            label={social.label || social.platform}
                            hoverBackground={socialsHoverBackground}
                        >
                            {renderSocialIcon(social.platform)}
                        </SocialTile>
                    ))}
                </div>

                <div
                    style={{
                        width: "100%",
                        height: 1,
                        background: "rgba(255,255,255,0.08)",
                    }}
                />

                {showBigWordmark && (
                    <div
                        ref={wordmarkMaskRef}
                        style={{
                            width: "100%",
                            overflowX: "clip",
                            overflowY: "clip",
                            display: "flex",
                            justifyContent: "center",
                            paddingTop: "0.12em",
                            paddingBottom: "0.12em",
                        }}
                    >
                        <div
                            className={`footer-big-wordmark-${uid}`}
                            style={{
                                fontFamily:
                                    '"Clash Grotesk", "Inter", sans-serif',
                                fontWeight: 900,
                                letterSpacing: "-0.04em",
                                lineHeight: 1.15,
                                textAlign: "center",
                                color: "rgba(255,255,255,0.06)",
                                userSelect: "none",
                                whiteSpace: "nowrap",
                                transform: `translateY(${wordmarkTranslateY})`,
                                opacity: wordmarkOpacity,
                                willChange: wordmarkReveal
                                    ? "transform, opacity"
                                    : undefined,
                            }}
                        >
                            {wordmark}
                        </div>
                    </div>
                )}

                <div
                    style={{
                        width: "100%",
                        borderTop: "1px solid rgba(255,255,255,0.08)",
                        paddingTop: "clamp(22px, 3cqw, 28px)",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                        gap: "clamp(12px, 2cqw, 16px)",
                    }}
                >
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "clamp(16px, 3cqw, 24px)",
                            flexWrap: "wrap",
                        }}
                    >
                        <div
                            style={{
                                fontFamily: '"Inter", sans-serif',
                                fontWeight: 400,
                                fontSize: "clamp(12px, 1.8cqw, 14px)",
                                color: "rgba(255,255,255,0.4)",
                            }}
                        >
                            {copyright}
                        </div>
                        {legalLinks.map((link, index) => (
                            <HoverLink
                                key={`${link.label}-${index}`}
                                href={resolveHref(link.href)}
                                style={{
                                    fontFamily: '"Inter", sans-serif',
                                    fontWeight: 400,
                                    fontSize: "clamp(12px, 1.8cqw, 14px)",
                                    color: "rgba(255,255,255,0.55)",
                                    textDecoration: "none",
                                }}
                            >
                                {link.label}
                            </HoverLink>
                        ))}
                    </div>

                    {showLocale && (
                        <button
                            type="button"
                            onClick={onLocaleClick}
                            onMouseEnter={() => setLocaleHover(true)}
                            onMouseLeave={() => setLocaleHover(false)}
                            onFocus={() => setLocaleHover(true)}
                            onBlur={() => setLocaleHover(false)}
                            style={{
                                border: "1px solid rgba(255,255,255,0.1)",
                                background: localeHover
                                    ? "rgba(255,255,255,0.09)"
                                    : "rgba(255,255,255,0.05)",
                                borderRadius: 10,
                                padding: "8px 12px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 8,
                                cursor: "pointer",
                                color: "rgba(255,255,255,0.75)",
                                transition: "background 0.2s ease",
                            }}
                            aria-label={localeLabel}
                        >
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                aria-hidden
                            >
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="8.5"
                                    stroke="white"
                                    strokeOpacity="0.75"
                                    strokeWidth="1.6"
                                />
                                <path
                                    d="M3.8 12H20.2M12 3.8C14.3 6 15.6 9 15.6 12C15.6 15 14.3 18 12 20.2M12 3.8C9.7 6 8.4 9 8.4 12C8.4 15 9.7 18 12 20.2"
                                    stroke="white"
                                    strokeOpacity="0.75"
                                    strokeWidth="1.3"
                                />
                            </svg>
                            <span
                                style={{
                                    fontFamily: '"Inter", sans-serif',
                                    fontWeight: 500,
                                    fontSize: "clamp(12px, 1.8cqw, 14px)",
                                    color: "rgba(255,255,255,0.75)",
                                }}
                            >
                                {localeLabel}
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </footer>
    )
}

/** Square social tile that scales up + tints on hover (replaces `whileHover`). */
function SocialTile({
    href,
    label,
    hoverBackground,
    children,
}: {
    href: string
    label: string
    hoverBackground: string
    children: ReactNode
}) {
    const [hover, setHover] = useState(false)
    return (
        <a
            href={href}
            aria-label={label}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            onFocus={() => setHover(true)}
            onBlur={() => setHover(false)}
            style={{
                width: "clamp(36px, 7cqw, 40px)",
                height: "clamp(36px, 7cqw, 40px)",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.1)",
                background: hover ? hoverBackground : "rgba(255,255,255,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
                color: "#FFFFFF",
                willChange: "transform",
                transform: hover ? "scale(1.15)" : "scale(1)",
                transition: "transform 0.3s ease, background 0.3s ease",
            }}
        >
            {children}
        </a>
    )
}
