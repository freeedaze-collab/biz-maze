// @ts-nocheck
import { useState } from "react";
import Navigation from "@/components/Navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Play, Pause, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SynthesisStatus = () => {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const synthesisJobs = [
    {
      id: "SYNTH-001",
      name: "Data Synthesis Pipeline A",
      status: "running",
      progress: 75,
      startTime: "2024-01-15 14:30:00",
      estimatedCompletion: "2024-01-15 16:00:00",
      processedRecords: 7500,
      totalRecords: 10000,
      errors: 0,
    },
    {
      id: "SYNTH-002",
      name: "ML Model Training Synthesis",
      status: "completed",
      progress: 100,
      startTime: "2024-01-15 09:00:00",
      estimatedCompletion: "2024-01-15 13:30:00",
      processedRecords: 50000,
      totalRecords: 50000,
      errors: 0,
    },
    {
      id: "SYNTH-003",
      name: "Report Generation Pipeline",
      status: "paused",
      progress: 45,
      startTime: "2024-01-15 12:15:00",
      estimatedCompletion: "2024-01-15 18:00:00",
      processedRecords: 2250,
      totalRecords: 5000,
      errors: 3,
    },
    {
      id: "SYNTH-004",
      name: "Data Validation Process",
      status: "pending",
      progress: 0,
      startTime: null,
      estimatedCompletion: "2024-01-15 20:00:00",
      processedRecords: 0,
      totalRecords: 15000,
      errors: 0,
    },
  ];

  const handleUpdate = async () => {
    setUpdating(true);
    
    setTimeout(() => {
      setUpdating(false);
      setLastUpdate(new Date());
      toast({
        title: "Status Updated",
        description: "Synthesis status has been refreshed",
      });
    }, 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success hover:bg-success/90';
      case 'running': return 'bg-primary hover:bg-primary/90';
      case 'paused': return 'bg-warning hover:bg-warning/90';
      case 'pending': return 'bg-muted hover:bg-muted/90';
      case 'error': return 'bg-destructive hover:bg-destructive/90';
      default: return '';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'running': return <Play className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'error': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-card-foreground mb-2">
                Synthesis Status Display
              </h1>
              <p className="text-muted-foreground text-lg">
                Monitor and manage your synthesis processes
              </p>
            </div>
            <Button onClick={handleUpdate} disabled={updating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${updating ? 'animate-spin' : ''}`} />
              {updating ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: {lastUpdate.toLocaleString()}
          </p>
        </div>

        <Navigation />

        {/* Status Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{synthesisJobs.length}</div>
              <p className="text-xs text-muted-foreground">
                Synthesis processes
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Running</CardTitle>
              <Play className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                {synthesisJobs.filter(job => job.status === 'running').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Active processes
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">
                {synthesisJobs.filter(job => job.status === 'completed').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Successfully finished
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">
                {synthesisJobs.filter(job => job.status === 'paused' || job.errors > 0).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Requiring attention
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Synthesis Jobs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Synthesis Processes
            </CardTitle>
            <CardDescription>
              Real-time status of all synthesis jobs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {synthesisJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-6 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${getStatusColor(job.status).replace('bg-', 'bg-').replace('hover:bg-', 'text-white bg-')}`}>
                        {getStatusIcon(job.status)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">{job.name}</h3>
                        <p className="text-sm text-muted-foreground">{job.id}</p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={getStatusColor(job.status)}
                    >
                      {job.status}
                    </Badge>
                  </div>

                  <div className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Progress: {job.processedRecords.toLocaleString()} / {job.totalRecords.toLocaleString()}</span>
                        <span>{job.progress}%</span>
                      </div>
                      <Progress value={job.progress} className="h-2" />
                    </div>

                    {/* Job Details */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Start Time</p>
                        <p className="font-medium">{job.startTime || 'Not started'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Est. Completion</p>
                        <p className="font-medium">{job.estimatedCompletion}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Records</p>
                        <p className="font-medium">{job.processedRecords.toLocaleString()} / {job.totalRecords.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Errors</p>
                        <p className={`font-medium ${job.errors > 0 ? 'text-destructive' : 'text-success'}`}>
                          {job.errors}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                      {job.status === 'running' && (
                        <Button size="sm" variant="outline">
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </Button>
                      )}
                      {job.status === 'paused' && (
                        <Button size="sm" variant="outline">
                          <Play className="h-3 w-3 mr-1" />
                          Resume
                        </Button>
                      )}
                      {job.status === 'pending' && (
                        <Button size="sm" variant="outline">
                          <Play className="h-3 w-3 mr-1" />
                          Start
                        </Button>
                      )}
                      <Button size="sm" variant="ghost">
                        View Logs
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SynthesisStatus;