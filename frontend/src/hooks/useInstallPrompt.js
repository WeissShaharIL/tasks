import { useEffect, useState } from "react";

function isMobile() {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) && !/CriOS|FxiOS|OPiOS/i.test(ua);
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(() => window.__pwaPrompt || null);
  const [dismissed] = useState(() => !!localStorage.getItem("pwa-dismissed"));

  useEffect(() => {
    if (window.__pwaPrompt) setPrompt(window.__pwaPrompt);
    const handler = () => setPrompt(window.__pwaPrompt);
    window.addEventListener("pwa-prompt-ready", handler);
    return () => window.removeEventListener("pwa-prompt-ready", handler);
  }, []);

  const canShow = !isStandalone() && !dismissed && isMobile();
  const ios = isIOSSafari();

  async function triggerInstall() {
    if (!prompt) return false;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__pwaPrompt = null;
    setPrompt(null);
    return outcome === "accepted";
  }

  function dismiss() {
    localStorage.setItem("pwa-dismissed", "1");
  }

  return {
    canShow,
    ios,
    hasNativePrompt: !!prompt,
    triggerInstall,
    dismiss,
  };
}
