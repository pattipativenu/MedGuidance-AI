"use client";

import AnimatedGradientBackground from "@/components/ui/animated-gradient-background";
import TypewriterText from "@/components/ui/typewriter-text";
import { motion } from "framer-motion";

export default function Home() {
  const taglines = [
    "Evidence-backed answers to your toughest medical questions",
    "Evidence-backed drug interactions and side effect analysis",
    "Evidence-backed treatment options and dosing recommendations",
    "Evidence-backed quick curbside consults in seconds",
    "Evidence-backed deep research on any medical topic",
    "Evidence-backed treatment alternatives and clinical pathways",
    "Evidence-backed fact checks with cited sources",
    "Evidence-backed guidance—unlimited scope, unlimited depth",
  ];

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Animated Gradient Background */}
      <AnimatedGradientBackground
        Breathing={true}
        startingGap={125}
        breathingRange={5}
        animationSpeed={0.02}
      />

      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/20 z-5" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-4 text-center">
        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.9 }}
          className="text-5xl md:text-7xl font-bold text-white tracking-tight"
        >
          Welcome to{" "}
          <span className="bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            MedGuidence AI
          </span>
        </motion.h1>

        {/* Typewriter Rotating Taglines */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.9 }}
          className="mt-8 text-lg md:text-xl text-blue-200 min-h-12 flex items-center justify-center max-w-3xl px-4"
        >
          <TypewriterText phrases={taglines} typingSpeed={40} deletingSpeed={25} pauseDuration={2500} />
        </motion.div>

        {/* Divider */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="mt-16 w-24 h-1 bg-linear-to-r from-transparent via-white/50 to-transparent rounded-full"
        />

        {/* Static Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.9 }}
          className="mt-8 text-xl md:text-2xl text-gray-200 font-light"
        >
          Select your mode to get started
        </motion.p>

        {/* Mode Selection Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.9 }}
          className="mt-10 flex flex-col sm:flex-row gap-6"
        >
          <button
            onClick={() => window.location.href = "/doctor"}
            className="group relative px-10 py-5 bg-white/5 backdrop-blur-lg border-2 border-white/20 rounded-2xl text-white font-semibold text-xl overflow-hidden transition-all duration-500 hover:scale-105 hover:border-blue-400/50 hover:shadow-[0_0_30px_rgba(59,130,246,0.5)]"
          >
            <div className="absolute inset-0 bg-linear-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Doctor Mode
            </span>
          </button>
          <button
            onClick={() => window.location.href = "/general"}
            className="group relative px-10 py-5 bg-white/5 backdrop-blur-lg border-2 border-white/20 rounded-2xl text-white font-semibold text-xl overflow-hidden transition-all duration-500 hover:scale-105 hover:border-purple-400/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.5)]"
          >
            <div className="absolute inset-0 bg-linear-to-r from-purple-600 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <span className="relative z-10 flex items-center gap-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              General Mode
            </span>
          </button>
        </motion.div>

        {/* Subtle hint text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 1 }}
          className="mt-12 text-sm text-gray-400/80"
        >
          Powered by advanced AI • Evidence-based medical insights
        </motion.p>
      </div>
    </div>
  );
}
