import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Search, Brain, Clock, MessageSquare, Phone, User } from 'lucide-react';
import { searchAPI } from '@/services/api';

interface SearchResult {
  query: string;
  answer: string;
  sources: Array<{
    content: string;
    metadata: any;
    similarity_score: number;
  }>;
  confidence_score: number;
  total_results: number;
  processing_time: number;
}

export const IntelligentSearch = () => {
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const { register, handleSubmit, watch } = useForm({
    defaultValues: {
      query: '',
    },
  });

  const query = watch('query');

  const onSubmit = async (data: { query: string }) => {
    if (!data.query.trim()) return;

    setIsLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await searchAPI.search(data.query);
      setResult(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Search failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getSourceIcon = (metadata: any) => {
    const appName = metadata?.app_name?.toLowerCase() || '';
    if (appName.includes('sms') || appName.includes('message')) {
      return <MessageSquare className="h-4 w-4" />;
    }
    if (appName.includes('call') || appName.includes('phone')) {
      return <Phone className="h-4 w-4" />;
    }
    if (appName.includes('contact')) {
      return <User className="h-4 w-4" />;
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI-Powered Forensic Search
          </CardTitle>
          <CardDescription>
            Ask natural language questions about your forensic data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex gap-2">
              <Input
                {...register('query')}
                placeholder="e.g., 'Show me all messages between John and Mary last week' or 'Find suspicious communication patterns'"
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <>
                    <Search className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search
                  </>
                )}
              </Button>
            </div>

            <div className="text-sm text-gray-600">
              <p className="font-medium mb-1">Example queries:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>"Find all WhatsApp messages containing 'meeting'"</li>
                <li>"Show communication patterns for phone number +1234567890"</li>
                <li>"What are the most frequent contacts for John Doe?"</li>
                <li>"Find messages sent between 2PM and 4PM yesterday"</li>
              </ul>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>AI Analysis Result</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge className={getConfidenceColor(result.confidence_score)}>
                    {Math.round(result.confidence_score * 100)}% confidence
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {result.processing_time.toFixed(2)}s
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose max-w-none">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
                  <p className="text-blue-900 whitespace-pre-wrap">{result.answer}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.sources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Evidence Sources ({result.total_results})</CardTitle>
                <CardDescription>
                  Data sources that informed this analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {result.sources.map((source, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getSourceIcon(source.metadata)}
                          <span className="font-medium">
                            {source.metadata?.app_name || 'Unknown Source'}
                          </span>
                        </div>
                        <Badge variant="outline">
                          {Math.round(source.similarity_score * 100)}% match
                        </Badge>
                      </div>

                      <div className="text-sm text-gray-600 mb-2">
                        {source.metadata?.sender_id && (
                          <span>From: {source.metadata.sender_id}</span>
                        )}
                        {source.metadata?.receiver_id && (
                          <span> → To: {source.metadata.receiver_id}</span>
                        )}
                        {source.metadata?.timestamp && (
                          <span className="ml-2">
                            📅 {formatTimestamp(source.metadata.timestamp)}
                          </span>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded p-3">
                        <p className="text-sm">{source.content}</p>
                      </div>

                      {source.metadata && Object.keys(source.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-gray-500 cursor-pointer">
                            View metadata
                          </summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(source.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
