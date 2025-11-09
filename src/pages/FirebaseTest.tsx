import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const FirebaseTest = () => {
  const [status, setStatus] = useState<{
    firestore: "testing" | "success" | "error";
    message: string;
  }>({
    firestore: "testing",
    message: "Testing connection...",
  });

  useEffect(() => {
    const testFirestore = async () => {
      try {
        // Try to read from Firestore
        const testCollection = collection(db, "employees");
        await getDocs(testCollection);
        
        setStatus({
          firestore: "success",
          message: "Firestore is connected and working!",
        });
      } catch (error: any) {
        console.error("Firestore error:", error);
        setStatus({
          firestore: "error",
          message: error.message || "Failed to connect to Firestore",
        });
      }
    };

    testFirestore();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Firebase Connection Test</h1>
        <p className="text-muted-foreground mt-1">Checking your Firebase setup</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Firestore Database</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            {status.firestore === "testing" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span>Testing connection...</span>
              </>
            )}
            {status.firestore === "success" && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-700">{status.message}</span>
              </>
            )}
            {status.firestore === "error" && (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-red-700 font-medium">Connection Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{status.message}</p>
                </div>
              </>
            )}
          </div>

          {status.firestore === "error" && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="font-medium mb-2">How to fix:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Firebase Console</a></li>
                <li>Select your project: <code className="bg-gray-200 px-1 rounded">safay-1</code></li>
                <li>Go to <strong>Firestore Database</strong> in the left menu</li>
                <li>If not created, click <strong>"Create database"</strong></li>
                <li>Choose <strong>"Start in test mode"</strong></li>
                <li>Click <strong>"Enable"</strong></li>
                <li>Refresh this page</li>
              </ol>
            </div>
          )}

          {status.firestore === "success" && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-700">
                ✅ Firestore is working correctly! You can now add employees.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Firebase Project ID:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">
                {import.meta.env.VITE_FIREBASE_PROJECT_ID || "Not set"}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cloudinary Cloud Name:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">
                {import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "Not set"}
              </code>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cloudinary Preset:</span>
              <code className="bg-gray-100 px-2 py-1 rounded">
                {import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "Not set"}
              </code>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FirebaseTest;
