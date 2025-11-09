import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Phone, MapPin, Calendar, Loader2, DollarSign, Edit, Trash2 } from "lucide-react";
import { useFirestore } from "@/hooks/useFirestore";
import { orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { format, addDays, addMonths, parseISO, isSameDay, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";

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

const MembershipMembers = () => {
  const { data: members, loading, deleteDocument } = useFirestore<MembershipMember>(
    "membershipMembers",
    orderBy("createdAt", "desc")
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from membership?`)) {
      try {
        await deleteDocument(id);
        toast.success(`${name} removed from membership`);
      } catch (error) {
        console.error("Error deleting member:", error);
        toast.error("Failed to remove member");
      }
    }
  };

  const getStatusVariant = (status: string) => {
    const lower = status.toLowerCase();
    if (lower === "active") return "default";
    if (lower === "inactive") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Membership Members</h1>
        <p className="text-muted-foreground mt-1">View and manage your membership customers</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="ml-3 text-muted-foreground">Loading members...</p>
        </div>
      ) : members && members.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id} className="hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{member.name}</CardTitle>
                    <Badge variant={getStatusVariant(member.status)} className="mt-1">
                      {member.status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>{member.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className="line-clamp-2">{member.address}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span>Joined: {member.joinDate}</span>
                </div>
                {member.membershipDuration && (
                  (() => {
                    // compute next work date based on membershipDuration
                    let nextDate: Date | null = null;
                    try {
                      const join = parseISO(member.joinDate);
                      const d = member.membershipDuration;
                      if (d.endsWith("days")) {
                        const n = parseInt(d.replace("days", ""), 10) || 0;
                        nextDate = addDays(join, n);
                      } else if (d.endsWith("month")) {
                        const n = parseInt(d.replace("month", ""), 10) || 0;
                        nextDate = addMonths(join, n);
                      }
                    } catch (err) {
                      console.error("Failed to compute next date:", err);
                    }

                    const today = new Date();
                    const isWorkDay = nextDate ? isSameDay(nextDate, today) : false;
                    const daysRemaining = nextDate ? differenceInCalendarDays(nextDate, today) : null;
                    const displayNext = nextDate ? format(nextDate, "yyyy-MM-dd") : null;

                    return (
                      <div className="mt-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="secondary">Duration: {member.membershipDuration}</Badge>
                        </div>
                        {displayNext && (
                          <div className="mt-2 text-sm">
                            <div>Next work date: <span className="font-medium">{displayNext}</span></div>
                            {daysRemaining !== null && daysRemaining > 0 && (
                              <div className="text-xs text-muted-foreground">{daysRemaining} day(s) remaining</div>
                            )}
                            {daysRemaining !== null && daysRemaining < 0 && (
                              <div className="text-xs text-destructive">Overdue by {Math.abs(daysRemaining)} day(s)</div>
                            )}
                            {isWorkDay && (
                              <div className="mt-3 p-3 bg-rose-600 text-white rounded text-center text-lg font-bold">WORK DAY</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()
                )}
                {member.membershipType && (
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-xs">
                      {member.membershipType}
                    </Badge>
                  </div>
                )}
                {member.rate && (
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <DollarSign className="h-4 w-4 flex-shrink-0" />
                    <span>{member.rate}</span>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => handleDelete(member.id, member.name)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">No membership members yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add inquiries with "Membership" type in the Contact Form to create members
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default MembershipMembers;
