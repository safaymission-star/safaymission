import { collection, query, where, getDocs, deleteDoc, doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import { deleteMultipleCloudinaryImages } from "./cloudinaryDelete";

/**
 * Delete all documents in a collection that match a field value
 * @param collectionName - The name of the collection
 * @param fieldName - The field to match
 * @param fieldValue - The value to match
 * @returns Number of documents deleted
 */
export const deleteRelatedDocuments = async (
  collectionName: string,
  fieldName: string,
  fieldValue: string
): Promise<number> => {
  try {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, where(fieldName, "==", fieldValue));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return 0;
    }

    // Delete all matching documents
    const deletions = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletions);
    
    return snapshot.size;
  } catch (error) {
    console.error(`Error deleting related documents from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Delete an employee and all their related data (cascade delete)
 * @param employeeId - The employee ID to delete
 * @returns Object with deletion counts
 */
export const cascadeDeleteEmployee = async (employeeId: string) => {
  const results = {
    attendance: 0,
    images: 0,
    // Add more collections here as needed in the future
    // payments: 0,
    // leaves: 0,
  };

  try {
    // First, get the employee document to retrieve image URLs
    const employeeRef = doc(db, "employees", employeeId);
    const employeeDoc = await getDoc(employeeRef);
    
    if (employeeDoc.exists()) {
      const employeeData = employeeDoc.data();
      const imageUrls: string[] = [];
      
      // Collect all image URLs
      if (employeeData.photoUrl) {
        imageUrls.push(employeeData.photoUrl);
      }
      if (employeeData.aadharPhotoUrl) {
        imageUrls.push(employeeData.aadharPhotoUrl);
      }
      
      // Delete images from Cloudinary
      if (imageUrls.length > 0) {
        console.log(`Deleting ${imageUrls.length} images from Cloudinary...`);
        results.images = await deleteMultipleCloudinaryImages(imageUrls);
      }
    }
    
    // Delete attendance records
    results.attendance = await deleteRelatedDocuments("attendance", "employeeId", employeeId);
    
    // Add more related collections here as your app grows
    // results.payments = await deleteRelatedDocuments("payments", "employeeId", employeeId);
    // results.leaves = await deleteRelatedDocuments("leaves", "employeeId", employeeId);
    
    return results;
  } catch (error) {
    console.error("Error in cascade delete:", error);
    throw error;
  }
};

/**
 * Get count of related documents before deletion (for confirmation dialog)
 * @param employeeId - The employee ID
 * @returns Object with counts
 */
export const getRelatedDataCounts = async (employeeId: string) => {
  const counts = {
    attendance: 0,
    images: 0,
  };

  try {
    // Count attendance records
    const attendanceRef = collection(db, "attendance");
    const attendanceQuery = query(attendanceRef, where("employeeId", "==", employeeId));
    const attendanceSnapshot = await getDocs(attendanceQuery);
    counts.attendance = attendanceSnapshot.size;

    // Count images
    const employeeRef = doc(db, "employees", employeeId);
    const employeeDoc = await getDoc(employeeRef);
    if (employeeDoc.exists()) {
      const employeeData = employeeDoc.data();
      if (employeeData.photoUrl) counts.images++;
      if (employeeData.aadharPhotoUrl) counts.images++;
    }

    return counts;
  } catch (error) {
    console.error("Error getting related data counts:", error);
    return counts;
  }
};
