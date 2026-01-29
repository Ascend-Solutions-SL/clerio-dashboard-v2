'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function TruncateWithTooltip({
  value,
  className = '',
  placeholder = '',
}: {
  value: string | null | undefined;
  className?: string;
  placeholder?: string;
}) {
  const text = value ?? '';
  const tooltipText = text && text.trim().length > 0 ? text : placeholder;

  const ref = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const computeTruncation = useCallback(() => {
    const el = ref.current;
    if (!el) {
      setIsTruncated(false);
      return;
    }

    setIsTruncated(el.scrollWidth > el.clientWidth);
  }, []);

  useLayoutEffect(() => {
    computeTruncation();
  }, [computeTruncation, text, className]);

  if (!tooltipText) {
    return <span ref={ref} className={`block min-w-0 truncate ${className}`}>{text}</span>;
  }

  if (!isTruncated) {
    return (
      <span ref={ref} className={`block min-w-0 truncate ${className}`}>
        {text}
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            ref={ref}
            onMouseEnter={computeTruncation}
            className={`block min-w-0 truncate cursor-zoom-in ${className}`}
          >
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm break-words text-sm">{tooltipText}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
