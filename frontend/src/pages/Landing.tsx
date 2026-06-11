import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Brain, Database, Search, ChevronRight, Activity, FileText, Share2, Network, Lock, Zap } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();
  const observerRef = useRef<IntersectionObserver | null>(null);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 overflow-x-hidden selection:bg-blue-500/30 selection:text-blue-900 font-sans relative">
      
      {/* Unified Brand Color Mesh Gradient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-blue-300/30 blur-[120px] mix-blend-multiply opacity-70 animate-[pulse_8s_ease-in-out_infinite]"></div>
        <div className="absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-indigo-300/30 blur-[120px] mix-blend-multiply opacity-60 animate-[pulse_10s_ease-in-out_infinite_alternate]"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[60%] rounded-full bg-blue-200/40 blur-[120px] mix-blend-multiply opacity-50 animate-[pulse_12s_ease-in-out_infinite_alternate-reverse]"></div>
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden group">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover z-10" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-900">CopSight AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors relative group">
              Intelligence
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </a>
            <a href="#workflow" className="text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors relative group">
              Platform
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
            </a>
            {!isAuthenticated && (
              <button 
                onClick={handleAction}
                className="font-bold text-slate-700 hover:text-blue-600 transition-colors"
              >
                Sign In
              </button>
            )}
            <button 
              onClick={handleAction}
              className="relative px-6 py-2.5 rounded-full font-bold text-white bg-slate-900 overflow-hidden group shadow-[0_4px_14px_0_rgba(15,23,42,0.39)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.23)] transition-all active:scale-95"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <span className="relative z-10 flex items-center gap-2">{isAuthenticated ? 'Dashboard' : 'Get Started'} <ChevronRight className="w-4 h-4" /></span>
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-24 px-6 z-10">
        <div className="max-w-5xl mx-auto flex flex-col items-center text-center">
          
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-blue-200 shadow-sm text-blue-700 text-[11px] uppercase tracking-[0.25em] font-extrabold mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 ease-out">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
            </span>
            Enterprise Digital Forensics
          </div>
          
          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-100 ease-out leading-[1.1] text-slate-900">
            Uncover Truth <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
              Instantly.
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 max-w-3xl mb-12 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-200 ease-out leading-relaxed font-medium">
            Empower your investigations with AI-driven processing, intelligent relationship mapping, and instant evidentiary reporting.
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
            <button className="flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm text-slate-800 px-8 py-4 rounded-full text-lg font-bold transition-all active:scale-95">
              Read the Docs
            </button>
          </div>

          {/* Consistent Theme Glass Ticker */}
          <div className="mt-24 w-full max-w-4xl animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-500 ease-out relative">
            <div className="relative p-6 rounded-3xl bg-white/80 backdrop-blur-xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-wrap justify-center md:justify-between items-center gap-8 hover:shadow-[0_8px_30px_rgb(37,99,235,0.1)] transition-shadow duration-500">
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <div className="p-2 bg-blue-50 rounded-lg"><Activity className="w-5 h-5 text-blue-600" /></div> Real-Time AI
              </div>
              <div className="hidden md:block h-8 w-[1px] bg-slate-200"></div>
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <div className="p-2 bg-indigo-50 rounded-lg"><Lock className="w-5 h-5 text-indigo-600" /></div> Air-Gapped Ready
              </div>
              <div className="hidden md:block h-8 w-[1px] bg-slate-200"></div>
              <div className="flex items-center gap-3 text-sm font-bold text-slate-700">
                <div className="p-2 bg-blue-50 rounded-lg"><Shield className="w-5 h-5 text-blue-600" /></div> Evidentiary Standard
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Bento Grid */}
      <section id="features" className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6">
              Platform Capabilities
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">Intelligence at Scale</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
            {/* Large Card: AI Search */}
            <div className="md:col-span-4 bg-white hover:bg-slate-50/50 backdrop-blur-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8">
              <div className="bg-blue-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-blue-100 group-hover:scale-110 transition-transform duration-500">
                <Brain className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-900 tracking-tight">AI-Powered Interrogation</h3>
              <p className="text-slate-600 mb-8 max-w-lg font-medium text-lg">Talk to your evidence. Use natural language querying to extract hidden insights across millions of extracted records without complex SQL syntax.</p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-indigo-500"></div>
                <div className="flex items-center gap-3 mb-4">
                  <Search className="w-5 h-5 text-indigo-500" />
                  <span className="text-sm font-mono text-slate-800 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">"Show me all communications with foreign numbers"</span>
                </div>
                <div className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="space-y-3 w-full">
                    <div className="h-2.5 w-3/4 bg-slate-200 rounded-full"></div>
                    <div className="h-2.5 w-1/2 bg-slate-200 rounded-full"></div>
                    <div className="h-2.5 w-5/6 bg-slate-100 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical Card: Network Graphs */}
            <div className="md:col-span-2 md:row-span-2 bg-white hover:bg-slate-50/50 backdrop-blur-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-indigo-900/5 rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-100 flex flex-col">
              <div className="bg-indigo-50 w-16 h-16 rounded-2xl flex items-center justify-center mb-8 border border-indigo-100 group-hover:scale-110 transition-transform duration-500">
                <Network className="w-8 h-8 text-indigo-600" />
              </div>
              <h3 className="text-3xl font-bold mb-4 text-slate-900 tracking-tight">Network Mapping</h3>
              <p className="text-slate-600 mb-8 font-medium text-lg">Automatically visualize relationships between entities, suspects, and complex communication patterns.</p>
              
              <div className="relative w-full flex-1 min-h-[250px] bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center overflow-hidden">
                <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
                  <line x1="30%" y1="30%" x2="70%" y2="60%" stroke="#cbd5e1" strokeWidth="2" />
                  <line x1="70%" y1="60%" x2="50%" y2="80%" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 4" />
                  <line x1="30%" y1="30%" x2="50%" y2="80%" stroke="#e2e8f0" strokeWidth="2" />
                </svg>
                <div className="w-14 h-14 rounded-full bg-white border-4 border-blue-500 absolute top-1/4 left-1/4 shadow-lg flex items-center justify-center z-10 animate-[bounce_3s_infinite]">
                  <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                </div>
                <div className="w-20 h-20 rounded-full bg-white border-4 border-indigo-500 absolute bottom-1/3 right-1/4 shadow-lg flex items-center justify-center z-10 animate-[pulse_2s_infinite]">
                  <div className="w-6 h-6 bg-indigo-500 rounded-full"></div>
                </div>
                <div className="w-12 h-12 rounded-full bg-white border-4 border-blue-300 absolute bottom-[10%] left-1/2 shadow-lg z-10 animate-[bounce_4s_infinite]"></div>
              </div>
            </div>

            {/* Small Card 1: Processing */}
            <div className="md:col-span-2 bg-slate-900 hover:bg-slate-800 backdrop-blur-2xl border border-slate-800 shadow-xl rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-200">
              <Database className="w-12 h-12 text-blue-400 mb-6 drop-shadow-sm relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <h3 className="text-2xl font-bold mb-3 text-white relative z-10">Massive Scale</h3>
              <p className="text-slate-400 font-medium relative z-10">Automated ingestion and Neo4j-backed indexing of multi-gigabyte UFDR extraction files.</p>
            </div>

            {/* Small Card 2: Reports */}
            <div className="md:col-span-2 bg-gradient-to-br from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 backdrop-blur-2xl shadow-xl shadow-blue-500/20 rounded-[2rem] p-10 relative overflow-hidden group transition-all duration-500 animate-on-scroll opacity-0 translate-y-8 delay-300">
              <FileText className="w-12 h-12 text-white mb-6 drop-shadow-md relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <h3 className="text-2xl font-bold mb-3 text-white relative z-10">Instant Reports</h3>
              <p className="text-blue-100 font-medium relative z-10">Generate comprehensive, court-ready evidentiary PDF reports with one single click.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section - Unified Colors */}
      <section id="workflow" className="py-32 px-6 relative z-10 bg-white">
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center mb-24 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 mb-6">The Investigation Pipeline</h2>
            <p className="text-lg text-slate-600 font-medium max-w-2xl mx-auto">A seamless flow from raw extraction data to actionable intelligence.</p>
          </div>

          <div className="flex flex-col md:flex-row items-start justify-between relative gap-8 md:gap-4">
            {/* Connecting Line (Desktop) */}
            <div className="hidden md:block absolute top-12 left-12 right-12 h-1 bg-slate-100 z-0 rounded-full">
              <div className="h-full w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-500 rounded-full opacity-20"></div>
            </div>

            {[
              { num: '01', title: 'Ingest', desc: 'Securely upload UFDR packages.', icon: Database },
              { num: '02', title: 'Process', desc: 'Map entities & networks in Neo4j.', icon: Network },
              { num: '03', title: 'Query', desc: 'Interrogate via AI LLM agent.', icon: Brain },
              { num: '04', title: 'Report', desc: 'Export verifiable evidence.', icon: Share2 }
            ].map((step, idx) => (
              <div key={idx} className="relative z-10 flex flex-col items-center group animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 w-full md:w-1/4" style={{ transitionDelay: `${idx * 150}ms` }}>
                <div className={`w-24 h-24 rounded-3xl bg-white border border-slate-200 shadow-md flex items-center justify-center mb-8 relative overflow-hidden group-hover:-translate-y-2 transition-all duration-300 group-hover:shadow-xl group-hover:shadow-blue-900/5 group-hover:border-blue-200`}>
                  <div className={`absolute inset-0 bg-blue-50 opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                  <step.icon className={`w-10 h-10 text-slate-400 group-hover:text-blue-600 transition-colors relative z-10`} />
                </div>
                <div className="text-blue-600 font-black text-sm tracking-widest mb-3 bg-blue-50 px-3 py-1 rounded-full">{step.num}</div>
                <h4 className="text-xl font-bold mb-3 text-slate-900">{step.title}</h4>
                <p className="text-base text-slate-600 font-medium text-center">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mock UI Section */}
      <section className="py-32 px-6 relative z-10 bg-slate-50">
        <div className="max-w-6xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[11px] uppercase tracking-[0.2em] font-extrabold mb-6 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700">
            Interface Preview
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-16 animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 delay-100 text-slate-900">Powerful Yet Simple</h2>
          
          <div className="relative rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.05)] overflow-hidden animate-on-scroll opacity-0 translate-y-16 transition-all duration-1000 delay-200 text-slate-900 group">
            {/* Mac Window Controls */}
            <div className="h-12 border-b border-slate-200 bg-slate-100 flex items-center px-4 gap-2">
              <div className="w-3.5 h-3.5 rounded-full bg-slate-300"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-slate-300"></div>
              <div className="w-3.5 h-3.5 rounded-full bg-slate-300"></div>
            </div>
            {/* Mock Layout */}
            <div className="flex h-[500px]">
              {/* Sidebar */}
              <div className="w-64 border-r border-slate-200 bg-slate-50 p-6 space-y-4 hidden md:block text-left">
                <div className="h-8 w-3/4 bg-slate-200 rounded-lg mb-8"></div>
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-10 rounded-lg ${i===2 ? 'bg-indigo-600 text-white' : 'bg-transparent'} transition-colors relative`}>
                    {i===2 && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-300 rounded-r-md"></div>}
                  </div>
                ))}
              </div>
              {/* Main Content */}
              <div className="flex-1 p-10 text-left bg-white relative overflow-hidden">
                {/* Scanner effect line */}
                <div className="absolute left-0 right-0 h-1 bg-blue-400/20 shadow-[0_0_20px_rgba(96,165,250,0.5)] z-20 animate-[pulse_3s_ease-in-out_infinite_alternate] opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex justify-between items-center mb-10">
                  <div className="space-y-3">
                    <div className="h-8 w-64 bg-slate-800 rounded-md"></div>
                    <div className="h-4 w-40 bg-slate-200 rounded-md"></div>
                  </div>
                  <div className="h-12 w-40 bg-blue-600 rounded-xl shadow-md"></div>
                </div>
                {/* Stats */}
                <div className="grid grid-cols-3 gap-6 mb-10">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-32 bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden hover:-translate-y-1 transition-transform duration-300 cursor-default">
                       <div className="h-4 w-1/2 bg-slate-200 rounded"></div>
                       <div className="h-10 w-1/3 bg-slate-800 rounded"></div>
                       <div className="absolute bottom-0 left-0 h-1.5 bg-blue-500 transition-all duration-500" style={{width: `${(i*30)}%`}}></div>
                    </div>
                  ))}
                </div>
                {/* List */}
                <div className="space-y-4">
                  {[1,2].map(i => (
                    <div key={i} className="h-20 bg-white border border-slate-100 hover:border-blue-100 hover:shadow-sm transition-all rounded-2xl p-4 flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-5">
                        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
                           <div className="w-6 h-6 bg-slate-200 rounded-full"></div>
                        </div>
                        <div className="space-y-3">
                          <div className="h-3 w-40 bg-slate-800 rounded"></div>
                          <div className="h-2 w-24 bg-slate-300 rounded"></div>
                        </div>
                      </div>
                      <div className="h-8 w-28 bg-blue-50 rounded-lg border border-blue-100"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 px-6 relative z-10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="relative rounded-[3rem] overflow-hidden bg-gradient-to-b from-blue-50 to-white border border-blue-100 p-16 md:p-24 text-center animate-on-scroll opacity-0 translate-y-8 transition-all duration-700 shadow-2xl shadow-blue-900/5">
            <div className="w-20 h-20 mx-auto mb-8 relative z-10 animate-[bounce_4s_ease-in-out_infinite] rounded-full overflow-hidden shadow-lg border-2 border-white">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover" />
            </div>
            <h2 className="relative z-10 text-5xl md:text-6xl font-black tracking-tighter mb-8 text-slate-900">Modernize Your Operations.</h2>
            <p className="relative z-10 text-xl text-slate-600 font-medium max-w-2xl mx-auto mb-12 leading-relaxed">
              Join leading agencies in transforming how digital evidence is processed, analyzed, and presented.
            </p>
            <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={handleAction}
                className="bg-slate-900 text-white px-10 py-5 rounded-full text-lg font-bold transition-all active:scale-95 shadow-[0_10px_30px_rgba(15,23,42,0.2)] hover:shadow-[0_15px_40px_rgba(15,23,42,0.3)] hover:-translate-y-1"
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Sign In to System'}
              </button>
              <button className="bg-white text-slate-900 border border-slate-200 px-10 py-5 rounded-full text-lg font-bold transition-all active:scale-95 shadow-sm hover:shadow-md hover:bg-slate-50 hover:-translate-y-1">
                Request Demo
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-50 border-t border-slate-200 py-16 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow">
              <img src="/logo.jpeg" alt="CopSight Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-xl text-slate-900 tracking-tight">CopSight AI</span>
          </div>
          <div className="flex gap-6 text-sm font-bold text-slate-500">
            <a href="#" className="hover:text-blue-600 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-blue-600 transition-colors">Security</a>
          </div>
          <div className="text-sm font-medium text-slate-400">
            &copy; {new Date().getFullYear()} CopSight AI. All rights reserved. For Authorized Law Enforcement Only.
          </div>
        </div>
      </footer>
    </div>
  );
};
