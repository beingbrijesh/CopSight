import { create } from 'zustand';
import { loggerService } from '../lib/loggerService';

export interface ForensicCase {
  id: number;
  caseNumber: string;
  title: string;
  description?: string;
  category?: string;
  status: string;
  priority?: string;
  suspectName?: string;
  leadInvestigator?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface CaseState {
  selectedCase: ForensicCase | null;
  assignedCases: ForensicCase[];
  isLoading: boolean;
  searchQuery: string;
  filterStatus: string;
  setSelectedCase: (c: ForensicCase | null) => void;
  setAssignedCases: (cases: ForensicCase[]) => void;
  setIsLoading: (loading: boolean) => void;
  setSearchQuery: (query: string) => void;
  setFilterStatus: (status: string) => void;
  clearSelection: () => void;
}

export const useCaseStore = create<CaseState>((set) => ({
  selectedCase: JSON.parse(localStorage.getItem('copsight_selected_case') || 'null'),
  assignedCases: [],
  isLoading: false,
  searchQuery: '',
  filterStatus: 'ALL',

  setSelectedCase: (c) => {
    if (c) {
      localStorage.setItem('copsight_selected_case', JSON.stringify(c));
      loggerService.event(
        'CASE',
        'Select Case',
        'SUCCESS',
        `Active jurisdiction set to Case #${c.caseNumber} ("${c.title}").`,
        { caseId: c.id, caseNumber: c.caseNumber, title: c.title }
      );
    } else {
      localStorage.removeItem('copsight_selected_case');
    }
    set({ selectedCase: c });
  },

  setAssignedCases: (assignedCases) => set({ assignedCases }),
  setIsLoading: (isLoading) => set({ isLoading }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setFilterStatus: (filterStatus) => {
    loggerService.event('CASE', 'Filter Status', 'SUCCESS', `Filtered case docket by: ${filterStatus}`);
    set({ filterStatus });
  },
  clearSelection: () => {
    localStorage.removeItem('copsight_selected_case');
    loggerService.event('CASE', 'Switch Case', 'SUCCESS', 'Returned to case assignment selection screen.');
    set({ selectedCase: null });
  },
}));
