
// import React, { useState } from "react";
// import { Button } from "@/components/ui/button";
// import {
//   Dialog,
//   DialogClose,
//   DialogContent,
//   DialogDescription,
//   DialogFooter,
//   DialogHeader,
//   DialogTitle,
// } from "@/components/ui/dialog";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
//   FormMessage,
// } from "@/components/ui/form";
// import { Input } from "@/components/ui/input";
// import { Textarea } from "@/components/ui/textarea";
// import { z } from "zod";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useForm } from "react-hook-form";
// import { Search, ArrowRight } from "lucide-react";
// import { useNavigate } from "react-router-dom";
// import { useToast } from "@/hooks/use-toast";

// // Define form schema using Zod
// const formSchema = z.object({
//   targetMarket: z.string().min(3, "Target market is required"),
//   industryFocus: z.string().min(3, "Industry focus is required"),
//   companySize: z.string().min(1, "Company size is required"),
//   geographicRegion: z.string().min(1, "Geographic region is required"),
//   leadPriority: z.string().min(1, "Lead priority criteria is required"),
//   additionalContext: z.string().optional(),
// });

// type FormValues = z.infer<typeof formSchema>;

// interface ScoutDeploymentModalProps {
//   isOpen: boolean;
//   onClose: () => void;
//   onDeploy: (values: FormValues) => void;
// }

// export function ScoutDeploymentModal({
//   isOpen,
//   onClose,
//   onDeploy,
// }: ScoutDeploymentModalProps) {
//   const [currentStep, setCurrentStep] = useState(0);
//   const { toast } = useToast();
//   const navigate = useNavigate();
  
//   const form = useForm<FormValues>({
//     resolver: zodResolver(formSchema),
//     defaultValues: {
//       targetMarket: "",
//       industryFocus: "",
//       companySize: "",
//       geographicRegion: "",
//       leadPriority: "",
//       additionalContext: "",
//     },
//   });

//   const steps = [
//     {
//       id: "target-market",
//       title: "Target Market",
//       description: "What specific market are you targeting?",
//       field: "targetMarket",
//       placeholder: "e.g., SaaS companies in healthcare sector",
//     },
//     {
//       id: "industry",
//       title: "Industry Focus",
//       description: "Which industries should Scout prioritize?",
//       field: "industryFocus",
//       placeholder: "e.g., Healthcare, Finance, Technology",
//     },
//     {
//       id: "company-size",
//       title: "Company Size",
//       description: "What size of companies are you targeting?",
//       field: "companySize",
//       placeholder: "e.g., 50-200 employees, $5M-$20M revenue",
//     },
//     {
//       id: "region",
//       title: "Geographic Region",
//       description: "Which regions should Scout focus on?",
//       field: "geographicRegion",
//       placeholder: "e.g., North America, Western Europe",
//     },
//     {
//       id: "priority",
//       title: "Lead Priority",
//       description: "How should Scout prioritize your leads?",
//       field: "leadPriority",
//       placeholder: "e.g., Growth rate, tech adoption, funding stage",
//     },
//     {
//       id: "context",
//       title: "Additional Context",
//       description: "Any other details to help Scout find the best matches?",
//       field: "additionalContext",
//       placeholder: "e.g., Specific technologies, pain points, or use cases",
//       optional: true,
//     },
//   ];

//   const currentQuestion = steps[currentStep];

//   const handleNext = () => {
//     const field = currentQuestion.field as keyof FormValues;
//     const value = form.getValues(field);
    
//     if (!value && !currentQuestion.optional) {
//       form.setError(field, {
//         type: "manual",
//         message: "This field is required",
//       });
//       return;
//     }
    
//     if (currentStep < steps.length - 1) {
//       setCurrentStep((prev) => prev + 1);
//     } else {
//       handleSubmit();
//     }
//   };

//   const handleBack = () => {
//     if (currentStep > 0) {
//       setCurrentStep((prev) => prev - 1);
//     }
//   };

//   const handleSubmit = () => {
//     if (form.formState.isValid) {
//       const values = form.getValues();
//       onDeploy(values);
//       toast({
//         title: "Scout deployed successfully!",
//         description: "Navigating to Market Research...",
//       });
//       navigate("/market-research");
//       onClose();
//     } else {
//       form.trigger();
//     }
//   };

//   return (
//     <Dialog open={isOpen} onOpenChange={onClose}>
//       <DialogContent className="sm:max-w-[500px]">
//         <DialogHeader>
//           <div className="flex items-center gap-3">
//             <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
//               <Search className="h-6 w-6" />
//             </div>
//             <div>
//               <DialogTitle>Deploy Scout Agent</DialogTitle>
//               <DialogDescription>
//                 Help Scout understand what leads to find for you
//               </DialogDescription>
//             </div>
//           </div>
//         </DialogHeader>

//         <Form {...form}>
//           <div className="py-4">
//             <div className="mb-6 flex items-center">
//               <div className="relative w-full bg-gray-200 h-2 rounded-full">
//                 <div
//                   className="absolute bg-blue-600 h-2 rounded-full transition-all"
//                   style={{
//                     width: `${((currentStep + 1) / steps.length) * 100}%`,
//                   }}
//                 ></div>
//               </div>
//               <span className="ml-3 text-sm font-medium">
//                 {currentStep + 1}/{steps.length}
//               </span>
//             </div>

