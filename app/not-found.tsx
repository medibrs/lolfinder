"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export default function NotFound() {
  const [glitch, setGlitch] = useState(false)
  const [floatingItems, setFloatingItems] = useState<{ id: number; left: number; delay: number }[]>([])

  useEffect(() => {
    // Random glitch effect
    const glitchInterval = setInterval(
      () => {
        setGlitch(true)
        setTimeout(() => setGlitch(false), 100)
      },
      3000 + Math.random() * 2000,
    )

    return () => clearInterval(glitchInterval)
  }, [])

  useEffect(() => {
    // Generate floating items
    setFloatingItems(
      Array.from({ length: 5 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
      })),
    )
  }, [])

  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center p-4">
      {/* Animated Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(0deg, transparent 24%, rgba(139, 92, 246, 0.2) 25%, rgba(139, 92, 246, 0.2) 26%, transparent 27%, transparent 74%, rgba(139, 92, 246, 0.2) 75%, rgba(139, 92, 246, 0.2) 76%, transparent 77%, transparent),
              linear-gradient(90deg, transparent 24%, rgba(139, 92, 246, 0.2) 25%, rgba(139, 92, 246, 0.2) 26%, transparent 27%, transparent 74%, rgba(139, 92, 246, 0.2) 75%, rgba(139, 92, 246, 0.2) 76%, transparent 77%, transparent)
            `,
            backgroundSize: "50px 50px",
            animation: "scroll 20s linear infinite",
          }}
        />
      </div>

      {/* Floating Decorative Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {floatingItems.map((item) => (
          <div
            key={item.id}
            className="absolute w-32 h-32 rounded-full opacity-20"
            style={{
              left: `${item.left}%`,
              top: "-50px",
              background: "linear-gradient(135deg, rgb(139, 92, 246), rgb(236, 163, 51))",
              animation: `float 15s ease-in-out infinite`,
              animationDelay: `${item.delay}s`,
              filter: "blur(40px)",
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 max-w-3xl text-center">
        {/* 404 with Glitch Effect */}
        <div className={`mb-8 transition-all duration-100 ${glitch ? "scale-95 opacity-80" : ""}`}>
          <div
            className="text-9xl md:text-[200px] font-black text-transparent bg-clip-text"
            style={{
              backgroundImage: "linear-gradient(135deg, rgb(139, 92, 246) 0%, rgb(236, 163, 51) 100%)",
              lineHeight: "1",
              letterSpacing: "-0.05em",
            }}
          >
            404
          </div>
          <div className="h-2 w-48 mx-auto mt-4 bg-gradient-to-r from-primary via-accent to-primary rounded-full animate-pulse" />
        </div>

        <h1 className="text-4xl md:text-5xl font-black mb-8 text-foreground text-balance">PAGE NOT FOUND</h1>

        {/* Back to Home Button */}
        <Button
          asChild
          className="bg-primary hover:bg-primary/90 text-foreground font-bold py-6 px-8 text-lg rounded-lg"
        >
          <Link href="/">Back to Home</Link>
        </Button>
      </div>

      {/* Animated Background - CSS in globals */}
      <style>{`
        @keyframes scroll {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(50px);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-30px);
          }
        }
      `}</style>
    </div>
  )
}
