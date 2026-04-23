"use client";

import { useEffect, useMemo, useState } from "react";
import { MoveRight, PhoneCall } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function Hero() {
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => ["amazing", "new", "wonderful", "beautiful", "smart"],
    [],
  );
  const titleColors = useMemo(
    () => [
      "text-sky-600",
      "text-blue-600",
      "text-cyan-600",
      "text-indigo-600",
      "text-teal-600",
    ],
    [],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setTitleNumber((current) => (current === titles.length - 1 ? 0 : current + 1));
    }, 2000);

    return () => window.clearTimeout(timeoutId);
  }, [titleNumber, titles]);

  return (
    <div className="w-full">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col items-center justify-center gap-8 py-16 text-center lg:py-24">
          <div>
            <Button
              variant="secondary"
              size="sm"
              className="gap-3 rounded-full border border-slate-200 bg-white/90 px-4 text-slate-700 shadow-sm backdrop-blur"
              asChild
            >
              <Link href="#product-glimpse">
                Read our launch article <MoveRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="flex max-w-3xl flex-col gap-5">
            <h1 className="text-center text-5xl font-medium tracking-[-0.06em] text-slate-950 md:text-7xl">
              <span className="text-slate-950">This is something</span>
              <span className="relative flex w-full justify-center overflow-hidden pb-2 pt-2 md:pb-4 md:pt-3">
                &nbsp;
                {titles.map((title, index) => (
                  <motion.span
                    key={index}
                    className={`absolute font-semibold ${titleColors[index]}`}
                    initial={{ opacity: 0, y: -100 }}
                    transition={{ type: "spring", stiffness: 50 }}
                    animate={
                      titleNumber === index
                        ? { y: 0, opacity: 1 }
                        : { y: titleNumber > index ? -150 : 150, opacity: 0 }
                    }
                  >
                    {title}
                  </motion.span>
                ))}
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-center text-lg leading-8 tracking-tight text-slate-600 md:text-xl">
              Ditch manual tracking for intelligent, batch-aware clinical inventory management.
              Prevent stockouts and eliminate expiry risk with precise pharmacy operations.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button size="lg" className="gap-3 rounded-xl px-6" asChild>
              <Link href="/sign-in">
                Sign up here <MoveRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { Hero };
