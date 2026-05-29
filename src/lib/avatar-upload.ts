const MAX_INPUT_FILE_SIZE = 8 * 1024 * 1024;
const OUTPUT_SIZE = 384;
const OUTPUT_QUALITY = 0.86;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that image.'));
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read that image.'));
        return;
      }

      resolve(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not process that image.'));
    image.src = src;
  });
}

export async function prepareAvatarUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file.');
  }

  if (file.size > MAX_INPUT_FILE_SIZE) {
    throw new Error('That image is too large. Please choose one under 8 MB.');
  }

  const sourceDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Your browser could not prepare that image.');
  }

  const cropSize = Math.min(image.width, image.height);
  const sourceX = (image.width - cropSize) / 2;
  const sourceY = (image.height - cropSize) / 2;

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, sourceX, sourceY, cropSize, cropSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  const outputDataUrl = canvas.toDataURL('image/jpeg', OUTPUT_QUALITY);

  if (!outputDataUrl) {
    throw new Error('Could not prepare that image.');
  }

  return outputDataUrl;
}
