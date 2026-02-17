import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { GalleryImage } from "../types/gallery";
import { BLANK_IMAGE, toLightboxSlides } from "../utils/lightbox";

type ImageLightboxProps = {
  open: boolean;
  index: number;
  images: GalleryImage[];
  lightboxUrls: Record<string, string>;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export default function ImageLightbox({
  open,
  index,
  images,
  lightboxUrls,
  onClose,
  onIndexChange
}: ImageLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={toLightboxSlides(images, lightboxUrls)}
      on={{
        view: ({ index: nextIndex }) => onIndexChange(nextIndex)
      }}
      render={{
        slide: ({ slide }) =>
          slide.src === BLANK_IMAGE ? (
            <div className="lightbox-loading-card">
              <span className="dot" />
              <p>正在载入大图...</p>
            </div>
          ) : undefined
      }}
      carousel={{
        finite: images.length <= 1
      }}
      animation={{
        fade: 0,
        swipe: 0,
        navigation: 0
      }}
    />
  );
}
