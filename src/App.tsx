import { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { supabase } from './utils/supabase';
import { 
  BarChart3, 
  CheckSquare, 
  FileText, 
  Image as ImageIcon, 
  LayoutDashboard, 
  MoreHorizontal, 
  Search, 
  Settings, 
  Users, 
  ChevronRight,
  TrendingUp,
  Clock,
  ExternalLink,
  Plus,
  Trash2,
  Download,
  AlertCircle,
  Menu,
  X,
  Briefcase,
  IndianRupee,
  Calendar,
  Globe,
  ArrowRight,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChecklistCategory, INITIAL_CHECKLIST } from './constants';

type View = 'checklist' | 'media' | 'notes';

interface Note {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  timestamp: number;
}

interface MediaAsset {
  id: string;
  name: string;
  url: string;
  type: string;
  size: string;
}

interface Project {
  id: string;
  name: string;
  client: string;
  budget: string;
  deadline: string;
  checklist: ChecklistCategory[];
  notes: Note[];
  media: MediaAsset[];
  created_at: number;
}

const Logo = ({ size = 32, className = "" }: { size?: number, className?: string }) => (
  <div 
    className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-blue-700 shadow-lg ${className}`}
    style={{ width: size, height: size }}
  >
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.5" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className="text-white"
      style={{ width: size * 0.6, height: size * 0.6 }}
    >
      <path d="M4 4l3 16l3 -10l3 10l3 -16" />
    </svg>
    <div className="absolute inset-0 rounded-full border-2 border-white/20 pointer-events-none" />
  </div>
);

export default function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [activeView, setActiveView] = useState<View>('checklist');
  const [activeCategory, setActiveCategory] = useState<string>('foundation');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<Record<string, boolean>>({});
  const [newTaskText, setNewTaskText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'task' | 'note';
    id: string;
    catId?: string;
    title: string;
  } | null>(null);
  const [previewMedia, setPreviewMedia] = useState<MediaAsset | null>(null);

  // New Project Form State
  const [newProject, setNewProject] = useState({
    name: '',
    client: '',
    budget: '',
    deadline: ''
  });

  // Initialization & Persistence from Supabase
  useEffect(() => {
    async function loadProjects() {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (data && !error) {
        setProjects(data as Project[]);
      }
    }
    loadProjects();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newProject = payload.new as Project;
            setProjects(prev => prev.find(p => p.id === newProject.id) ? prev : [newProject, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedProject = payload.new as Project;
            setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
          } else if (payload.eventType === 'DELETE') {
            setProjects(prev => prev.filter(p => p.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const currentProject = projects.find(p => p.id === currentProjectId);

  // Derived Values for current project
  const overallProgress = useMemo(() => {
    if (!currentProject) return 0;
    const totalItems = currentProject.checklist.reduce((acc, cat) => acc + cat.items.length, 0);
    const completedItems = currentProject.checklist.reduce((acc, cat) => acc + cat.items.filter(i => i.completed).length, 0);
    return totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100);
  }, [currentProject]);

  const handleCreateProject = async (e: FormEvent) => {
    e.preventDefault();
    const project: Project = {
      id: Date.now().toString(),
      name: newProject.name,
      client: newProject.client,
      budget: newProject.budget,
      deadline: newProject.deadline,
      checklist: INITIAL_CHECKLIST,
      notes: [],
      media: [],
      created_at: Date.now()
    };
    
    // Save to Supabase
    const { error } = await supabase.from('projects').insert([project]);
    
    if (!error) {
      setProjects([project, ...projects]);
      setCurrentProjectId(project.id);
      setShowSetup(false);
      setNewProject({ name: '', client: '', budget: '', deadline: '' });
    } else {
      console.error("Error creating project:", error);
    }
  };

  const updateCurrentProjectData = async (updates: Partial<Project>) => {
    if (!currentProjectId) return;
    
    // Optimistic UI update
    setProjects(prev => prev.map(p => p.id === currentProjectId ? { ...p, ...updates } : p));
    
    // Sync to Supabase
    const { error } = await supabase.from('projects').update(updates).eq('id', currentProjectId);
    if (error) {
      console.error("Error updating project data:", error);
    }
  };

  const toggleTask = (catId: string, taskId: string) => {
    if (!currentProject) return;
    const updatedChecklist = currentProject.checklist.map(cat => {
      if (cat.id !== catId) return cat;
      return {
        ...cat,
        items: cat.items.map(item => 
          item.id === taskId ? { ...item, completed: !item.completed } : item
        )
      };
    });
    updateCurrentProjectData({ checklist: updatedChecklist });
  };

  const addTask = (e: FormEvent) => {
    e.preventDefault();
    if (!currentProject || !newTaskText.trim()) return;

    const updatedChecklist = currentProject.checklist.map(cat => {
      if (cat.id !== activeCategory) return cat;
      return {
        ...cat,
        items: [
          ...cat.items,
          { id: Date.now().toString(), task: newTaskText, completed: false }
        ]
      };
    });

    updateCurrentProjectData({ checklist: updatedChecklist });
    setNewTaskText('');
  };

  const deleteTask = (catId: string, taskId: string) => {
    if (!currentProject) return;
    const updatedChecklist = currentProject.checklist.map(cat => {
      if (cat.id !== catId) return cat;
      return {
        ...cat,
        items: cat.items.filter(item => item.id !== taskId)
      };
    });
    updateCurrentProjectData({ checklist: updatedChecklist });
  };

  const addNote = () => {
    if (!currentProject) return;
    const newNote: Note = {
      id: Date.now().toString(),
      categoryId: activeCategory,
      title: 'Technical Note',
      content: '',
      timestamp: Date.now()
    };
    updateCurrentProjectData({ notes: [...currentProject.notes, newNote] });
  };

  const updateNote = (id: string, noteUpdates: Partial<Note>) => {
    if (!currentProject) return;
    updateCurrentProjectData({
      notes: currentProject.notes.map(n => n.id === id ? { ...n, ...noteUpdates } : n)
    });
  };

  const deleteNote = (id: string) => {
    if (!currentProject) return;
    updateCurrentProjectData({
      notes: currentProject.notes.filter(n => n.id !== id)
    });
  };

  const handleSaveNote = (noteId: string) => {
    setSaveStatus(prev => ({ ...prev, [noteId]: true }));
    setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [noteId]: false }));
    }, 2000);
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newMedia: MediaAsset = {
        id: Date.now().toString(),
        name: file.name,
        url: reader.result as string,
        type: file.type.split('/')[1].toUpperCase(),
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      };
      updateCurrentProjectData({ media: [...currentProject.media, newMedia] });
    };
    reader.readAsDataURL(file);
    // Reset input
    e.target.value = '';
  };

  const deleteMedia = (id: string) => {
    if (!currentProject) return;
    updateCurrentProjectData({
      media: currentProject.media.filter(m => m.id !== id)
    });
  };

  if (!currentProjectId) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 sm:p-12 font-sans">
        <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="flex items-center gap-4">
              <Logo size={56} className="shadow-blue-200" />
              <h1 className="text-4xl font-black tracking-tight text-slate-900">WP-Suite <span className="text-blue-600">PRO</span></h1>
            </div>
            
            <div className="space-y-6">
              <h2 className="text-5xl font-bold text-slate-900 leading-[1.1]">Elite WordPress <br/>Service Portal.</h2>
              <p className="text-slate-500 text-lg leading-relaxed max-w-sm">Manage your client workflows, checklists, and technical documentation from a single source of truth.</p>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setShowSetup(true)}
                className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-blue-700 transition-all shadow-xl shadow-blue-200"
              >
                Start New Project
                <ArrowRight size={20} />
              </button>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-slate-200 border border-slate-100">
            <h3 className="text-xl font-bold text-slate-900 mb-6">Recent Workspaces</h3>
            {projects.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-4">
                <Globe size={40} className="opacity-20" />
                <p className="font-medium">No projects found yet.</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                {projects.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => setCurrentProjectId(p.id)}
                    className="w-full text-left p-4 rounded-2xl border border-slate-100 hover:border-blue-500 hover:bg-blue-50/30 transition-all flex items-center justify-between group"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900">{p.name}</h4>
                      <p className="text-xs text-slate-500 mt-1">{p.client} • {p.deadline}</p>
                    </div>
                    <ChevronRight size={20} className="text-slate-300 group-hover:text-blue-500 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Setup Modal */}
        <AnimatePresence>
          {showSetup && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
              >
                <form onSubmit={handleCreateProject} className="p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold text-slate-900">Project Configuration</h3>
                    <button type="button" onClick={() => setShowSetup(false)} className="text-slate-400 hover:text-slate-600"><X size={24} /></button>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Project Name</label>
                      <div className="relative">
                        <Briefcase size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          required
                          type="text" 
                          placeholder="e.g. Modern Retail Site"
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-blue-500 outline-none transition-all"
                          value={newProject.name}
                          onChange={e => setNewProject({...newProject, name: e.target.value})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Client</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Company LLC"
                          className="w-full px-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-blue-500 outline-none transition-all"
                          value={newProject.client}
                          onChange={e => setNewProject({...newProject, client: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Budget</label>
                        <div className="relative">
                          <IndianRupee size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="text" 
                            placeholder="50,000"
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-blue-500 outline-none transition-all"
                            value={newProject.budget}
                            onChange={e => setNewProject({...newProject, budget: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Launch Deadline</label>
                      <div className="relative">
                        <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                          required
                          type="text" 
                          placeholder="Oct 12, 2026"
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 rounded-2xl border border-slate-100 focus:border-blue-500 outline-none transition-all"
                          value={newProject.deadline}
                          onChange={e => setNewProject({...newProject, deadline: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>

                  <button className="w-full py-5 bg-blue-600 text-white rounded-2xl font-bold text-lg hover:bg-blue-700 transition-all shadow-xl shadow-blue-200">
                    Initialize Workspace
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  const selectedCategory = currentProject.checklist.find(c => c.id === activeCategory);

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-800 font-sans overflow-hidden">
      {/* Left Navigation Rail */}
      <aside className={`fixed inset-y-0 left-0 z-50 bg-[#0F172A] flex flex-col flex-shrink-0 text-slate-400 transition-all duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'w-64 opacity-100' : 'w-20'} ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 border-b border-slate-800 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <Logo size={32} className="shrink-0" />
            {(isSidebarOpen || isMobileMenuOpen) && <span className="text-white font-bold text-lg tracking-tight whitespace-nowrap">WP-Suite <span className="text-blue-500">PRO</span></span>}
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 overflow-y-auto pt-4 pb-8 px-3 space-y-1 scrollbar-hide">
          {(isSidebarOpen || isMobileMenuOpen) && (
            <div className="flex justify-between items-center px-3 py-2 mb-1">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Process Phases</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setShowSetup(true); setIsMobileMenuOpen(false); }} 
                  className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-bold"
                >
                  <Plus size={10} />
                  New
                </button>
                <button 
                  onClick={() => { setCurrentProjectId(null); setIsMobileMenuOpen(false); }} 
                  className="text-[10px] text-slate-400 hover:text-white transition-colors flex items-center gap-1 font-bold"
                >
                  <LogOut size={10} />
                  Switch
                </button>
              </div>
            </div>
          )}
          
          {currentProject.checklist.map((cat) => {
            const progress = Math.round((cat.items.filter(i => i.completed).length / cat.items.length) * 100);
            return (
              <button 
                id={`nav-${cat.id}`}
                key={cat.id}
                onClick={() => {
                  setActiveCategory(cat.id);
                  setActiveView('checklist');
                  if (window.innerWidth < 768) setIsMobileMenuOpen(false);
                }}
                className={`sidebar-item ${activeCategory === cat.id && activeView === 'checklist' ? 'text-blue-400 bg-slate-800/50 shadow-inner' : 'hover:text-slate-200'}`}
              >
                <span className="truncate mr-2">{(isSidebarOpen || isMobileMenuOpen) ? cat.title.split('. ')[1] || cat.title : cat.title.split('. ')[0]}</span>
                {(isSidebarOpen || isMobileMenuOpen) && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${progress === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {progress}%
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 shrink-0">
          <div className="bg-slate-800/50 rounded-xl p-3">
            {(isSidebarOpen || isMobileMenuOpen) && <div className="text-xs text-slate-500 mb-1">Total Progress</div>}
            <div className="h-2 w-full bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: `${overallProgress}%` }}></div>
            </div>
            {(isSidebarOpen || isMobileMenuOpen) && (
              <div className="mt-2 text-[10px] flex justify-between">
                <span>{currentProject.checklist.reduce((acc, c) => acc + c.items.filter(i => i.completed).length, 0)}/{currentProject.checklist.reduce((acc, c) => acc + c.items.length, 0)}</span>
                <span>{overallProgress}%</span>
              </div>
            )}
          </div>
          <button 
            id="toggle-sidebar"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="hidden md:flex w-full mt-4 items-center justify-center p-2 text-slate-500 hover:text-white transition-colors border border-slate-800/50 rounded-xl"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#F1F5F9] overflow-hidden">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 shadow-sm z-10 sticky top-0">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
              <Menu size={20} />
            </button>
            <div className="flex flex-col md:flex-row md:items-center md:gap-4 truncate">
              <h1 className="text-sm md:text-lg font-bold text-slate-900 truncate">{selectedCategory?.title || 'Checklist'}</h1>
              <span className="hidden sm:inline-block px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide shrink-0">Dev Flow</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 md:gap-6 shrink-0">
            <div className="hidden lg:block text-right">
              <div className="text-xs text-slate-400">Project: {currentProject.name}</div>
              <div className="text-sm font-semibold text-slate-900">{currentProject.client} • {currentProject.deadline}</div>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full shadow-lg flex items-center justify-center text-white font-bold shrink-0">{currentProject.client.charAt(0)}</div>
          </div>
        </header>

        {/* Dashboard Workspace */}
        <div className="flex-1 p-4 md:p-8 flex flex-col lg:flex-row gap-6 md:gap-8 overflow-y-auto lg:overflow-hidden bg-[#F8FAFC] scrollbar-hide">
          {/* Active Checklist Section */}
          <section className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col min-w-0 h-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                <LayoutDashboard size={20} className="text-blue-500" />
                Phase Activity
              </h3>
              <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
                <button 
                  onClick={() => setActiveView('checklist')}
                  className={`text-xs px-3 md:px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeView === 'checklist' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Tasks
                </button>
                <button 
                  onClick={() => setActiveView('media')}
                  className={`text-xs px-3 md:px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeView === 'media' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Assets
                </button>
                <button 
                  onClick={() => setActiveView('notes')}
                  className={`lg:hidden text-xs px-3 md:px-4 py-2 rounded-lg transition-all whitespace-nowrap ${activeView === 'notes' ? 'bg-white shadow-sm text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Log
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              <AnimatePresence mode="wait">
                {activeView === 'checklist' ? (
                  <motion.div 
                    key="checklist-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-4"
                  >
                    {/* Add Task Input */}
                    <form onSubmit={addTask} className="relative group">
                      <Plus size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                      <input 
                        type="text"
                        placeholder="Add a new task to this phase..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:border-blue-500 focus:bg-white transition-all text-sm font-medium"
                        value={newTaskText}
                        onChange={(e) => setNewTaskText(e.target.value)}
                      />
                    </form>

                    <div className="space-y-2">
                      {selectedCategory?.items.map((item) => (
                        <div 
                          id={`task-${item.id}`}
                          key={item.id} 
                          className={`flex items-center group p-4 rounded-2xl border transition-all cursor-pointer ${
                            item.completed 
                              ? 'bg-slate-50/50 border-transparent' 
                              : 'bg-white border-slate-100 hover:border-blue-200 hover:shadow-md'
                          }`}
                        >
                          <div 
                            onClick={() => toggleTask(selectedCategory.id, item.id)}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center mr-3 md:mr-4 transition-all shrink-0 ${
                              item.completed 
                                ? 'border-emerald-500 bg-emerald-500 text-white' 
                                : 'border-slate-200'
                            }`}
                          >
                            {item.completed && <CheckSquare size={14} strokeWidth={4} />}
                          </div>
                          <span 
                            onClick={() => toggleTask(selectedCategory.id, item.id)}
                            className={`flex-1 text-xs md:text-sm font-medium transition-all mr-2 ${
                              item.completed ? 'text-slate-400 line-through' : 'text-slate-700'
                            }`}
                          >
                            {item.task}
                          </span>
                          <div className="flex gap-1 md:gap-2 items-center shrink-0">
                            {item.completed ? (
                              <span className="text-[8px] md:text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-full uppercase">Verified</span>
                            ) : (
                              <div className="flex gap-2 md:gap-3 px-2">
                                <span className="md:opacity-0 group-hover:opacity-100 transition-opacity text-slate-300"><ImageIcon size={14} /></span>
                                <span className="md:opacity-0 group-hover:opacity-100 transition-opacity text-blue-500 text-[10px] font-bold uppercase tracking-wider">Execute</span>
                              </div>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDelete({
                                  type: 'task',
                                  id: item.id,
                                  catId: selectedCategory.id,
                                  title: item.task
                                });
                              }}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all md:opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ) : activeView === 'media' ? (
                  <motion.div 
                    key="media-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-4"
                  >
                    <label className="aspect-[4/3] bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 group cursor-pointer hover:border-blue-400 hover:bg-blue-50/20 transition-all">
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                      <Plus size={24} />
                      <div className="text-[10px] font-bold mt-2 uppercase tracking-widest text-slate-500 group-hover:text-blue-600 text-center px-2">Upload Asset</div>
                    </label>
                    {currentProject.media.map(item => (
                      <div key={item.id} className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 group bg-slate-100 cursor-pointer" onClick={() => setPreviewMedia(item)}>
                        <img 
                          src={item.url} 
                          alt={item.name} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent flex items-end justify-between p-3 opacity-0 group-hover:opacity-100 transition-all">
                          <div className="min-w-0">
                            <span className="text-[8px] text-white font-mono uppercase block mb-1 truncate pr-2">{item.name}</span>
                            <span className="text-[7px] text-blue-300 font-bold uppercase tracking-widest">{item.size}</span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteMedia(item.id); }}
                            className="p-1 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded transition-all shrink-0"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                ) : (
                  <motion.div 
                    key="notes-view"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col gap-4"
                  >
                    <div className="flex justify-between items-center mb-2">
                       <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Phase Documentation</h4>
                       <button onClick={addNote} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase hover:bg-blue-600 hover:text-white transition-all">
                         <Plus size={12} /> Add Note
                       </button>
                    </div>
                    {currentProject.notes.filter(n => n.categoryId === activeCategory).length > 0 ? (
                      currentProject.notes.filter(n => n.categoryId === activeCategory).map((note) => (
                        <div key={note.id} className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col gap-3">
                          <input 
                            type="text"
                            className="bg-transparent font-bold text-slate-900 border-none outline-none focus:ring-0 text-sm placeholder:text-slate-300 w-full"
                            value={note.title}
                            onChange={(e) => updateNote(note.id, { title: e.target.value })}
                            placeholder="Note Title..."
                          />
                          <textarea 
                            className="w-full bg-transparent border-none text-xs text-slate-600 resize-none focus:outline-none focus:ring-0 placeholder:text-slate-300 leading-relaxed min-h-[80px]" 
                            placeholder="Phase details..."
                            value={note.content}
                            onChange={(e) => updateNote(note.id, { content: e.target.value })}
                          />
                          <div className="flex justify-between items-center pt-2">
                            <span className="text-[9px] text-slate-400 font-mono">
                              {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleSaveNote(note.id)}
                                className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                                  saveStatus[note.id] ? 'bg-emerald-100 text-emerald-600' : 'text-blue-600 bg-blue-50'
                                }`}
                              >
                                {saveStatus[note.id] ? 'Saved' : 'Save'}
                              </button>
                              <button 
                                onClick={() => setConfirmDelete({
                                  type: 'note',
                                  id: note.id,
                                  title: note.title || 'Untitled Note'
                                })}
                                className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40">
                        <FileText size={40} strokeWidth={1} />
                        <p className="text-xs font-bold uppercase tracking-widest">No phase logs yet</p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="p-6 border-t border-slate-100 flex justify-between items-center shrink-0 bg-slate-50/30">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                {selectedCategory?.items.filter(i => !i.completed).length} Tasks Pending
              </div>
              <div className="flex gap-4">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Budget: ₹{currentProject.budget}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" />
                  Launch: {currentProject.deadline}
                </div>
              </div>
            </div>
          </section>

          {/* Side Panel: Notes (Desktop Only) */}
          <aside className="hidden lg:flex w-96 flex-col gap-6 shrink-0 h-full overflow-hidden">
            <section className="bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col h-full overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <FileText size={20} className="text-slate-400" />
                  Technical Log
                </h3>
                <button onClick={addNote} className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all"><Plus size={18} /></button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide">
                {currentProject.notes.filter(n => n.categoryId === activeCategory).length > 0 ? (
                  currentProject.notes.filter(n => n.categoryId === activeCategory).map((note) => (
                    <motion.div 
                      key={note.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-50 rounded-2xl p-5 border border-slate-100 hover:border-blue-200 transition-all flex flex-col gap-3 group"
                    >
                      <div className="flex justify-between items-center">
                        <input 
                          type="text"
                          className="bg-transparent font-bold text-slate-900 border-none outline-none focus:ring-0 text-sm placeholder:text-slate-300 w-full"
                          value={note.title}
                          onChange={(e) => updateNote(note.id, { title: e.target.value })}
                          placeholder="Note Title..."
                        />
                        <button 
                          onClick={() => setConfirmDelete({
                            type: 'note',
                            id: note.id,
                            title: note.title || 'Untitled Note'
                          })}
                          className="text-slate-300 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <textarea 
                        className="w-full bg-transparent border-none text-xs text-slate-600 resize-none focus:outline-none focus:ring-0 placeholder:text-slate-300 leading-relaxed min-h-[60px]" 
                        placeholder="Phase details..."
                        value={note.content}
                        onChange={(e) => updateNote(note.id, { content: e.target.value })}
                      />
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-[9px] text-slate-400 font-mono uppercase tracking-widest">
                          {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button 
                          onClick={() => handleSaveNote(note.id)}
                          className={`text-[9px] font-bold uppercase tracking-widest transition-all px-2 py-1 rounded ${
                            saveStatus[note.id] 
                              ? 'bg-emerald-100 text-emerald-600' 
                              : 'text-blue-600 hover:text-blue-800 bg-blue-50'
                          }`}
                        >
                          {saveStatus[note.id] ? 'Saved!' : 'Save'}
                        </button>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-40 py-20">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                      <FileText size={32} strokeWidth={1.5} />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest text-center">Logs for this phase<br/>are empty.</p>
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                <AlertCircle size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Confirmation</h3>
              <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-slate-900">"{confirmDelete.title}"</span>? This action cannot be undone.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setConfirmDelete(null)}
                  className="py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    if (confirmDelete.type === 'task') {
                      deleteTask(confirmDelete.catId!, confirmDelete.id);
                    } else {
                      deleteNote(confirmDelete.id);
                    }
                    setConfirmDelete(null);
                  }}
                  className="py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-100"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {previewMedia && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[300] flex items-center justify-center p-4 md:p-8"
            onClick={() => setPreviewMedia(null)}
          >
            <div className="relative w-full max-w-5xl max-h-full flex flex-col items-center justify-center" onClick={e => e.stopPropagation()}>
              <div className="absolute -top-12 md:-top-16 right-0 flex gap-4">
                <a 
                  href={previewMedia.url} 
                  download={previewMedia.name}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur transition-all"
                  title="Download"
                  onClick={e => e.stopPropagation()}
                >
                  <Download size={20} />
                </a>
                <button 
                  onClick={() => setPreviewMedia(null)}
                  className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white backdrop-blur transition-all"
                >
                  <X size={20} />
                </button>
              </div>
              <img 
                src={previewMedia.url} 
                alt={previewMedia.name} 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
              />
              <div className="mt-4 text-white text-center">
                <p className="font-bold">{previewMedia.name}</p>
                <p className="text-xs text-slate-400 mt-1">{previewMedia.size}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
