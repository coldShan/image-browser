import { useCallback, useEffect, useMemo, useState } from "react";
import GalleryGrid from "./components/GalleryGrid";
import ImageLightbox from "./components/ImageLightbox";
import { useDirectoryImages } from "./hooks/useDirectoryImages";
import { hasDirectoryPicker } from "./utils/fileSystem";

const toggleFullscreen = async (): Promise<void> => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    return;
  }
  await document.exitFullscreen();
};

export default function App() {
  const { images, loading, error, pickDirectory, clearImages } = useDirectoryImages();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const canUseDirectoryPicker = useMemo(hasDirectoryPicker, []);

  const openAt = useCallback(
    (index: number) => {
      if (!images.length) return;
      setCurrentIndex(Math.min(Math.max(index, 0), images.length - 1));
      setLightboxOpen(true);
    },
    [images.length]
  );

  useEffect(() => {
    if (!images.length) {
      setCurrentIndex(0);
      setLightboxOpen(false);
      return;
    }
    if (currentIndex > images.length - 1) setCurrentIndex(images.length - 1);
  }, [currentIndex, images.length]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (!images.length) return;

      if (!lightboxOpen && event.key === "Enter") {
        event.preventDefault();
        openAt(currentIndex);
        return;
      }

      if (!lightboxOpen) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setLightboxOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentIndex, images.length, lightboxOpen, openAt]);

  return (
    <div className="app">
      <header className="toolbar">
        <div className="title-block">
          <h1>Local Image Gallery</h1>
          <p>
            Choose a folder and browse all nested images. Shortcuts: Enter open, Esc
            close, Arrow Left/Right navigate, F fullscreen.
          </p>
        </div>

        <div className="actions">
          <button
            type="button"
            onClick={() => void pickDirectory()}
            disabled={loading || !canUseDirectoryPicker}
          >
            {loading ? "Scanning..." : "Choose Folder"}
          </button>
          <button type="button" onClick={clearImages} disabled={!images.length && !error}>
            Clear
          </button>
        </div>
      </header>

      {!canUseDirectoryPicker && (
        <p className="status warning">
          当前浏览器不支持目录选择，请使用最新版 Chrome/Edge
        </p>
      )}

      {error && <p className="status error">{error}</p>}

      {!images.length && !loading && !error && (
        <section className="empty-state">
          <h2>No Images Yet</h2>
          <p>Select a local folder to start browsing.</p>
        </section>
      )}

      {images.length > 0 && (
        <section className="gallery-shell">
          <p className="status ok">{images.length} image(s) loaded.</p>
          <GalleryGrid images={images} onOpen={openAt} />
        </section>
      )}

      <ImageLightbox
        open={lightboxOpen}
        index={currentIndex}
        images={images}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setCurrentIndex}
      />
    </div>
  );
}
