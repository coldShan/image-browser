import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { GalleryImage } from "../types/gallery";
import { toLightboxSlides } from "../utils/lightbox";

type ImageLightboxProps = {
  open: boolean;
  index: number;
  images: GalleryImage[];
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export default function ImageLightbox({
  open,
  index,
  images,
  onClose,
  onIndexChange
}: ImageLightboxProps) {
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={toLightboxSlides(images)}
      on={{
        view: ({ index: nextIndex }) => onIndexChange(nextIndex)
      }}
    />
  );
}
