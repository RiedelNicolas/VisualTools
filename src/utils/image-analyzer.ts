import type { ImageDimensions, ImageAnalysisResult } from '../types.ts';

export function getImageDimensions(file: File): Promise<ImageDimensions> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    
    img.src = url;
  });
}

export async function analyzeImages(files: File[]): Promise<ImageAnalysisResult> {
  const dimensions = await Promise.all(files.map(file => getImageDimensions(file)));
  
  const maxWidth = Math.max(...dimensions.map(d => d.width));
  const maxHeight = Math.max(...dimensions.map(d => d.height));
  
  return { maxWidth, maxHeight, dimensions };
}

export function calculateCommonHeight(dimensions: ImageDimensions[]): number {
  return Math.max(...dimensions.map(d => d.height));
}
