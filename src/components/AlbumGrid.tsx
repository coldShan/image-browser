import { History } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { AlbumSummary } from "../types/gallery";
import { BLANK_IMAGE } from "../utils/lightbox";

type AlbumGridProps = {
  albums: AlbumSummary[];
  onOpenAlbum: (path: string) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
  progressByAlbumPath?: Record<string, number>;
  recentAlbumPath?: string | null;
  restoreAlbumPath?: string | null;
  restoreToken?: string | number;
};

type AlbumCardProps = {
  album: AlbumSummary;
  onOpenAlbum: (path: string) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  progress: number;
  isRecent: boolean;
};

function AlbumCard({
  album,
  onOpenAlbum,
  ensurePreviewUrl,
  progress,
  isRecent
}: AlbumCardProps) {
  const [coverSrc, setCoverSrc] = useState(BLANK_IMAGE);
  const progressPercent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  useEffect(() => {
    let cancelled = false;
    setCoverSrc(BLANK_IMAGE);

    void ensurePreviewUrl(album.coverImageId).then((url) => {
      if (cancelled || !url) return;
      setCoverSrc(url);
    });

    return () => {
      cancelled = true;
    };
  }, [album.coverImageId, ensurePreviewUrl]);

  return (
    <button
      type="button"
      className="album-card"
      onClick={() => onOpenAlbum(album.path)}
      aria-label={`打开画集 ${album.title}`}
      data-album-path={album.path}
    >
      <div className="album-cover-wrap">
        <img
          className={`album-cover${coverSrc === BLANK_IMAGE ? " is-loading" : ""}`}
          src={coverSrc}
          alt={album.coverRelativePath}
          loading="lazy"
          decoding="async"
        />
      </div>
      <div className="album-meta">
        <strong>{album.title}</strong>
        <span>{album.imageCount} 张图片</span>
        <div
          className="album-progress"
          role="progressbar"
          aria-label={`画集 ${album.title} 阅读进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressPercent}
        >
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
        <p className="album-progress-text">{`阅读进度 ${progressPercent}%`}</p>
        {isRecent && (
          <p className="album-recent-badge">
            <History size={14} aria-hidden />
            最近阅读
          </p>
        )}
      </div>
    </button>
  );
}

export default function AlbumGrid({
  albums,
  onOpenAlbum,
  ensurePreviewUrl,
  progressByAlbumPath,
  recentAlbumPath,
  restoreAlbumPath,
  restoreToken
}: AlbumGridProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const restoredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!restoreAlbumPath || restoreToken === undefined) return;
    const restoreKey = `${String(restoreToken)}:${restoreAlbumPath}`;
    if (restoredRef.current === restoreKey) return;
    restoredRef.current = restoreKey;

    const section = sectionRef.current;
    if (!section) return;

    const rafId = window.requestAnimationFrame(() => {
      const target = Array.from(
        section.querySelectorAll<HTMLElement>("[data-album-path]")
      ).find((node) => node.dataset.albumPath === restoreAlbumPath);
      target?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" });
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [restoreAlbumPath, restoreToken]);

  if (!albums.length) return null;

  return (
    <section ref={sectionRef} className="album-grid" aria-label="画集列表">
      {albums.map((album) => (
        <AlbumCard
          key={album.path}
          album={album}
          onOpenAlbum={onOpenAlbum}
          ensurePreviewUrl={ensurePreviewUrl}
          progress={progressByAlbumPath?.[album.path] ?? 0}
          isRecent={recentAlbumPath === album.path}
        />
      ))}
    </section>
  );
}
