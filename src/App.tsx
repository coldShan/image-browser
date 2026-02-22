import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AlbumGrid from "./components/AlbumGrid";
import AlbumDetailModal from "./components/AlbumDetailModal";
import GalleryGrid from "./components/GalleryGrid";
import ImageLightbox from "./components/ImageLightbox";
import { useDirectoryImages } from "./hooks/useDirectoryImages";
import type { GalleryViewMode } from "./types/gallery";
import { buildAlbums, filterImagesByPath } from "./utils/albums";
import { hasImagePicker } from "./utils/fileSystem";

const HEADER_SCROLL_THRESHOLD = 80;
const HEADER_SCROLL_DEBOUNCE_MS = 80;
const LIGHTBOX_SWITCH_THROTTLE_MS = 30;

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
    refreshCurrentDirectory,
    canRefreshCurrentDirectory,
    clearImages,
    ensurePreviewUrl,
    releasePreviewUrl,
    syncLightboxWindow,
    releaseAllLightboxUrls
  } = useDirectoryImages();
  const [viewMode, setViewMode] = useState<GalleryViewMode>("all");
  const [activeAlbumPath, setActiveAlbumPath] = useState<string | null>(null);
  const [albumDetailOpen, setAlbumDetailOpen] = useState(false);
  const [allModePath, setAllModePath] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxScope, setLightboxScope] = useState<"all" | "album">("all");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxUrls, setLightboxUrls] = useState<Record<string, string>>({});
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const lightboxThrottleRef = useRef<{
    lastTriggeredAt: number;
    pendingIndex: number | null;
    timerId: ReturnType<typeof window.setTimeout> | null;
  }>({
    lastTriggeredAt: 0,
    pendingIndex: null,
    timerId: null
  });

  const canPickImages = useMemo(hasImagePicker, []);
  const albums = useMemo(() => buildAlbums(images), [images]);
  const allVisibleImages = useMemo(
    () => filterImagesByPath(images, allModePath),
    [allModePath, images]
  );
  const albumDetailImages = useMemo(() => {
    if (!activeAlbumPath) return [];
    return filterImagesByPath(images, activeAlbumPath);
  }, [activeAlbumPath, images]);
  const lightboxImages = useMemo(
    () => (lightboxScope === "album" ? albumDetailImages : allVisibleImages),
    [albumDetailImages, allVisibleImages, lightboxScope]
  );
  const isAlbumListView = viewMode === "album";

  const resetBrowseContext = useCallback(() => {
    setActiveAlbumPath(null);
    setAlbumDetailOpen(false);
    setAllModePath("");
    setLightboxScope("all");
    setCurrentIndex(0);
    setLightboxOpen(false);
  }, []);

  const resetViewState = useCallback(() => {
    setViewMode("all");
    resetBrowseContext();
  }, [resetBrowseContext]);

  const openAt = useCallback(
    (index: number, scope: "all" | "album") => {
      const target = scope === "album" ? albumDetailImages : allVisibleImages;
      if (!target.length) return;
      setLightboxScope(scope);
      setCurrentIndex(Math.min(Math.max(index, 0), target.length - 1));
      setLightboxOpen(true);
    },
    [albumDetailImages, allVisibleImages]
  );

  const openAllAt = useCallback(
    (index: number) => {
      openAt(index, "all");
    },
    [openAt]
  );

  const openAlbumAt = useCallback(
    (index: number) => {
      openAt(index, "album");
    },
    [openAt]
  );

  const closeAlbumDetail = useCallback(() => {
    setAlbumDetailOpen(false);
    setLightboxOpen(false);
    setLightboxScope("all");
    setCurrentIndex(0);
  }, []);

  const onAlbumModalClose = useCallback(() => {
    if (lightboxOpen) {
      setLightboxOpen(false);
      return;
    }
    closeAlbumDetail();
  }, [closeAlbumDetail, lightboxOpen]);

  const switchToAllMode = useCallback(() => {
    setViewMode("all");
    if (activeAlbumPath) setAllModePath(activeAlbumPath);
    closeAlbumDetail();
    setActiveAlbumPath(null);
  }, [activeAlbumPath, closeAlbumDetail]);

  const switchToAlbumMode = useCallback(() => {
    setViewMode("album");
    closeAlbumDetail();
    setActiveAlbumPath(null);
  }, [closeAlbumDetail]);

  const openAlbum = useCallback((path: string) => {
    setViewMode("album");
    setActiveAlbumPath(path);
    setAlbumDetailOpen(true);
    setCurrentIndex(0);
    setLightboxOpen(false);
    setLightboxScope("album");
  }, []);

  const onPickDirectory = useCallback(async () => {
    await pickDirectory();
    resetBrowseContext();
  }, [pickDirectory, resetBrowseContext]);

  const onClearImages = useCallback(() => {
    clearImages();
    resetViewState();
  }, [clearImages, resetViewState]);

  const onRefreshCurrentDirectory = useCallback(async () => {
    await refreshCurrentDirectory();
  }, [refreshCurrentDirectory]);

  const resetLightboxThrottle = useCallback(() => {
    const state = lightboxThrottleRef.current;
    if (state.timerId !== null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }
    state.pendingIndex = null;
    state.lastTriggeredAt = 0;
  }, []);

  const onLightboxIndexChange = useCallback(
    (nextIndex: number) => {
      const state = lightboxThrottleRef.current;
      const now = Date.now();
      const elapsed = now - state.lastTriggeredAt;
      const run = (index: number) => {
        state.lastTriggeredAt = Date.now();
        setCurrentIndex(index);
      };

      if (state.lastTriggeredAt === 0 || elapsed >= LIGHTBOX_SWITCH_THROTTLE_MS) {
        if (state.timerId !== null) {
          window.clearTimeout(state.timerId);
          state.timerId = null;
        }
        state.pendingIndex = null;
        run(nextIndex);
        return;
      }

      state.pendingIndex = nextIndex;
      if (state.timerId !== null) return;
      state.timerId = window.setTimeout(() => {
        state.timerId = null;
        if (state.pendingIndex === null) return;
        const targetIndex = state.pendingIndex;
        state.pendingIndex = null;
        run(targetIndex);
      }, LIGHTBOX_SWITCH_THROTTLE_MS - elapsed);
    },
    []
  );

  useEffect(() => resetLightboxThrottle, [resetLightboxThrottle]);

  useEffect(() => {
    if (!lightboxImages.length) {
      setCurrentIndex(0);
      setLightboxOpen(false);
      return;
    }
    if (currentIndex > lightboxImages.length - 1) {
      setCurrentIndex(lightboxImages.length - 1);
    }
  }, [currentIndex, lightboxImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;

    let cancelled = false;
    void syncLightboxWindow(currentIndex, lightboxImages).then((urls) => {
      if (cancelled) return;
      setLightboxUrls(urls);
    });

    return () => {
      cancelled = true;
    };
  }, [currentIndex, lightboxImages, lightboxOpen, syncLightboxWindow]);

  useEffect(() => {
    if (lightboxOpen) return;
    resetLightboxThrottle();
    releaseAllLightboxUrls();
    setLightboxUrls({});
  }, [lightboxOpen, releaseAllLightboxUrls, resetLightboxThrottle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.key === "f" || event.key === "F") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (!lightboxOpen && event.key === "Enter") {
        event.preventDefault();
        if (albumDetailOpen) {
          openAlbumAt(currentIndex);
          return;
        }
        if (viewMode === "all") {
          openAllAt(currentIndex);
        }
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (lightboxOpen) {
          setLightboxOpen(false);
          return;
        }
        if (albumDetailOpen) {
          closeAlbumDetail();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    albumDetailOpen,
    closeAlbumDetail,
    currentIndex,
    lightboxOpen,
    openAlbumAt,
    openAllAt,
    viewMode
  ]);

  useEffect(() => {
    let scrolledTimer: ReturnType<typeof window.setTimeout> | null = null;

    const applyScrolledState = (y: number) => {
      setIsScrolled(y > HEADER_SCROLL_THRESHOLD);
    };

    const updateScrollProgress = (y: number) => {
      const doc = document.documentElement;
      const max = Math.max(doc.scrollHeight - window.innerHeight, 1);
      setScrollProgress(Math.min(Math.max(y / max, 0), 1));
    };

    const onScroll = () => {
      const y = window.scrollY;
      if (scrolledTimer !== null) window.clearTimeout(scrolledTimer);
      scrolledTimer = window.setTimeout(() => {
        applyScrolledState(y);
        scrolledTimer = null;
      }, HEADER_SCROLL_DEBOUNCE_MS);
      updateScrollProgress(y);
    };

    const initialY = window.scrollY;
    applyScrolledState(initialY);
    updateScrollProgress(initialY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrolledTimer !== null) window.clearTimeout(scrolledTimer);
    };
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
            {albumDetailOpen && (
              <button type="button" className="text-button" onClick={closeAlbumDetail}>
                关闭画集详情
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
          <button
            type="button"
            onClick={() => void onRefreshCurrentDirectory()}
            disabled={loading || !canRefreshCurrentDirectory}
          >
            刷新当前目录
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

      {viewMode === "all" && images.length > 0 && (
        <section className="gallery-shell">
          <p className="status ok">{`已载入 ${allVisibleImages.length} 张图片`}</p>
          {allModePath && <p className="path-tip">当前全图路径：{allModePath}</p>}
          {allVisibleImages.length > 0 ? (
            <GalleryGrid
              images={allVisibleImages}
              onOpen={openAllAt}
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

      <AlbumDetailModal
        open={albumDetailOpen && viewMode === "album"}
        albumPath={activeAlbumPath}
        images={albumDetailImages}
        onClose={onAlbumModalClose}
        onOpenImage={openAlbumAt}
        ensurePreviewUrl={ensurePreviewUrl}
        releasePreviewUrl={releasePreviewUrl}
      />

      <ImageLightbox
        open={lightboxOpen}
        index={currentIndex}
        images={lightboxImages}
        lightboxUrls={lightboxUrls}
        onClose={() => setLightboxOpen(false)}
        onIndexChange={onLightboxIndexChange}
      />
    </div>
  );
}
