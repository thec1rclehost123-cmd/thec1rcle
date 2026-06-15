export const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues
    image.src = url;
  });

export default async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  options?: {
    outputWidth?: number;
    outputHeight?: number;
    quality?: number;
  },
): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return '';
  }

  const outputWidth = options?.outputWidth;
  const outputHeight = options?.outputHeight;
  const quality = options?.quality ?? 0.7;

  const MAX_WIDTH = 1080;
  let targetWidth = pixelCrop.width;
  let targetHeight = pixelCrop.height;

  if (outputWidth && outputHeight) {
    targetWidth = outputWidth;
    targetHeight = outputHeight;
  } else if (targetWidth > 1080) {
    const scale = MAX_WIDTH / targetWidth;
    targetWidth = MAX_WIDTH;
    targetHeight = targetHeight * scale;
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return canvas.toDataURL('image/jpeg', quality);
}
