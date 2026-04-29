import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileText, Download, Clock, CheckCircle, Settings } from 'lucide-react';
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
    includeBookmarks: true,
    includeGraph: false,
    includeMedia: false
  });

  useEffect(() => {
    loadData();
  }, [caseId]);

  const loadData = async () => {
    try {
      // Load case data
      const caseResponse = await api.get(`/cases/${caseId}`);
      setCaseData(caseResponse.data.data?.case);

      // Load templates
      const templatesResponse = await api.get('/reports/templates');
      setTemplates(templatesResponse.data.data?.templates || []);

      // Load report history
      const historyResponse = await api.get(`/reports/case/${caseId}/history`);
      setReportHistory(historyResponse.data.data?.reports || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      const response = await api.post(
        `/reports/case/${caseId}/generate`,
        { ...options, templateId: selectedTemplate },
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
      if (template.options) {
        setOptions(template.options);
      } else {
        // Fallback backward compatibility
        setOptions({
          includeTimeline: template.sections.includes('timeline') || template.sections.includes('executive_summary'),
          includeEvidence: template.sections.includes('evidence') || template.sections.includes('executive_summary'),
          includeBookmarks: template.sections.includes('bookmarks'),
          includeGraph: template.sections.includes('graph'),
          includeMedia: template.sections.includes('media') || false
        });
      }
    }
  };

  const handleDownloadHistory = async (report: any) => {
    try {
      const response = await api.get(`/reports/${report.id}/download`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', report.pdfPath || `report-${report.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to download report:', error);
      alert('Failed to retrieve the forensic file.');
    }
  };

  return (
      <div className="mx-auto max-w-7xl">
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
                          className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-medium rounded capitalize"
                        >
                          {section.replace('_', ' ')}
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
                Report Sections (Custom Selection)
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
                    <div className="font-medium text-gray-900">Network Graph Summary</div>
                    <div className="text-sm text-gray-600">Include communication network topology overview</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.includeMedia}
                    onChange={(e) => setOptions({ ...options, includeMedia: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Media Previews</div>
                    <div className="text-sm text-gray-600">Attempt to preview image assets in evidence</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Generate Button */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Note:</strong> Full Reports with a large data volume may take 10-20 seconds to generate. Please be patient.
                  </p>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="w-full py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg font-semibold"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Generating Forensic PDF...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Generate Case PDF Report
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
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {reportHistory.map((report, idx) => (
                    <div key={idx} className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase">
                          {report.reportType}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {new Date(report.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-gray-900 mb-1 truncate">
                        {report.title}
                      </p>
                      <p className="text-[11px] text-gray-600 mb-3">
                        By {report.generator?.fullName || 'CopSight'}
                      </p>
                      <div className="flex items-center justify-between border-t pt-2">
                        <button 
                          onClick={() => handleDownloadHistory(report)}
                          className="text-xs text-blue-600 font-medium hover:text-blue-800 flex items-center gap-1"
                        >
                          <Download className="w-3 h-3" />
                          Download PDF
                        </button>
                        <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm">No forensic reports archived</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
  );
};
