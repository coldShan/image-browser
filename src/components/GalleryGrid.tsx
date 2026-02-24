import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Eye } from "lucide-react";
import {
  RowsPhotoAlbum,
  type Photo,
  type RenderButtonContext,
  type RenderButtonProps,
  type RenderImageContext,
  type RenderImageProps
} from "react-photo-album";
import "react-photo-album/rows.css";
import type { GalleryImage } from "../types/gallery";
import { BLANK_IMAGE } from "../utils/lightbox";

const PREVIEW_RELEASE_DELAY_MS = 10_000;
const SCROLL_SETTLE_DELAY_MS = 180;

type LazyPreviewImageProps = RenderImageProps & {
  imageId: string;
  scrollSettled: boolean;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

function LazyPreviewImage({
  imageId,
  scrollSettled,
  ensurePreviewUrl,
  releasePreviewUrl,
  ...imgProps
}: LazyPreviewImageProps) {
  const [src, setSrc] = useState(BLANK_IMAGE);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);

  const clearReleaseTimer = useCallback(() => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const loadPreview = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const url = await ensurePreviewUrl(imageId);
    if (requestId !== requestIdRef.current) return;
    if (url) {
      setSrc(url);
    }
  }, [ensurePreviewUrl, imageId]);

  const scheduleRelease = useCallback(() => {
    clearReleaseTimer();
    timerRef.current = window.setTimeout(() => {
      releasePreviewUrl(imageId);
      setSrc(BLANK_IMAGE);
      setIsLoaded(false);
    }, PREVIEW_RELEASE_DELAY_MS);
  }, [clearReleaseTimer, imageId, releasePreviewUrl]);

  useEffect(() => {
    setSrc(BLANK_IMAGE);
    setIsLoaded(false);
    clearReleaseTimer();

    if (typeof IntersectionObserver !== "function") {
      void loadPreview();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: "300px 0px" }
    );

    const element = imgRef.current;
    if (element) observer.observe(element);

    return () => {
      requestIdRef.current++;
      clearReleaseTimer();
      releasePreviewUrl(imageId);
      observer.disconnect();
    };
  }, [clearReleaseTimer, imageId, loadPreview, releasePreviewUrl, scheduleRelease]);

  useEffect(() => {
    if (!isVisible) {
      scheduleRelease();
      return;
    }

    clearReleaseTimer();
    if (!scrollSettled) return;
    void loadPreview();
  }, [clearReleaseTimer, isVisible, loadPreview, scheduleRelease, scrollSettled]);

  return (
    <img
      ref={imgRef}
      {...imgProps}
      className={`gallery-photo-image${isLoaded ? " is-loaded" : " is-loading"}`}
      src={src}
      loading="lazy"
      decoding="async"
      onLoad={() => setIsLoaded(src !== BLANK_IMAGE)}
      style={{
        ...imgProps.style,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block"
      }}
    />
  );
}

type GalleryGridProps = {
  images: GalleryImage[];
  onOpen: (index: number) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
  lastViewedRelativePath?: string | null;
  restoreRelativePath?: string | null;
  restoreToken?: string | number;
};

const renderPhotoButton =
  (images: GalleryImage[]) =>
  (props: RenderButtonProps, context: RenderButtonContext<Photo>) => {
    const image = images[context.index];
    return (
      <button
        {...(props as ComponentProps<"button">)}
        className={`${props.className ?? ""} gallery-photo-button`.trim()}
        aria-label={props["aria-label"] ?? "打开图片"}
        data-gallery-path={image?.relativePath}
      />
    );
  };

const renderPhotoExtras = (
  images: GalleryImage[],
  lastViewedRelativePath?: string | null
) =>
  function renderExtras(_: unknown, context: RenderImageContext) {
    const image = images[context.index];
    if (!image) return null;
    const isLastViewed = Boolean(
      lastViewedRelativePath && image.relativePath === lastViewedRelativePath
    );

    return (
      <>
        <div className="gallery-photo-meta" aria-hidden>
          <strong>{image.name}</strong>
          <span>{image.relativePath}</span>
        </div>
        {isLastViewed && (
          <p className="gallery-last-viewed-badge">
            <Eye size={13} aria-hidden />
            上次看到这里
          </p>
        )}
      </>
    );
  };

const renderPreviewImage = (
  scrollSettled: boolean,
  ensurePreviewUrl: (id: string) => Promise<string | null>,
  releasePreviewUrl: (id: string) => void,
  images: GalleryImage[]
) =>
  function renderImage(props: RenderImageProps, context: RenderImageContext) {
    const image = images[context.index];
    if (!image) return <img {...props} />;

    return (
      <LazyPreviewImage
        key={image.id}
        imageId={image.id}
        scrollSettled={scrollSettled}
        ensurePreviewUrl={ensurePreviewUrl}
        releasePreviewUrl={releasePreviewUrl}
        {...props}
      />
    );
  };

export default function GalleryGrid({
  images,
  onOpen,
  ensurePreviewUrl,
  releasePreviewUrl,
  lastViewedRelativePath,
  restoreRelativePath,
  restoreToken
}: GalleryGridProps) {
  const [scrollSettled, setScrollSettled] = useState(true);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const restoredRef = useRef<string | null>(null);
  const photos = useMemo<Photo[]>(
    () =>
      images.map((image) => ({
        key: image.id,
        src: BLANK_IMAGE,
        width: image.width ?? 4,
        height: image.height ?? 3,
        alt: image.name,
        title: image.relativePath,
        label: `打开 ${image.name}`
      })),
    [images]
  );

  useEffect(() => {
    let timer: number | null = null;

    const onScrollActivity = () => {
      setScrollSettled(false);
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setScrollSettled(true);
      }, SCROLL_SETTLE_DELAY_MS);
    };

    window.addEventListener("scroll", onScrollActivity, { passive: true });
    window.addEventListener("wheel", onScrollActivity, { passive: true });
    window.addEventListener("touchmove", onScrollActivity, { passive: true });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("scroll", onScrollActivity);
      window.removeEventListener("wheel", onScrollActivity);
      window.removeEventListener("touchmove", onScrollActivity);
    };
  }, []);

  useEffect(() => {
    if (!restoreRelativePath || restoreToken === undefined) return;
    const restoreKey = `${String(restoreToken)}:${restoreRelativePath}`;
    if (restoredRef.current === restoreKey) return;
    restoredRef.current = restoreKey;

    const root = rootRef.current;
    if (!root) return;

    const rafId = window.requestAnimationFrame(() => {
      const target = Array.from(
        root.querySelectorAll<HTMLElement>(".gallery-photo-button[data-gallery-path]")
      ).find((node) => node.dataset.galleryPath === restoreRelativePath);
      target?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [restoreRelativePath, restoreToken]);

  if (!photos.length) return null;

  return (
    <div ref={rootRef} className="gallery-grid-shell">
      <p className={`gallery-recover-hint${scrollSettled ? "" : " is-visible"}`} role="status">
        正在快速滚动，停止后会自动加载当前区域图片。
      </p>
      <RowsPhotoAlbum
        photos={photos}
        onClick={({ index }) => onOpen(index)}
        targetRowHeight={230}
        spacing={16}
        render={{
          button: renderPhotoButton(images),
          extras: renderPhotoExtras(images, lastViewedRelativePath),
          image: renderPreviewImage(
            scrollSettled,
            ensurePreviewUrl,
            releasePreviewUrl,
            images
          )
        }}
      />
    </div>
  );
}
