import { useMemo } from "react";
import { RowsPhotoAlbum, type Photo } from "react-photo-album";
import "react-photo-album/rows.css";
import type { GalleryImage } from "../types/gallery";

type GalleryGridProps = {
  images: GalleryImage[];
  onOpen: (index: number) => void;
};

export default function GalleryGrid({ images, onOpen }: GalleryGridProps) {
  const photos = useMemo<Photo[]>(
    () =>
      images.map((image) => ({
        key: image.id,
        src: image.previewUrl,
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
      componentsProps={{
        image: { loading: "lazy" }
      }}
    />
  );
}
