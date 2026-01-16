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
    pixelCrop: { x: number; y: number; width: number; height: number }
): Promise<string> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return "";
    }

    // Enforce maximum dimensions to keep base64 size manageable for Firestore
    const MAX_WIDTH = 1080;
    let targetWidth = pixelCrop.width;
    let targetHeight = pixelCrop.height;

    if (targetWidth > MAX_WIDTH) {
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
        targetHeight
    );

    // Reduced quality slightly to significantly reduce base64 string length
    return canvas.toDataURL('image/jpeg', 0.7);
}
