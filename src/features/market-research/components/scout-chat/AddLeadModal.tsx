// Add-lead modal — part of the market-research scout-chat UI.

import { Loader2 } from "lucide-react";
import React, { useState, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { buildApiUrl } from "@/shared/api/transport";
import { useAuth } from "@/shared/auth";
import jwtManager from "@/shared/auth/jwt";

interface AddLeadFormData {
  fullName: string;
  email: string;
  mobile: string;
  companyName: string;
  companyWebsite: string;
  linkedInProfile: string;
  actions: string;
}

interface AddLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: Partial<AddLeadFormData>;
  onAdd?: (data: AddLeadFormData) => Promise<void>;
  onSuccess?: () => void;
}

const emptyForm: AddLeadFormData = {
  fullName: "",
  email: "",
  mobile: "",
  companyName: "",
  companyWebsite: "",
  linkedInProfile: "",
  actions: "",
};

export function AddLeadModal({
  open,
  onOpenChange,
  initialData,
  onAdd,
  onSuccess,
}: AddLeadModalProps) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [form, setForm] = useState<AddLeadFormData>({
    ...emptyForm,
    ...initialData,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && initialData) {
      setForm((p) => ({ ...p, ...initialData }));
    }
  }, [open, initialData]);

  const addLeadViaApi = async (data: AddLeadFormData) => {
    const userId = currentUser?.uid || "";
    const orgId = userId;
    if (!userId || !orgId) throw new Error("Authentication required");
    const authHeader = await jwtManager.getAuthHeader();
    const url = buildApiUrl("leads");
    const payload = { user_id: userId, org_id: orgId, data };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader && { Authorization: authHeader }),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName?.trim() || !form.email?.trim()) {
      toast({
        title: "Missing required fields",
        description: "Full Name and Email are required.",
        variant: "destructive",
      });
      return;
    }
    try {
      setIsSubmitting(true);
      if (onAdd) {
        await onAdd(form);
      } else {
        await addLeadViaApi(form);
      }
      toast({ title: "Lead added", description: "The lead has been added to your Lead Stream." });
      setForm({ ...emptyForm });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Failed to add lead",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (key: keyof AddLeadFormData, value: string) =>
    setForm((p) => ({ ...p, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to Lead Stream</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Full Name *</Label>
              <Input
                value={form.fullName}
                onChange={(e) => update("fullName", e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="john@company.com"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mobile</Label>
              <Input
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                placeholder="+1 555 000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input
                value={form.companyName}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Acme Inc"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Company Website</Label>
            <Input
              type="url"
              value={form.companyWebsite}
              onChange={(e) => update("companyWebsite", e.target.value)}
              placeholder="https://acme.com"
            />
          </div>
          <div className="space-y-2">
            <Label>LinkedIn Profile</Label>
            <Input
              type="url"
              value={form.linkedInProfile}
              onChange={(e) => update("linkedInProfile", e.target.value)}
              placeholder="https://linkedin.com/in/..."
            />
          </div>
          <div className="space-y-2">
            <Label>Actions / Notes</Label>
            <Input
              value={form.actions}
              onChange={(e) => update("actions", e.target.value)}
              placeholder="Follow up, schedule demo..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
