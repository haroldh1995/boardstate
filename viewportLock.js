let cleanupViewportLock = null;

export function enableViewportLock() {
  if (cleanupViewportLock) return cleanupViewportLock;

  const html = document.documentElement;
  const body = document.body;
  const previous = {
    htmlOverflow: html.style.overflow,
    bodyOverflow: body.style.overflow,
    htmlTouchAction: html.style.touchAction,
    bodyTouchAction: body.style.touchAction,
  };

  html.classList.add("boardstate-viewport-locked");
  body.classList.add("boardstate-viewport-locked");
  html.style.overflow = "hidden";
  body.style.overflow = "hidden";
  html.style.touchAction = "manipulation";
  body.style.touchAction = "manipulation";

  let lastTouchEnd = 0;
  const preventMultiTouch = (event) => { if (event.touches.length > 1) event.preventDefault(); };
  const preventDoubleTap = (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  };
  const preventGesture = (event) => event.preventDefault();

  document.addEventListener("touchmove", preventMultiTouch, { passive: false });
  document.addEventListener("touchend", preventDoubleTap, { passive: false });
  document.addEventListener("gesturestart", preventGesture, { passive: false });
  document.addEventListener("gesturechange", preventGesture, { passive: false });
  document.addEventListener("gestureend", preventGesture, { passive: false });

  cleanupViewportLock = () => {
    document.removeEventListener("touchmove", preventMultiTouch);
    document.removeEventListener("touchend", preventDoubleTap);
    document.removeEventListener("gesturestart", preventGesture);
    document.removeEventListener("gesturechange", preventGesture);
    document.removeEventListener("gestureend", preventGesture);
    html.classList.remove("boardstate-viewport-locked");
    body.classList.remove("boardstate-viewport-locked");
    html.style.overflow = previous.htmlOverflow;
    body.style.overflow = previous.bodyOverflow;
    html.style.touchAction = previous.htmlTouchAction;
    body.style.touchAction = previous.bodyTouchAction;
    cleanupViewportLock = null;
  };

  return cleanupViewportLock;
}

export function disableViewportLock() {
  if (cleanupViewportLock) cleanupViewportLock();
}
