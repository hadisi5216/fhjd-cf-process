type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
};

export async function enterFullscreen() {
  const fullscreenDocument = document as FullscreenDocument;
  if (document.fullscreenElement || fullscreenDocument.webkitFullscreenElement) {
    return true;
  }

  const element = document.documentElement as FullscreenElement;
  const request = element.requestFullscreen?.bind(element) ?? element.webkitRequestFullscreen?.bind(element);
  if (!request) return false;

  try {
    await request();
    return true;
  } catch {
    return false;
  }
}
