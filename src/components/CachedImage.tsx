import { Image as ExpoImage, type ImageProps as ExpoImageProps } from 'expo-image';
import { memo } from 'react';

type CachedImageProps = ExpoImageProps & {
  uri: string;
};

/** Disk-cached remote image (prefer over RN Image for URLs). */
export const CachedImage = memo(function CachedImage({
  uri,
  contentFit = 'contain',
  transition = 200,
  ...rest
}: CachedImageProps) {
  return (
    <ExpoImage
      source={{ uri }}
      contentFit={contentFit}
      transition={transition}
      cachePolicy="memory-disk"
      {...rest}
    />
  );
});
