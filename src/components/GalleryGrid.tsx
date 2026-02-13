import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  RowsPhotoAlbum,
  type Photo,
  type RenderImageContext,
  type RenderImageProps
} from "react-photo-album";
import "react-photo-album/rows.css";
import type { GalleryImage } from "../types/gallery";
import { BLANK_IMAGE } from "../utils/lightbox";

const PREVIEW_RELEASE_DELAY_MS = 10_000;

type LazyPreviewImageProps = RenderImageProps & {
  imageId: string;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

function LazyPreviewImage({
  imageId,
  ensurePreviewUrl,
  releasePreviewUrl,
  ...imgProps
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
    const url = await ensurePreviewUrl(imageId);
    if (requestId !== requestIdRef.current) return;
    if (url) setSrc(url);
  }, [ensurePreviewUrl, imageId]);

  const scheduleRelease = useCallback(() => {
    clearReleaseTimer();
    timerRef.current = window.setTimeout(() => {
      releasePreviewUrl(imageId);
      setSrc(BLANK_IMAGE);
    }, PREVIEW_RELEASE_DELAY_MS);
  }, [clearReleaseTimer, imageId, releasePreviewUrl]);

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
      releasePreviewUrl(imageId);
      observer.disconnect();
    };
  }, [clearReleaseTimer, imageId, loadPreview, releasePreviewUrl, scheduleRelease]);

  return (
    <img
      ref={imgRef}
      {...imgProps}
      src={src}
      loading="lazy"
      decoding="async"
      style={{
        ...imgProps.style,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        background: "#ebe2d6",
        borderRadius: "12px"
      }}
    />
  );
}

type GalleryGridProps = {
  images: GalleryImage[];
  onOpen: (index: number) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

const renderPreviewImage = (
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
  releasePreviewUrl
}: GalleryGridProps) {
  const photos = useMemo<Photo[]>(
    () =>
      images.map((image) => ({
        key: image.id,
        src: BLANK_IMAGE,
        width: image.width ?? 4,
        height: image.height ?? 3,
        alt: image.name,
        title: image.relativePath
      })),
    [images]
  );

  if (!photos.length) return null;

  return (
    <RowsPhotoAlbum
      photos={photos}
      onClick={({ index }) => onOpen(index)}
      targetRowHeight={220}
      spacing={14}
      render={{
        image: renderPreviewImage(ensurePreviewUrl, releasePreviewUrl, images)
      }}
    />
  );
}
