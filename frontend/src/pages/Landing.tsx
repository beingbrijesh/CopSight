import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Brain, Database, Search, ChevronRight, Activity, FileText, Share2,
  Network, Lock, Clock, UserCheck, Fingerprint, BarChart3, BookMarked,
  Globe, Cpu, AlertTriangle, Layers, Eye,
  MessageSquare, TrendingUp, Server, Sun, Moon, ArrowRight, Zap
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const { isDarkMode, toggleTheme } = useThemeStore();
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');

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

  const scrollToSection = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -110;
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // Scroll-spy to highlight active menu pill item
  useEffect(() => {
    const sections = ['features', 'workflow', 'architecture', 'security'];
    
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 240;
      const featuresEl = document.getElementById('features');

      // If above features section (i.e. at top/hero), no menu should be highlighted
      if (!featuresEl || scrollPosition < featuresEl.offsetTop) {
        setActiveSection('');
        return;
      }

      let current = '';
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            current = sectionId;
            break;
          }
        }
      }
      setActiveSection(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animation on scroll
  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('opacity-100', 'translate-y-0');
          entry.target.classList.remove('opacity-0', 'translate-y-8');
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach((el) => observerRef.current?.observe(el));

    return () => {
      elements.forEach((el) => observerRef.current?.unobserve(el));
      observerRef.current?.disconnect();
    };
  }, []);

  const navLinks = [
    { id: 'features', label: 'Intelligence' },
    { id: 'workflow', label: 'Platform' },
    { id: 'architecture', label: 'Architecture' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div className="min-h-screen bg-transparent text-white overflow-x-hidden font-sans relative selection:bg-[#FF7A59]/30 selection:text-white">
      
      {/* ─── Floating Dual-Pill Navigation (Landing Page Specific) ──────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 pt-4 sm:pt-6 pb-2 px-4 sm:px-8 md:px-[2cm] w-full mx-auto pointer-events-none flex flex-wrap items-center justify-between gap-4">
        
        {/* Left Pill: Branding Text & Logo Only (Equal Height & Larger Scale) */}
        <div 
          onClick={() => {
            setActiveSection('');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }} 
          className="pointer-events-auto h-[4.25rem] sm:h-[4.5rem] px-5 sm:px-7 glass-panel rounded-full flex items-center gap-3.5 sm:gap-4 cursor-pointer group shrink-0 select-none shadow-2xl backdrop-blur-2xl transition-all duration-300 hover:scale-[1.02]"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-md ring-2 ring-white/40 overflow-hidden group-hover:scale-105 transition-transform">
            <img
              src="/logo.jpeg"
              alt="CopSight Logo"
              className="w-full h-full object-cover rounded-full"
            />
          </div>
          <div>
            <span className="text-base sm:text-lg font-extrabold tracking-tight uppercase text-white block leading-tight group-hover:text-[#FF7A59] transition-colors">
              CopSight AI
            </span>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-widest opacity-80 text-white leading-tight mt-0.5">
              Unified Forensic Data
            </p>
          </div>
        </div>

        {/* Right Pill: Navigation Menu Options, Theme Switcher & Actions (Matching Height) */}
        <div className="pointer-events-auto h-[4.25rem] sm:h-[4.5rem] px-3.5 sm:px-5 glass-panel rounded-full flex items-center gap-3 sm:gap-4 select-none shadow-2xl backdrop-blur-2xl shrink-0">
          
          {/* Navigation Menu Bar */}
          <nav className="flex items-center gap-1 sm:gap-1.5 p-1 sm:p-1.5 rounded-full bg-black/25 dark:bg-white/10 border border-white/15 shadow-inner overflow-x-auto custom-scrollbar">
            {navLinks.map((tab) => {
              const isActive = activeSection === tab.id;
              return (
                <a
                  key={tab.id}
                  href={`#${tab.id}`}
                  onClick={(e) => scrollToSection(e, tab.id)}
                  className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-[#FF7A59] text-white shadow-md font-bold scale-[1.02] dark:bg-white dark:text-black'
                      : 'text-white/80 hover:text-white hover:bg-white/10 dark:text-white/70 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </a>
              );
            })}
          </nav>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-black/20 dark:bg-white/10 hover:bg-black/30 dark:hover:bg-white/20 text-white border border-white/15 transition-all shadow-sm cursor-pointer shrink-0"
            title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDarkMode ? (
              <Sun className="h-4 w-4 sm:h-5 sm:w-5 text-amber-300" />
            ) : (
              <Moon className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
            )}
          </button>

          {/* Action Button */}
          <button
            onClick={handleAction}
            className="px-5 sm:px-6 py-2.5 sm:py-3 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-xs sm:text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>{isAuthenticated ? 'Open Dashboard' : 'Sign In'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>

        </div>
      </header>

      {/* ─── Hero Section ──────────────────────────────────────────────────────── */}
      <section className="relative min-h-[85vh] flex items-center justify-center pt-32 sm:pt-40 pb-20 px-4 sm:px-8 md:px-[2cm] w-full mx-auto z-10">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 shadow-sm text-white text-[11px] uppercase tracking-[0.25em] font-extrabold mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF7A59] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF7A59]"></span>
            </span>
            Enterprise Digital Forensics
          </div>
          
          {/* Main Headline */}
          <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tighter mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-100 ease-out leading-[1.08] text-white">
            Uncover Truth <br/>
            <span className="text-[#FF7A59] dark:text-white underline decoration-white/20">
              Instantly.
            </span>
          </h1>
          
          {/* Subheading */}
          <p className="text-lg sm:text-xl md:text-2xl text-white/80 max-w-3xl mb-12 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-200 ease-out leading-relaxed font-normal">
            Empower your investigations with AI-driven processing, intelligent relationship mapping, and instant evidentiary reporting — all on-premise, all secure.
          </p>
          
          {/* Primary Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-300 ease-out">
            <button 
              onClick={handleAction}
              className="group flex items-center gap-2.5 bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white px-8 py-4 rounded-full text-base font-bold transition-all active:scale-95 shadow-xl cursor-pointer"
            >
              <span>{isAuthenticated ? 'Open Dashboard' : 'Access System'}</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className="flex items-center gap-2 glass-panel hover:bg-white/20 border border-white/20 shadow-sm text-white px-8 py-4 rounded-full text-base font-bold transition-all active:scale-95 cursor-pointer"
            >
              Explore Capabilities
            </a>
          </div>

          {/* Stats Ticker (Bento Glass Style) */}
          <div className="mt-20 w-full max-w-4xl animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-500 ease-out">
            <div className="glass-panel rounded-[2rem] p-5 sm:p-6 flex flex-wrap justify-around items-center gap-6 shadow-xl">
              <div className="flex items-center gap-3 text-sm font-bold text-white">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/15 text-[#FF7A59] dark:text-white">
                  <Activity className="w-5 h-5" />
                </div>
                <span>Real-Time AI</span>
              </div>
              <div className="hidden sm:block h-6 w-[1px] bg-white/20"></div>
              <div className="flex items-center gap-3 text-sm font-bold text-white">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/15 text-cyan-300">
                  <Lock className="w-5 h-5" />
                </div>
                <span>Air-Gapped Ready</span>
              </div>
              <div className="hidden sm:block h-6 w-[1px] bg-white/20"></div>
              <div className="flex items-center gap-3 text-sm font-bold text-white">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/15 text-emerald-400">
                  <Shield className="w-5 h-5" />
                </div>
                <span>Evidentiary Standard</span>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ─── Features Bento Grid ──────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10">
        <div className="text-center mb-16 sm:mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-white text-[11px] uppercase tracking-[0.2em] font-extrabold mb-4">
            Platform Capabilities
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white">Intelligence at Scale</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
          
          {/* Large Card: AI Search (4 cols) */}
          <div className="md:col-span-4 glass-panel rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 text-[#FF7A59] dark:text-white group-hover:scale-110 transition-transform">
                <Brain className="w-7 h-7" />
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold mb-3 text-white tracking-tight">AI-Powered Interrogation</h3>
              <p className="text-white/80 mb-8 max-w-2xl font-normal text-base leading-relaxed">
                Talk to your evidence. Use natural language querying powered by RAG (Retrieval-Augmented Generation) to extract hidden insights across millions of extracted records.
              </p>
            </div>
            
            <div className="rounded-2xl bg-black/30 dark:bg-black/50 border border-white/15 p-5 relative overflow-hidden">
              <div className="flex items-center gap-3 mb-3">
                <Search className="w-4 h-4 text-[#FF7A59] dark:text-white" />
                <span className="text-xs font-mono text-white font-semibold">
                  "Show me all communications with foreign numbers"
                </span>
              </div>
              <div className="space-y-2 p-3 rounded-xl bg-white/5 border border-white/10">
                <div className="h-2 w-3/4 bg-white/30 rounded-full"></div>
                <div className="h-2 w-1/2 bg-white/20 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Vertical Card: Network Graphs (2 cols) */}
          <div className="md:col-span-2 glass-panel rounded-[2.5rem] p-8 sm:p-10 flex flex-col justify-between group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-100 shadow-xl">
            <div>
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 text-cyan-300 group-hover:scale-110 transition-transform">
                <Network className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-white tracking-tight">Network Mapping</h3>
              <p className="text-white/80 font-normal text-sm leading-relaxed mb-6">
                Visualize relationships between suspects, entities, and call patterns with Neo4j-backed graph intelligence.
              </p>
            </div>
            
            <div className="p-4 rounded-2xl bg-black/30 dark:bg-black/50 border border-white/15 text-center font-mono text-xs text-white/70">
              <div className="flex justify-around items-center py-4">
                <div className="w-10 h-10 rounded-full bg-cyan-400/20 border border-cyan-400 flex items-center justify-center text-cyan-300 font-bold">A</div>
                <div className="h-[2px] w-12 bg-white/30"></div>
                <div className="w-12 h-12 rounded-full bg-[#FF7A59]/20 border border-[#FF7A59] flex items-center justify-center text-[#FF7A59] font-bold">Target</div>
                <div className="h-[2px] w-12 bg-white/30"></div>
                <div className="w-10 h-10 rounded-full bg-emerald-400/20 border border-emerald-400 flex items-center justify-center text-emerald-300 font-bold">B</div>
              </div>
              <p className="text-[10px] opacity-60">Triangulated Relationship Mesh</p>
            </div>
          </div>

          {/* Additional Bento Feature Cards (6 equal cards in 3 columns) */}
          {[
            { title: 'Massive Scale', desc: 'Automated ingestion and multi-database indexing of multi-gigabyte UFDR extractions.', icon: Database, accent: 'text-blue-300' },
            { title: 'Instant Reports', desc: 'Generate comprehensive, court-ready evidentiary PDF reports with customizable templates.', icon: FileText, accent: 'text-emerald-300' },
            { title: 'Timeline Analysis', desc: 'Chronological event visualization with advanced cross-source filtering.', icon: Clock, accent: 'text-amber-300' },
            { title: 'Entity Extraction', desc: 'Automatically extract phone numbers, crypto wallets, IMEI tags, and URLs.', icon: Fingerprint, accent: 'text-rose-300' },
            { title: 'Evidence Bookmarks', desc: 'Tag, annotate, and assemble critical evidence directly from query results.', icon: BookMarked, accent: 'text-purple-300' },
            { title: 'Cross-Case Radar', desc: 'Discover hidden connections and shared actors across independent FIRs.', icon: Globe, accent: 'text-cyan-300' },
          ].map((item, idx) => (
            <div key={idx} className="md:col-span-2 glass-panel rounded-[2rem] p-7 flex flex-col justify-between hover:bg-white/20 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8 shadow-lg">
              <div>
                <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mb-5">
                  <item.icon className={`w-6 h-6 ${item.accent}`} />
                </div>
                <h4 className="text-xl font-bold mb-2 text-white">{item.title}</h4>
                <p className="text-sm text-white/75 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}

        </div>
      </section>

      {/* ─── Investigation Pipeline (Process Section) ─────────────────────────── */}
      <section id="workflow" className="py-20 sm:py-28 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10">
        <div className="text-center mb-16 sm:mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-white text-[11px] uppercase tracking-[0.2em] font-extrabold mb-4">
            End-to-End Pipeline
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">The Investigation Pipeline</h2>
          <p className="text-base sm:text-lg text-white/80 font-normal max-w-2xl mx-auto">A seamless flow from raw extraction data to actionable intelligence and court-ready reports.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { num: '01', title: 'Ingest', desc: 'Upload UFDR packages with automated background job processing.', icon: Database },
            { num: '02', title: 'Extract', desc: 'Parse entities, contacts, chats, and construct Neo4j graphs.', icon: Fingerprint },
            { num: '03', title: 'Analyze', desc: 'Query via AI RAG, explore timelines, and trace communication networks.', icon: Brain },
            { num: '04', title: 'Report', desc: 'Generate Section 65B compliant PDF dossiers & evidentiary export.', icon: Share2 }
          ].map((step, idx) => (
            <div 
              key={idx} 
              className="glass-panel rounded-[2rem] p-7 flex flex-col items-center text-center group hover:bg-white/20 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8 shadow-lg"
            >
              <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <step.icon className="w-8 h-8 text-[#FF7A59] dark:text-white" />
              </div>
              <span className="text-xs font-mono font-bold tracking-widest px-3 py-1 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-white mb-3">
                STEP {step.num}
              </span>
              <h4 className="text-xl font-bold mb-2 text-white">{step.title}</h4>
              <p className="text-xs sm:text-sm text-white/75 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Multi-Role Architecture Section ─────────────────────────────────── */}
      <section id="architecture" className="py-20 sm:py-28 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10">
        <div className="text-center mb-16 sm:mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-white text-[11px] uppercase tracking-[0.2em] font-extrabold mb-4">
            Role-Based Architecture
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">Built for Every Role</h2>
          <p className="text-base sm:text-lg text-white/80 font-normal max-w-3xl mx-auto">Three specialized dashboards tailored for Administrators, Investigating Officers, and Supervisors.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {[
            {
              role: 'Administrator',
              icon: UserCheck,
              tag: 'Global Node Control',
              features: ['User accounts & role assignment', 'Case allocation & boundary management', 'System-wide telemetry & health gauge', 'Live forensic audit stream'],
            },
            {
              role: 'Investigating Officer',
              icon: Eye,
              tag: 'Forensic Workbench',
              features: ['UFDR forensic data extraction', 'Natural language RAG case queries', 'Evidence bookmarks & annotations', 'Neo4j entity network graph'],
            },
            {
              role: 'Supervisor',
              icon: BarChart3,
              tag: 'Oversight & Compliance',
              features: ['Cross-case oversight & workload review', 'Evidentiary case approval workflows', 'Anomaly detection & triage alerts', 'Comprehensive analytical audit trail'],
            },
          ].map((item, idx) => (
            <div key={idx} className="glass-panel rounded-[2.5rem] p-8 flex flex-col justify-between hover:bg-white/20 transition-all duration-300 animate-on-scroll opacity-0 translate-y-8 shadow-xl">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center mb-6 text-[#FF7A59] dark:text-white">
                  <item.icon className="w-7 h-7" />
                </div>
                <h3 className="text-2xl font-bold mb-1 text-white">{item.role}</h3>
                <p className="text-xs font-mono uppercase tracking-wider text-white/60 mb-6">{item.tag}</p>
                <ul className="space-y-3 font-mono text-xs text-white/80">
                  {item.features.map((feat, fi) => (
                    <li key={fi} className="flex items-start gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FF7A59] dark:bg-white mt-1.5 shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Purpose-Built Stack Section ──────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10">
        <div className="text-center mb-16 sm:mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-white text-[11px] uppercase tracking-[0.2em] font-extrabold mb-4">
            Multi-Database Architecture
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">Purpose-Built Stack</h2>
          <p className="text-base sm:text-lg text-white/80 font-normal max-w-3xl mx-auto">Five specialized databases working in concert to deliver unmatched analytical power.</p>
        </div>

        {/* Database Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-5 mb-8">
          {[
            { name: 'PostgreSQL', desc: '14 tables', icon: Database, detail: 'Relational Core' },
            { name: 'Elasticsearch', desc: '3 indices', icon: Search, detail: 'Full-Text Search' },
            { name: 'Neo4j', desc: 'Graph DB', icon: Network, detail: 'Relationship Map' },
            { name: 'Redis', desc: 'Queue', icon: Zap, detail: 'Job Processing' },
            { name: 'Milvus', desc: 'Vectors', icon: Cpu, detail: 'Semantic Embeddings' },
          ].map((db, idx) => (
            <div key={idx} className="glass-panel rounded-2xl p-5 text-center animate-on-scroll opacity-0 translate-y-8 transition-all duration-500 hover:bg-white/20 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center mx-auto mb-3 text-cyan-300">
                <db.icon className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-white text-sm">{db.name}</h4>
              <p className="text-[11px] text-white/60 font-mono mt-0.5">{db.desc}</p>
              <p className="text-[11px] text-[#FF7A59] dark:text-white font-semibold mt-2">{db.detail}</p>
            </div>
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          {[
            { label: 'API Endpoints', value: '61+', icon: Server },
            { label: 'Database Models', value: '14', icon: Layers },
            { label: 'React Components', value: '25+', icon: MessageSquare },
            { label: 'Background Workers', value: '3', icon: TrendingUp },
          ].map((stat, idx) => (
            <div key={idx} className="glass-panel rounded-2xl p-6 text-center shadow-md">
              <stat.icon className="w-6 h-6 text-[#FF7A59] dark:text-white mx-auto mb-2 opacity-80" />
              <div className="text-3xl font-black font-mono text-white">{stat.value}</div>
              <div className="text-xs text-white/70 uppercase tracking-wider font-mono mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Security & Compliance Section ───────────────────────────────────── */}
      <section id="security" className="py-20 sm:py-28 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10">
        <div className="text-center mb-16 sm:mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-black/20 dark:bg-white/10 border border-white/15 text-white text-[11px] uppercase tracking-[0.2em] font-extrabold mb-4">
            Security & Compliance
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-4">Enterprise-Grade Security</h2>
          <p className="text-base sm:text-lg text-white/80 font-normal max-w-3xl mx-auto">Built from the ground up for classified environments with on-premise AI, zero external API leakage, and complete audit logging.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Lock, label: 'JWT Authentication', desc: 'Secure token-based auth' },
            { icon: Shield, label: 'RBAC Authorization', desc: '3-tier role access control' },
            { icon: Fingerprint, label: 'Bcrypt Hashing', desc: '12-round password security' },
            { icon: Eye, label: 'Audit Logging', desc: 'Full tamper-evident trail' },
            { icon: Globe, label: 'CORS Hardening', desc: 'Strict origin policies' },
            { icon: Server, label: 'Helmet Headers', desc: 'Security-first HTTP wrappers' },
            { icon: AlertTriangle, label: 'Rate Limiting', desc: 'DDoS & brute-force defense' },
            { icon: Cpu, label: 'On-Premise AI', desc: 'Zero cloud telemetry leakage' },
          ].map((item, idx) => (
            <div key={idx} className="glass-panel rounded-2xl p-5 flex items-start gap-4 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 shadow-md">
              <div className="p-2.5 bg-white/10 rounded-xl border border-white/15 text-emerald-400 shrink-0">
                <item.icon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">{item.label}</h4>
                <p className="text-xs text-white/70 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Call to Action Bento Card ───────────────────────────────────────── */}
      <section className="py-20 sm:py-28 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10">
        <div className="glass-panel rounded-[3rem] p-10 sm:p-16 md:p-20 text-center animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 shadow-2xl relative overflow-hidden max-w-5xl mx-auto">
          
          <div className="w-20 h-20 mx-auto mb-8 rounded-full bg-white p-2 flex items-center justify-center shadow-xl ring-4 ring-white/30 overflow-hidden">
            <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tighter mb-6 text-white leading-tight">
            Modernize Your Operations.
          </h2>
          
          <p className="text-base sm:text-lg text-white/80 font-normal max-w-2xl mx-auto mb-10 leading-relaxed">
            Join leading law enforcement and investigative agencies in transforming how digital evidence is processed, analyzed, and presented.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <button 
              onClick={handleAction}
              className="w-full sm:w-auto px-8 sm:px-10 py-4 rounded-full bg-[#FF7A59] hover:bg-[#ff6540] dark:bg-white dark:text-black text-white font-mono text-sm font-bold transition-all shadow-xl active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isAuthenticated ? 'Go to Dashboard' : 'Sign In to System'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a 
              href="#features" 
              onClick={(e) => scrollToSection(e, 'features')}
              className="w-full sm:w-auto px-8 sm:px-10 py-4 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-mono text-sm font-bold transition-all shadow-sm flex items-center justify-center cursor-pointer"
            >
              Explore Capabilities
            </a>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/15 py-12 px-4 sm:px-8 md:px-[2cm] w-full mx-auto relative z-10 flex flex-col sm:flex-row justify-between items-center gap-6 text-xs text-white/70 font-mono">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-white p-0.5 overflow-hidden">
            <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          <span className="font-bold text-sm text-white tracking-tight uppercase">CopSight AI</span>
        </div>
        <div>
          &copy; {new Date().getFullYear()} CopSight AI • Unified Forensic Data • Law Enforcement Grade
        </div>
      </footer>

    </div>
  );
};
