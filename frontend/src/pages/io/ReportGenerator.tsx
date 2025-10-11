import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download, Clock, CheckCircle, Settings } from 'lucide-react';
import { Navbar } from '../../components/Navbar';
import { api } from '../../lib/api';

export const ReportGenerator = () => {
  const { caseId } = useParams();
  const [caseData, setCaseData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('full');
  const [reportHistory, setReportHistory] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  
  // Report options
  const [options, setOptions] = useState({
    includeTimeline: true,
    includeEvidence: true,
    includeQueries: true,
    includeBookmarks: true,
    includeGraph: false
  });

  useEffect(() => {
    loadData();
  }, [caseId]);

  const loadData = async () => {
    try {
      // Load case data
      const caseResponse = await api.get(`/api/cases/${caseId}`);
      setCaseData(caseResponse.data.data?.case);

      // Load templates
      const templatesResponse = await api.get('/api/reports/templates');
      setTemplates(templatesResponse.data.data?.templates || []);

      // Load report history
      const historyResponse = await api.get(`/api/reports/case/${caseId}/history`);
      setReportHistory(historyResponse.data.data?.reports || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await api.post(
        `/api/reports/case/${caseId}/generate`,
        options,
        { responseType: 'blob' }
      );

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `case-${caseData?.caseNumber}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Reload history
      loadData();
    } catch (error) {
      console.error('Failed to generate report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    
    if (template) {
      setOptions({
        includeTimeline: template.sections.includes('timeline'),
        includeEvidence: template.sections.includes('evidence'),
        includeQueries: template.sections.includes('queries'),
        includeBookmarks: template.sections.includes('bookmarks'),
        includeGraph: template.sections.includes('graph')
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-green-600" />
            Generate Case Report
          </h1>
          <p className="text-gray-600 mt-1">
            Create a comprehensive PDF report for case {caseData?.caseNumber}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Configuration */}
          <div className="lg:col-span-2 space-y-6">
            {/* Template Selection */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Report Template
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => handleTemplateChange(template.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      selectedTemplate === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <h3 className="font-semibold text-gray-900 mb-1">{template.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {template.sections.map((section: string) => (
                        <span
                          key={section}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {section}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Options */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Report Sections
              </h2>
              
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeEvidence}
                    onChange={(e) => setOptions({ ...options, includeEvidence: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Evidence Summary</div>
                    <div className="text-sm text-gray-600">Include extracted evidence and data sources</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeTimeline}
                    onChange={(e) => setOptions({ ...options, includeTimeline: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Event Timeline</div>
                    <div className="text-sm text-gray-600">Chronological list of all events</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeQueries}
                    onChange={(e) => setOptions({ ...options, includeQueries: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Analysis Queries</div>
                    <div className="text-sm text-gray-600">Include executed queries and results</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeBookmarks}
                    onChange={(e) => setOptions({ ...options, includeBookmarks: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Bookmarked Evidence</div>
                    <div className="text-sm text-gray-600">Include all bookmarked items with notes</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeGraph}
                    onChange={(e) => setOptions({ ...options, includeGraph: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Network Graph</div>
                    <div className="text-sm text-gray-600">Include communication network visualization</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-semibold"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating Report...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate PDF Report
                </>
              )}
            </button>
          </div>

          {/* Report History */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow p-6 sticky top-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Report History
              </h2>

              {reportHistory.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {reportHistory.map((report, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />
                        <span className="text-xs text-gray-500">
                          {new Date(report.createdAt || report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mb-1">
                        Generated by {report.User?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(report.createdAt || report.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm">No reports generated yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
