import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist. 
// Use /tmp on Render since it's an ephemeral read-only filesystem except for /tmp.
const uploadsDir = process.env.RENDER ? '/tmp/uploads' : path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create case-specific directory
    const caseId = req.params.caseId || 'temp';
    const caseDir = path.join(uploadsDir, `case_${caseId}`);
    
    if (!fs.existsSync(caseDir)) {
      fs.mkdirSync(caseDir, { recursive: true });
    }
    
    cb(null, caseDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    cb(null, `${basename}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.vbs', '.ps1', '.msi', '.php', '.jsp', '.cgi', '.pl', '.jar'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (dangerousExtensions.includes(ext)) {
    cb(new Error(`Security Error: Uploading executable or script files (${ext}) is prohibited.`), false);
  } else {
    cb(null, true);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 104857600 // 100MB default
  }
});

export default upload;