//             <FormField
//               control={form.control}
//               name={currentQuestion.field as any}
//               render={({ field }) => (
//                 <FormItem>
//                   <FormLabel className="text-lg font-semibold">
//                     {currentQuestion.title}
//                   </FormLabel>
//                   <div className="text-sm text-gray-500 mb-4">
//                     {currentQuestion.description}
//                   </div>
//                   <FormControl>
//                     {currentQuestion.field === "additionalContext" ? (
//                       <Textarea
//                         placeholder={currentQuestion.placeholder}
//                         className="resize-none h-32"
//                         {...field}
//                       />
//                     ) : (
//                       <Input placeholder={currentQuestion.placeholder} {...field} />
//                     )}
//                   </FormControl>
//                   <FormMessage />
//                 </FormItem>
//               )}
//             />
//           </div>
          
//           <DialogFooter className="flex justify-between">
//             <div>
//               {currentStep > 0 && (
//                 <Button variant="outline" onClick={handleBack}>
//                   Back
//                 </Button>
//               )}
//             </div>
//             <div>
//               {currentStep < steps.length - 1 ? (
//                 <Button type="button" onClick={handleNext} className="gap-2">
//                   Next <ArrowRight className="h-4 w-4" />
//                 </Button>
//               ) : (
//                 <Button 
//                   type="button"
//                   onClick={handleSubmit}
//                   className="bg-blue-600 hover:bg-blue-700"
//                 >
//                   Deploy Scout
//                 </Button>
//               )}
//             </div>
//           </DialogFooter>
//         </Form>
//       </DialogContent>
//     </Dialog>
//   );
// }


import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Search, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  targetMarket: z.string().min(3, "Target market is required"),
  industryFocus: z.string().min(3, "Industry focus is required"),
  companySize: z.string().min(1, "Company size is required"),
  geographicRegion: z.string().min(1, "Geographic region is required"),
  leadPriority: z.string().min(1, "Lead priority criteria is required"),
  additionalContext: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface ScoutDeploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeploy: (values: FormValues) => void;
}

export function ScoutDeploymentModal({
  isOpen,
  onClose,
  onDeploy,
}: ScoutDeploymentModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetMarket: "",
      industryFocus: "",
      companySize: "",
      geographicRegion: "",
      leadPriority: "",
      additionalContext: "",
    },
    shouldUnregister: true,
  });

  const steps = [
    {
      id: "target-market",
      title: "Target Market",
      description: "What specific market are you targeting?",
      field: "targetMarket",
      placeholder: "e.g., SaaS companies in healthcare sector",
    },
    {
      id: "industry",
      title: "Industry Focus",
      description: "Which industries should Scout prioritize?",
      field: "industryFocus",
      placeholder: "e.g., Healthcare, Finance, Technology",
    },
    {
      id: "company-size",
      title: "Company Size",
      description: "What size of companies are you targeting?",
      field: "companySize",
      placeholder: "e.g., 50-200 employees, $5M-$20M revenue",
    },
    {
      id: "region",
      title: "Geographic Region",
      description: "Which regions should Scout focus on?",
      field: "geographicRegion",
      placeholder: "e.g., North America, Western Europe",
    },
    {
      id: "priority",
      title: "Lead Priority",
      description: "How should Scout prioritize your leads?",
      field: "leadPriority",
      placeholder: "e.g., Growth rate, tech adoption, funding stage",
    },
    {
      id: "context",
      title: "Additional Context",
      description: "Any other details to help Scout find the best matches?",
      field: "additionalContext",
      placeholder: "e.g., Specific technologies, pain points, or use cases",
      optional: true,
    },
  ];

  const currentQuestion = steps[currentStep];

  const handleNext = () => {
    const field = currentQuestion.field as keyof FormValues;
    const value = form.getValues(field);

    if (!value && !currentQuestion.optional) {
      form.setError(field, {
        type: "manual",
        message: "This field is required",
      });
      return;
    }

    if (currentStep < steps.length - 1) {
      const nextField = steps[currentStep + 1].field as keyof FormValues;
      form.setValue(nextField, ""); // Clear the next input field
      setCurrentStep((prev) => prev + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (form.formState.isValid) {
      const values = form.getValues();
      onDeploy(values);
      toast({
        title: "Scout deployed successfully!",
        description: "Navigating to Market Research...",
      });
      navigate("/market-research");
      onClose();
    } else {
      form.trigger();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Search className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle>Deploy Scout Agent</DialogTitle>
              <DialogDescription>
                Help Scout understand what leads to find for you
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <div className="py-4">
            <div className="mb-6 flex items-center">
              <div className="relative w-full bg-gray-200 h-2 rounded-full">
                <div
                  className="absolute bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${((currentStep + 1) / steps.length) * 100}%`,
                  }}
                ></div>
              </div>
              <span className="ml-3 text-sm font-medium">
                {currentStep + 1}/{steps.length}
              </span>
            </div>

            <FormField
              control={form.control}
              name={currentQuestion.field as keyof FormValues}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-lg font-semibold">
                    {currentQuestion.title}
                  </FormLabel>
                  <div className="text-sm text-gray-500 mb-4">
                    {currentQuestion.description}
                  </div>
                  <FormControl>
                    {currentQuestion.field === "additionalContext" ? (
                      <Textarea
                        placeholder={currentQuestion.placeholder}
                        className="resize-none h-32"
                        {...field}
                      />
                    ) : (
                      <Input placeholder={currentQuestion.placeholder} {...field} />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <DialogFooter className="flex justify-between">
            <div>
              {currentStep > 0 && (
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
            </div>
            <div>
              {currentStep < steps.length - 1 ? (
                <Button type="button" onClick={handleNext} className="gap-2">
                  Next <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleSubmit}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Deploy Scout
                </Button>
              )}
            </div>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
