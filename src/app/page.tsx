import Link from "next/link"
import {
  MessageCircle,
  Store,
  NotebookText,
  Zap,
  CheckCircle2,
  Users,
} from "lucide-react"
import { HeroBackdrop } from "@/components/landing/HeroBackdrop"

const NAV_LINKS = [
  { label: "Bring-Back", href: "#bring-back" },
  { label: "Storefront", href: "#storefront" },
  { label: "Khata", href: "#khata" },
  { label: "Billing", href: "#billing" },
]

const RECENT_TRANSACTIONS = [
  { name: "Ramesh Kumar", time: "Today, 14:32", amount: "₹1,245.00" },
  { name: "Priya Singh", time: "Today, 12:15", amount: "₹850.00" },
  { name: "Anil Patel", time: "Today, 10:45", amount: "₹3,420.00" },
]

const LOOP_STEPS = [
  {
    title: "Bill it, or just note it",
    body: "Every sale records who bought what. Bill the customers who need one — note the rest in five seconds. Either way, the customer is remembered.",
  },
  {
    title: "Your shop builds its own memory",
    body: "Names, numbers, what they bought, when they'll likely need it again. It builds itself while you work. No data entry, no spreadsheets.",
  },
  {
    title: "WhatsApp brings them back",
    body: "“Your tyres are due for a rotation check.” Sent at the right moment, on the app your customers already live in — and only to the ones who said yes.",
  },
  {
    title: "You see the rupees",
    body: "When they come back and buy, the sale is linked to the message that brought them. Your dashboard shows exactly how much came back this month.",
  },
]

const FEATURES = [
  {
    id: "bring-back",
    icon: MessageCircle,
    accent: "text-money",
    title: "WhatsApp Bring-Back — with ₹-proof",
    body: "Customers forget. Your shop doesn't. Automatic reminders fire at the right repurchase moment — oil at six months, uniforms before the school year, sweets before the festival. Then the dashboard shows the rupees that came back.",
    kicker: "No other billing app can show you that number.",
  },
  {
    id: "storefront",
    icon: Store,
    accent: "text-brand",
    title: "Your shop's own online store",
    body: "A real storefront your customers browse and order from on their phone. Your products, your name, your WhatsApp — not a marketplace where you compete with ten other shops. Orders land straight in your billing screen.",
  },
  {
    id: "khata",
    icon: NotebookText,
    accent: "text-info",
    title: "Digital khata",
    body: "Every udhaar tracked to the paisa. Polite payment reminders on WhatsApp with your UPI ID attached, so customers can pay in two taps. No awkward phone calls.",
  },
  {
    id: "billing",
    icon: Zap,
    accent: "text-brand",
    title: "GST billing, fast",
    body: "Keyboard-driven, barcode-ready, correct GST every time. Tax invoice or bill of supply, sequential numbering, GST report ready for your CA. The fastest part of your day.",
  },
]

