
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar as CalendarIcon, PlusCircle } from "lucide-react";

const Calendar = () => {
  return (
    <Layout>
      <div className="animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Campaigns (Activator)</h1>
            <p className="text-gray-500">Move fast. Book meetings. Fill your pipeline.</p>
          </div>
          <Button className="bg-sales-blue hover:bg-blue-700 flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            New Campaign
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Campaigns</CardTitle>
                <CardDescription>Your ongoing outreach efforts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border rounded-md p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">UK Fintech Ops Directors</h3>
                        <p className="text-sm text-gray-500">Started 5 days ago • 14 days remaining</p>
                      </div>
                      <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Targets</p>
                        <p className="text-sm font-medium">85 contacts</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Open Rate</p>
                        <p className="text-sm font-medium">42%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Response Rate</p>
                        <p className="text-sm font-medium">18%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Meetings Booked</p>
                        <p className="text-sm font-medium">7</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="text-sales-blue">
                        View Campaign
                      </Button>
                    </div>
                  </div>
                  
                  <div className="border rounded-md p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">UK Fintech CTOs</h3>
                        <p className="text-sm text-gray-500">Started 3 days ago • 18 days remaining</p>
                      </div>
                      <span className="bg-green-100 text-green-800 text-xs px-2.5 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Targets</p>
                        <p className="text-sm font-medium">65 contacts</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Open Rate</p>
                        <p className="text-sm font-medium">38%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Response Rate</p>
                        <p className="text-sm font-medium">12%</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Meetings Booked</p>
                        <p className="text-sm font-medium">4</p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="sm" className="text-sales-blue">
                        View Campaign
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Meetings</CardTitle>
                <CardDescription>Scheduled through your campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start space-x-4 p-3 border rounded-md">
                    <Checkbox id="meeting1" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <label htmlFor="meeting1" className="font-medium cursor-pointer">
                          Intro Call with Fintech Ops Ltd
                        </label>
                        <span className="text-sm text-gray-500">Today, 2:30 PM</span>
                      </div>
                      <p className="text-sm text-gray-500">Jane Smith, Operations Director</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4 p-3 border rounded-md">
                    <Checkbox id="meeting2" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <label htmlFor="meeting2" className="font-medium cursor-pointer">
                          Demo with TechFinance
                        </label>
                        <span className="text-sm text-gray-500">Tomorrow, 10:00 AM</span>
                      </div>
                      <p className="text-sm text-gray-500">Mark Johnson, CTO</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-4 p-3 border rounded-md">
                    <Checkbox id="meeting3" />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <label htmlFor="meeting3" className="font-medium cursor-pointer">
                          Follow-up with PayTech Solutions
                        </label>
                        <span className="text-sm text-gray-500">Thu, 11:00 AM</span>
                      </div>
                      <p className="text-sm text-gray-500">Sarah Williams, Operations Manager</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Performance</CardTitle>
                <CardDescription>Metrics across all campaigns</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Contacts Reached</p>
                    <p className="text-2xl font-bold">150</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Average Open Rate</p>
                    <p className="text-2xl font-bold">40%</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Total Meetings Booked</p>
                    <p className="text-2xl font-bold">11</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Conversion Rate</p>
                    <p className="text-2xl font-bold">7.3%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Activator Capabilities</CardTitle>
                <CardDescription>What this agent can do for you</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      1
                    </div>
                    <span className="text-sm">Multi-channel campaign execution</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      2
                    </div>
                    <span className="text-sm">Automated email sequence generation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      3
                    </div>
                    <span className="text-sm">Meeting scheduling & calendar sync</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      4
                    </div>
                    <span className="text-sm">Campaign performance tracking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="h-5 w-5 rounded-full bg-blue-100 text-sales-blue flex items-center justify-center flex-shrink-0 mt-0.5">
                      5
                    </div>
                    <span className="text-sm">CRM integration & lead management</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Calendar;
