import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, File, CheckCircle, XCircle, Clock } from 'lucide-react';
import { parserAPI } from '@/services/api';

interface UploadJob {
  id: string;
  filename: string;
  status: 'uploading' | 'queued' | 'parsing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export const FileUpload = () => {
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const jobId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add job to state
      const newJob: UploadJob = {
        id: jobId,
        filename: file.name,
        status: 'uploading',
        progress: 0,
      };
      
      setJobs(prev => [...prev, newJob]);
      setIsUploading(true);

      try {
        // Upload file
        const response = await parserAPI.uploadFile(file);
        
        // Update job with server job ID
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, id: response.job_id, status: 'queued', progress: 25 }
            : job
        ));

        // Poll for status updates
        pollJobStatus(response.job_id);

      } catch (error: any) {
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { ...job, status: 'failed', error: error.message }
            : job
        ));
      }
    }
    
    setIsUploading(false);
  }, []);

  const pollJobStatus = async (jobId: string) => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;

    const poll = async () => {
      try {
        const status = await parserAPI.getJobStatus(jobId);
        
        setJobs(prev => prev.map(job => 
          job.id === jobId 
            ? { 
                ...job, 
                status: status.status,
                progress: getProgressFromStatus(status.status),
                error: status.error_message 
              }
            : job
        ));

        if (status.status === 'completed' || status.status === 'failed') {
          return; // Stop polling
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000); // Poll every 5 seconds
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    };

    poll();
  };

  const getProgressFromStatus = (status: string): number => {
    switch (status) {
      case 'queued': return 25;
      case 'parsing': return 50;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
      case 'queued':
      case 'parsing':
        return <Clock className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <File className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploading':
      case 'queued':
        return 'bg-blue-100 text-blue-800';
      case 'parsing':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/xml': ['.xml'],
      'application/json': ['.json'],
      'text/csv': ['.csv'],
      'application/octet-stream': ['.ufdr'],
    },
    disabled: isUploading,
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload UFDR Files
          </CardTitle>
          <CardDescription>
            Upload Cellebrite reports, UFDR files, or CSV data for analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
              }
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            {isDragActive ? (
              <p className="text-blue-600">Drop the files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop files here or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Supports XML, JSON, CSV, and UFDR files
                </p>
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p className="font-medium">Supported formats:</p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Cellebrite XML reports (.xml)</li>
              <li>UFDR JSON files (.json)</li>
              <li>CSV data exports (.csv)</li>
              <li>Binary UFDR files (.ufdr)</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {jobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Jobs</CardTitle>
            <CardDescription>
              Track the progress of your uploaded files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="font-medium">{job.filename}</span>
                    </div>
                    <Badge className={getStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </div>
                  
                  <Progress value={job.progress} className="mb-2" />
                  
                  {job.error && (
                    <Alert variant="destructive" className="mt-2">
                      <AlertDescription>{job.error}</AlertDescription>
                    </Alert>
                  )}
                  
                  <div className="text-sm text-gray-500">
                    Job ID: {job.id}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
