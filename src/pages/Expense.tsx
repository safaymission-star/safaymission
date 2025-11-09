import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useFirestore } from "@/hooks/useFirestore";
import { format } from "date-fns";
import { Loader2, Save } from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";

interface PendingWork {
  id: string;
  customerName: string;
  estimatedCost: number;
  status: "pending" | "in-progress" | "completed";
  date: string;
  createdAt?: Timestamp;
}

interface OtherExpense {
  id: string;
  amount: number;
  description: string;
  date: string;
  createdAt: Timestamp;
}

interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  status: "present" | "absent" | "half-day" | "leave";
}

const Expense = () => {
  const { data: works, loading: worksLoading } = useFirestore<PendingWork>("pendingWorks");
  const { data: attendanceRecords, loading: attendanceLoading } = useFirestore<AttendanceRecord>("attendance");
  const { data: expenseRecords, addDocument: addExpense, loading: expenseLoading } = useFirestore<OtherExpense>("otherExpenses");
  
  // State for other costs
  const [otherCost1, setOtherCost1] = useState({ amount: "", description: "" });
  const [otherCost2, setOtherCost2] = useState({ amount: "", description: "" });
  const [isSaving, setIsSaving] = useState(false);

  // Function to handle saving expenses
  const handleSaveExpenses = async () => {
    try {
      setIsSaving(true);
      const expenses = [];
      
      if (otherCost1.amount && otherCost1.description) {
        expenses.push({
          amount: Number(otherCost1.amount),
          description: otherCost1.description,
          date: selectedDateISO,
          createdAt: Timestamp.now()
        });
      }
      
      if (otherCost2.amount && otherCost2.description) {
        expenses.push({
          amount: Number(otherCost2.amount),
          description: otherCost2.description,
          date: selectedDateISO,
          createdAt: Timestamp.now()
        });
      }

      if (expenses.length === 0) {
        toast.error("Please enter at least one expense with amount and description");
        return;
      }

      // Save all expenses
      await Promise.all(expenses.map(expense => addExpense(expense)));
      
      // Clear the forms
      setOtherCost1({ amount: "", description: "" });
      setOtherCost2({ amount: "", description: "" });
      
      toast.success("Expenses saved successfully!");
    } catch (error) {
      console.error("Failed to save expenses:", error);
      toast.error("Failed to save expenses. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // State for selected date
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  // Get selected date in yyyy-MM-dd format
  const selectedDateISO = format(selectedDate, "yyyy-MM-dd");

  // Selected month (yyyy-MM) for month totals
  const selectedMonth = format(selectedDate, "yyyy-MM");

  // Calculate works for selected date
  const selectedDateWorks = (works || []).filter((w) => {
    if (w.date === selectedDateISO) return true;
    if (w.createdAt && typeof w.createdAt.toDate === "function") {
      try {
        const createdDate = format(w.createdAt.toDate(), "yyyy-MM-dd");
        return createdDate === selectedDateISO;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  // Selected date's completed works
  const selectedDateCompletedWorks = selectedDateWorks.filter((w) => w.status === "completed");
  
  // Total rate from completed works for selected date
  const selectedDateRateTotal = selectedDateCompletedWorks.reduce(
    (sum, w) => sum + (Number(w.estimatedCost) || 0),
    0
  );

  // Worker salary calculations
  const workerSalaryPerDay = 400; // default per-day salary for 'present'
  const salaryForStatus = (status?: string) => {
    if (!status) return 0;
    if (status === "present") return workerSalaryPerDay;
    if (status === "half-day") return Math.round(workerSalaryPerDay / 2);
    return 0; // absent/leave
  };

  // Selected date's attendance records
  const selectedDateAttendance = (attendanceRecords || []).filter(
    (r) => r.date === selectedDateISO
  );
  
  // Calculate total worker salary for selected date
  const totalWorkerSalary = selectedDateAttendance.reduce(
    (sum, r) => sum + salaryForStatus(r.status),
    0
  );

  // Count workers who are present or on half-day
  const workerCount = selectedDateAttendance.filter(
    (r) => r.status === "present" || r.status === "half-day"
  ).length;

  // Get selected date's saved expenses
  const savedExpenses = (expenseRecords || []).filter(
    (expense) => expense.date === selectedDateISO
  );
  
  // Calculate total of saved expenses for selected date
  const savedExpensesTotal = savedExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  // Calculate month total of saved expenses (otherExpenses) for selected month
  const monthSavedExpenses = (expenseRecords || []).filter(
    (expense) => typeof expense.date === 'string' && expense.date.startsWith(selectedMonth)
  );
  const monthSavedExpensesTotal = monthSavedExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // Calculate current input costs total
  const otherCostsTotal = Number(otherCost1.amount || 0) + Number(otherCost2.amount || 0);

  // Calculate selected date's profit/loss including both saved and current expenses
  const totalProfit = selectedDateRateTotal - totalWorkerSalary - savedExpensesTotal;

  const loading = worksLoading || attendanceLoading;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Expense Overview</h1>
          <p className="text-muted-foreground mt-1">Track your daily expenses and revenue</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-white border rounded-lg shadow-sm">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => setSelectedDate(date || new Date())}
              className="rounded-md"
            />
          </div>

          <div className="flex flex-col items-end">
            <span className="text-sm text-muted-foreground">Month Total Expenses</span>
            <span className="text-lg font-bold text-red-600">-₹{monthSavedExpensesTotal.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Expense for {format(selectedDate, "dd/MM/yyyy")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Date</span>
                  <span className="text-lg font-bold">
                    {format(selectedDate, "dd/MM/yyyy")}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Inquiries / Works (today)
                  </span>
                  <span className="text-lg font-bold">{selectedDateWorks.length}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Rate
                  </span>
                  <span className="text-lg font-bold">
                    ₹{selectedDateRateTotal.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Worker salary (per day)
                  </span>
                  <span className="text-lg font-bold">
                    ₹{workerSalaryPerDay.toLocaleString()}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Workers
                  </span>
                  <span className="text-lg font-bold">{workerCount}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Worker Salary
                  </span>
                  <span className="text-lg font-bold">
                    ₹{totalWorkerSalary.toLocaleString()}
                  </span>
                </div>

                <div className="border-t pt-3">
                  <div className="mb-3">
                    <span className="text-sm font-medium">Other Cost 1</span>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={otherCost1.amount}
                        onChange={(e) => setOtherCost1({ ...otherCost1, amount: e.target.value })}
                        className="w-32"
                      />
                      <Input
                        type="text"
                        placeholder="Description (e.g., Soap, Machines)"
                        value={otherCost1.description}
                        onChange={(e) => setOtherCost1({ ...otherCost1, description: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <span className="text-sm font-medium">Other Cost 2</span>
                    <div className="flex gap-2 mt-1">
                      <Input
                        type="number"
                        placeholder="Amount"
                        value={otherCost2.amount}
                        onChange={(e) => setOtherCost2({ ...otherCost2, amount: e.target.value })}
                        className="w-32"
                      />
                      <Input
                        type="text"
                        placeholder="Description (e.g., Soap, Machines)"
                        value={otherCost2.description}
                        onChange={(e) => setOtherCost2({ ...otherCost2, description: e.target.value })}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  {(otherCost1.amount || otherCost2.amount) && (
                    <>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-sm text-muted-foreground">New Costs (Unsaved)</span>
                        <span className="text-lg font-bold text-red-600">
                          -₹{otherCostsTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-3 flex justify-end">
                        <Button
                          onClick={handleSaveExpenses}
                          disabled={isSaving}
                          className="w-full md:w-auto"
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Expenses
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {savedExpenses.length > 0 && (
                  <div className="border-t pt-3">
                    <h3 className="text-sm font-medium mb-2">Saved Expenses</h3>
                    {savedExpenses.map((expense, index) => (
                      <div key={expense.id} className="flex justify-between items-center text-sm mb-2">
                        <span className="text-muted-foreground">{expense.description}</span>
                        <span className="font-medium text-red-600">-₹{expense.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t">
                      <span className="text-sm font-medium">Total Saved Expenses</span>
                      <span className="text-lg font-bold text-red-600">
                        -₹{savedExpensesTotal.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center border-t pt-3">
                  <span className="text-sm text-muted-foreground">
                    Profit / (Loss)
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      totalProfit >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {`${totalProfit >= 0 ? "₹" : "-₹"}${Math.abs(
                      totalProfit
                    ).toLocaleString()}`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Expense;