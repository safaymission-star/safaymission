/**
 * Optimize Cloudinary image URL for faster loading
 * Adds transformations for automatic format, quality, and size optimization
 */
export const optimizeCloudinaryUrl = (
  url: string,
  options: {
    width?: number;
    height?: number;
    quality?: 'auto' | 'auto:low' | 'auto:good' | 'auto:best';
    format?: 'auto' | 'webp' | 'jpg' | 'png';
    crop?: 'limit' | 'fill' | 'scale' | 'fit';
  } = {}
): string => {
  // Return original URL if not a Cloudinary URL
  if (!url || !url.includes('cloudinary.com')) {
    return url;
  }

  const {
    width = 400,
    height = 400,
    quality = 'auto:good',
    format = 'auto',
    crop = 'limit'
  } = options;

  // Build transformation string
  const transformations = [
    `w_${width}`,
    `h_${height}`,
    `c_${crop}`,
    `q_${quality}`,
    `f_${format}`,
  ].join(',');

  // Insert transformations into URL
  // Cloudinary URL structure: https://res.cloudinary.com/[cloud_name]/image/upload/[transformations]/[public_id]
  const uploadIndex = url.indexOf('/upload/');
  if (uploadIndex === -1) {
    return url;
  }

  const beforeUpload = url.substring(0, uploadIndex + 8); // include '/upload/'
  const afterUpload = url.substring(uploadIndex + 8);

  // Check if transformations already exist
  if (afterUpload.includes('w_') || afterUpload.includes('q_')) {
    // URL already has transformations, return as is
    return url;
  }

  return `${beforeUpload}${transformations}/${afterUpload}`;
};

/**
 * Get optimized thumbnail URL from Cloudinary image
 */
export const getCloudinaryThumbnail = (url: string): string => {
  return optimizeCloudinaryUrl(url, {
    width: 150,
    height: 150,
    quality: 'auto:low',
    crop: 'fill'
  });
};

/**
 * Get optimized avatar URL from Cloudinary image
 */
export const getCloudinaryAvatar = (url: string): string => {
  return optimizeCloudinaryUrl(url, {
    width: 200,
    height: 200,
    quality: 'auto:good',
    crop: 'fill'
  });
};

/**
 * Get optimized preview URL from Cloudinary image
 */
export const getCloudinaryPreview = (url: string): string => {
  return optimizeCloudinaryUrl(url, {
    width: 800,
    height: 800,
    quality: 'auto:good',
    crop: 'limit'
  });
};
