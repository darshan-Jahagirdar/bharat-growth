'use client'

import { useRef, useEffect } from 'react'
import Spline from '@splinetool/react-spline'
import type { Application } from '@splinetool/runtime'
import gsap from 'gsap'

const SPLINE_SCENE = 'https://prod.spline.design/uk4qu40vSIB7mwvk/scene.splinecode'

export default function TunnelSpline() {
  const splineRef = useRef<Application | null>(null)
  const tlRef = useRef<gsap.core.Timeline | null>(null)

  useEffect(() => {
    return () => {
      tlRef.current?.kill()
    }
  }, [])

  function onLoad(splineApp: Application) {
    splineRef.current = splineApp
    const tunnelGroup = splineApp.findObjectByName('Group')
    if (!tunnelGroup) return

    const startZ = tunnelGroup.position.z
    const startRotZ = tunnelGroup.rotation.z

    const tl = gsap.timeline({ repeat: -1 })

    // Fly forward through the tunnel
    tl.to(tunnelGroup.position, {
      z: startZ + 1050,
      duration: 6,
      ease: 'power1.inOut',
    }, 0)

    // Slow continuous rotation for immersion
    tl.to(tunnelGroup.rotation, {
      z: startRotZ + Math.PI * 2,
      duration: 6,
      ease: 'none',
    }, 0)

    // Snap back instantly at the end so the loop is seamless
    tl.set(tunnelGroup.position, { z: startZ })
    tl.set(tunnelGroup.rotation, { z: startRotZ })

    tlRef.current = tl
  }

  return (
    <div className="w-full h-[600px] relative">
      <Spline scene={SPLINE_SCENE} onLoad={onLoad} />
    </div>
  )
}
