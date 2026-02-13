import { useCallback, useEffect, useRef, useState } from "react";
import type { GalleryImage } from "../types/gallery";
import { BLANK_IMAGE } from "../utils/lightbox";

const PREVIEW_RELEASE_DELAY_MS = 10_000;

type LazyPreviewImageProps = {
  image: GalleryImage;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

function LazyPreviewImage({
  image,
  ensurePreviewUrl,
  releasePreviewUrl
}: LazyPreviewImageProps) {
  const [src, setSrc] = useState(BLANK_IMAGE);
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
    const url = await ensurePreviewUrl(image.id);
    if (requestId !== requestIdRef.current) return;
    if (url) setSrc(url);
  }, [ensurePreviewUrl, image.id]);

  const scheduleRelease = useCallback(() => {
    clearReleaseTimer();
    timerRef.current = window.setTimeout(() => {
      releasePreviewUrl(image.id);
      setSrc(BLANK_IMAGE);
    }, PREVIEW_RELEASE_DELAY_MS);
  }, [clearReleaseTimer, image.id, releasePreviewUrl]);

  useEffect(() => {
    setSrc(BLANK_IMAGE);
    clearReleaseTimer();

    if (typeof IntersectionObserver !== "function") {
      void loadPreview();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry) return;
        if (entry.isIntersecting) {
          clearReleaseTimer();
          void loadPreview();
        } else {
          scheduleRelease();
        }
      },
      { rootMargin: "300px 0px" }
    );

    const element = imgRef.current;
    if (element) observer.observe(element);

    return () => {
      requestIdRef.current++;
      clearReleaseTimer();
      releasePreviewUrl(image.id);
      observer.disconnect();
    };
  }, [clearReleaseTimer, image.id, loadPreview, releasePreviewUrl, scheduleRelease]);

  return (
    <img
      ref={imgRef}
      className="masonry-thumb"
      src={src}
      alt={image.name}
      title={image.relativePath}
      loading="lazy"
      decoding="async"
    />
  );
}

type GalleryGridProps = {
  images: GalleryImage[];
  onOpen: (index: number) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

export default function GalleryGrid({
  images,
  onOpen,
  ensurePreviewUrl,
  releasePreviewUrl
}: GalleryGridProps) {
  if (!images.length) return null;

  return (
    <div className="gallery-masonry">
      {images.map((image, index) => (
        <button
          key={image.id}
          type="button"
          className="masonry-item"
          onClick={() => onOpen(index)}
          aria-label={`Open ${image.name}`}
        >
          <LazyPreviewImage
            image={image}
            ensurePreviewUrl={ensurePreviewUrl}
            releasePreviewUrl={releasePreviewUrl}
          />
        </button>
      ))}
    </div>
  );
}
