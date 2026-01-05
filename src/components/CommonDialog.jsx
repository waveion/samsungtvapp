import React, { useEffect, useRef } from "react";
import "./CommonDialog.css";

function CommonDialog({
  showDialog,
  title = null,
  message = null,
  iconSrc = null,
  isErrorAdded = true,
  errorCode = null,
  errorMessage = null,
  borderColor = "#5a6676",
  confirmButtonText = null,
  onConfirm = null,
  dismissButtonText = null,
  onDismiss = null,
  initialFocusOnConfirm = false,
  inlineOverlay = false,
  compact = false,
  passive = false, // preview/embedded mode: do not grab focus or keys
}) {
  const confirmRef = useRef(null);
  const dismissRef = useRef(null);
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!showDialog || passive) return;

    const focusTarget = initialFocusOnConfirm && confirmButtonText
      ? confirmRef.current
      : dismissButtonText
      ? dismissRef.current
      : confirmRef.current || dismissRef.current;

    // Defer to allow mount
    const t = setTimeout(() => focusTarget?.focus(), 30);
    return () => clearTimeout(t);
  }, [showDialog, initialFocusOnConfirm, confirmButtonText, dismissButtonText, passive]);

  // Hard focus trap: when dialog is open, keep focus strictly on the buttons
  useEffect(() => {
    if (!showDialog || passive) return;
    const forceFocusWithin = (e) => {
      try {
        const target = e.target;
        const isDialogChild = dialogRef.current && dialogRef.current.contains(target);
        const isButton = target === dismissRef.current || target === confirmRef.current;
        if (!isDialogChild || !isButton) {
          // Redirect focus to the first available button
          const fallback = dismissRef.current || confirmRef.current;
          if (fallback && document.activeElement !== fallback) {
            e.preventDefault?.();
            fallback.focus();
          }
        }
      } catch {}
    };
    document.addEventListener('focusin', forceFocusWithin, true);
    // Also blur any currently focused element outside
    try { if (document.activeElement && !dialogRef.current?.contains(document.activeElement)) document.activeElement.blur(); } catch {}
    return () => {
      document.removeEventListener('focusin', forceFocusWithin, true);
    };
  }, [showDialog, passive]);

  if (!showDialog) return null;

  const handleKeyDown = (e) => {
    // If a global force-push message is visible, ignore all keys at dialog
    // level so that only the force overlay owns BACK/DPAD.
    try {
      if (typeof window !== 'undefined' && window.__CAASTV_FORCE_PUSH_ACTIVE) {
        e.preventDefault?.();
        e.stopPropagation?.();
        return;
      }
    } catch {}

    if (passive) return; // do not capture keys in passive mode
    // Trap focus between buttons
    if (e.key === "Tab") {
      const focusables = [dismissRef.current, confirmRef.current].filter(Boolean);
      if (focusables.length === 0) return;
      const currentIndex = focusables.indexOf(document.activeElement);
      e.preventDefault();
      const nextIndex = e.shiftKey
        ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
        : (currentIndex >= focusables.length - 1 ? 0 : currentIndex + 1);
      focusables[nextIndex]?.focus();
    } else if (e.key === "Escape" || e.key === "Backspace") {
      if (onDismiss) onDismiss();
      e.stopPropagation();
    } else if (e.key === "Enter") {
      if (document.activeElement === confirmRef.current && onConfirm) onConfirm();
      else if (document.activeElement === dismissRef.current && onDismiss) onDismiss();
      e.preventDefault();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      // Left/Right to move focus between buttons like TV DPAD
      const focusables = [dismissRef.current, confirmRef.current].filter(Boolean);
      if (focusables.length > 1) {
        const currentIndex = focusables.indexOf(document.activeElement);
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const nextIndex = (currentIndex + delta + focusables.length) % focusables.length;
        focusables[nextIndex]?.focus();
        e.preventDefault();
        e.stopPropagation();
      } else {
        // Capture to avoid bubbling to app
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      // Capture vertical DPAD while dialog is open
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const hasButtons = Boolean(confirmButtonText || dismissButtonText);
  const showErrorDetails = errorCode != null || errorMessage != null;

  return (
    <div className={`cd-overlay${inlineOverlay ? " cd-overlay-inline" : ""}${compact ? " cd-overlay-compact" : ""}`} role="dialog" aria-modal={passive ? "false" : "true"} onKeyDown={handleKeyDown}>
      <div
        className={`cd-surface${compact ? " cd-surface-compact" : ""}`}
        ref={dialogRef}
        style={{ borderColor: borderColor || "transparent" }}
      >
        <div className="cd-body">
          {title ? (
            <>
              <div className="cd-title-row">
                {isErrorAdded && (
                  iconSrc ? (
                    <img src={iconSrc} alt="icon" className="cd-title-icon" />
                  ) : (
                    <span className="cd-title-icon cd-default-icon" aria-hidden>!</span>
                  )
                )}
                <h3 className="cd-title" title={title}>{title}</h3>
              </div>
              <div className="cd-gap-lg" />
            </>
          ) : null}

          {message ? (
            <>
              <p className={`cd-message ${!hasButtons ? "cd-message-wide" : ""}`}>{message}</p>
              <div className="cd-gap-sm" />
            </>
          ) : null}

          {showErrorDetails ? (
            <>
              <p className="cd-error">
                {isErrorAdded === false
                  ? `${errorMessage || ""}`
                  : `Error ${errorCode ?? ""}: ${errorMessage || ""}`}
              </p>
              <div className="cd-gap-md" />
            </>
          ) : null}

          {hasButtons ? (
            <div className="cd-actions">
              {dismissButtonText && onDismiss ? (
                <button
                  ref={dismissRef}
                  className="cd-btn cd-btn-text"
                  onClick={onDismiss}
                >
                  {dismissButtonText}
                </button>
              ) : null}

              {confirmButtonText && onConfirm ? (
                <button
                  ref={confirmRef}
                  className="cd-btn cd-btn-text"
                  onClick={onConfirm}
                >
                  {confirmButtonText}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default CommonDialog;


