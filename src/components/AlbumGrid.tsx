import { useEffect, useState } from "react";
import type { AlbumSummary } from "../types/gallery";
import { BLANK_IMAGE } from "../utils/lightbox";

type AlbumGridProps = {
  albums: AlbumSummary[];
  onOpenAlbum: (path: string) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
  releasePreviewUrl: (id: string) => void;
};

type AlbumCardProps = {
  album: AlbumSummary;
  onOpenAlbum: (path: string) => void;
  ensurePreviewUrl: (id: string) => Promise<string | null>;
};

function AlbumCard({
  album,
  onOpenAlbum,
  ensurePreviewUrl
}: AlbumCardProps) {
  const [coverSrc, setCoverSrc] = useState(BLANK_IMAGE);

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
      </div>
    </button>
  );
}

export default function AlbumGrid({
  albums,
  onOpenAlbum,
  ensurePreviewUrl
}: AlbumGridProps) {
  if (!albums.length) return null;

  return (
    <section className="album-grid" aria-label="画集列表">
      {albums.map((album) => (
        <AlbumCard
          key={album.path}
          album={album}
          onOpenAlbum={onOpenAlbum}
          ensurePreviewUrl={ensurePreviewUrl}
        />
      ))}
    </section>
  );
}
