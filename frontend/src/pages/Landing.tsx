import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Brain, Database, Search, ChevronRight, Activity, FileText, Share2,
  Network, Lock, Zap, Clock, UserCheck, Fingerprint, BarChart3, BookMarked,
  Globe, Cpu, AlertTriangle, Sun, Moon, Layers, Eye,
  MessageSquare, TrendingUp, Server
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const handleAction = () => {
    if (isAuthenticated && user) {
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'investigating_officer') navigate('/io');
      else if (user.role === 'supervisor') navigate('/supervisor');
      else navigate('/login');
    } else {
      navigate('/login');
    }
  };

  // Scroll-triggered animations effect (Optimized)
  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => {
      elements.forEach((el) => observerRef.current?.unobserve(el));
      observerRef.current?.disconnect();
    };
  }, []);

  const mockTabs = [
    { label: 'AI Query', icon: Brain },
    { label: 'Network', icon: Network },
    { label: 'Timeline', icon: Clock },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-transparent text-slate-900 dark:text-slate-100 overflow-x-hidden selection:bg-blue-500/30 selection:text-blue-900 dark:selection:text-blue-100 font-sans relative">
      
      {/* Unified Brand Color Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0  transform-gpu">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-300/30 dark:bg-blue-500/10 blur-[100px] mix-blend-multiply dark:mix-blend-normal opacity-70 animate-[pulse_8s_ease-in-out_infinite] transform-gpu"></div>
        <div className="absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-300/30 dark:bg-indigo-500/10 blur-[100px] mix-blend-multiply dark:mix-blend-normal opacity-60 animate-[pulse_10s_ease-in-out_infinite_alternate] transform-gpu"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-blue-200/40 dark:bg-violet-500/5 blur-[100px] mix-blend-multiply dark:mix-blend-normal opacity-50 animate-[pulse_12s_ease-in-out_infinite_alternate-reverse] transform-gpu"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-transparent/70 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 shadow-sm transition-all duration-300 ">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-xl shadow-md border border-blue-100 dark:border-white/10 overflow-hidden group">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover z-10" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900 dark:text-white">CopSight AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group">
              Intelligence
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a href="#workflow" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group">
              Platform
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a href="#architecture" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group">
              Architecture
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a href="#security" className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors relative group">
              Security
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </a>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="relative flex items-center justify-center h-9 w-9 rounded-full border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-indigo-600" />}
            </button>

            {/* Removed Sign In button because Get Started does the same work */}
            <button 
              onClick={handleAction}
              className="relative px-6 py-2.5 rounded-full font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 overflow-hidden group shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.23)] transition-all active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span className="relative z-10 flex items-center gap-2 group-hover:text-white">{isAuthenticated ? 'Dashboard' : 'Get Started'} <ChevronRight className="w-4 h-4" /></span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 px-6 z-10">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-blue-200 dark:border-blue-500/30 shadow-sm text-blue-700 dark:text-blue-400 text-[11px] uppercase tracking-[0.25em] font-extrabold mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out ">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            Enterprise Digital Forensics
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-100 ease-out leading-[1.1] text-slate-900 dark:text-white">
            Uncover Truth <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-violet-400">
              Instantly.
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 max-w-3xl mb-12 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-200 ease-out leading-relaxed font-medium">
            Empower your investigations with AI-driven processing, intelligent relationship mapping, and instant evidentiary reporting — all on-premise, all secure.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-6 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-300 ease-out">
            <button 
              onClick={handleAction}
              className="group relative flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-8 py-4 rounded-full text-lg font-bold transition-all active:scale-95 shadow-[0_8px_30px_rgb(37,99,235,0.3)] hover:shadow-[0_8px_30px_rgb(37,99,235,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
              <span className="relative z-10 flex items-center gap-2">
                {isAuthenticated ? 'Open Dashboard' : 'Access System'}
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </span>
            </button>
            <a href="#features" className="flex items-center gap-2 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm text-slate-800 dark:text-slate-200 px-8 py-4 rounded-full text-lg font-bold transition-all active:scale-95">
              Explore Features
            </a>
          </div>

          {/* Stats Ticker */}
          <div className="mt-24 w-full max-w-4xl animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-500 ease-out relative ">
            <div className="relative p-6 rounded-3xl bg-white/80 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)] flex flex-wrap justify-center md:justify-between items-center gap-8 hover:shadow-[0_8px_30px_rgb(37,99,235,0.1)] transition-shadow duration-500">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div> Real-Time AI
              </div>
              <div className="hidden md:block h-8 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg"><Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div> Air-Gapped Ready
              </div>
              <div className="hidden md:block h-8 w-[1px] bg-slate-200 dark:bg-slate-700"></div>
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700 dark:text-slate-300">
                <div className="p-2 bg-blue-50 dark:bg-blue-500/10 rounded-lg"><Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" /></div> Evidentiary Standard
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6">
              Platform Capabilities
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">Intelligence at Scale</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {/* Large Card: AI Search */}
            <div className="md:col-span-4 bg-white/80 dark:bg-white/5 hover:bg-white/90 dark:hover:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 dark:hover:shadow-blue-500/5 rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 ">
              <div className="bg-blue-50 dark:bg-blue-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-blue-100 dark:border-blue-500/20 group-hover:scale-110 transition-transform duration-500">
                <Brain className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white tracking-tight">AI-Powered Interrogation</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-lg font-medium text-lg">Talk to your evidence. Use natural language querying powered by RAG (Retrieval-Augmented Generation) to extract hidden insights across millions of extracted records.</p>
              
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500"></div>
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  <span className="text-sm font-mono text-slate-800 dark:text-slate-200 font-bold glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl px-3 py-1 rounded-lg border border-slate-200 dark:border-white/10 shadow-sm">"Show me all communications with foreign numbers"</span>
                </div>
                <div className="flex items-start gap-4 p-4 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl/50 rounded-xl border border-slate-100 dark:border-white/10 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="space-y-3 w-full">
                    <div className="h-2.5 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                    <div className="h-2.5 w-5/6 bg-slate-100 dark:bg-slate-800 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Card: Network Graphs */}
            <div className="md:col-span-2 md:row-span-2 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl hover:bg-slate-50/50 dark:hover:bg-slate-900/80 backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5 dark:hover:shadow-indigo-500/5 rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-100 flex flex-col ">
              <div className="bg-indigo-50 dark:bg-indigo-500/10 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-indigo-100 dark:border-indigo-500/20 group-hover:scale-110 transition-transform duration-500">
                <Network className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white tracking-tight">Network Mapping</h3>
              <p className="text-slate-600 dark:text-slate-400 mb-8 font-medium text-lg">Visualize relationships between entities, suspects, and communication patterns with Neo4j-backed graph intelligence.</p>
              
              <div className="relative w-full flex-1 min-h-[250px] bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-slate-200 dark:border-white/10 flex items-center justify-center overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  <line x1="30%" y1="30%" x2="70%" y2="60%" stroke="currentColor" className="text-slate-300 dark:text-slate-600" strokeWidth="2" />
                  <line x1="70%" y1="60%" x2="50%" y2="80%" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="30%" y1="30%" x2="50%" y2="80%" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="2" />
                </svg>
                <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-4 border-blue-500 absolute top-1/4 left-1/4 shadow-lg flex items-center justify-center z-10 animate-[bounce_3s_infinite]">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                </div>
                <div className="w-20 h-20 rounded-full bg-white dark:bg-slate-800 border-4 border-indigo-500 absolute bottom-1/3 right-1/4 shadow-lg flex items-center justify-center z-10 animate-[pulse_2s_infinite]">
                  <div className="w-6 h-6 bg-indigo-500 rounded-full"></div>
                </div>
                <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border-4 border-blue-300 dark:border-blue-600 absolute bottom-[10%] left-1/2 shadow-lg z-10 animate-[bounce_4s_infinite]"></div>
              </div>
            </div>

            {/* Small Card 1: Massive Scale */}
            <div className="md:col-span-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 backdrop-blur-2xl border border-slate-800 dark:border-white/10 shadow-xl rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-200">
              <Database className="w-12 h-12 text-blue-400 mb-6 drop-shadow-sm relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <h3 className="text-2xl font-bold mb-3 text-white relative z-10">Massive Scale</h3>
              <p className="text-slate-400 font-medium relative z-10">Automated ingestion and multi-database indexing of multi-gigabyte UFDR extraction files in the background.</p>
            </div>

            {/* Small Card 2: Reports */}
            <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 backdrop-blur-2xl shadow-xl shadow-blue-500/20 rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-300">
              <FileText className="w-12 h-12 text-white mb-6 drop-shadow-md relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <h3 className="text-2xl font-bold mb-3 text-white relative z-10">Instant Reports</h3>
              <p className="text-blue-100 font-medium relative z-10">Generate comprehensive, court-ready evidentiary PDF reports with customizable templates in a single click.</p>
            </div>
          </div>

          {/* Second Row - Additional Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Timeline Analysis */}
            <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 transition-transform duration-500">
                <Clock className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">Timeline Analysis</h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Chronological event visualization with advanced filtering. See the story unfold in sequence across all data sources.</p>
            </div>

            {/* Entity Extraction */}
            <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-100">
              <div className="bg-amber-50 dark:bg-amber-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-amber-100 dark:border-amber-500/20 group-hover:scale-110 transition-transform duration-500">
                <Fingerprint className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">Entity Extraction</h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Automatically identify phone numbers, emails, crypto addresses, IDs, and URLs from all extracted conversations.</p>
            </div>

            {/* Evidence Bookmarking */}
            <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-200">
              <div className="bg-rose-50 dark:bg-rose-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-rose-100 dark:border-rose-500/20 group-hover:scale-110 transition-transform duration-500">
                <BookMarked className="w-7 h-7 text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">Evidence Bookmarking</h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Save, annotate, and tag critical evidence with personal notes. Build your case file from query results instantly.</p>
            </div>
          </div>

          {/* Third Row - More Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Cross-Case Intelligence */}
            <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8">
              <div className="bg-violet-50 dark:bg-violet-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-violet-100 dark:border-violet-500/20 group-hover:scale-110 transition-transform duration-500">
                <Globe className="w-7 h-7 text-violet-600 dark:text-violet-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">Cross-Case Intelligence</h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Search across all cases, find shared entities, and automatically link related investigations together.</p>
            </div>

            {/* Smart Alerts */}
            <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-100">
              <div className="bg-orange-50 dark:bg-orange-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-orange-100 dark:border-orange-500/20 group-hover:scale-110 transition-transform duration-500">
                <AlertTriangle className="w-7 h-7 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">Smart Alerts</h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Configure custom alert rules that trigger on pattern matches, anomalies, or specific entity appearances.</p>
            </div>

            {/* Semantic Search */}
            <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl rounded-[2rem] p-8 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-200">
              <div className="bg-cyan-50 dark:bg-cyan-500/10 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 border border-cyan-100 dark:border-cyan-500/20 group-hover:scale-110 transition-transform duration-500">
                <Search className="w-7 h-7 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-slate-900 dark:text-white tracking-tight">Semantic Search</h3>
              <p className="text-slate-600 dark:text-slate-400 font-medium">Vector-based similarity search using Milvus embeddings. Find contextually relevant evidence beyond keyword matching.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="workflow" className="py-32 px-6 relative z-10 bg-white dark:bg-transparent/50">
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-24 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6">
              End-to-End Pipeline
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">The Investigation Pipeline</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">A seamless flow from raw extraction data to actionable intelligence and court-ready reports.</p>
          </div>

          <div className="flex flex-col md:flex-row items-start justify-between relative gap-8 md:gap-4">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-12 right-12 h-1 bg-slate-100 dark:bg-slate-800 z-0 rounded-full">
              <div className="h-full w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 rounded-full opacity-20 dark:opacity-40"></div>
            </div>

            {[
              { num: '01', title: 'Ingest', desc: 'Upload UFDR packages with background job processing.', icon: Database },
              { num: '02', title: 'Extract', desc: 'Parse entities, contacts, messages & map in Neo4j.', icon: Fingerprint },
              { num: '03', title: 'Analyze', desc: 'Query via AI, explore timelines & network graphs.', icon: Brain },
              { num: '04', title: 'Report', desc: 'Generate PDF reports & export evidence.', icon: Share2 }
            ].map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center group animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 w-full md:w-1/4" style={{ transitionDelay: `${idx * 150}ms` }}>
                <div className={`w-24 h-24 rounded-3xl glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 shadow-md flex items-center justify-center mb-8 relative overflow-hidden group-hover:-translate-y-2 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-blue-900/5 dark:group-hover:shadow-blue-500/10 group-hover:border-blue-200 dark:group-hover:border-blue-500/30`}>
                  <div className={`absolute inset-0 bg-blue-50 dark:bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                  <step.icon className={`w-10 h-10 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors relative z-10`} />
                </div>
                <div className="text-blue-600 dark:text-blue-400 font-black text-sm tracking-widest mb-3 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full">{step.num}</div>
                <h4 className="text-xl font-bold mb-3 text-slate-900 dark:text-white">{step.title}</h4>
                <p className="text-base text-slate-600 dark:text-slate-400 font-medium text-center">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Multi-Role Architecture Section */}
      <section id="architecture" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6">
              Role-Based Architecture
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Built for Every Role</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-3xl mx-auto">Three specialized dashboards tailored for Administrators, Investigating Officers, and Supervisors — each with fine-grained access control.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                role: 'Administrator',
                icon: UserCheck,
                color: 'blue',
                features: ['User management & role assignment', 'Case creation & officer assignment', 'System-wide analytics dashboard', 'Audit log oversight'],
              },
              {
                role: 'Investigating Officer',
                icon: Eye,
                color: 'indigo',
                features: ['UFDR file upload & processing', 'Natural language AI queries', 'Evidence bookmarking & tagging', 'Network graph exploration', 'Report generation'],
              },
              {
                role: 'Supervisor',
                icon: BarChart3,
                color: 'violet',
                features: ['Cross-case oversight', 'Case review & approval', 'Investigation monitoring', 'Performance analytics'],
              },
            ].map((item, idx) => {
              const bgLight = item.color === 'blue' ? 'bg-blue-50' : item.color === 'indigo' ? 'bg-indigo-50' : 'bg-violet-50';
              const bgDark = item.color === 'blue' ? 'dark:bg-blue-500/10' : item.color === 'indigo' ? 'dark:bg-indigo-500/10' : 'dark:bg-violet-500/10';
              const borderLight = item.color === 'blue' ? 'border-blue-100' : item.color === 'indigo' ? 'border-indigo-100' : 'border-violet-100';
              const borderDark = item.color === 'blue' ? 'dark:border-blue-500/20' : item.color === 'indigo' ? 'dark:border-indigo-500/20' : 'dark:border-violet-500/20';
              const textLight = item.color === 'blue' ? 'text-blue-600' : item.color === 'indigo' ? 'text-indigo-600' : 'text-violet-600';
              const textDark = item.color === 'blue' ? 'dark:text-blue-400' : item.color === 'indigo' ? 'dark:text-indigo-400' : 'dark:text-violet-400';

              return (
                <div key={idx} className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl backdrop-blur-2xl border border-slate-200 dark:border-white/10 rounded-[2rem] p-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 hover:shadow-xl hover:-translate-y-1" style={{ transitionDelay: `${idx * 150}ms` }}>
                  <div className={`${bgLight} ${bgDark} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 ${borderLight} ${borderDark} border`}>
                    <item.icon className={`w-7 h-7 ${textLight} ${textDark}`} />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">{item.role}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-500 mb-6 font-medium uppercase tracking-wider">Dashboard</p>
                  <ul className="space-y-3">
                    {item.features.map((feat, fi) => (
                      <li key={fi} className="flex items-center gap-3 text-slate-600 dark:text-slate-400 font-medium">
                        <div className={`w-1.5 h-1.5 rounded-full ${textLight === 'text-blue-600' ? 'bg-blue-500' : textLight === 'text-indigo-600' ? 'bg-indigo-500' : 'bg-violet-500'}`}></div>
                        {feat}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-32 px-6 relative z-10 bg-white dark:bg-transparent/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6">
              Multi-Database Architecture
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Purpose-Built Stack</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-3xl mx-auto">Five specialized databases, each chosen for its unique strengths, working in concert to deliver unmatched analytical power.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { name: 'PostgreSQL', desc: '14 tables', icon: Database, detail: 'Relational core' },
              { name: 'Elasticsearch', desc: '3 indices', icon: Search, detail: 'Full-text search' },
              { name: 'Neo4j', desc: 'Graph DB', icon: Network, detail: 'Relationship mapping' },
              { name: 'Redis', desc: 'Queue', icon: Zap, detail: 'Job processing' },
              { name: 'Milvus', desc: 'Vectors', icon: Cpu, detail: 'Semantic search' },
            ].map((db, idx) => (
              <div key={idx} className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 hover:-translate-y-1 hover:shadow-lg group" style={{ transitionDelay: `${idx * 100}ms` }}>
                <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <db.icon className="w-6 h-6 text-slate-600 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">{db.name}</h4>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">{db.desc}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-2">{db.detail}</p>
              </div>
            ))}
          </div>

          {/* Stats Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-300">
            {[
              { label: 'API Endpoints', value: '61+', icon: Server },
              { label: 'Database Models', value: '14', icon: Layers },
              { label: 'React Components', value: '25+', icon: MessageSquare },
              { label: 'Background Workers', value: '3', icon: TrendingUp },
            ].map((stat, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center">
                <stat.icon className="w-6 h-6 text-blue-600 dark:text-blue-400 mx-auto mb-3" />
                <div className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</div>
                <div className="text-sm text-slate-500 dark:text-slate-500 font-medium mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mock UI Section with Tabs */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-400 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            Interface Preview
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-16 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-100 text-slate-900 dark:text-white">Powerful Yet Simple</h2>
          
          {/* Tabs */}
          <div className="flex items-center justify-center gap-2 mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-200">
            {mockTabs.map((tab, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTab(idx)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                  activeTab === idx
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative rounded-2xl border border-slate-200 dark:border-white/10 glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl shadow-[0_20px_50px_rgba(15,23,42,0.05)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden animate-on-scroll opacity-0 translate-y-16 transition-all duration-1000 delay-300 text-slate-900 dark:text-slate-100 group">
            {/* Mac Window Controls */}
            <div className="h-12 border-b border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-slate-800 flex items-center px-4 gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-400"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-yellow-400"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-green-400"></div>
              <span className="ml-4 text-xs font-medium text-slate-500 dark:text-slate-500">CopSight AI — {mockTabs[activeTab].label}</span>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px] relative overflow-hidden">
              {/* AI Query Tab */}
              {activeTab === 0 && (
                <div className="flex h-[500px]">
                  {/* Sidebar */}
                  <div className="w-64 border-r border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900 p-6 space-y-4 hidden md:block text-left">
                    <div className="h-8 w-3/4 bg-slate-200 dark:bg-slate-700 rounded-lg mb-8"></div>
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-10 rounded-lg ${i===2 ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white' : 'bg-transparent'} transition-colors relative`}>
                        {i===2 && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-300 rounded-r-md"></div>}
                      </div>
                    ))}
                  </div>
                  {/* Main Content */}
                  <div className="flex-1 p-10 text-left bg-white dark:bg-transparent/50 relative overflow-hidden">
                    <div className="flex justify-between items-center mb-10">
                      <div className="space-y-3">
                        <div className="h-8 w-64 bg-slate-800 dark:bg-slate-200 rounded-md"></div>
                        <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded-md"></div>
                      </div>
                      <div className="h-12 w-40 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl shadow-md"></div>
                    </div>
                    {/* AI Query Box */}
                    <div className="mb-8 p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center gap-3">
                      <Search className="w-5 h-5 text-slate-400" />
                      <div className="h-4 w-2/3 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="ml-auto h-8 w-20 bg-blue-600 rounded-lg"></div>
                    </div>
                    {/* Response Area */}
                    <div className="space-y-3 p-4 rounded-xl bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/20">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        <div className="h-3 w-20 bg-blue-200 dark:bg-blue-800 rounded"></div>
                      </div>
                      <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-3 w-5/6 bg-slate-200 dark:bg-slate-700 rounded"></div>
                      <div className="h-3 w-3/4 bg-slate-100 dark:bg-slate-800 rounded"></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Network Graph Tab */}
              {activeTab === 1 && (
                <div className="h-[500px] bg-white dark:bg-transparent/50 p-8 relative flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                    <line x1="20%" y1="30%" x2="50%" y2="50%" stroke="currentColor" className="text-blue-300 dark:text-blue-700" strokeWidth="2" />
                    <line x1="50%" y1="50%" x2="80%" y2="35%" stroke="currentColor" className="text-indigo-300 dark:text-indigo-700" strokeWidth="2" />
                    <line x1="50%" y1="50%" x2="35%" y2="75%" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="2" strokeDasharray="4 4" />
                    <line x1="50%" y1="50%" x2="70%" y2="70%" stroke="currentColor" className="text-violet-300 dark:text-violet-700" strokeWidth="2" />
                    <line x1="20%" y1="30%" x2="35%" y2="75%" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="1" />
                  </svg>
                  <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 border-4 border-blue-500 absolute top-[25%] left-[18%] shadow-xl flex items-center justify-center z-10 animate-[pulse_3s_infinite]"><div className="w-5 h-5 bg-blue-500 rounded-full"></div></div>
                  <div className="w-24 h-24 rounded-full bg-white dark:bg-slate-800 border-4 border-indigo-500 absolute top-[42%] left-[46%] shadow-xl flex items-center justify-center z-10 animate-float"><div className="w-8 h-8 bg-indigo-500 rounded-full"></div></div>
                  <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 border-4 border-violet-500 absolute top-[28%] right-[17%] shadow-xl flex items-center justify-center z-10 animate-[bounce_4s_infinite]"><div className="w-4 h-4 bg-violet-500 rounded-full"></div></div>
                  <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 border-4 border-emerald-400 absolute bottom-[20%] left-[32%] shadow-lg z-10 animate-[pulse_2.5s_infinite]"></div>
                  <div className="w-16 h-16 rounded-full bg-white dark:bg-slate-800 border-4 border-amber-400 absolute bottom-[25%] right-[27%] shadow-lg z-10 animate-[bounce_3.5s_infinite]"></div>
                </div>
              )}

              {/* Timeline Tab */}
              {activeTab === 2 && (
                <div className="h-[500px] bg-white dark:bg-transparent/50 p-10 overflow-hidden text-left">
                  <div className="flex items-center justify-between mb-8">
                    <div className="h-6 w-48 bg-slate-800 dark:bg-slate-200 rounded"></div>
                    <div className="flex gap-2">
                      <div className="h-8 w-24 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-white/10"></div>
                      <div className="h-8 w-24 bg-blue-600 rounded-lg"></div>
                    </div>
                  </div>
                  {/* Timeline items */}
                  <div className="relative">
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                    {[
                      { time: '09:14 AM', color: 'bg-blue-500' },
                      { time: '11:32 AM', color: 'bg-indigo-500' },
                      { time: '02:45 PM', color: 'bg-violet-500' },
                      { time: '05:18 PM', color: 'bg-emerald-500' },
                      { time: '08:03 PM', color: 'bg-amber-500' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-6 mb-6 relative">
                        <div className={`w-3 h-3 rounded-full ${item.color} mt-1.5 relative z-10 ring-4 ring-white dark:ring-slate-950`}></div>
                        <div className="flex-1 p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/10">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-500">{item.time}</span>
                            <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded"></div>
                          </div>
                          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-32 px-6 relative z-10 bg-white dark:bg-transparent/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6">
              Security & Compliance
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-6">Enterprise-Grade Security</h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium max-w-3xl mx-auto">Built from the ground up for classified environments with on-premise AI, no external API calls, and comprehensive audit logging.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Lock, label: 'JWT Authentication', desc: 'Secure token-based auth' },
              { icon: Shield, label: 'RBAC', desc: '3-tier role access control' },
              { icon: Fingerprint, label: 'Bcrypt Hashing', desc: '12-round password security' },
              { icon: Eye, label: 'Audit Logging', desc: 'Full action trail' },
              { icon: Globe, label: 'CORS Protection', desc: 'Configurable origins' },
              { icon: Server, label: 'Helmet Headers', desc: 'Security-first HTTP' },
              { icon: AlertTriangle, label: 'Rate Limiting', desc: 'Auth, search, upload' },
              { icon: Cpu, label: 'On-Premise AI', desc: 'Zero external API calls' },
            ].map((item, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-start gap-4 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 hover:shadow-lg hover:-translate-y-0.5" style={{ transitionDelay: `${idx * 75}ms` }}>
                <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
                  <item.icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{item.label}</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-[3rem] overflow-hidden bg-gradient-to-b from-blue-50 dark:from-slate-900 to-white dark:to-slate-950 border border-blue-100 dark:border-white/10 p-16 md:p-24 text-center animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 shadow-2xl shadow-blue-900/5 dark:shadow-blue-500/5">
            <div className="w-20 h-20 mx-auto mb-8 relative z-10 animate-[bounce_4s_ease-in-out_infinite] rounded-full overflow-hidden shadow-lg border-2 border-white dark:border-white/10">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover" />
            </div>
            <h2 className="relative z-10 text-5xl md:text-6xl font-black tracking-tighter mb-8 text-slate-900 dark:text-white">Modernize Your Operations.</h2>
            <p className="relative z-10 text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto mb-12 leading-relaxed">
              Join leading agencies in transforming how digital evidence is processed, analyzed, and presented.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={handleAction}
                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-10 py-5 rounded-full text-lg font-bold transition-all active:scale-95 shadow-[0_10px_30px_rgba(15,23,42,0.2)] hover:shadow-[0_15px_40px_rgba(15,23,42,0.3)] hover:-translate-y-1"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Sign In to System'}
              </button>
              <a href="#features" className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl text-slate-900 dark:text-white border border-slate-200 dark:border-white/10 px-10 py-5 rounded-full text-lg font-bold transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-800 hover:-translate-y-1">
                Explore Platform
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 dark:bg-transparent border-t border-slate-200 dark:border-white/10 py-16 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 shadow-sm group-hover:shadow-md transition-shadow">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-xl text-slate-900 dark:text-white tracking-tight">CopSight AI</span>
          </div>
          <div className="flex gap-6 text-sm font-bold text-slate-500 dark:text-slate-500">
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Security</a>
          </div>
          <div className="text-sm font-medium text-slate-400 dark:text-slate-600">
            &copy; {new Date().getFullYear()} CopSight AI. All rights reserved. For Authorized Law Enforcement Only.
          </div>
        </div>
      </footer>
    </div>
  );
};
