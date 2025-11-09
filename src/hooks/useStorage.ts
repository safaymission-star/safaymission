import { useState } from "react";
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/firebase";
import { toast } from "sonner";

export interface UploadProgress {
  progress: number;
  url: string | null;
  error: Error | null;
  uploading: boolean;
}

/**
 * Custom hook for Firebase Storage operations
 */
export function useStorage() {
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    progress: 0,
    url: null,
    error: null,
    uploading: false,
  });

  /**
   * Upload a file to Firebase Storage
   * @param file - File to upload
   * @param path - Storage path (e.g., 'employees/photos/')
   * @returns Promise with download URL
   */
  const uploadFile = async (file: File, path: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name}`;
        const storageRef = ref(storage, `${path}/${fileName}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        setUploadProgress({
          progress: 0,
          url: null,
          error: null,
          uploading: true,
        });

        uploadTask.on(
          "state_changed",
          (snapshot) => {
            const progress =
              (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress((prev) => ({
              ...prev,
              progress,
            }));
          },
          (error) => {
            console.error("Upload error:", error);
            setUploadProgress({
              progress: 0,
              url: null,
              error: error as Error,
              uploading: false,
            });
            toast.error("Failed to upload file");
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress({
                progress: 100,
                url: downloadURL,
                error: null,
                uploading: false,
              });
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
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
   * Delete a file from Firebase Storage
   * @param fileUrl - Full URL of the file to delete
   */
  const deleteFile = async (fileUrl: string): Promise<void> => {
    try {
      const fileRef = ref(storage, fileUrl);
      await deleteObject(fileRef);
      toast.success("File deleted successfully");
    } catch (error) {
      console.error("Error deleting file:", error);
      toast.error("Failed to delete file");
      throw error;
    }
  };

  return {
    uploadFile,
    deleteFile,
    uploadProgress,
  };
}
