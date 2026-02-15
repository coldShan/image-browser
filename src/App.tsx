import { useCallback, useEffect, useMemo, useState } from "react";
import AlbumGrid from "./components/AlbumGrid";
import GalleryGrid from "./components/GalleryGrid";
import ImageLightbox from "./components/ImageLightbox";
import { useDirectoryImages } from "./hooks/useDirectoryImages";
import type { GalleryViewMode } from "./types/gallery";
import { buildAlbums, filterImagesByPath } from "./utils/albums";
import { hasImagePicker } from "./utils/fileSystem";

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
  const [viewMode, setViewMode] = useState<GalleryViewMode>("all");
  const [activeAlbumPath, setActiveAlbumPath] = useState<string | null>(null);
  const [allModePath, setAllModePath] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxUrls, setLightboxUrls] = useState<Record<string, string>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const canPickImages = useMemo(hasImagePicker, []);
  const albums = useMemo(() => buildAlbums(images), [images]);
  const visibleImages = useMemo(() => {
    if (viewMode === "all") return filterImagesByPath(images, allModePath);
    if (!activeAlbumPath) return [];
    return filterImagesByPath(images, activeAlbumPath);
  }, [activeAlbumPath, allModePath, images, viewMode]);
  const isAlbumListView = viewMode === "album" && activeAlbumPath === null;
  const isAlbumDetailView = viewMode === "album" && activeAlbumPath !== null;

  const resetBrowseContext = useCallback(() => {
    setActiveAlbumPath(null);
    setAllModePath("");
    setCurrentIndex(0);
    setLightboxOpen(false);
  }, []);

  const resetViewState = useCallback(() => {
    setViewMode("all");
    resetBrowseContext();
  }, [resetBrowseContext]);

  const openAt = useCallback(
    (index: number) => {
      if (!visibleImages.length) return;
      setCurrentIndex(Math.min(Math.max(index, 0), visibleImages.length - 1));
      setLightboxOpen(true);
    },
    [visibleImages.length]
  );

  const switchToAllMode = useCallback(() => {
    setViewMode("all");
    if (activeAlbumPath) setAllModePath(activeAlbumPath);
    setActiveAlbumPath(null);
    setCurrentIndex(0);
    setLightboxOpen(false);
  }, [activeAlbumPath]);

  const switchToAlbumMode = useCallback(() => {
    setViewMode("album");
    setActiveAlbumPath(null);
    setCurrentIndex(0);
    setLightboxOpen(false);
  }, []);

  const openAlbum = useCallback((path: string) => {
    setViewMode("album");
    setActiveAlbumPath(path);
    setCurrentIndex(0);
    setLightboxOpen(false);
  }, []);

  const onPickDirectory = useCallback(async () => {
    await pickDirectory();
    resetBrowseContext();
  }, [pickDirectory, resetBrowseContext]);

  const onClearImages = useCallback(() => {
    clearImages();
    resetViewState();
  }, [clearImages, resetViewState]);

  useEffect(() => {
    if (!visibleImages.length) {
      setCurrentIndex(0);
      setLightboxOpen(false);
      return;
    }
    if (currentIndex > visibleImages.length - 1) {
      setCurrentIndex(visibleImages.length - 1);
    }
  }, [currentIndex, visibleImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;

    let cancelled = false;
    void syncLightboxWindow(currentIndex, visibleImages).then((urls) => {
      if (cancelled) return;
      setLightboxUrls(urls);
    });

    return () => {
      cancelled = true;
    };
  }, [currentIndex, lightboxOpen, syncLightboxWindow, visibleImages]);

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

      if (!visibleImages.length) return;

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
  }, [currentIndex, lightboxOpen, openAt, visibleImages.length]);

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
          <div className="view-mode-switch" role="tablist" aria-label="浏览模式切换">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "all"}
              aria-pressed={viewMode === "all"}
              className={viewMode === "all" ? "is-active" : ""}
              onClick={switchToAllMode}
            >
              全图模式
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "album"}
              aria-pressed={viewMode === "album"}
              className={viewMode === "album" ? "is-active" : ""}
              onClick={switchToAlbumMode}
            >
              画集模式
            </button>
          </div>
          <div className="path-actions">
            {viewMode === "all" && allModePath && (
              <button type="button" className="text-button" onClick={() => setAllModePath("")}>
                返回根路径全图
              </button>
            )}
            {isAlbumDetailView && (
              <button
                type="button"
                className="text-button"
                onClick={() => setActiveAlbumPath(null)}
              >
                返回画集列表
              </button>
            )}
          </div>
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
            onClick={() => void onPickDirectory()}
            disabled={loading || !canPickImages}
          >
            {loading ? "扫描中..." : "选择文件夹或图片"}
          </button>
          <button type="button" onClick={onClearImages} disabled={!images.length && !error}>
            清空
          </button>
        </div>
      </header>

      {!canPickImages && (
        <p className="status warning">
          当前浏览器不支持本地文件选择，请更换浏览器后重试
        </p>
      )}

      {error && <p className="status error">{error}</p>}

      {!images.length && !loading && !error && (
        <section className="empty-state">
          <h2>还没有可浏览的图片</h2>
          <p>点击上方“选择文件夹或图片”开始建立你的本地图片画廊。</p>
        </section>
      )}

      {isAlbumListView && images.length > 0 && (
        <section className="gallery-shell">
          <p className="status ok">共 {albums.length} 个画集</p>
          {albums.length > 0 ? (
            <AlbumGrid
              albums={albums}
              onOpenAlbum={openAlbum}
              ensurePreviewUrl={ensurePreviewUrl}
              releasePreviewUrl={releasePreviewUrl}
            />
          ) : (
            <section className="empty-state album-empty">
              <h2>当前目录没有可展示的画集</h2>
              <p>画集模式仅展示一级子目录，根目录图片可在全图模式查看。</p>
            </section>
          )}
        </section>
      )}

      {(viewMode === "all" || isAlbumDetailView) && images.length > 0 && (
        <section className="gallery-shell">
          <p className="status ok">
            {viewMode === "all"
              ? `已载入 ${visibleImages.length} 张图片`
              : `画集「${activeAlbumPath}」共 ${visibleImages.length} 张图片`}
          </p>
          {viewMode === "all" && allModePath && (
            <p className="path-tip">当前全图路径：{allModePath}</p>
          )}
          {visibleImages.length > 0 ? (
            <GalleryGrid
              images={visibleImages}
              onOpen={openAt}
              ensurePreviewUrl={ensurePreviewUrl}
              releasePreviewUrl={releasePreviewUrl}
            />
          ) : (
            <section className="empty-state album-empty">
              <h2>当前路径没有可浏览的图片</h2>
              <p>你可以返回根路径全图，或切换到画集模式继续浏览。</p>
            </section>
          )}
        </section>
      )}

      <ImageLightbox
        open={lightboxOpen}
        index={currentIndex}
        images={visibleImages}
        lightboxUrls={lightboxUrls}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={setCurrentIndex}
      />
    </div>
  );
}
