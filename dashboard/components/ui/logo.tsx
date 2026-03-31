/*
 * Copyright (c) Dotcorr Studio. and affiliates.
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0.
 * Commercial use requires a license from DotCorr.
 */

import React from "react";

export function Logo({ className = "", size = "w-6 h-6" }: { className?: string, size?: string }) {
  return (
    <div className={`${size} relative ${className}`}>
      <img
        src="/dotcorr-isometric-black.svg"
        alt="DotCorr logo"
        className="h-full w-full object-contain dark:hidden"
      />
      <img
        src="/dotcorr-isometric-white.svg"
        alt="DotCorr logo"
        className="hidden h-full w-full object-contain dark:block"
      />
    </div>
  );
}

