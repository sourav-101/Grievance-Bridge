/* eslint-disable @next/next/no-img-element */
/**
 * IIT Roorkee identity banner (blue panel with a curved edge, logo, Hindi and
 * English names, Thomason Building silhouette on the right).
 */
export function IitrBanner() {
  return (
    <div className="relative overflow-hidden bg-white" role="banner" aria-label="Indian Institute of Technology Roorkee">
      <img
        src="/images/banner-building.png"
        alt=""
        className="pointer-events-none absolute bottom-0 right-0 h-full w-auto select-none opacity-90"
      />
      <svg className="absolute inset-y-0 left-0 h-full w-[94%] sm:w-[78%]" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden>
        <path d="M0 0 H86 Q100 20 86 40 H0 Z" fill="#1c4682" />
      </svg>
      <div className="relative z-10 mx-auto flex max-w-6xl items-center gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-5">
        <img src="/images/iitr-logo.png" alt="IIT Roorkee logo" className="size-14 shrink-0 rounded-full sm:size-20" />
        <div className="min-w-0 pr-16 leading-tight text-white sm:pr-0">
          <p className="text-[14px] font-semibold sm:text-2xl" lang="hi">
            भारतीय प्रौद्योगिकी संस्थान रुड़की
          </p>
          <p className="text-[12px] sm:text-xl" lang="en">
            Indian Institute of Technology Roorkee
          </p>
        </div>
      </div>
    </div>
  );
}
