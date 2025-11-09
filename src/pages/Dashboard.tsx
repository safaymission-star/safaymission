import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Clock, CheckCircle } from "lucide-react";
import { useFirestore } from "@/hooks/useFirestore";
import { format } from "date-fns";

interface Employee {
  id: string;
  name: string;
  address: string;
  contact: string;
  photoUrl: string;
  aadharPhotoUrl: string;
}

interface Inquiry {
  id: string;
  name: string;
  email: string;
  message: string;
}

interface Payment {
  id: string;
  amount: number;
  date: string;
}

interface PendingWork {
  id: string;
  customerName: string;
  contact?: string;
  address?: string;
  workType?: string;
  description?: string;
  estimatedCost?: number;
  status?: string;
  assignedTo?: string;
  secondWorker?: string;
  date?: string; // yyyy-MM-dd
  type?: string;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // yyyy-MM-dd
  checkIn: string;
  checkOut?: string;
  status: "present" | "absent" | "half-day" | "leave";
}

const Dashboard = () => {
  // Fetch data from Firestore
  const { data: employees } = useFirestore<Employee>("employees");
  const { data: inquiries } = useFirestore<Inquiry>("inquiries");
  const { data: payments } = useFirestore<Payment>("payments");
  const { data: pendingWorks } = useFirestore<PendingWork>("pendingWorks");
  const { data: attendanceRecords } = useFirestore<AttendanceRecord>("attendance");

  // Calculate statistics
  const totalEmployees = employees.length;
  const inquiriesCount = inquiries.length;
  const revenueTotal = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
  const pendingCount = (pendingWorks || []).filter((work: PendingWork) => work.status !== "completed").length;

  // Use local date formatting to match how ContactForm saves dates
  const todayISO = format(new Date(), "yyyy-MM-dd");

  // Works created today (inquiries submitted today)
  const todaysWorks = (pendingWorks || []).filter((w: any) => {
    // If explicit date string is present, use it
    if (w.date === todayISO) return true;
    // Otherwise, fall back to createdAt Timestamp from Firestore
    if (w.createdAt && typeof w.createdAt.toDate === "function") {
      try {
        const createdDate = format(w.createdAt.toDate(), "yyyy-MM-dd");
        return createdDate === todayISO;
      } catch (e) {
        return false;
      }
    }
    return false;
  });
  const todaysInquiriesCount = todaysWorks.length;

  // Works completed today (status === completed and date === today)
  const todaysCompletedWorks = todaysWorks.filter((w: PendingWork) => w.status === "completed");
  const todaysCompletedCount = todaysCompletedWorks.length;

  // Revenue is counted from completed works (sum of estimatedCost)
  const todaysRateTotal = todaysCompletedWorks.reduce((sum: number, w: any) => sum + (Number(w.estimatedCost) || 0), 0);

  // Worker salary should be based on attendance records (per day), not per-work
  const workerSalaryPerDay = 400; // default per-day salary for 'present'
  const salaryForStatus = (status?: string) => {
    if (!status) return 0;
    if (status === "present") return workerSalaryPerDay;
    if (status === "half-day") return Math.round(workerSalaryPerDay / 2);
    return 0; // absent/leave
  };

  // Attendance entries for today
  const todaysAttendance = (attendanceRecords || []).filter((r: any) => r.date === todayISO);
  // Total worker salary is sum of per-record salary based on status
  const totalWorkerSalary = todaysAttendance.reduce((sum: number, r: any) => sum + salaryForStatus(r.status), 0);
  // Number of workers counted for salary (present or half-day)
  const workerCountToday = todaysAttendance.filter((r: any) => salaryForStatus(r.status) > 0).length;
  const todaysProfit = todaysRateTotal - totalWorkerSalary;

  const stats = [
    {
      title: "Today's Inquiries",
      value: String(todaysInquiriesCount),
      icon: Users,
      trend: "",
      color: "text-primary",
    },
    {
      title: "Today's Revenue",
      value: `₹${todaysRateTotal.toLocaleString()}`,
      icon: DollarSign,
      trend: "",
      color: "text-success",
    },
    {
      title: "Pending Works",
      value: String(pendingCount),
      icon: Clock,
      trend: "",
      color: "text-warning",
    },
    {
      title: "Completed Today",
      value: String(todaysCompletedCount),
      icon: CheckCircle,
      trend: "",
      color: "text-success",
    },
  ];

  // Expense card data
  const expense = {
    inquiriesToday: todaysInquiriesCount,
    rateToday: todaysRateTotal,
    workerSalaryPerDay,
    workerCountToday,
    totalWorkerSalary,
    profit: todaysProfit,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Overview of your business activities</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-2">{stat.trend}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { action: "New inquiry received", time: "recently", type: "inquiry" },
                { action: "Work completed", time: "earlier today", type: "completed" },
                { action: "Payment received", time: "earlier today", type: "payment" },
                { action: "New employee added", time: "earlier today", type: "employee" },
              ].map((activity, index) => (
                <div key={index} className="flex items-center gap-3 pb-3 border-b last:border-0">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.type === "inquiry" ? "bg-primary" :
                    activity.type === "completed" ? "bg-success" :
                    activity.type === "payment" ? "bg-success" :
                    "bg-info"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Members</span>
                <span className="text-xl font-bold">{inquiriesCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Employees</span>
                <span className="text-xl font-bold">{totalEmployees}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Monthly Revenue</span>
                <span className="text-xl font-bold">{`₹${revenueTotal.toLocaleString()}`}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Attendance Rate</span>
                <span className="text-xl font-bold">—</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>


    </div>
  );
};

export default Dashboard;
