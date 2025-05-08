
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle, ChevronRight, Loader2 } from "lucide-react";

export function ICPBuilder() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState(1);

  const startProcessing = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setActiveStep(activeStep + 1);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create New ICP Profile</CardTitle>
          <CardDescription>
            Define your ideal customer profile with AI assistance from Profiler
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="guided" className="w-full">
            <TabsList className="mb-6 w-full">
              <TabsTrigger value="guided" className="flex-1">Guided Builder</TabsTrigger>
              <TabsTrigger value="ai" className="flex-1">AI-Generated</TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">Manual Input</TabsTrigger>
            </TabsList>
            
            <TabsContent value="guided">
              <div className="space-y-6">
                {/* Step indicators */}
                <div className="flex justify-between items-center">
                  {[1, 2, 3, 4].map((step) => (
                    <div key={step} className="flex items-center">
                      <div 
                        className={`h-8 w-8 rounded-full flex items-center justify-center
                          ${step < activeStep ? "bg-green-500 text-white" : 
                            step === activeStep ? "bg-blue-500 text-white" : 
                            "bg-gray-200 text-gray-600"}
                        `}
                      >
                        {step < activeStep ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          step
                        )}
                      </div>
                      {step < 4 && (
                        <div className={`h-1 w-16 ${step < activeStep ? "bg-green-500" : "bg-gray-200"}`} />
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Step content */}
                {activeStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Basic Information</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Profile Name</Label>
                          <Input id="name" placeholder="e.g., UK Fintech Decision Maker" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="industry">Industry</Label>
                          <Select>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fintech">Fintech</SelectItem>
                              <SelectItem value="healthcare">Healthcare</SelectItem>
                              <SelectItem value="ecommerce">E-commerce</SelectItem>
                              <SelectItem value="saas">SaaS</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="description">Brief Description</Label>
                        <Textarea 
                          id="description" 
                          placeholder="Describe your ideal customer profile in a few sentences..." 
                          rows={3}
                        />
                      </div>
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        onClick={startProcessing} 
                        className="bg-sales-blue hover:bg-blue-700"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            Continue
                            <ChevronRight className="ml-1 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                
                {activeStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Firmographics</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company-size">Company Size</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select size range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-500">201-500 employees</SelectItem>
                            <SelectItem value="501+">501+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="revenue">Annual Revenue</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select revenue range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="<1m">Less than £1M</SelectItem>
                            <SelectItem value="1m-10m">£1M - £10M</SelectItem>
                            <SelectItem value="10m-50m">£10M - £50M</SelectItem>
                            <SelectItem value="50m-100m">£50M - £100M</SelectItem>
                            <SelectItem value="100m+">£100M+</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* More fields would go here */}
                    </div>
                    
                    <div className="flex justify-end">
                      <Button 
                        onClick={startProcessing} 
                        className="bg-sales-blue hover:bg-blue-700"
                      >
                        Continue
                        <ChevronRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                
                {/* Additional steps would be implemented similarly */}
              </div>
            </TabsContent>
            
            <TabsContent value="ai">
              <div className="space-y-4">
                <div className="rounded-md bg-blue-50 p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-blue-800">Generate ICP with AI</h4>
                    <p className="text-sm text-blue-700">
                      Profiler will use market research data and your inputs to generate a comprehensive ICP profile.
                      Provide some basic guidance below.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <Label htmlFor="ai-prompt">Instructions for Profiler</Label>
                  <Textarea 
                    id="ai-prompt" 
                    placeholder="e.g., Create an ICP for UK fintech companies with 50-200 employees that need payment processing solutions..." 
                    rows={4}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button className="bg-sales-blue hover:bg-blue-700">
                    Generate ICP Profile
                  </Button>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="manual">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Manually input all details of your ideal customer profile.
                </p>
                
                {/* Manual form fields would go here */}
                <div className="flex justify-end">
                  <Button className="bg-sales-blue hover:bg-blue-700">
                    Save Profile
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
