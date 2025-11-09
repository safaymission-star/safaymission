import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, MapPin, Phone, DollarSign, Loader2, Trash2, Edit, CheckCircle, Share2 } from "lucide-react";
import { useFirestore } from "@/hooks/useFirestore";
import { orderBy, collection, query, where, getDocs, deleteDoc } from "firebase/firestore";
import { toast } from "sonner";
import { db } from "@/lib/firebase";

interface PendingWork {
  id: string;
  customerName: string;
  contact: string;
  address: string;
  workType: string;
  description: string;
  estimatedCost: number;
  status: "pending" | "in-progress" | "completed";
  assignedTo?: string;
  secondWorker?: string;
  startTime?: string;
  completedTime?: string;
  date: string;
  type?: string; // "membership" or "individual"
}

interface MembershipMember {
  id: string;
  name: string;
  contact: string;
  address: string;
}

interface Employee {
  id: string;
  name: string;
  photoUrl?: string;
}

const PendingWorks = () => {
  const { data: employees } = useFirestore<Employee>("employees");
  const { data: works, loading, updateDocument, deleteDocument } = useFirestore<PendingWork>(
    "pendingWorks",
    orderBy("createdAt", "desc")
  );

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedWork, setSelectedWork] = useState<PendingWork | null>(null);
  const [formData, setFormData] = useState<{
    customerName: string;
    contact: string;
    address: string;
    workType: string;
    description: string;
    estimatedCost: number;
    status: "pending" | "in-progress" | "completed";
    assignedTo: string;
    secondWorker: string;
    date: string;
  }>({
    customerName: "",
    contact: "",
    address: "",
    workType: "",
    description: "",
    estimatedCost: 0,
    status: "pending",
    assignedTo: "",
    secondWorker: "",
    date: new Date().toISOString().split('T')[0],
  });

  const resetForm = () => {
    setFormData({
      customerName: "",
      contact: "",
      address: "",
      workType: "",
      description: "",
      estimatedCost: 0,
      status: "pending",
      assignedTo: "",
      secondWorker: "",
      date: new Date().toISOString().split('T')[0],
    });
  };

  /**
   * Delete related membership member if work type is membership
   */
  const deleteMembershipMember = async (work: PendingWork) => {
    if (work.type !== "membership") {
      return 0; // Not a membership, nothing to delete
    }

    try {
      // Find membership member by matching name and contact
      const membersRef = collection(db, "membershipMembers");
      const q = query(
        membersRef,
        where("name", "==", work.customerName),
        where("contact", "==", work.contact)
      );
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        console.log("No matching membership member found");
        return 0;
      }

      // Delete all matching members (should be only one, but just in case)
      const deletions = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletions);

      console.log(`Deleted ${snapshot.size} membership member(s)`);
      return snapshot.size;
    } catch (error) {
      console.error("Error deleting membership member:", error);
      return 0;
    }
  };

  const handleEdit = (work: PendingWork) => {
    setSelectedWork(work);
    setFormData({
      customerName: work.customerName,
      contact: work.contact,
      address: work.address,
      workType: work.workType,
      description: work.description,
      estimatedCost: work.estimatedCost,
      status: work.status,
      assignedTo: work.assignedTo || "",
      secondWorker: work.secondWorker || "",
      date: work.date,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWork) return;
    try {
      await updateDocument(selectedWork.id, formData);
      setIsEditDialogOpen(false);
      resetForm();
      setSelectedWork(null);
    } catch (error) {
      console.error("Error updating work:", error);
    }
  };

  const handleShare = async (work: PendingWork) => {
    try {
      const assignedWorkers = [];
      if (work.assignedTo) {
        const worker1 = employees?.find(emp => emp.id === work.assignedTo)?.name || work.assignedTo;
        assignedWorkers.push(worker1);
      }
      if (work.secondWorker) {
        const worker2 = employees?.find(emp => emp.id === work.secondWorker)?.name || work.secondWorker;
        assignedWorkers.push(worker2);
      }

      // Generate Google Maps link
      const encodedAddress = encodeURIComponent(work.address);
      const googleMapsLink = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

      const workDetails = `
🏗️ Work Details from Safay Hub

Customer: ${work.customerName}
Type: ${work.type === "membership" ? "Membership Work" : "Individual Work"}
Work: ${work.workType}
Status: ${work.status.toUpperCase()}
Date: ${format(new Date(work.date), "dd/MM/yyyy")}

📝 Description:
${work.description}

📍 Location: ${work.address}
📍 Google Maps: ${googleMapsLink}
📱 Contact: ${work.contact}
💰 Estimated Cost: ₹${work.estimatedCost.toLocaleString()}

${assignedWorkers.length > 0 ? `👷 Assigned Workers:\n${assignedWorkers.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : ''}
${work.startTime ? `\n⏱️ Started: ${format(new Date(work.startTime), "dd/MM/yyyy HH:mm")}` : ''}
`.trim();

      if (navigator.share) {
        await navigator.share({
          title: `Work Details - ${work.customerName}`,
          text: workDetails
        });
        toast.success("Work details shared successfully!");
      } else {
        await navigator.clipboard.writeText(workDetails);
        toast.success("Work details copied to clipboard!");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error("Error sharing work details:", err);
        toast.error("Failed to share work details");
      }
    }
  };

  const handleDelete = async (work: PendingWork) => {
    // Build confirmation message
    let confirmMessage = `Are you sure you want to delete this work for ${work.customerName}?`;
    
    if (work.type === "membership") {
      confirmMessage += "\n\n⚠️ This will also delete the associated membership member!";
    }
    
    confirmMessage += "\n\nThis action cannot be undone.";

    if (!confirm(confirmMessage)) {
      return;
    }

    const deleteToast = toast.loading(
      work.type === "membership" 
        ? `Deleting work and membership member...` 
        : `Deleting work...`
    );

    try {
      // Delete membership member first if applicable
      const memberDeleted = await deleteMembershipMember(work);

      // Then delete the pending work
      await deleteDocument(work.id);

      // Show success message
      if (work.type === "membership" && memberDeleted > 0) {
        toast.success(`Successfully deleted pending work`, {
          id: deleteToast,
          description: `Also deleted ${memberDeleted} membership member(s)`
        });
      } else {
        toast.success("Successfully deleted pending work", {
          id: deleteToast,
        });
      }
    } catch (error) {
      console.error("Error deleting work:", error);
      toast.error("Failed to delete work. Please try again.", {
        id: deleteToast,
      });
    }
  };

  const handleStatusChange = async (work: PendingWork, newStatus: "pending" | "in-progress" | "completed") => {
    try {
      const updates: Partial<PendingWork> = { status: newStatus };

      // If starting work, set startTime if not already set
      if (newStatus === "in-progress") {
        updates.startTime = work.startTime || new Date().toISOString();
      }

      // If completing work, set completedTime (and ensure startTime exists)
      if (newStatus === "completed") {
        updates.completedTime = new Date().toISOString();
        if (!work.startTime) {
          updates.startTime = new Date().toISOString();
        }
      }

      await updateDocument(work.id, updates);

      // Friendly toast with formatted times
      const startMsg = updates.startTime ? ` Start: ${format(new Date(updates.startTime), "dd/MM/yyyy HH:mm:ss")}.` : "";
      const doneMsg = updates.completedTime ? ` Completed: ${format(new Date(updates.completedTime), "dd/MM/yyyy HH:mm:ss")}.` : "";
      toast.success(`Work marked as ${newStatus}.${startMsg}${doneMsg}`);
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status. Please try again.");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: "secondary",
      "in-progress": "default",
      completed: "outline",
    };
    return variants[status as keyof typeof variants] || "secondary";
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: "text-yellow-600",
      "in-progress": "text-blue-600",
      completed: "text-green-600",
    };
    return colors[status as keyof typeof colors] || "text-gray-600";
  };

  const renderForm = (onSubmit: (e: React.FormEvent) => void) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="customerName">Customer Name</Label>
          <Input
            id="customerName"
            value={formData.customerName}
            onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact">Contact</Label>
          <Input
            id="contact"
            value={formData.contact}
            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Input
          id="address"
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="workType">Work Type</Label>
          <Input
            id="workType"
            placeholder="e.g., Plumbing, Electrical"
            value={formData.workType}
            onChange={(e) => setFormData({ ...formData, workType: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimatedCost">Estimated Cost (₹)</Label>
          <Input
            id="estimatedCost"
            type="number"
            value={formData.estimatedCost}
            onChange={(e) => setFormData({ ...formData, estimatedCost: Number(e.target.value) })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          required
          rows={3}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assignedTo">First Worker (Optional)</Label>
          <Select 
            value={formData.assignedTo} 
            onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select first worker">
                {employees?.find(emp => emp.id === formData.assignedTo)?.name || "Select worker"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees?.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="secondWorker">Second Worker (Optional)</Label>
          <Select 
            value={formData.secondWorker} 
            onValueChange={(value) => setFormData({ ...formData, secondWorker: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select second worker">
                {employees?.find(emp => emp.id === formData.secondWorker)?.name || "Select worker"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {employees?.map((employee) => (
                <SelectItem key={employee.id} value={employee.id}>
                  {employee.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button type="submit" className="w-full">
        Update Work
      </Button>
    </form>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pending Works</h1>
        <p className="text-muted-foreground mt-1">
          Manage your work requests. Add new inquiries via Contact Form.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {(works || []).filter(w => w.status !== 'completed').map((work) => (
              <Card key={work.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-xl">{work.customerName}</CardTitle>
                        {work.type && (
                          <Badge variant={work.type === "membership" ? "default" : "secondary"} className="text-xs">
                            {work.type === "membership" ? "👑 Membership" : "📋 Individual"}
                          </Badge>
                        
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{work.workType}</p>
                    </div>
                    <Badge variant={getStatusBadge(work.status) as any}>
                      <span className={getStatusColor(work.status)}>
                        {work.status.replace("-", " ").toUpperCase()}
                      </span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{work.description}</p>
                  
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{work.contact}</span>
                    </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(new Date(work.date), "dd/MM/yyyy")}</span>
                  </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{work.address}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">₹{work.estimatedCost.toLocaleString()}</span>
                    </div>
                  </div>

                    {(work.assignedTo || work.secondWorker) && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Assigned to: </span>
                      <div className="font-medium space-y-1">
                        {work.assignedTo && (
                          <div>
                            1. {employees?.find(emp => emp.id === work.assignedTo)?.name || work.assignedTo}
                          </div>
                        )}
                        {work.secondWorker && (
                          <div>
                            2. {employees?.find(emp => emp.id === work.secondWorker)?.name || work.secondWorker}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {(work.startTime || work.completedTime) && (
                    <div className="text-sm text-muted-foreground">
                      {work.startTime && (
                        <div>
                          <span className="font-medium">Started:</span> {format(new Date(work.startTime), "dd/MM/yyyy HH:mm:ss")}
                        </div>
                      )}
                      {work.completedTime && (
                        <div>
                          <span className="font-medium">Completed:</span> {format(new Date(work.completedTime), "dd/MM/yyyy HH:mm:ss")}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {work.status !== "completed" && (
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleStatusChange(work, work.status === "pending" ? "in-progress" : "completed")}
                      >
                        <CheckCircle className="mr-1 h-3 w-3" />
                        {work.status === "pending" ? "Start Work" : "Complete"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => handleEdit(work)}>
                      <Edit className="mr-1 h-3 w-3" />
                      Edit
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => handleShare(work)}>
                      <Share2 className="mr-1 h-3 w-3" />
                      Share
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(work)}>
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {works.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No pending works yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Add new inquiries via the Contact Form to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Work</DialogTitle>
          </DialogHeader>
          {renderForm(handleUpdate)}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingWorks;
