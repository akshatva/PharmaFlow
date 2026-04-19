'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';

interface ScrollExpandMediaProps {
  mediaType?: 'video' | 'image';
  mediaSrc: string;
  posterSrc?: string;
  bgImageSrc: string;
  title?: string;
  date?: string;
  scrollToExpand?: string;
  textBlend?: boolean;
  children?: ReactNode;
}

export default function ScrollExpandMedia({
  mediaType = 'video',
  mediaSrc,
  posterSrc,
  bgImageSrc,
  title,
  date,
  scrollToExpand,
  textBlend = false,
  children,
}: ScrollExpandMediaProps) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [mediaFullyExpanded, setMediaFullyExpanded] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);
  const [isMobileState, setIsMobileState] = useState(false);

  useEffect(() => {
    setScrollProgress(0);
    setShowContent(false);
    setMediaFullyExpanded(false);
  }, [mediaType]);

  useEffect(() => {
    const handleWheel = (event: globalThis.WheelEvent) => {
      if (mediaFullyExpanded && event.deltaY < 0 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        setShowContent(false);
        setScrollProgress(0.92);
        event.preventDefault();
        return;
      }

      if (!mediaFullyExpanded) {
        event.preventDefault();
        const scrollDelta = event.deltaY * 0.0009;
        const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
        setScrollProgress(newProgress);

        if (newProgress >= 1) {
          setMediaFullyExpanded(true);
          setShowContent(true);
        } else if (newProgress < 0.75) {
          setShowContent(false);
        }
      }
    };

    const handleTouchStart = (event: globalThis.TouchEvent) => {
      setTouchStartY(event.touches[0]?.clientY ?? 0);
    };

    const handleTouchMove = (event: globalThis.TouchEvent) => {
      if (!touchStartY) {
        return;
      }

      const touchY = event.touches[0]?.clientY ?? 0;
      const deltaY = touchStartY - touchY;

      if (mediaFullyExpanded && deltaY < -20 && window.scrollY <= 5) {
        setMediaFullyExpanded(false);
        setShowContent(false);
        setScrollProgress(0.92);
        event.preventDefault();
        return;
      }

      if (!mediaFullyExpanded) {
        event.preventDefault();
        const scrollFactor = deltaY < 0 ? 0.008 : 0.005;
        const scrollDelta = deltaY * scrollFactor;
        const newProgress = Math.min(Math.max(scrollProgress + scrollDelta, 0), 1);
        setScrollProgress(newProgress);

        if (newProgress >= 1) {
          setMediaFullyExpanded(true);
          setShowContent(true);
        } else if (newProgress < 0.75) {
          setShowContent(false);
        }

        setTouchStartY(touchY);
      }
    };

    const handleTouchEnd = () => {
      setTouchStartY(0);
    };

    const handleScroll = () => {
      if (!mediaFullyExpanded) {
        window.scrollTo(0, 0);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('scroll', handleScroll);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [mediaFullyExpanded, scrollProgress, touchStartY]);

  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileState(window.innerWidth < 768);
    };

    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);

    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  const mediaWidth = 320 + scrollProgress * (isMobileState ? 620 : 1080);
  const mediaHeight = 200 + scrollProgress * (isMobileState ? 240 : 440);
  const textTranslateX = scrollProgress * (isMobileState ? 120 : 90);
  const firstWord = title ? title.split(' ')[0] : '';
  const restOfTitle = title ? title.split(' ').slice(1).join(' ') : '';

  return (
    <div className="overflow-x-hidden transition-colors duration-700 ease-in-out">
      <section className="relative flex min-h-[100dvh] flex-col items-center justify-start">
        <div className="relative flex min-h-[100dvh] w-full flex-col items-center">
          <motion.div
            className="absolute inset-0 z-0 h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 - scrollProgress }}
            transition={{ duration: 0.15 }}
          >
            <Image
              src={bgImageSrc}
              alt="Background"
              width={1920}
              height={1080}
              className="h-screen w-screen"
              style={{ objectFit: 'cover', objectPosition: 'center' }}
              priority
            />
            <div className="absolute inset-0 bg-slate-950/20" />
          </motion.div>

          <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center px-4 sm:px-6 lg:px-8">
            <div className="relative flex h-[100dvh] w-full flex-col items-center justify-center">
              <div
                className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-[28px] transition-none"
                style={{
                  width: `${mediaWidth}px`,
                  height: `${mediaHeight}px`,
                  maxWidth: '94vw',
                  maxHeight: '84vh',
                  boxShadow: '0px 24px 80px rgba(15, 23, 42, 0.22)',
                }}
              >
                {mediaType === 'video' ? (
                  mediaSrc.includes('youtube.com') ? (
                    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/20 pointer-events-none">
                      <iframe
                        width="100%"
                        height="100%"
                        src={
                          mediaSrc.includes('embed')
                            ? `${mediaSrc}${mediaSrc.includes('?') ? '&' : '?'}autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1`
                            : `${mediaSrc.replace('watch?v=', 'embed/')}?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&disablekb=1&modestbranding=1&playlist=${mediaSrc.split('v=')[1]}`
                        }
                        className="h-full w-full rounded-[24px]"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                      <motion.div
                        className="absolute inset-0 rounded-[24px] bg-slate-950/30"
                        initial={{ opacity: 0.7 }}
                        animate={{ opacity: 0.45 - scrollProgress * 0.2 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  ) : (
                    <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/20 pointer-events-none">
                      <video
                        src={mediaSrc}
                        poster={posterSrc}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        className="h-full w-full rounded-[24px] object-cover"
                        controls={false}
                        disablePictureInPicture
                        disableRemotePlayback
                      />
                      <motion.div
                        className="absolute inset-0 rounded-[24px] bg-slate-950/22"
                        initial={{ opacity: 0.55 }}
                        animate={{ opacity: 0.3 - scrollProgress * 0.16 }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                  )
                ) : (
                  <div className="relative h-full w-full overflow-hidden rounded-[24px] border border-white/20">
                    <Image
                      src={mediaSrc}
                      alt={title || 'Media content'}
                      width={1280}
                      height={720}
                      className="h-full w-full rounded-[24px] object-cover"
                    />
                    <motion.div
                      className="absolute inset-0 rounded-[24px] bg-slate-950/35"
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: 0.5 - scrollProgress * 0.2 }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}

                {(date || scrollToExpand) ? (
                  <div className="relative z-10 mt-4 flex flex-col items-center text-center transition-none">
                    {date ? (
                      <p
                        className="text-lg font-medium text-blue-100 md:text-2xl"
                        style={{ transform: `translateX(-${textTranslateX}vw)` }}
                      >
                        {date}
                      </p>
                    ) : null}
                    {scrollToExpand ? (
                      <p
                        className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-blue-100/90"
                        style={{ transform: `translateX(${textTranslateX}vw)` }}
                      >
                        {scrollToExpand}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {title ? (
                <div
                  className={`relative z-10 flex w-full flex-col items-center justify-center gap-3 text-center transition-none ${
                    textBlend ? 'mix-blend-difference' : 'mix-blend-normal'
                  }`}
                >
                  <motion.h2
                    className="text-3xl font-semibold tracking-tight text-blue-100 md:text-5xl lg:text-6xl"
                    style={{ transform: `translateX(-${textTranslateX}vw)` }}
                  >
                    {firstWord}
                  </motion.h2>
                  <motion.h2
                    className="text-3xl font-semibold tracking-tight text-blue-100 md:text-5xl lg:text-6xl"
                    style={{ transform: `translateX(${textTranslateX}vw)` }}
                  >
                    {restOfTitle}
                  </motion.h2>
                </div>
              ) : null}
            </div>

            <motion.section
              className="flex w-full flex-col px-0 pb-24 pt-36 md:pt-52"
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ duration: 0.7 }}
            >
              {children}
            </motion.section>
          </div>
        </div>
      </section>
    </div>
  );
}
