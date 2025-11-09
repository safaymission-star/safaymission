import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFirestore } from "@/hooks/useFirestore";
import { useCloudinary } from "@/hooks/useCloudinary";
import { compressImage, blobToFile, getImageSize } from "@/lib/imageCompression";

interface Employee {
  id: string;
  name: string;
  address: string;
  contact: string;
  photoUrl: string;
  aadharPhotoUrl: string;
}

const AddEmployee = () => {
  const { addDocument } = useFirestore<Employee>("employees");
  const { uploadImage, uploadProgress } = useCloudinary();
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    contact: "",
    photo: null as File | null,
    aadhar: null as File | null,
  });
  const [previews, setPreviews] = useState({
    photo: "",
    aadhar: "",
  });

  const photoInputRef = useRef<HTMLInputElement>(null);
  const aadharInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (type: 'photo' | 'aadhar', file: File | null) => {
    if (file) {
      try {
        // Show original size
        const originalSize = getImageSize(file);
        toast.info(`Original size: ${originalSize} KB - Compressing...`);

        // Compress the image
        const compressedBlob = await compressImage(
          file,
          800, // max width
          800, // max height
          0.7  // quality (70%)
        );

        // Convert blob back to file
        const compressedFile = blobToFile(compressedBlob, file.name);
        const compressedSize = getImageSize(compressedFile);
        
        // Show compression results
        const reduction = Math.round(((originalSize - compressedSize) / originalSize) * 100);
        toast.success(`Compressed to ${compressedSize} KB (${reduction}% smaller)`);

        // Update form data with compressed file
        setFormData(prev => ({
          ...prev,
          [type]: compressedFile
        }));

        // Create preview URL
        const previewUrl = URL.createObjectURL(compressedBlob);
        setPreviews(prev => ({
          ...prev,
          [type]: previewUrl
        }));
      } catch (error) {
        console.error("Error compressing image:", error);
        toast.error("Failed to compress image. Please try another image.");
      }
    }
  };

  const removeFile = (type: 'photo' | 'aadhar') => {
    setFormData(prev => ({
      ...prev,
      [type]: null
    }));
    setPreviews(prev => ({
      ...prev,
      [type]: ""
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.photo || !formData.aadhar) {
      toast.error("Please upload both photo and Aadhar");
      return;
    }

    setUploading(true);

    try {
      // Upload photo to Cloudinary
      toast.info("Uploading employee photo...");
      const photoUrl = await uploadImage(formData.photo, "employees/photos");
      
      // Upload Aadhar to Cloudinary
      toast.info("Uploading Aadhar photo...");
      const aadharPhotoUrl = await uploadImage(formData.aadhar, "employees/aadhar");

      // Save employee data to Firestore
      await addDocument({
        name: formData.name,
        address: formData.address,
        contact: formData.contact,
        photoUrl,
        aadharPhotoUrl,
      } as Omit<Employee, "id">);

      toast.success("Employee added successfully!");
      
      // Reset form
      setFormData({
        name: "",
        address: "",
        contact: "",
        photo: null,
        aadhar: null,
      });
      setPreviews({
        photo: "",
        aadhar: "",
      });
    } catch (error) {
      console.error("Error saving employee:", error);
      toast.error("Failed to add employee. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Add Employee</h1>
        <p className="text-muted-foreground mt-1">Register a new employee</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="empName">Employee Name</Label>
                <Input
                  id="empName"
                  placeholder="Enter employee name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="empContact">Contact Number</Label>
                <Input
                  id="empContact"
                  placeholder="Enter contact number"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="empAddress">Address</Label>
              <Textarea
                id="empAddress"
                placeholder="Enter complete address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="min-h-[100px]"
              />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="empPhoto">Employee Photo</Label>
                {previews.photo ? (
                  <div className="relative">
                    <img 
                      src={previews.photo} 
                      alt="Employee preview" 
                      className="w-full h-[200px] object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeFile('photo')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                    onClick={() => photoInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload photo</p>
                    <Input
                      ref={photoInputRef}
                      id="empPhoto"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange('photo', e.target.files?.[0] || null)}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="aadharPhoto">Aadhar Photo</Label>
                {previews.aadhar ? (
                  <div className="relative">
                    <img 
                      src={previews.aadhar} 
                      alt="Aadhar preview" 
                      className="w-full h-[200px] object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeFile('aadhar')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
                    onClick={() => aadharInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload Aadhar</p>
                    <Input
                      ref={aadharInputRef}
                      id="aadharPhoto"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileChange('aadhar', e.target.files?.[0] || null)}
                    />
                  </div>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {uploadProgress.uploading ? `Uploading... ${uploadProgress.progress.toFixed(0)}%` : "Processing..."}
                </>
              ) : (
                "Add Employee"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddEmployee;
