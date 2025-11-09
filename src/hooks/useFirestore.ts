import { useState, useEffect, useMemo } from "react";
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  QueryConstraint,
  DocumentData,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

export interface FirestoreDocument extends DocumentData {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Custom hook for Firestore operations
 * @param collectionName - Name of the Firestore collection
 * @param queryConstraints - Optional query constraints (where, orderBy, limit, etc.)
 */
export function useFirestore<T extends FirestoreDocument>(
  collectionName: string,
  ...queryConstraints: QueryConstraint[]
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize the query constraints to prevent infinite loops
  const constraintsKey = useMemo(
    () => JSON.stringify(queryConstraints.map((c) => c.type)),
    [queryConstraints.length]
  );

  useEffect(() => {
    setLoading(true);
    const collectionRef = collection(db, collectionName);
    const q = queryConstraints.length > 0 
      ? query(collectionRef, ...queryConstraints)
      : query(collectionRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const documents = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        setData(documents);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error(`Error fetching ${collectionName}:`, err);
        setError(err as Error);
        setLoading(false);
        toast.error(`Failed to load ${collectionName}`);
      }
    );

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionName, constraintsKey]);

  const addDocument = async (document: Omit<T, "id">) => {
    try {
      const collectionRef = collection(db, collectionName);
      const docRef = await addDoc(collectionRef, {
        ...document,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      toast.success("Document added successfully!");
      return docRef.id;
    } catch (err) {
      console.error(`Error adding document to ${collectionName}:`, err);
      toast.error("Failed to add document");
      throw err;
    }
  };

  const updateDocument = async (id: string, updates: Partial<T>) => {
    try {
      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      });
      toast.success("Document updated successfully!");
    } catch (err) {
      console.error(`Error updating document in ${collectionName}:`, err);
      toast.error("Failed to update document");
      throw err;
    }
  };

  const deleteDocument = async (id: string) => {
    try {
      const docRef = doc(db, collectionName, id);
      await deleteDoc(docRef);
      toast.success("Document deleted successfully!");
    } catch (err) {
      console.error(`Error deleting document from ${collectionName}:`, err);
      toast.error("Failed to delete document");
      throw err;
    }
  };

  return {
    data,
    loading,
    error,
    addDocument,
    updateDocument,
    deleteDocument,
  };
}
