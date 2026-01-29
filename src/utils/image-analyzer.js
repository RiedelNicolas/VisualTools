/**
 * Analyze image dimensions
 * @param {File} file - Image file
 * @returns {Promise<{ width: number, height: number }>}
 */
export function getImageDimensions(file) {
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

/**
 * Analyze multiple images and find max dimensions
 * @param {File[]} files - Image files
 * @returns {Promise<{ maxWidth: number, maxHeight: number, dimensions: Array<{ width: number, height: number }> }>}
 */
export async function analyzeImages(files) {
  const dimensions = await Promise.all(files.map(file => getImageDimensions(file)));
  
  const maxWidth = Math.max(...dimensions.map(d => d.width));
  const maxHeight = Math.max(...dimensions.map(d => d.height));
  
  return { maxWidth, maxHeight, dimensions };
}

/**
 * Calculate the common height for side-by-side comparison
 * @param {Array<{ width: number, height: number }>} dimensions - Image dimensions
 * @returns {number} Common height
 */
export function calculateCommonHeight(dimensions) {
  // Use the maximum height
  return Math.max(...dimensions.map(d => d.height));
}