const FOOTER_COLUMNS = [
  {
    heading: "Product",
    links: [
      { label: "Bring-Back", href: "#bring-back" },
      { label: "Storefront", href: "#storefront" },
      { label: "Khata", href: "#khata" },
      { label: "Billing", href: "#billing" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
]

export default function BharatGrowthLanding() {
  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      {/* Top nav */}
      <nav className="fixed top-0 z-50 w-full border-b border-white/5 bg-gray-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between px-6 py-4 lg:px-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-white">
            <span className="text-brand">Bharat</span>Growth
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-gray-400 transition-colors hover:text-white"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm text-gray-400 transition-colors hover:text-white sm:block"
            >
              Login
            </Link>
            <Link
              href="/onboarding"
              className="rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-gray-950 transition-colors hover:bg-orange-400"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative overflow-hidden px-6 pb-24 pt-36 lg:px-8">
        <HeroBackdrop />

        {/* Growth-line motif. Each SVG is two identical wave periods across a
         * 200%-wide box, so translating it by -50% lands on an identical
         * frame — the drift loops with no visible seam. */}
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 z-0 overflow-hidden opacity-30"
          aria-hidden="true"
        >
          <svg
            className="hero-wave h-32 w-[200%]"
            viewBox="0 0 2000 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,50 Q250,10 500,50 T1000,50 Q1250,10 1500,50 T2000,50"
              fill="none"
              stroke="#F97316"
              strokeWidth="1"
            />
          </svg>
          <svg
            className="hero-wave hero-wave--alt absolute inset-0 h-32 w-[200%]"
            viewBox="0 0 2000 100"
            preserveAspectRatio="none"
          >
            <path
              d="M0,60 Q250,90 500,60 T1000,60 Q1250,90 1500,60 T2000,60"
              fill="none"
              stroke="#10B981"
              strokeWidth="0.5"
              strokeDasharray="4 4"
            />
          </svg>
        </div>

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <h1 className="text-balance text-5xl font-bold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
            Your shop&apos;s fight back
            <br />
            <span className="text-brand">against online giants.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-gray-400 md:text-xl">
            BharatGrowth brings your customers back on WhatsApp — and proves it in
            rupees. Fast GST billing comes standard.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/onboarding"
              className="w-full rounded-lg bg-brand px-8 py-4 text-base font-bold text-gray-950 transition-colors hover:bg-orange-400 sm:w-auto"
            >
              Start free
            </Link>
            <a
              href="#the-loop"
              className="w-full rounded-lg border border-brand/50 px-8 py-4 text-base font-bold text-brand transition-colors hover:border-brand hover:bg-brand/5 sm:w-auto"
            >
              See how Bring-Back works
            </a>
          </div>
        </div>

        {/* POS terminal frame. Tilt is deliberately shallow — the panel's
         * contents are the pitch, so legibility wins over the angle. */}
        <div className="relative z-10 mx-auto mt-20 w-full max-w-6xl [perspective:1600px]">
          <div className="hero-mockup overflow-hidden rounded-xl border border-white/10 bg-gray-900">
            {/* Terminal chrome */}
            <div className="flex items-center justify-between border-b border-white/5 bg-gray-950 px-4 py-3">
              <div className="flex gap-2.5">
                <span className="h-3 w-3 rounded-full bg-white/20" />
                <span className="h-3 w-3 rounded-full bg-white/20" />
                <span className="h-3 w-3 rounded-full bg-white/20" />
              </div>
              <span className="font-mono text-xs tracking-widest text-white/40">
                POS_TERMINAL_V2.1.4
              </span>
            </div>

            {/* Terminal body */}
            <div className="flex flex-col gap-6 p-6 md:flex-row md:p-8">
              {/* Recent transactions */}
              <div className="flex flex-col rounded-xl border border-white/5 bg-gray-800/40 p-6 md:w-2/3">
                <div className="border-b border-white/10 pb-3 text-xs font-bold uppercase tracking-[0.2em] text-brand/80">
                  Recent transactions
                </div>
                {RECENT_TRANSACTIONS.map((txn) => (
                  <div
                    key={txn.name}
                    className="flex min-h-[48px] items-center justify-between border-b border-white/5 py-4"
                  >
                    <div>
                      <div className="font-medium text-white">{txn.name}</div>
                      <div className="mt-0.5 text-sm text-white/50">{txn.time}</div>
                    </div>
                    <div className="text-right font-mono text-lg text-white">
                      {txn.amount}
                    </div>
                  </div>
                ))}
              </div>

              {/* Side panels */}
              <div className="flex flex-col gap-6 md:w-1/3">
                <div className="rounded-xl border border-white/5 bg-gray-800/40 p-6">
                  <div className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                    Daily revenue
                  </div>
                  <div className="font-mono text-3xl font-bold tracking-tight text-brand">
                    ₹24,510.00
                  </div>
                </div>

                <div className="flex-grow rounded-xl border border-white/5 bg-gray-800/40 p-6">
                  <div className="mb-6 text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                    WhatsApp status
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-money/20 bg-money/10">
                      <CheckCircle2 className="h-5 w-5 text-money" />
                    </span>
                    <span className="text-white/80">42 receipts sent</span>
                  </div>
                  <div className="mt-6 flex items-center gap-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full border border-brand/20 bg-brand/10">
                      <Users className="h-5 w-5 text-brand" />
                    </span>
                    <span className="text-white/80">8 customers returned</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Proof ticker */}
      <div className="w-full border-y border-white/5 bg-gray-950 px-6 py-8 lg:px-8">
        <div className="mx-auto max-w-[1440px] overflow-x-auto">
          <p className="text-center font-mono text-base font-medium tracking-wider text-money md:whitespace-nowrap md:text-xl">
            <span className="text-money/50">&gt;</span> ₹38,400 brought back for
            Ganesh Tyres this month · 14 customers returned
          </p>
        </div>
      </div>

      {/* The loop */}
      <section id="the-loop" className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">
              How your shop starts remembering
            </h2>
            <div className="mx-auto mt-6 h-1 w-16 rounded-full bg-brand" />
          </div>

          <ol className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {LOOP_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="rounded-xl border border-white/5 bg-gray-900 p-6"
              >
                <div className="font-mono text-sm font-bold text-brand">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <h3 className="mt-4 text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-3 leading-relaxed text-gray-400">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Feature cards */}
      <section className="px-6 pb-24 lg:px-8">
        <div className="mx-auto grid max-w-[1440px] gap-6 md:grid-cols-2">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.id}
                id={feature.id}
                className="scroll-mt-24 rounded-xl border border-white/5 bg-gray-900 p-8"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-gray-800">
                  <Icon className={`h-6 w-6 ${feature.accent}`} />
                </div>
                <h3 className="mt-6 text-xl font-bold text-white">
                  {feature.title}
                </h3>
                <p className="mt-3 leading-relaxed text-gray-400">{feature.body}</p>
                {feature.kicker ? (
                  <p className="mt-4 font-bold text-money">{feature.kicker}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>

      {/* Closing */}
      <section className="border-t border-white/5 px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-white md:text-4xl">
            The shop that remembers, wins.
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-gray-400">
            Online giants don&apos;t beat you on price. They beat you on memory —
            they know what every customer bought and exactly when to ask again. Now
            you do too.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3">
            <Link
              href="/onboarding"
              className="rounded-lg bg-brand px-10 py-4 text-base font-bold text-gray-950 transition-colors hover:bg-orange-400"
            >
              Start free
            </Link>
            <span className="text-sm text-gray-500">no card needed</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-gray-950 px-6 py-12 lg:px-8">
        <div className="mx-auto max-w-[1440px]">
          <div className="flex flex-col gap-10 md:flex-row md:justify-between">
            <div className="text-xl font-bold tracking-tight text-white">
              <span className="text-brand">Bharat</span>Growth
            </div>

            <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
              {FOOTER_COLUMNS.map((column) => (
                <div key={column.heading}>
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-white/60">
                    {column.heading}
                  </h4>
                  <ul className="mt-4 space-y-2">
                    {column.links.map((link) => (
                      <li key={link.label}>
                        <a
                          href={link.href}
                          className="text-sm text-gray-400 transition-colors hover:text-brand"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <p className="mt-12 border-t border-white/5 pt-8 text-sm text-gray-500">
            Made in India, for Indian shops.
          </p>
        </div>
      </footer>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes hero-wave-drift {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        .hero-wave {
          animation: hero-wave-drift 38s linear infinite;
          will-change: transform;
        }
        /* Different speed for depth; each period is self-contained so the
           loop stays seamless at any duration. */
        .hero-wave--alt { animation-duration: 54s; }

        /* Tilt is a wide-screen flourish. On a phone the panel is a narrow
           stacked column and the angle only costs legibility, so it stays
           flat below md. */
        @media (min-width: 768px) {
          .hero-mockup {
            transform: rotateX(5deg) rotateY(-3deg);
            transition: transform 600ms cubic-bezier(0.4, 0, 0.2, 1);
          }
          .hero-mockup:hover { transform: rotateX(1.5deg) rotateY(-1deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-wave { animation: none; }
          .hero-mockup { transition: none; }
        }
      `,
        }}
      />
    </div>
  )
}
