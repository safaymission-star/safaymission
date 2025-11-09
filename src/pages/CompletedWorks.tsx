import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, MapPin, Phone, DollarSign, Loader2, Trash2, Download } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logoSmall from "../../img/s.png";
import { format } from "date-fns";
import { useFirestore } from "@/hooks/useFirestore";
import { orderBy } from "firebase/firestore";
import { toast } from "sonner";

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

interface Employee {
  id: string;
  name: string;
  photoUrl?: string;
}

const CompletedWorks = () => {
  const { data: employees } = useFirestore<Employee>("employees");
  const { data: works, loading, updateDocument, deleteDocument } = useFirestore<PendingWork>(
    "pendingWorks",
    orderBy("createdAt", "desc")
  );

  const handleReopen = async (work: PendingWork) => {
    try {
      await updateDocument(work.id, { status: "pending" });
      toast.success("Work moved back to Pending");
    } catch (err) {
      console.error("Failed to reopen work:", err);
      toast.error("Failed to reopen work");
    }
  };

  const handleDelete = async (work: PendingWork) => {
    if (!confirm(`Delete completed work for ${work.customerName}? This cannot be undone.`)) return;
    try {
      await deleteDocument(work.id);
      toast.success("Completed work deleted");
    } catch (err) {
      console.error("Failed to delete completed work:", err);
      toast.error("Failed to delete work");
    }
  };

  const generatePDFBill = async (work: PendingWork) => {
    try {
      // Initialize PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = pdf.internal.pageSize.width;
      
      // Create high-resolution canvas for Gujarati text
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');
      
      // Set canvas size (2x for better resolution)
      canvas.width = 800;
      canvas.height = 240;
      
      // Enable high-quality text rendering
      ctx.textRendering = 'geometricPrecision';
      ctx.imageSmoothingEnabled = true;
      
      // Clear canvas
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Draw company name
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Enable better text rendering for Gujarati
      ctx.textRendering = 'geometricPrecision';
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'center';
      
      // Draw company name
      ctx.font = 'bold 48px "Nirmala UI"';
      ctx.fillText("સફાઈ.com service", canvas.width / 2, 50);
      
      // Draw address with larger font
      ctx.font = '28px "Nirmala UI"';
      ctx.fillText("ઓફીસ નં. ૫ વનમાળી જંકશન, BRTS રોડ,", canvas.width / 2, 100);
      ctx.fillText("હનુમાનજી મંદિરની પાછળ, યોગીચોક, સુરત", canvas.width / 2, 140);
      
      // Phone with slightly smaller font
      ctx.font = '24px Arial';
      ctx.fillText("Phone: +91 9714719906", canvas.width / 2, 180);

  // GST number in header
  ctx.font = '20px Arial';
  ctx.fillText("Gst no : 22SSEEWWQQRR33", canvas.width / 2, 205);

      // Draw very small centered logo in header (like a word)
      try {
        // Fetch the imported image asset and convert to ImageBitmap for drawing
        const resp = await fetch(logoSmall);
        const blob = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        const logoWidth = 20; // very small
        const logoHeight = (bitmap.height / bitmap.width) * logoWidth;
        const logoX = (canvas.width - logoWidth) / 2;
        const logoY = 12; // near top, above company name
        ctx.drawImage(bitmap, logoX, logoY, logoWidth, logoHeight);
      } catch (imgErr) {
        console.warn('Failed to load header logo', imgErr);
      }
      
      // Add high-resolution canvas as image to PDF
      const imageData = canvas.toDataURL('image/png');
      pdf.addImage(imageData, 'PNG', 10, 10, pageWidth - 20, 45);

      // Bill Details - Adjusted spacing
      pdf.line(10, 60, pageWidth - 10, 60);
      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("BILL", pageWidth / 2, 68, { align: "center" });
      
      // Customer Details - Moved down
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      const customerY = 85;
      pdf.text("Bill To:", 15, customerY);
      pdf.setFont("helvetica", "normal");
      pdf.text(work.customerName || "-", 15, customerY + 7);
      pdf.text(`Contact: ${work.contact || "-"}`, 15, customerY + 14);
      pdf.text(`Address: ${work.address || "-"}`, 15, customerY + 21);
      
      // Dates
      const dateY = 85; // Aligned with customerY
      pdf.setFont("helvetica", "bold");
      pdf.text("Bill Date:", pageWidth - 65, dateY);
      pdf.text("Work Date:", pageWidth - 65, dateY + 7);
      pdf.setFont("helvetica", "normal");
      const currentDate = format(new Date(), "dd/MM/yyyy");
      const workDate = work.date ? format(new Date(work.date), "dd/MM/yyyy") : "-";
      pdf.text(currentDate, pageWidth - 15, dateY, { align: "right" });
      pdf.text(workDate, pageWidth - 15, dateY + 7, { align: "right" });
      
      // Work Details Table - Moved down to avoid overlap
      const tableY = 115;
      const assigned1 = work.assignedTo ? (employees?.find(e => e.id === work.assignedTo)?.name || work.assignedTo) : "-";
      const assigned2 = work.secondWorker ? (employees?.find(e => e.id === work.secondWorker)?.name || work.secondWorker) : "-";
      
      let started = "-";
      let completed = "-";
      try {
        if (work.startTime) started = format(new Date(work.startTime), "dd/MM/yyyy HH:mm:ss");
        if (work.completedTime) completed = format(new Date(work.completedTime), "dd/MM/yyyy HH:mm:ss");
      } catch (e) {
        console.error("Date formatting error:", e);
      }
      
      const workType = work.workType || "General Work";
      const description = work.description || "-";
      const cost = Number(work.estimatedCost || 0).toLocaleString();

      // Create canvas for Description with Gujarati text
      const descCanvas = document.createElement('canvas');
      descCanvas.width = 1000;
      descCanvas.height = 300;
      const descCtx = descCanvas.getContext('2d');
      let descriptionImage = '';
      
      if (descCtx) {
        descCtx.fillStyle = '#FFFFFF';
        descCtx.fillRect(0, 0, descCanvas.width, descCanvas.height);
        descCtx.fillStyle = '#000000';
        descCtx.textBaseline = 'top';
        descCtx.textAlign = 'left';
        
        // Draw each line with proper spacing
        descCtx.font = 'bold 24px "Nirmala UI", "Shruti", Arial';
        descCtx.fillText(workType, 10, 20);
        
        descCtx.font = '20px "Nirmala UI", "Shruti", Arial';
        descCtx.fillText(description, 10, 60);
        
        descCtx.font = '18px Arial';
        descCtx.fillText(`Start: ${started}`, 10, 100);
        descCtx.fillText(`Completed: ${completed}`, 10, 130);
        
        descriptionImage = descCanvas.toDataURL('image/png');
      }

      try {
        autoTable(pdf, {
          startY: tableY,
          head: [["Description", "Workers", "Amount "]],
          body: [[
            {
              content: '',
              styles: { 
                cellWidth: 90,
                cellPadding: { top: 5, bottom: 5, left: 5, right: 5 },
                minCellHeight: 35
              }
            },
            {
              content: assigned1 + "\n" + assigned2,
              styles: { 
                cellWidth: 40,
                cellPadding: { top: 5, bottom: 5, left: 5, right: 5 }
              }
            },
            {
              content: cost,
              styles: { 
                halign: "right",
                cellWidth: 40,
                cellPadding: { top: 5, bottom: 5, left: 5, right: 5 }
              }
            }
          ]],
          foot: [
            ["Total Amount:", "", `${cost} /-`]
          ],
          theme: 'striped',
          styles: {
            fontSize: 10,
            lineWidth: 0.1,
            lineColor: [0, 0, 0],
            textColor: [0, 0, 0],
            valign: 'middle'
          },
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: 'left'
          },
          footStyles: {
            fontStyle: "bold",
            halign: 'right'
          },
          didDrawCell: (data: any) => {
            // Add description image to the first body cell
            if (data.section === 'body' && data.column.index === 0 && descriptionImage) {
              const cellX = data.cell.x;
              const cellY = data.cell.y;
              pdf.addImage(descriptionImage, 'PNG', cellX + 2, cellY + 2, 86, 32);
            }
          }
        });
      } catch (e) {
        console.error("Table generation error:", e);
        throw e;
      }
      
      try {
        // Additional Notes
        const tableEnd = (pdf as any).lastAutoTable.finalY + 10;
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text("Notes:", 15, tableEnd);
        pdf.setFont("helvetica", "normal");
        
        // Handle Gujarati text for inquiry type
        const inquiryTypeText = work.type === "membership" ? "Membership work" : "વ્યક્તિગત કામ";
        
        if (work.type !== "membership") {
          // Create canvas for Gujarati text
          const gujaratiCanvas = document.createElement('canvas');
          gujaratiCanvas.width = 600;
          gujaratiCanvas.height = 80;
          const gCtx = gujaratiCanvas.getContext('2d');
          
          if (gCtx) {
            // Clear canvas
            gCtx.fillStyle = '#FFFFFF';
            gCtx.fillRect(0, 0, gujaratiCanvas.width, gujaratiCanvas.height);
            
            // Draw text
            gCtx.fillStyle = '#000000';
            gCtx.textBaseline = 'middle';
            gCtx.textAlign = 'left';
            gCtx.font = '18px "Nirmala UI", "Shruti", sans-serif';
            gCtx.fillText('Inquiry Type: વ્યક્તિગત કામ', 10, 40);
            
            // Add canvas as image to PDF
            const gujaratiImage = gujaratiCanvas.toDataURL('image/png');
            pdf.addImage(gujaratiImage, 'PNG', 15, tableEnd + 2, 100, 10);
          }
        } else {
          // For membership work, use regular text
          pdf.text(`Inquiry Type: ${inquiryTypeText}`, 15, tableEnd + 7);
        }
        
        // Signature box - right aligned at end of page
        try {
          const signatureBoxWidth = 60;
          const signatureBoxHeight = 25;
          const signatureX = pageWidth - signatureBoxWidth - 15;
          const signatureYPos = tableEnd + 20;

          // Draw a rectangle for signature area
          pdf.setLineWidth(0.3);
          pdf.rect(signatureX, signatureYPos, signatureBoxWidth, signatureBoxHeight);

          // Label below the box, centered
          pdf.setFontSize(10);
          pdf.setFont("helvetica", "normal");
          pdf.text("Authorized Signature", signatureX + signatureBoxWidth / 2, signatureYPos + signatureBoxHeight + 6, { align: 'center' });
        } catch (sigErr) {
          console.error('Signature box draw error:', sigErr);
        }

        // Generate filename
        const sanitizedCustomerName = work.customerName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        const billDate = format(new Date(), "dd-MM-yyyy");
        const filename = `bill-${sanitizedCustomerName}-${billDate}.pdf`;

        // Save PDF
        pdf.save(filename);
        toast.success("Bill downloaded successfully!");
      } catch (e) {
        console.error("Notes/Save error:", e);
        throw e;
      }
    } catch (err) {
      console.error("Failed to generate PDF bill:", err);
      toast.error("Failed to generate bill. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Completed Works</h1>
        <p className="text-muted-foreground mt-1">All works marked as completed</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {(works || []).filter(w => w.status === 'completed').map((work) => (
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
                    <Badge variant="outline">
                      <span className="text-green-600">COMPLETED</span>
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

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="default" onClick={() => handleReopen(work)}>
                      Reopen
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => generatePDFBill(work)}>
                      <Download className="mr-1 h-3 w-3" />
                      Download Bill
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

          {(!works || works.filter(w => w.status === 'completed').length === 0) && (
            <Card>
              <CardContent className="py-10 text-center">
                <p className="text-muted-foreground">No completed works yet.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default CompletedWorks;
