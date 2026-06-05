'use client'

import { Check, Keyboard, Calculator, Store, FileText } from "lucide-react"
import Spline from '@splinetool/react-spline'
import dynamic from 'next/dynamic'
const TunnelSpline = dynamic(() => import('@/components/TunnelSpline'), { ssr: false })

const SPLINE_SCENE = 'https://prod.spline.design/uk4qu40vSIB7mwvk/scene.splinecode'

export default function BharatGrowthLanding() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* Hero Section */}
      <section className="relative px-6 pt-12 pb-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {/* Navigation */}
          <nav className="flex items-center justify-between mb-16">
            <div className="text-2xl font-bold">
              <span className="text-orange-500">Bharat</span>Growth
            </div>

            {/* Center Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">
                About Us
              </a>
              <a href="#" className="text-slate-400 hover:text-white transition-colors duration-200">
                Contact Us
              </a>
            </div>

            {/* Right Buttons */}
            <div className="flex items-center gap-3">
              <a
                href="/login"
                className="px-6 py-2.5 border border-white/20 rounded-lg font-semibold text-sm text-white hover:border-orange-500 transition-all duration-300"
              >
                Login
              </a>
              <a
                href="/onboarding"
                className="px-6 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg font-semibold text-sm shadow-[0_0_15px_rgba(249,115,22,0.4)] hover:shadow-[0_0_25px_rgba(249,115,22,0.6)] transition-all duration-300"
              >
                Onboard Now
              </a>
            </div>
          </nav>

          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto mb-12">
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-balance">
              Turn Every Walk-In Into a{" "}
              <span className="text-orange-500">Lifetime Customer.</span>
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 mb-10">
              The first WhatsApp CRM for Indian retail that builds itself.
            </p>
            <button className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl font-semibold text-lg shadow-[0_0_15px_rgba(249,115,22,0.6)] hover:shadow-[0_0_30px_rgba(249,115,22,0.8)] transition-all duration-300 transform hover:scale-105">
              Onboard Now
            </button>
          </div>

          {/* Hero 3D Scene */}
          <div className="w-full h-[500px] relative">
            <Spline scene={SPLINE_SCENE} />
          </div>
        </div>
      </section>

      {/* Section - Digital Storefront */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content - Left */}
            <div className="lg:pr-8">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
                Your Shop Has a Website.{" "}
                <span className="text-orange-500">You Didn&apos;t Have to Build One.</span>
              </h2>
              <p className="text-lg text-slate-400 mb-8">
                The moment you add a product to your billing counter, it appears live on your public digital storefront — ready to take WhatsApp orders from customers who found you on Google.
              </p>
              <ul className="space-y-5">
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-white">Zero Setup:</span>
                    <span className="text-lg text-slate-300"> Your store is live the second you onboard.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-white">WhatsApp Orders:</span>
                    <span className="text-lg text-slate-300"> Every product card has a one-tap Order on WhatsApp button.</span>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <span className="text-lg font-semibold text-white">Your Brand, Your Look:</span>
                    <span className="text-lg text-slate-300"> Your storefront is designed to match your shop&apos;s personality.</span>
                  </div>
                </li>
              </ul>
            </div>

            {/* 3D Scene - Right */}
            <div className="w-full h-[500px] relative">
              <Spline scene={SPLINE_SCENE} />
            </div>
          </div>
        </div>
      </section>

      {/* Section - Throw Away Your Thermal Printer */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 3D Scene - Left */}
            <div className="w-full h-[500px] relative">
              <Spline scene={SPLINE_SCENE} />
            </div>

            {/* Content - Right */}
            <div className="lg:pl-8">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
                Throw Away Your{" "}
                <span className="text-orange-500">Thermal Printer.</span>
              </h2>
              <p className="text-lg text-slate-400 mb-8">
                Generate professional digital invoices instantly and send them directly to your customers via WhatsApp. No more paper jams, no more ink cartridges.
              </p>
              <ul className="space-y-4">
                <li className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="text-lg font-medium">3,000 Free Bills/Month</span>
                </li>
                <li className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <span className="text-lg font-medium">The Silent CRM</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section - World-Class POS */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content - Left */}
            <div className="lg:pr-8 order-2 lg:order-1">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
                A World-Class Billing POS, Hidden Inside{" "}
                <span className="text-orange-500">Your CRM.</span>
              </h2>
              <p className="text-lg text-slate-400 mb-10">
                Everything you need to run your business, seamlessly integrated.
              </p>

              {/* 4-Item Feature Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur p-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                    <Keyboard className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Keyboard-Speed</h3>
                  <p className="text-slate-400 text-sm">Bill faster than your competition can blink.</p>
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur p-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                    <Calculator className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Zero Math Mistakes</h3>
                  <p className="text-slate-400 text-sm">Automatic calculations, every single time.</p>
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur p-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                    <Store className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">Live Storefront</h3>
                  <p className="text-slate-400 text-sm">Your products online in minutes, not months.</p>
                </div>

                <div className="bg-slate-900/50 rounded-2xl border border-white/5 backdrop-blur p-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center mb-4">
                    <FileText className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">The CA-Pleaser</h3>
                  <p className="text-slate-400 text-sm">GST-ready reports your accountant will love.</p>
                </div>
              </div>
            </div>

            {/* 3D Scene - Right */}
            <div className="w-full h-[500px] relative order-1 lg:order-2">
              <Spline scene={SPLINE_SCENE} />
            </div>
          </div>
        </div>
      </section>

      {/* Section - Recover Udhaar */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* 3D Scene - Left */}
            <div className="w-full h-[500px] relative">
              <Spline scene={SPLINE_SCENE} />
            </div>

            {/* Content - Right */}
            <div className="lg:pl-8">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
                Recover Udhaar Without the{" "}
                <span className="text-orange-500">Awkward Phone Calls.</span>
              </h2>
              <p className="text-lg text-slate-400 mb-8">
                Automated WhatsApp reminders do the heavy lifting. Your customers pay on time, and your relationships stay intact.
              </p>

              {/* WhatsApp Message Bubble */}
              <div className="inline-block bg-[#005c4b] rounded-2xl px-6 py-4 max-w-md">
                <p className="text-white text-base">
                  Hi Rajesh, your Khata balance of ₹4,500 at Ganesh Tyres is due.
                </p>
                <p className="text-emerald-300/60 text-xs mt-2 text-right">10:30 AM</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section - Bring Them Back on Autopilot */}
      <section className="px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Content - Left */}
            <div className="lg:pr-8">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
                Bring Them Back on{" "}
                <span className="text-orange-500">Autopilot.</span>
              </h2>
              <p className="text-lg text-slate-400">
                Smart re-engagement campaigns that bring dormant customers back to your store. Birthday wishes, festival offers, and personalized deals — all automated.
              </p>
            </div>

            {/* 3D Scene - Right */}
            <div className="w-full h-[500px] relative">
              <Spline scene={SPLINE_SCENE} />
            </div>
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-6 py-24 lg:px-8 bg-slate-900/30">
        <div className="mx-auto max-w-7xl">
          {/* Spline Tunnel */}
          <div className="mb-16">
            <TunnelSpline />
          </div>

          {/* CTA Content */}
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-10 text-balance">
              Stop letting your best customers{" "}
              <span className="text-orange-500">walk away forever.</span>
            </h2>
            <button className="px-10 py-5 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl font-semibold text-lg shadow-[0_0_15px_rgba(249,115,22,0.6)] hover:shadow-[0_0_30px_rgba(249,115,22,0.8)] transition-all duration-300 transform hover:scale-105 mb-8">
              Onboard Now
            </button>

            {/* Trust Badge */}
            <div className="flex items-center justify-center gap-2 text-emerald-500">
              <Check className="w-5 h-5" />
              <span className="font-medium">100% DPDP Act 2026 Compliant</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 lg:px-8 border-t border-white/5">
        <div className="mx-auto max-w-7xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-xl font-bold">
            <span className="text-orange-500">Bharat</span>Growth
          </div>
          <p className="text-slate-500 text-sm">
            &copy; 2026 BharatGrowth. Made with love for Indian SMBs.
          </p>
        </div>
      </footer>
    </div>
  )
}
