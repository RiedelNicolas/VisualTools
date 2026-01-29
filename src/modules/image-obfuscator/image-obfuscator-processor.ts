/**
 * Processor for applying obfuscation effects to images
 */

export interface RedactionRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RedactionEffect = 'blur' | 'pixelate';

export class ImageObfuscatorProcessor {
  /**
   * Apply redaction effects to an image
   * @param imageFile The image file to process
   * @param regions Array of regions to redact
   * @param effect The type of effect to apply (blur or pixelate)
   * @returns Promise<Uint8Array> The processed image data
   */
  async process(
    imageFile: File,
    regions: RedactionRegion[],
    effect: RedactionEffect
  ): Promise<Uint8Array> {
    if (regions.length === 0) {
      throw new Error('No regions selected for redaction');
    }

    // Create canvas and load image
    const img = await this.loadImage(imageFile);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = img.width;
    canvas.height = img.height;
    
    // Draw the original image
    ctx.drawImage(img, 0, 0);

    // Apply redaction to each region
    for (const region of regions) {
      if (effect === 'blur') {
        this.applyBlur(ctx, region);
      } else {
        this.applyPixelate(ctx, region);
      }
    }

    // Convert canvas to Uint8Array
    return await this.canvasToUint8Array(canvas);
  }

  /**
   * Load an image file into an HTMLImageElement
   */
  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Apply blur effect to a region
   */
  private applyBlur(ctx: CanvasRenderingContext2D, region: RedactionRegion): void {
    // Save the current state
    ctx.save();

    // Extract the region to blur
    const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
    
    // Create a temporary canvas for blurring
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) {
      ctx.restore();
      return;
    }

    tempCanvas.width = region.width;
    tempCanvas.height = region.height;
    tempCtx.putImageData(imageData, 0, 0);

    // Apply blur by drawing the image multiple times at slightly different positions
    // This creates a blur effect without external libraries
    ctx.filter = 'blur(10px)';
    ctx.drawImage(tempCanvas, region.x, region.y, region.width, region.height);
    
    ctx.restore();
  }

  /**
   * Apply pixelate effect to a region
   */
  private applyPixelate(ctx: CanvasRenderingContext2D, region: RedactionRegion): void {
    const pixelSize = 10; // Size of each "pixel" in the pixelated effect

    // Get the image data for the region
    const imageData = ctx.getImageData(region.x, region.y, region.width, region.height);
    const data = imageData.data;

    // Pixelate by averaging colors in blocks
    for (let y = 0; y < region.height; y += pixelSize) {
      for (let x = 0; x < region.width; x += pixelSize) {
        // Calculate the average color for this block
        let r = 0, g = 0, b = 0, count = 0;
        
        for (let py = 0; py < pixelSize && y + py < region.height; py++) {
          for (let px = 0; px < pixelSize && x + px < region.width; px++) {
            const idx = ((y + py) * region.width + (x + px)) * 4;
            if (idx < data.length) {
              r += data[idx] ?? 0;
              g += data[idx + 1] ?? 0;
              b += data[idx + 2] ?? 0;
              count++;
            }
          }
        }

        // Average the colors
        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        // Fill the block with the average color
        for (let py = 0; py < pixelSize && y + py < region.height; py++) {
          for (let px = 0; px < pixelSize && x + px < region.width; px++) {
            const idx = ((y + py) * region.width + (x + px)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
          }
        }
      }
    }

    // Put the pixelated data back
    ctx.putImageData(imageData, region.x, region.y);
  }

  /**
   * Convert canvas to Uint8Array
   */
  private canvasToUint8Array(canvas: HTMLCanvasElement): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to convert canvas to blob'));
          return;
        }
        
        const reader = new FileReader();
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer;
          resolve(new Uint8Array(arrayBuffer));
        };
        reader.onerror = () => reject(new Error('Failed to read blob'));
        reader.readAsArrayBuffer(blob);
      }, 'image/png');
    });
  }
}
