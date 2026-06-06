import { getReportHistory, generateReport } from './src/controllers/reportController.js';
import { checkCaseAccess } from './src/middleware/caseAccess.js';

const req = {
  params: { caseId: '1' },
  body: {},
  user: { id: 1, role: 'admin' },
  ip: '127.0.0.1',
  get: () => 'curl'
};

const res = {
  json: (data) => console.log('JSON:', data),
  status: function(code) {
    console.log('STATUS:', code);
    return this;
  },
  setHeader: (key, val) => console.log('HEADER:', key, val)
};

const next = () => console.log('NEXT called');

async function test() {
  try {
    console.log('--- Testing checkCaseAccess ---');
    await checkCaseAccess(req, res, async () => {
      console.log('--- Testing getReportHistory ---');
      await getReportHistory(req, res);
      
      console.log('--- Testing generateReport ---');
      // Create a mock stream for pdf pipe
      const mockStream = {
        pipe: () => console.log('PIPE called')
      };
      
      const realSetHeader = res.setHeader;
      res.setHeader = (k,v) => console.log('SET HEADER:', k, v);
      
      await generateReport(req, res);
    });
  } catch(e) {
    console.error('UNCAUGHT:', e);
  }
}

test();
