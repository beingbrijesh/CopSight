/**
 * System-Wide Audit & Diagnostic Logging Service for CopSight Forensics Workstation.
 * Records user interactions, clicks, API requests, daemon RPC calls, and errors.
 */

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'ACTION' | 'DEBUG';
export type LogCategory =
  | 'AUTH'
  | 'NAVIGATION'
  | 'API'
  | 'DAEMON'
  | 'UI'
  | 'ACQUISITION'
  | 'DECRYPTION'
  | 'CASE'
  | 'DEVICE'
  | 'EVIDENCE'
  | 'SYSTEM';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, any>;
  stack?: string;
}

export interface ToastMessage {
  id: string;
  type: 'error' | 'warn' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: number;
}

class LoggerService {
  private logs: AuditLogEntry[] = [];
  private readonly maxLogs: number = 1000;
  private logListeners: Set<(logs: AuditLogEntry[]) => void> = new Set();
  private toastListeners: Set<(toast: ToastMessage) => void> = new Set();
  private isInitialized = false;

  constructor() {
    this.loadPersistedLogs();
  }

  public initGlobalListeners(): void {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Window Unhandled Error Listener
    window.addEventListener('error', (event) => {
      this.error('SYSTEM', `Uncaught exception: ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      }, event.error?.stack);
    });

    // Window Unhandled Promise Rejection Listener
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      this.error('SYSTEM', `Unhandled promise rejection: ${message}`, { reason }, stack);
    });

    // Global Click Listener to log UI interactions
    window.addEventListener('click', (event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      const button = target.closest('button');
      const link = target.closest('a');
      const input = target.closest('input');

      if (button) {
        const text = button.innerText?.trim().slice(0, 50) || button.getAttribute('title') || button.getAttribute('aria-label') || 'Button';
        this.action('UI', `Clicked button: "${text}"`);
      } else if (link) {
        const text = link.innerText?.trim().slice(0, 50) || link.getAttribute('href') || 'Link';
        this.action('NAVIGATION', `Clicked link: "${text}"`);
      } else if (input && input.type !== 'password') {
        this.action('UI', `Interacted with input: ${input.name || input.id || input.type}`);
      }
    }, { capture: true });

    this.info('SYSTEM', 'CopSight System-Wide Audit Logging Engine Initialized.');
  }

  private loadPersistedLogs(): void {
    try {
      const saved = localStorage.getItem('copsight_audit_trail');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(-this.maxLogs);
        }
      }
    } catch {
      this.logs = [];
    }
  }

  private persistLogs(): void {
    try {
      localStorage.setItem('copsight_audit_trail', JSON.stringify(this.logs.slice(-200)));
    } catch {
      // Ignore storage quota limits
    }
  }

  public log(level: LogLevel, category: LogCategory, message: string, metadata?: Record<string, any>, stack?: string): void {
    const entry: AuditLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      metadata,
      stack,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.persistLogs();
    this.notifyLogListeners();

    // Trigger toast notification for errors and warnings
    if (level === 'ERROR') {
      this.triggerToast({
        id: entry.id,
        type: 'error',
        title: `Error [${category}]`,
        message,
        timestamp: Date.now(),
      });
    } else if (level === 'WARN') {
      this.triggerToast({
        id: entry.id,
        type: 'warn',
        title: `Warning [${category}]`,
        message,
        timestamp: Date.now(),
      });
    }

    // Console mirror in development
    const formatted = `[CopSight][${level}][${category}] ${message}`;
    if (level === 'ERROR') console.error(formatted, metadata, stack);
    else if (level === 'WARN') console.warn(formatted, metadata);
    else console.log(formatted, metadata || '');
  }

  public info(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('INFO', category, message, metadata);
  }

  public success(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('INFO', category, `✓ ${message}`, metadata);
  }

  public warn(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('WARN', category, message, metadata);
  }

  public error(category: LogCategory, message: string, metadata?: Record<string, any>, stack?: string): void {
    this.log('ERROR', category, message, metadata, stack);
  }

  public action(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('ACTION', category, message, metadata);
  }

  public event(
    category: LogCategory,
    actionName: string,
    outcome: 'INITIATED' | 'SUCCESS' | 'FAILED' | 'SKIPPED',
    details: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = outcome === 'FAILED' ? 'ERROR' : outcome === 'INITIATED' ? 'ACTION' : 'INFO';
    const prefix = outcome === 'SUCCESS' ? '✓ ' : outcome === 'FAILED' ? '✕ ' : '➜ ';
    this.log(level, category, `${prefix}[${actionName}][${outcome}] ${details}`, metadata);
  }

  public debug(category: LogCategory, message: string, metadata?: Record<string, any>): void {
    this.log('DEBUG', category, message, metadata);
  }

  public getLogs(): AuditLogEntry[] {
    return [...this.logs];
  }

  public getErrorCount(): number {
    return this.logs.filter((l) => l.level === 'ERROR').length;
  }

  public getWarningCount(): number {
    return this.logs.filter((l) => l.level === 'WARN').length;
  }

  public clearLogs(): void {
    this.logs = [];
    localStorage.removeItem('copsight_audit_trail');
    this.notifyLogListeners();
    this.info('SYSTEM', 'Audit log buffer cleared by administrator.');
  }

  public subscribeLogs(listener: (logs: AuditLogEntry[]) => void): () => void {
    this.logListeners.add(listener);
    listener([...this.logs]);
    return () => this.logListeners.delete(listener);
  }

  public subscribeToasts(listener: (toast: ToastMessage) => void): () => void {
    this.toastListeners.add(listener);
    return () => this.toastListeners.delete(listener);
  }

  public triggerToast(toast: ToastMessage): void {
    this.toastListeners.forEach((fn) => fn(toast));
  }

  private notifyLogListeners(): void {
    const copy = [...this.logs];
    this.logListeners.forEach((fn) => fn(copy));
  }

  public async exportLogsJson(): Promise<void> {
    const jsonStr = JSON.stringify(this.logs, null, 2);
    
    // 1. First attempt native macOS file write via daemon RPC
    try {
      const res = await fetch('http://127.0.0.1:54322/api/logs/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: this.logs }),
      });
      const data = await res.json();
      if (data.success) {
        this.triggerToast({
          id: `export-${Date.now()}`,
          type: 'success',
          title: 'Logs Exported',
          message: data.message || 'Log dossier saved to Downloads and revealed in Finder.',
          timestamp: Date.now(),
        });
        // Also copy to clipboard for immediate pasting
        await this.copyLogsToClipboard(false);
        return;
      }
    } catch {
      // Fallback to browser blob download
    }

    // 2. Fallback: Blob URL download
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', `copsight_audit_log_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      // Ignore
    }

    // 3. Fallback: Copy to clipboard
    await this.copyLogsToClipboard();
  }

  public async copyLogsToClipboard(showToast = true): Promise<boolean> {
    try {
      const jsonStr = JSON.stringify(this.logs, null, 2);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonStr);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = jsonStr;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      if (showToast) {
        this.triggerToast({
          id: `copy-${Date.now()}`,
          type: 'success',
          title: 'Logs Copied',
          message: `Copied ${this.logs.length} audit log entries to clipboard in JSON format.`,
          timestamp: Date.now(),
        });
      }
      return true;
    } catch (e: any) {
      if (showToast) {
        this.triggerToast({
          id: `copy-err-${Date.now()}`,
          type: 'error',
          title: 'Copy Failed',
          message: `Could not copy logs: ${e.message}`,
          timestamp: Date.now(),
        });
      }
      return false;
    }
  }
}

export const loggerService = new LoggerService();
