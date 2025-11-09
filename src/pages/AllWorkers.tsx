import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, MapPin, Loader2, Trash2, Edit, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFirestore } from "@/hooks/useFirestore";
import { orderBy } from "firebase/firestore";
import { toast } from "sonner";
import { getCloudinaryAvatar, getCloudinaryPreview } from "@/lib/cloudinaryOptimizer";
import { cascadeDeleteEmployee, getRelatedDataCounts } from "@/lib/cascadeDelete";

interface Employee {
  id: string;
  name: string;
  address: string;
  contact: string;
  photoUrl: string;
  aadharPhotoUrl: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // yyyy-MM-dd
  status: "present" | "absent" | "half-day" | "leave";
}

interface UpadRecord {
  id: string;
  employeeId: string;
  amount: number;
  date: string; // yyyy-MM-dd when upad was given
  note?: string | null; // Make note explicitly optional and allow null
}

const AllWorkers = () => {
  const { data: workers, loading, error, deleteDocument } = useFirestore<Employee>("employees", orderBy("createdAt", "desc"));
  const { data: attendanceRecords } = useFirestore<AttendanceRecord>("attendance", orderBy("date", "desc"));
  const { data: upads, addDocument: addUpad } = useFirestore<UpadRecord>("upads", orderBy("createdAt", "desc"));
  const [selectedWorker, setSelectedWorker] = useState<Employee | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [upadAmount, setUpadAmount] = useState<string>("");
  const [upadNote, setUpadNote] = useState<string>("");
  const [isSavingUpad, setIsSavingUpad] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [isChangingMonth, setIsChangingMonth] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleViewDetails = (worker: Employee) => {
    setSelectedWorker(worker);
    setIsDetailDialogOpen(true);
  };

  const handleDelete = async (worker: Employee) => {
    try {
      // Get counts of related data
      const counts = await getRelatedDataCounts(worker.id);
      
      // Build confirmation message
      let confirmMessage = `Are you sure you want to delete ${worker.name}?\n\n`;
      
      const itemsToDelete = [];
      if (counts.attendance > 0) {
        itemsToDelete.push(`${counts.attendance} attendance record(s)`);
      }
      if (counts.images > 0) {
        itemsToDelete.push(`${counts.images} image(s) from Cloudinary`);
      }
      
      if (itemsToDelete.length > 0) {
        confirmMessage += `This will also delete:\n`;
        itemsToDelete.forEach(item => {
          confirmMessage += `• ${item}\n`;
        });
        confirmMessage += `\n`;
      }
      
      confirmMessage += `This action cannot be undone.`;
      
      if (!confirm(confirmMessage)) {
        return;
      }

      const deleteToast = toast.loading(`Deleting ${worker.name} and related data...`);

      // Perform cascade delete (includes Cloudinary images)
      const results = await cascadeDeleteEmployee(worker.id);
      
      // Delete the employee document
      await deleteDocument(worker.id);

      // Build success message
      const deletedItems = [];
      if (results.attendance > 0) {
        deletedItems.push(`${results.attendance} attendance record(s)`);
      }
      if (results.images > 0) {
        deletedItems.push(`${results.images} image(s) from Cloudinary`);
      }

      toast.success(
        `Successfully deleted ${worker.name}`, 
        {
          id: deleteToast,
          description: deletedItems.length > 0 
            ? `Also deleted: ${deletedItems.join(", ")}` 
            : 'No related records found'
        }
      );

    } catch (error) {
      console.error("Error deleting employee and related data:", error);
      toast.error("Failed to delete employee. Please try again.");
    }
  };

  const handleSaveUpad = async () => {
    if (!selectedWorker) {
      toast.error("No worker selected");
      return;
    }

    if (!upadAmount || upadAmount.trim() === "") {
      toast.error("Please enter an amount");
      return;
    }

    const amt = parseFloat(upadAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    if (!addUpad) {
      toast.error("Unable to save advance at this time");
      return;
    }

    setIsSavingUpad(true);
    try {
      // Prepare the upad data - omit note field if it's empty
      const upadData: Omit<UpadRecord, 'id'> = {
        employeeId: selectedWorker.id,
        amount: amt,
        date: format(new Date(), "yyyy-MM-dd"),
      };

      // Only add note field if it's not empty
      if (upadNote && upadNote.trim()) {
        upadData.note = upadNote.trim();
      }
      
      await addUpad(upadData);
      setUpadAmount("");
      setUpadNote("");
      toast.success(`Successfully added advance of ₹${amt} for ${selectedWorker.name}`);
    } catch (err) {
      console.error("Failed to save advance:", err);
      toast.error("Failed to save advance. Please try again.");
    } finally {
      setIsSavingUpad(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">All Workers</h1>
        <p className="text-muted-foreground mt-1">View and manage employee information</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading employees...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-destructive mb-2">Error loading employees</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
            <p className="text-xs text-muted-foreground mt-4">
              Make sure Firestore is enabled in Firebase Console
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {workers.map((worker) => (
              <Card key={worker.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col items-center gap-3">
                    <Avatar className="h-20 w-20">
                      {worker.photoUrl ? (
                        <AvatarImage src={getCloudinaryAvatar(worker.photoUrl)} alt={worker.name} />
                      ) : (
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                          {getInitials(worker.name)}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <CardTitle className="text-center">{worker.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{worker.contact}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{worker.address}</span>
                  </div>
                  {/* Salary info: today and month-to-date based on attendance */}
                  <div className="mt-2 border-t pt-2">
                    {(() => {
                      const todayISO = format(new Date(), "yyyy-MM-dd");
                      const currentMonth = format(new Date(), "yyyy-MM");
                      // today's record for this worker
                      const todayRecord = (attendanceRecords || []).find(r => r.employeeId === worker.id && r.date === todayISO);
                      const salaryForStatus = (status?: string) => {
                        if (!status) return 0;
                        if (status === "present") return 400;
                        if (status === "half-day") return 200;
                        return 0; // absent/leave
                      };
                      const todaySalary = salaryForStatus(todayRecord?.status);

                      // month-to-date salary: consider attendance records in current month
                      const monthly = (attendanceRecords || []).filter(r => r.employeeId === worker.id && r.date && r.date.startsWith(currentMonth));
                      const monthSalary = monthly.reduce((sum, r) => sum + salaryForStatus(r.status), 0);
                      // subtract month-to-date upads (advances) given to this worker
                      const monthUpads = (upads || []).filter(u => u.employeeId === worker.id && u.date && u.date.startsWith(currentMonth));
                      const monthUpadSum = monthUpads.reduce((s, u) => s + (u.amount || 0), 0);
                      const netMonthSalary = monthSalary - monthUpadSum;

                      return (
                        <div className="space-y-2">
                          <div className="flex justify-between items-baseline">
                            <span className="text-sm text-muted-foreground">Today</span>
                            <span className="text-base font-medium">{`₹${todaySalary.toLocaleString()}`}</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-sm text-muted-foreground">Total Attendance Salary</span>
                            <span className="text-base font-medium">{`₹${monthSalary.toLocaleString()}`}</span>
                          </div>
                          <div>
                            <div className="flex justify-between items-baseline">
                              <span className="text-sm text-muted-foreground">Final Salary</span>
                              <span className={`text-lg font-bold ${netMonthSalary >= 0 ? "text-green-600" : "text-red-600"}`}>
                                {netMonthSalary >= 0 ? "₹" : "-₹"}
                                {Math.abs(netMonthSalary).toLocaleString()}
                              </span>
                            </div>
                            {monthUpadSum > 0 && (
                              <div className="text-xs text-right text-muted-foreground">
                                Deducted Advances: -₹{monthUpadSum.toLocaleString()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => handleViewDetails(worker)}>
                      View Details
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDelete(worker)}>
                      <Trash2 className="mr-1 h-3 w-3" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {workers.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No employees added yet</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* View Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedWorker && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar className="h-24 w-24">
                  {selectedWorker.photoUrl ? (
                    <AvatarImage src={getCloudinaryAvatar(selectedWorker.photoUrl)} alt={selectedWorker.name} />
                  ) : (
                    <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                      {getInitials(selectedWorker.name)}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h3 className="text-2xl font-bold">{selectedWorker.name}</h3>
                  <p className="text-muted-foreground">{selectedWorker.contact}</p>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Address</p>
                  <p className="text-base">{selectedWorker.address}</p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Employee Photo</p>
                    {selectedWorker.photoUrl && (
                      <img 
                        src={getCloudinaryPreview(selectedWorker.photoUrl)} 
                        alt="Employee" 
                        className="w-full h-48 object-cover rounded-lg border"
                        loading="lazy"
                      />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">Aadhar Document</p>
                    {selectedWorker.aadharPhotoUrl && (
                      <img 
                        src={getCloudinaryPreview(selectedWorker.aadharPhotoUrl)} 
                        alt="Aadhar" 
                        className="w-full h-48 object-cover rounded-lg border"
                        loading="lazy"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Monthly salary breakdown with calendar */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <p className="text-sm font-medium text-muted-foreground">Monthly Attendance & Salary</p>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="h-9 w-auto text-sm">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedMonth, "MMMM yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="single"
                        selected={selectedMonth}
                        onSelect={(date) => date && setSelectedMonth(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {eachDayOfInterval({
                    start: startOfMonth(selectedMonth),
                    end: endOfMonth(selectedMonth)
                  }).map((date) => {
                    const dateStr = format(date, "yyyy-MM-dd");
                    const rec = (attendanceRecords || []).find(r => r.employeeId === selectedWorker.id && r.date === dateStr);
                    const salary = rec ? (rec.status === "present" ? 400 : rec.status === "half-day" ? 200 : 0) : 0;
                    const statusLabel = rec ? rec.status : "no record";
                    return (
                      <div key={dateStr} className="flex justify-between text-sm">
                        <div className="text-muted-foreground">{format(date, "dd/MM/yyyy")}</div>
                        <div className="flex gap-4">
                          <div className={`capitalize ${
                            rec ? 
                              (rec.status === 'present' ? 'text-green-600' : 
                               rec.status === 'half-day' ? 'text-yellow-600' : 
                               'text-red-600') 
                              : 'text-muted-foreground'
                          }`}>
                            {statusLabel}
                          </div>
                          <div className="font-medium">{`₹${salary.toLocaleString()}`}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Monthly Summary */}
                {(() => {
                  const monthStr = format(selectedMonth, "yyyy-MM");
                  const monthlyRecords = (attendanceRecords || [])
                    .filter(r => r.employeeId === selectedWorker.id && r.date.startsWith(monthStr));
                  
                  const totalSalary = monthlyRecords.reduce((sum, r) => {
                    if (r.status === "present") return sum + 400;
                    if (r.status === "half-day") return sum + 200;
                    return sum;
                  }, 0);

                  const monthlyAdvances = (upads || [])
                    .filter(u => u.employeeId === selectedWorker.id && u.date.startsWith(monthStr));
                  const totalAdvances = monthlyAdvances.reduce((sum, u) => sum + u.amount, 0);
                  
                  const netSalary = totalSalary - totalAdvances;

                  return (
                    <div className="border-t mt-4 pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Attendance Salary</span>
                        <span className="font-medium">₹{totalSalary.toLocaleString()}</span>
                      </div>
                      {totalAdvances > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Total Advances</span>
                          <span className="font-medium text-red-600">-₹{totalAdvances.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-base font-bold pt-2 border-t">
                        <span>Net Salary</span>
                        <span className={netSalary >= 0 ? "text-green-600" : "text-red-600"}>
                          {netSalary >= 0 ? "₹" : "-₹"}{Math.abs(netSalary).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Advances (Upad) section */}
              <div className="border-t pt-4 space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Advances / Upad</p>
                  <div className="space-y-2">
                    {(upads || []).filter(u => u.employeeId === selectedWorker.id).slice(0, 10).map((u) => (
                      <div key={u.id} className="flex justify-between text-sm">
                        <div className="text-muted-foreground">{u.date}</div>
                        <div className="flex gap-4 items-center">
                          <div className="text-muted-foreground">{u.note || ""}</div>
                          <div className="font-medium">{`-₹${u.amount}`}</div>
                        </div>
                      </div>
                    ))}
                    {(upads || []).filter(u => u.employeeId === selectedWorker.id).length === 0 && (
                      <div className="text-sm text-muted-foreground">No advances recorded</div>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Record a new advance</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    <input
                      type="number"
                      min="0"
                      value={upadAmount}
                      onChange={(e) => setUpadAmount(e.target.value)}
                      placeholder="Amount (₹)"
                      className="w-full border rounded px-3 py-2"
                    />
                    <input
                      type="text"
                      value={upadNote}
                      onChange={(e) => setUpadNote(e.target.value)}
                      placeholder="Note (optional)"
                      className="w-full border rounded px-3 py-2 md:col-span-2"
                    />
                  </div>
                  <div className="flex justify-end gap-2 mt-2">
                    <Button variant="default" onClick={handleSaveUpad} disabled={isSavingUpad}>
                      {isSavingUpad ? "Saving..." : "Save Advance"}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AllWorkers;
