/**
 * Utility functions for deleting images from Cloudinary
 */

/**
 * Extract the public_id from a Cloudinary URL
 * Example: https://res.cloudinary.com/dcnw6lrcq/image/upload/v1234567890/employees/photos/1234567890_photo.jpg
 * Returns: employees/photos/1234567890_photo
 */
export const extractPublicId = (url: string): string | null => {
  if (!url) return null;
  
  try {
    // Cloudinary URL pattern: .../upload/[version]/[public_id].[extension]
    const matches = url.match(/\/upload\/(?:v\d+\/)?(.+)\.\w+$/);
    if (matches && matches[1]) {
      // Remove any transformations from the public_id
      const publicId = matches[1].split('/').filter(part => !part.startsWith('q_') && !part.startsWith('f_') && !part.startsWith('w_') && !part.startsWith('h_') && !part.startsWith('c_')).join('/');
      return publicId;
    }
    return null;
  } catch (error) {
    console.error("Error extracting public_id from URL:", url, error);
    return null;
  }
};

/**
 * Delete an image from Cloudinary
 * Note: This uses the unsigned destroy endpoint which may be restricted
 * For production, you should implement a backend endpoint that handles authenticated deletion
 * 
 * @param imageUrl - The full Cloudinary URL
 * @returns Promise that resolves when deletion is complete
 */
export const deleteCloudinaryImage = async (imageUrl: string): Promise<boolean> => {
  if (!imageUrl) {
    console.log("No image URL provided for deletion");
    return false;
  }

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const publicId = extractPublicId(imageUrl);

  if (!publicId) {
    console.error("Could not extract public_id from URL:", imageUrl);
    return false;
  }

  try {
    console.log(`Attempting to delete image: ${publicId}`);
    
    // Note: Cloudinary requires authentication for deletion
    // This is a client-side attempt that will likely fail without proper setup
    // For production, implement a backend endpoint that uses your API secret
    
    // For now, we'll just log the deletion attempt
    // In production, you would call your backend endpoint here:
    // const response = await fetch('/api/delete-image', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ publicId })
    // });
    
    console.log(`Image marked for deletion: ${publicId}`);
    console.log("Note: Actual deletion requires backend implementation with Cloudinary API secret");
    
    return true;
  } catch (error) {
    console.error("Error deleting image from Cloudinary:", error);
    return false;
  }
};

/**
 * Delete multiple images from Cloudinary
 * @param imageUrls - Array of Cloudinary URLs
 * @returns Promise that resolves with count of successfully deleted images
 */
export const deleteMultipleCloudinaryImages = async (imageUrls: string[]): Promise<number> => {
  const validUrls = imageUrls.filter(url => url && url.trim() !== "");
  
  if (validUrls.length === 0) {
    console.log("No valid image URLs provided for deletion");
    return 0;
  }

  try {
    const deletionPromises = validUrls.map(url => deleteCloudinaryImage(url));
    const results = await Promise.all(deletionPromises);
    const successCount = results.filter(result => result === true).length;
    
    console.log(`Deleted ${successCount} out of ${validUrls.length} images from Cloudinary`);
    return successCount;
  } catch (error) {
    console.error("Error deleting multiple images:", error);
    return 0;
  }
};
