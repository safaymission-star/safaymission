import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useFirestore } from "@/hooks/useFirestore";

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
  date: string;
  membershipDuration?: string;
  type?: string; // "membership" or "individual"
}

interface MembershipMember {
  id: string;
  name: string;
  contact: string;
  address: string;
  status: string;
  joinDate: string;
  membershipType: string;
  rate: string;
  membershipDuration?: string;
}

interface Employee {
  id: string;
  name: string;
  photoUrl?: string;
}

const ContactForm = () => {
  const { data: employees } = useFirestore<Employee>("employees");
  const { addDocument: addPendingWork } = useFirestore<PendingWork>("pendingWorks");
  const { addDocument: addMember } = useFirestore<MembershipMember>("membershipMembers");
  
  const [date, setDate] = useState<Date>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    inquiryType: "",
    address: "",
    rate: "",
    type: "",
    workerName: "",
    secondWorkerName: "",
    membershipDuration: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // If membership, ensure duration selected
      if (formData.type === "membership" && !formData.membershipDuration) {
        toast.error("Please select membership duration");
        setIsSubmitting(false);
        return;
      }
      // 1. Create Pending Work entry
      const pendingWorkData = {
        customerName: formData.name,
        contact: formData.contact,
        address: formData.address,
        workType: formData.inquiryType,
        description: `${formData.type === "membership" ? "Membership" : "Individual Work"} - ${formData.inquiryType}`,
        estimatedCost: formData.rate ? Number(formData.rate) : 0,
        status: "pending" as const,
        assignedTo: formData.workerName,
        secondWorker: formData.secondWorkerName,
        date: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        membershipDuration: formData.membershipDuration,
        type: formData.type,
      };

      await addPendingWork(pendingWorkData as Omit<PendingWork, "id">);
      
      // 2. If membership type, create Membership Member
      if (formData.type === "membership") {
        const memberData = {
          name: formData.name,
          contact: formData.contact,
          address: formData.address,
          status: "Active",
          joinDate: date ? format(date, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
          membershipType: formData.inquiryType,
          rate: formData.rate ? `₹${formData.rate}` : "₹0",
          membershipDuration: formData.membershipDuration,
        };

        await addMember(memberData as Omit<MembershipMember, "id">);
        
        toast.success("Inquiry added to Pending Works & Membership Member created!", {
          description: `${formData.name} has been added as a member`,
        });
      } else {
        toast.success("Inquiry added to Pending Works!", {
          description: "You can track it in the Pending Works page",
        });
      }

      // Reset form
      setFormData({
        name: "",
        contact: "",
        inquiryType: "",
        address: "",
        rate: "",
        type: "",
        workerName: "",
        secondWorkerName: "",
        membershipDuration: "",
      });
      setDate(undefined);
    } catch (err) {
      console.error("Error saving inquiry:", err);
      toast.error("Failed to save inquiry. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Contact Form</h1>
        <p className="text-muted-foreground mt-1">Add new inquiry or work request</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New Inquiry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Enter customer name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact">Contact Number</Label>
                <Input
                  id="contact"
                  placeholder="Enter contact number"
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="inquiryType">Inquiry Type</Label>
                <Select
                  value={formData.inquiryType}
                  onValueChange={(value) => setFormData({ ...formData, inquiryType: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select service type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="પાર્કિંગ સફાઈ">પાર્કિંગ સફાઈ</SelectItem>
                    <SelectItem value="ચેર ડ્રાઇકલિંનીગ">ચેર ડ્રાઇકલિંનીગ</SelectItem>
                    <SelectItem value="ઘર સફાઈ">ઘર સફાઈ</SelectItem>
                    <SelectItem value="કાર્પેટ સફાઈ">કાર્પેટ સફાઈ</SelectItem>
                    <SelectItem value="સોલર સફાઈ">સોલર સફાઈ</SelectItem>
                    <SelectItem value="ઓફિસ સફાઈ">ઓફિસ સફાઈ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Work Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "dd/MM/yyyy") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate">Rate (Price)</Label>
                <Input
                  id="rate"
                  placeholder="Enter rate in ₹"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="membership">Membership</SelectItem>
                    <SelectItem value="individual">Individual Work</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === "membership" && (
                <div className="space-y-2">
                  <Label htmlFor="membershipDuration">Membership Duration</Label>
                  <Select
                    value={formData.membershipDuration}
                    onValueChange={(value) => setFormData({ ...formData, membershipDuration: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select duration" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10days">10 days</SelectItem>
                      <SelectItem value="15days">15 days</SelectItem>
                      <SelectItem value="20days">20 days</SelectItem>
                      <SelectItem value="30days">30 days</SelectItem>
                      <SelectItem value="60days">60 days</SelectItem>
                      <SelectItem value="3month">3 months</SelectItem>
                      <SelectItem value="4month">4 months</SelectItem>
                      <SelectItem value="5month">5 months</SelectItem>
                      <SelectItem value="6month">6 months</SelectItem>
                      <SelectItem value="7month">7 months</SelectItem>
                      <SelectItem value="8month">8 months</SelectItem>
                      <SelectItem value="9month">9 months</SelectItem>
                      <SelectItem value="10month">10 months</SelectItem>
                      <SelectItem value="11month">11 months</SelectItem>
                      <SelectItem value="12month">12 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="workerName">First Worker Name</Label>
                <Select
                  value={formData.workerName}
                  onValueChange={(value) => setFormData({ ...formData, workerName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select first worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondWorkerName">Second Worker Name</Label>
                <Select
                  value={formData.secondWorkerName}
                  onValueChange={(value) => setFormData({ ...formData, secondWorkerName: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select second worker" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                placeholder="Enter complete address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="min-h-[100px]"
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Add Inquiry"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContactForm;
