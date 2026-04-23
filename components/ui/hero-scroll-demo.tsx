"use client";
import React from "react";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";
import Image from "next/image";

export function HeroScrollDemo() {
  return (
    <div className="flex flex-col overflow-hidden pb-[100px] pt-[50px]">
      <ContainerScroll
        titleComponent={
          <>
            <h1 className="text-3xl font-semibold leading-tight text-slate-800 sm:text-4xl">
              Unleash the power of
            </h1>
            <span
              className="mt-2 block bg-gradient-to-r from-slate-950 via-slate-400 to-slate-800 bg-clip-text text-5xl font-black leading-none tracking-tight text-transparent md:text-[6rem]"
            >
              PharmaFlow
            </span>
          </>
        }
      >
        <Image
          src="/images/hero-tablet-pharma.png"
          alt="hero"
          height={720}
          width={1400}
          className="mx-auto rounded-2xl object-cover h-full object-left-top"
          draggable={false}
        />
      </ContainerScroll>
    </div>
  );
}
