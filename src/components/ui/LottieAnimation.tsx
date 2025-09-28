'use client';

import { useEffect, useRef, useState } from 'react';
import Lottie from 'lottie-react';

interface LottieAnimationProps {
  animationData: object;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
}

export default function LottieAnimation({ 
  animationData, 
  className = "", 
  loop = true, 
  autoplay = true 
}: LottieAnimationProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lottieRef = useRef<any>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (lottieRef.current && !hasError) {
      lottieRef.current.play();
    }
  }, [hasError]);

  if (hasError) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center">
          <svg
            className="w-16 h-16 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
            />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <Lottie
      lottieRef={lottieRef}
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      onError={() => setHasError(true)}
    />
  );
}
