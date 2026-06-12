import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FileBarChart, Download, Clock, CheckCircle2, SlidersHorizontal, Loader2 } from 'lucide-react';
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
      const caseResponse = await api.get(`/cases/${caseId}`);
      setCaseData(caseResponse.data.data?.case);

      const templatesResponse = await api.get('/reports/templates');
      setTemplates(templatesResponse.data.data?.templates || []);

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
        options,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `case-${caseData?.caseNumber}-report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

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

  const sectionOptions = [
    { key: 'includeEvidence', label: 'Evidence Summary', desc: 'Include extracted evidence and data sources', checked: options.includeEvidence },
    { key: 'includeTimeline', label: 'Event Timeline', desc: 'Chronological list of all events', checked: options.includeTimeline },
    { key: 'includeQueries', label: 'Analysis Queries', desc: 'Include executed queries and results', checked: options.includeQueries },
    { key: 'includeBookmarks', label: 'Bookmarked Evidence', desc: 'Include all bookmarked items with notes', checked: options.includeBookmarks },
    { key: 'includeGraph', label: 'Network Graph', desc: 'Include communication network visualization', checked: options.includeGraph },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <p className="text-sm text-gray-500 dark:text-slate-500 font-medium">
          Create a comprehensive PDF report for case {caseData?.caseNumber}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Report Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Template Selection */}
          <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
              Report Template
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => handleTemplateChange(template.id)}
                  className={`p-4 border-2 rounded-xl cursor-pointer transition-all card-hover-lift ${
                    selectedTemplate === template.id
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-500/10'
                      : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 bg-white dark:bg-transparent'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{template.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mb-2">{template.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {template.sections.map((section: string) => (
                      <span
                        key={section}
                        className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 text-xs rounded-full"
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
          <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
              Report Sections
            </h2>
            
            <div className="space-y-2">
              {sectionOptions.map(({ key, label, desc, checked }) => (
                <label key={key} className="flex items-center gap-3 p-3 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer transition">
                  <div className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => setOptions({ ...options, [key]: e.target.checked })}
                      className="w-4 h-4 text-blue-600 bg-white dark:bg-slate-800 border-gray-300 dark:border-slate-600 rounded focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white text-sm">{label}</div>
                    <div className="text-xs text-gray-500 dark:text-slate-500">{desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateReport}
            disabled={generating}
            className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-2xl hover:shadow-lg hover:shadow-emerald-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base font-semibold"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
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
          <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10 p-6 sticky top-24">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-400 dark:text-slate-500" />
              Report History
            </h2>

            {reportHistory.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                {reportHistory.map((report, idx) => (
                  <div key={idx} className="p-3 border border-gray-100 dark:border-white/10 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition">
                    <div className="flex items-start justify-between mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5" />
                      <span className="text-xs text-gray-500 dark:text-slate-500">
                        {new Date(report.createdAt || report.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-slate-300 mb-0.5">
                      Generated by {report.User?.name || 'Unknown'}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500">
                      {new Date(report.createdAt || report.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-slate-500">
                <FileBarChart className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm">No reports generated yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
