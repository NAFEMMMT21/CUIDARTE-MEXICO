import { useEffect } from "react";

// Global reference counter to handle overlapping or sequential modals safely
let activeLocksCount = 0;
let savedBodyOverflow = "";
let savedHtmlOverflow = "";
let savedBodyPaddingRight = "";

function applyLock() {
  if (typeof document === "undefined") return;

  if (activeLocksCount === 0) {
    savedBodyOverflow = document.body.style.overflow || "";
    savedHtmlOverflow = document.documentElement.style.overflow || "";
    savedBodyPaddingRight = document.body.style.paddingRight || "";

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.classList.add("modal-open");
    document.documentElement.classList.add("modal-open");
    
    // Only lock overflow on body to prevent double-locking viewport on mobile
    document.body.style.overflow = "hidden";
    
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  activeLocksCount++;
}

function releaseLock() {
  if (typeof document === "undefined") return;

  activeLocksCount = Math.max(0, activeLocksCount - 1);

  if (activeLocksCount === 0) {
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");

    document.body.style.overflow = savedBodyOverflow;
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.paddingRight = savedBodyPaddingRight;
    document.body.style.touchAction = "";
    document.documentElement.style.touchAction = "";
  }
}

// Emergency safety reset: in case of route transition or unhandled edge cases
export function forceResetBodyScroll() {
  if (typeof document === "undefined") return;
  activeLocksCount = 0;
  document.body.classList.remove("modal-open");
  document.documentElement.classList.remove("modal-open");
  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  document.body.style.paddingRight = "";
  document.body.style.touchAction = "";
  document.documentElement.style.touchAction = "";
}

/**
 * Custom hook to lock the background page scrolling when a modal or floating overlay is open.
 * Ensures the modal stays anchored and scrolling only happens inside the modal window.
 * Cleanly releases on mobile without locking touch gestures.
 */
export function useLockBodyScroll(isLocked: boolean = true) {
  useEffect(() => {
    if (!isLocked) return;

    applyLock();

    return () => {
      releaseLock();
    };
  }, [isLocked]);
}

