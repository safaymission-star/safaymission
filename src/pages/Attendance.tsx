import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Clock, CalendarDays, Users, CheckCircle, XCircle, AlertCircle,
  Download, Filter, Loader2, ClipboardCheck 
} from "lucide-react";
import { useFirestore } from "@/hooks/useFirestore";
import { orderBy } from "firebase/firestore";
import { toast } from "sonner";
import { format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  photoUrl?: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut?: string;
  status: "present" | "absent" | "half-day" | "leave";
  workHours?: number;
  notes?: string;
}

const Attendance = () => {
  const { data: employees } = useFirestore<Employee>("employees");
  const { data: attendanceRecords, loading, addDocument, updateDocument, deleteDocument } = useFirestore<AttendanceRecord>(
    "attendance",
    orderBy("date", "desc")
  );

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [isBulkMarkDialogOpen, setIsBulkMarkDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [bulkAttendanceDate, setBulkAttendanceDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchQuery, setSearchQuery] = useState("");
  const [employeeStatus, setEmployeeStatus] = useState<Record<string, "present" | "absent" | "half-day">>({}); 
  const [isSaving, setIsSaving] = useState(false);

  const filteredRecords = attendanceRecords.filter((record) => {
    const matchesEmployee = selectedEmployee === "all" || record.employeeId === selectedEmployee;
    const matchesDate = format(selectedDate, "yyyy-MM-dd") === record.date;
    return matchesEmployee && (selectedDate ? matchesDate : true);
  });

  const todayRecords = attendanceRecords.filter(
    (r) => r.date === format(new Date(), "yyyy-MM-dd")
  );
  const presentToday = todayRecords.filter((r) => r.status === "present").length;
  const absentToday = todayRecords.filter((r) => r.status === "absent").length;
  const halfDayToday = todayRecords.filter((r) => r.status === "half-day").length;
  const leaveToday = todayRecords.filter((r) => r.status === "leave").length;

  const currentMonth = format(new Date(), "yyyy-MM");
  const monthlyRecords = attendanceRecords.filter((r) => r.date.startsWith(currentMonth));
  const totalWorkingDays = new Set(monthlyRecords.map((r) => r.date)).size;

  // Initialize employee status when dialog opens
  const initializeEmployeeStatus = () => {
    const status: Record<string, "present" | "absent" | "half-day"> = {};
    employees.forEach(emp => {
      status[emp.id] = "present"; // Default to present
    });
    setEmployeeStatus(status);
  };

  const setEmployeeStatusValue = (employeeId: string, status: "present" | "absent" | "half-day") => {
    setEmployeeStatus(prev => ({
      ...prev,
      [employeeId]: status
    }));
  };

  const setAllEmployeesStatus = (status: "present" | "absent" | "half-day") => {
    const newStatus: Record<string, "present" | "absent" | "half-day"> = {};
    employees.forEach(emp => {
      newStatus[emp.id] = status;
    });
    setEmployeeStatus(newStatus);
  };

  const handleBulkMarkAttendance = async () => {
    if (employees.length === 0) {
      toast.error("No employees found");
      return;
    }

    // Check if attendance already exists for this date
    const existingForDate = attendanceRecords.filter(r => r.date === bulkAttendanceDate);
    if (existingForDate.length > 0) {
      const confirm = window.confirm(
        `Attendance already marked for ${existingForDate.length} employee(s) on this date. This will skip existing records. Continue?`
      );
      if (!confirm) return;
    }

    setIsSaving(true);
    const existingEmployeeIds = new Set(existingForDate.map(r => r.employeeId));
    let successCount = 0;
    let skipCount = 0;

    try {
      for (const employee of employees) {
        // Skip if already marked
        if (existingEmployeeIds.has(employee.id)) {
          skipCount++;
          continue;
        }

        const status = employeeStatus[employee.id] || "present";
        const checkIn = status !== "absent" ? "09:00" : "";
        const checkOut = status !== "absent" ? (status === "half-day" ? "13:00" : "18:00") : "";
        const workHours = status === "present" ? 9 : status === "half-day" ? 4.5 : 0;
        
        await addDocument({
          employeeId: employee.id,
          employeeName: employee.name,
          date: bulkAttendanceDate,
          checkIn,
          checkOut,
          status,
          workHours,
          notes: "",
        } as Omit<AttendanceRecord, "id">);
        
        successCount++;
      }

      toast.success(
        `Attendance marked for ${successCount} employee(s)${skipCount > 0 ? `. Skipped ${skipCount} existing records` : ""}`
      );
      setIsBulkMarkDialogOpen(false);
      setEmployeeStatus({});
    } catch (error) {
      console.error("Error marking bulk attendance:", error);
      toast.error("Failed to mark attendance");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditAttendance = async (record: AttendanceRecord) => {
    setEditingRecord(record);
    setIsEditDialogOpen(true);
  };

  const handleUpdateAttendance = async (status: "present" | "absent" | "half-day") => {
    if (!editingRecord) return;

    const checkIn = status !== "absent" ? "09:00" : "";
    const checkOut = status !== "absent" ? (status === "half-day" ? "13:00" : "18:00") : "";
    const workHours = status === "present" ? 9 : status === "half-day" ? 4.5 : 0;

    try {
      await updateDocument(editingRecord.id, {
        status,
        checkIn,
        checkOut,
        workHours,
      });
      toast.success("Attendance updated successfully");
      setIsEditDialogOpen(false);
      setEditingRecord(null);
    } catch (error) {
      console.error("Error updating attendance:", error);
      toast.error("Failed to update attendance");
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this attendance record?")) return;
    
    try {
      await deleteDocument(id);
      toast.success("Attendance deleted successfully");
    } catch (error) {
      console.error("Error deleting attendance:", error);
      toast.error("Failed to delete attendance");
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      present: "bg-green-100 text-green-800 border-green-200",
      absent: "bg-red-100 text-red-800 border-red-200",
      "half-day": "bg-yellow-100 text-yellow-800 border-yellow-200",
      leave: "bg-blue-100 text-blue-800 border-blue-200",
    };
    return colors[status as keyof typeof colors] || "";
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      present: <CheckCircle className="h-4 w-4" />,
      absent: <XCircle className="h-4 w-4" />,
      "half-day": <AlertCircle className="h-4 w-4" />,
      leave: <CalendarDays className="h-4 w-4" />,
    };
    return icons[status as keyof typeof icons] || null;
  };

  const exportToCSV = () => {
    const csvData = filteredRecords.map((record) => ({
      Date: record.date,
      Employee: record.employeeName,
      CheckIn: record.checkIn,
      CheckOut: record.checkOut || "N/A",
      Status: record.status,
      WorkHours: record.workHours || "0",
      Notes: record.notes || "",
    }));

    const headers = Object.keys(csvData[0] || {}).join(",");
    const rows = csvData.map((row) => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${format(selectedDate, "yyyy-MM-dd")}.csv`;
    a.click();
    toast.success("Attendance exported successfully");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Employee Attendance</h1>
          <p className="text-muted-foreground mt-1">Track and manage employee attendance</p>
        </div>
        <div className="flex gap-2">
          {/* Bulk Mark Attendance Dialog */}
          <Dialog open={isBulkMarkDialogOpen} onOpenChange={setIsBulkMarkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="default">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Bulk Mark Attendance
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Mark Attendance</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Select Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 border rounded-md"
                    value={bulkAttendanceDate}
                    onChange={(e) => setBulkAttendanceDate(e.target.value)}
                    onFocus={initializeEmployeeStatus}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Search Employee</label>
                  <input
                    type="text"
                    placeholder="Search employee by name..."
                    className="w-full px-3 py-2 border rounded-md"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <label className="text-sm font-medium">
                      Mark Attendance for All Employees
                    </label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAllEmployeesStatus("present")}
                      >
                        All Present
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAllEmployeesStatus("absent")}
                      >
                        All Absent
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto border rounded-md p-3">
                    {employees.length > 0 ? (
                      employees.filter(emp => 
                        emp.name.toLowerCase().includes(searchQuery.toLowerCase())
                      ).map((employee) => {
                        const status = employeeStatus[employee.id] || "present";
                        return (
                          <div
                            key={employee.id}
                            className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border"
                          >
                            <span className="text-sm font-medium flex-1">
                              {employee.name}
                            </span>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={status === "present" ? "default" : "outline"}
                                onClick={() => setEmployeeStatusValue(employee.id, "present")}
                              >
                                Present
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={status === "half-day" ? "default" : "outline"}
                                onClick={() => setEmployeeStatusValue(employee.id, "half-day")}
                              >
                                Half Day
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant={status === "absent" ? "default" : "outline"}
                                onClick={() => setEmployeeStatusValue(employee.id, "absent")}
                              >
                                Absent
                              </Button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        No employees found. Please add employees first.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm text-muted-foreground">
                      Present: <strong className="text-green-600">{Object.values(employeeStatus).filter(s => s === "present").length}</strong> | 
                      Half Day: <strong className="text-yellow-600">{Object.values(employeeStatus).filter(s => s === "half-day").length}</strong> | 
                      Absent: <strong className="text-red-600">{Object.values(employeeStatus).filter(s => s === "absent").length}</strong>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleBulkMarkAttendance}
                    disabled={isSaving || employees.length === 0}
                    className="flex-1"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Marking Attendance...
                      </>
                    ) : (
                      `Mark Attendance for ${employees.length} Employee(s)`
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkMarkDialogOpen(false)}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Attendance Dialog */}
          <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Attendance - {editingRecord?.employeeName}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Date: {editingRecord?.date && format(new Date(editingRecord.date), "dd/MM/yyyy")}
                </p>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Update Status</label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={editingRecord?.status === "present" ? "default" : "outline"}
                      onClick={() => handleUpdateAttendance("present")}
                      className="flex-1"
                    >
                      Present
                    </Button>
                    <Button
                      type="button"
                      variant={editingRecord?.status === "half-day" ? "default" : "outline"}
                      onClick={() => handleUpdateAttendance("half-day")}
                      className="flex-1"
                    >
                      Half Day
                    </Button>
                    <Button
                      type="button"
                      variant={editingRecord?.status === "absent" ? "default" : "outline"}
                      onClick={() => handleUpdateAttendance("absent")}
                      className="flex-1"
                    >
                      Absent
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Present Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-green-600">{presentToday}</div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Absent Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-red-600">{absentToday}</div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Half Day</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-yellow-600">{halfDayToday}</div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">On Leave</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-3xl font-bold text-blue-600">{leaveToday}</div>
              <CalendarDays className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Attendance Records</CardTitle>
                <div className="flex gap-2">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Employees</SelectItem>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={exportToCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center items-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredRecords.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Check In</TableHead>
                      <TableHead>Check Out</TableHead>
                      <TableHead>Work Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{format(new Date(record.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="font-medium">{record.employeeName}</TableCell>
                        <TableCell>{record.checkIn}</TableCell>
                        <TableCell>{record.checkOut || "—"}</TableCell>
                        <TableCell>{record.workHours ? `${record.workHours}h` : "—"}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(record.status)}>
                            <span className="flex items-center gap-1">
                              {getStatusIcon(record.status)}
                              {record.status}
                            </span>
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {record.notes || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditAttendance(record)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteAttendance(record.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-10 text-muted-foreground">
                  No attendance records for selected date
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Attendance Summary</CardTitle>
              <p className="text-sm text-muted-foreground">
                {format(new Date(), "MMMM yyyy")} • {totalWorkingDays} Working Days
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Absent</TableHead>
                    <TableHead>Half Day</TableHead>
                    <TableHead>Leave</TableHead>
                    <TableHead>Attendance %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => {
                    const empRecords = monthlyRecords.filter((r) => r.employeeId === emp.id);
                    const present = empRecords.filter((r) => r.status === "present").length;
                    const absent = empRecords.filter((r) => r.status === "absent").length;
                    const halfDay = empRecords.filter((r) => r.status === "half-day").length;
                    const leave = empRecords.filter((r) => r.status === "leave").length;
                    const total = empRecords.length || 1;
                    const percentage = Math.round((present / total) * 100);

                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell className="text-green-600">{present}</TableCell>
                        <TableCell className="text-red-600">{absent}</TableCell>
                        <TableCell className="text-yellow-600">{halfDay}</TableCell>
                        <TableCell className="text-blue-600">{leave}</TableCell>
                        <TableCell>
                          <Badge variant={percentage >= 80 ? "default" : "destructive"}>
                            {percentage}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-6">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border"
                />
                <div className="flex-1">
                  <h3 className="font-semibold mb-4">
                    {format(selectedDate, "dd/MM/yyyy")}
                  </h3>
                  {filteredRecords.length > 0 ? (
                    <div className="space-y-2">
                      {filteredRecords.map((record) => (
                        <div
                          key={record.id}
                          className="p-3 border rounded-md flex items-center justify-between"
                        >
                          <div>
                            <p className="font-medium">{record.employeeName}</p>
                            <p className="text-sm text-muted-foreground">
                              {record.checkIn} - {record.checkOut || "In progress"}
                            </p>
                          </div>
                          <Badge className={getStatusColor(record.status)}>
                            {record.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No records for this date</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Attendance;
