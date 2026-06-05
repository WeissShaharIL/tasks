import { useState } from "react";
import { useInstallPrompt } from "../hooks/useInstallPrompt";

/** Auto-appearing bottom banner (shown once per session if not dismissed) */
export default function InstallPrompt() {
  const { canShow, ios, hasNativePrompt, triggerInstall, dismiss } = useInstallPrompt();
  const [gone, setGone] = useState(false);

  if (!canShow || gone || (!ios && !hasNativePrompt)) return null;

  async function handleInstall() {
    await triggerInstall();
    setGone(true);
  }

  function handleDismiss() {
    dismiss();
    setGone(true);
  }

  return (
    <div className="install-banner" role="complementary" aria-label="התקנת אפליקציה">
      <img src="/icon.svg" className="install-banner__icon" alt="" width="40" height="40" />
      <div className="install-banner__text">
        <span className="install-banner__title">התקן את האפליקציה</span>
        <span className="install-banner__sub">
          {ios ? 'לחץ על "שתף" ← "הוסף למסך הבית"' : "גישה מהירה מהמסך הראשי"}
        </span>
      </div>
      {!ios && (
        <button className="install-banner__btn" onClick={handleInstall}>התקן</button>
      )}
      <button className="install-banner__dismiss" onClick={handleDismiss} aria-label="סגור">✕</button>
    </div>
  );
}

/** Compact button for the board toolbar — always shown on mobile until installed */
export function InstallButton() {
  const { canShow, ios, hasNativePrompt, triggerInstall } = useInstallPrompt();
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [done, setDone] = useState(false);

  if (!canShow || done) return null;

  async function handleClick() {
    if (ios) {
      setShowIOSHelp(true);
      return;
    }
    if (hasNativePrompt) {
      const accepted = await triggerInstall();
      if (accepted) setDone(true);
    } else {
      setShowIOSHelp(true); // fallback: show manual instructions
    }
  }

  return (
    <>
      <button className="toolbar-install-btn" onClick={handleClick} title="התקן כאפליקציה">
        הורד אפליקציה
      </button>
      {showIOSHelp && (
        <div className="ios-help-overlay" onClick={() => setShowIOSHelp(false)}>
          <div className="ios-help-card" onClick={(e) => e.stopPropagation()}>
            <p className="ios-help-card__text">
              לחץ על כפתור <strong>שתף</strong> בתחתית Safari,
              ואחר כך בחר <strong>"הוסף למסך הבית"</strong>
            </p>
            <button className="btn-primary btn-full" onClick={() => setShowIOSHelp(false)}>
              הבנתי
            </button>
          </div>
        </div>
      )}
    </>
  );
}
