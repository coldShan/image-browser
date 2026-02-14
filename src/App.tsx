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
  const {
    images,
    loading,
    error,
    pickDirectory,
    clearImages,
    ensurePreviewUrl,
    releasePreviewUrl,
    syncLightboxWindow,
    releaseAllLightboxUrls
  } = useDirectoryImages();
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxUrls, setLightboxUrls] = useState<Record<string, string>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

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
    if (!lightboxOpen) return;

    let cancelled = false;
    void syncLightboxWindow(currentIndex).then((urls) => {
      if (cancelled) return;
      setLightboxUrls(urls);
    });

    return () => {
      cancelled = true;
    };
  }, [currentIndex, lightboxOpen, syncLightboxWindow]);

  useEffect(() => {
    if (lightboxOpen) return;
    releaseAllLightboxUrls();
    setLightboxUrls({});
  }, [lightboxOpen, releaseAllLightboxUrls]);

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

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setIsScrolled(y > 80);

      const doc = document.documentElement;
      const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
      setScrollProgress(Math.min(Math.max(y / max, 0), 1));
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="app">
      <header className={`toolbar${isScrolled ? " is-scrolled" : ""}`}>
        {isScrolled && (
          <div className="scroll-progress" aria-hidden>
            <span style={{ transform: `scaleX(${scrollProgress})` }} />
          </div>
        )}

        <div className="title-block">
          <p className="eyebrow">本地图片档案馆</p>
          <h1>图像漫游</h1>
          <p>选择一个本地文件夹，以画廊方式浏览图片并进入沉浸式大图查看。</p>
          <ul className="shortcut-chips">
            <li>回车打开</li>
            <li>Esc 关闭</li>
            <li>左右切换</li>
            <li>F 全屏</li>
          </ul>
        </div>

        <div className="actions">
          <button
            type="button"
            onClick={() => void pickDirectory()}
            disabled={loading || !canUseDirectoryPicker}
          >
            {loading ? "扫描中..." : "选择文件夹"}
          </button>
          <button type="button" onClick={clearImages} disabled={!images.length && !error}>
            清空
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
          <h2>还没有可浏览的图片</h2>
          <p>点击上方“选择文件夹”开始建立你的本地图片画廊。</p>
        </section>
      )}

      {images.length > 0 && (
        <section className="gallery-shell">
          <p className="status ok">已载入 {images.length} 张图片</p>
          <GalleryGrid
            images={images}
            onOpen={openAt}
            ensurePreviewUrl={ensurePreviewUrl}
            releasePreviewUrl={releasePreviewUrl}
          />
        </section>
      )}

      <ImageLightbox
        open={lightboxOpen}
        index={currentIndex}
        images={images}
        lightboxUrls={lightboxUrls}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setCurrentIndex}
      />
    </div>
  );
}
