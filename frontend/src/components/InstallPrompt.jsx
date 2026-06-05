import { useEffect, useState } from "react";

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already running as installed PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // User dismissed before
    if (localStorage.getItem("pwa-dismissed")) return;
    // Only on mobile devices
    if (!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) return;

    const ua = navigator.userAgent;
    const isiOS = /iphone|ipad|ipod/i.test(ua);
    // CriOS/FxiOS = Chrome/Firefox on iOS — they can't install PWAs, skip
    const isSafariIOS = isiOS && !/CriOS|FxiOS|OPiOS/i.test(ua) && !window.navigator.standalone;

    if (isSafariIOS) {
      setIsIOS(true);
      setVisible(true);
      return;
    }

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
    setDeferredPrompt(null);
  }

  function handleDismiss() {
    localStorage.setItem("pwa-dismissed", "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="install-banner" role="complementary" aria-label="התקנת אפליקציה">
      <img
        src="/icon.svg"
        className="install-banner__icon"
        alt="משימות"
        width="40"
        height="40"
      />
      <div className="install-banner__text">
        <span className="install-banner__title">התקן את האפליקציה</span>
        <span className="install-banner__sub">
          {isIOS
            ? 'לחץ על "שתף" ואז "הוסף למסך הבית"'
            : "גישה מהירה ישירות מהמסך הראשי"}
        </span>
      </div>
      {!isIOS && (
        <button className="install-banner__btn" onClick={handleInstall}>
          התקן
        </button>
      )}
      <button
        className="install-banner__dismiss"
        onClick={handleDismiss}
        aria-label="סגור"
      >
        ✕
      </button>
    </div>
  );
}
