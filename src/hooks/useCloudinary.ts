import { useState } from "react";
import { toast } from "sonner";

export interface CloudinaryUploadProgress {
  progress: number;
  url: string | null;
  error: Error | null;
  uploading: boolean;
}

/**
 * Custom hook for Cloudinary image uploads
 * Uploads images directly to Cloudinary using unsigned upload
 */
export function useCloudinary() {
  const [uploadProgress, setUploadProgress] = useState<CloudinaryUploadProgress>({
    progress: 0,
    url: null,
    error: null,
    uploading: false,
  });

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  /**
   * Upload an image file to Cloudinary
   * @param file - Image file to upload
   * @param folder - Optional folder name in Cloudinary (e.g., 'employees/photos')
   * @returns Promise with the uploaded image URL
   */
  const uploadImage = async (file: File, folder?: string): Promise<string> => {
    if (!cloudName || !uploadPreset) {
      const error = new Error("Cloudinary credentials not configured. Please check your .env file.");
      toast.error("Cloudinary not configured");
      throw error;
    }

    return new Promise((resolve, reject) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", uploadPreset);
        
        // Add folder if specified (combined with upload preset folder)
        if (folder) {
          formData.append("folder", folder);
        }

        setUploadProgress({
          progress: 0,
          url: null,
          error: null,
          uploading: true,
        });

        // Create XMLHttpRequest for progress tracking
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const progress = (e.loaded / e.total) * 100;
            setUploadProgress((prev) => ({
              ...prev,
              progress,
            }));
          }
        });

        // Handle successful upload
        xhr.addEventListener("load", () => {
          if (xhr.status === 200) {
            try {
              const response = JSON.parse(xhr.responseText);
              const imageUrl = response.secure_url;

              setUploadProgress({
                progress: 100,
                url: imageUrl,
                error: null,
                uploading: false,
              });

              resolve(imageUrl);
            } catch (error) {
              const err = new Error("Failed to parse Cloudinary response");
              setUploadProgress({
                progress: 0,
                url: null,
                error: err,
                uploading: false,
              });
              toast.error("Upload failed");
              reject(err);
            }
          } else {
            // Log the error response for debugging
            let errorMessage = `Upload failed with status ${xhr.status}`;
            try {
              const errorResponse = JSON.parse(xhr.responseText);
              console.error("Cloudinary error response:", errorResponse);
              if (errorResponse.error && errorResponse.error.message) {
                errorMessage += `: ${errorResponse.error.message}`;
              }
            } catch (e) {
              console.error("Raw error response:", xhr.responseText);
            }
            
            const error = new Error(errorMessage);
            setUploadProgress({
              progress: 0,
              url: null,
              error,
              uploading: false,
            });
            toast.error("Upload failed. Check console for details.");
            reject(error);
          }
        });

        // Handle upload error
        xhr.addEventListener("error", () => {
          const error = new Error("Network error during upload");
          setUploadProgress({
            progress: 0,
            url: null,
            error,
            uploading: false,
          });
          toast.error("Upload failed");
          reject(error);
        });

        // Send the request
        xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
        xhr.send(formData);
      } catch (error) {
        console.error("Upload initialization error:", error);
        setUploadProgress({
          progress: 0,
          url: null,
          error: error as Error,
          uploading: false,
        });
        toast.error("Failed to start upload");
        reject(error);
      }
    });
  };

  /**
   * Delete an image from Cloudinary
   * Note: This requires a backend endpoint as deletion requires authentication
   * For now, this is a placeholder that returns success
   */
  const deleteImage = async (imageUrl: string): Promise<void> => {
    console.log("Delete image:", imageUrl);
    // Note: Actual deletion requires server-side implementation
    // Cloudinary doesn't support unsigned deletion for security reasons
    toast.info("Image marked for deletion");
  };

  /**
   * Reset upload progress
   */
  const resetProgress = () => {
    setUploadProgress({
      progress: 0,
      url: null,
      error: null,
      uploading: false,
    });
  };

  return {
    uploadImage,
    deleteImage,
    uploadProgress,
    resetProgress,
  };
}
