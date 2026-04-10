import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FolderOpen, Activity, Plus, RefreshCw, ArrowRight } from 'lucide-react';
import { caseAPI, userAPI } from '../../lib/api';
import { CreateUser } from './CreateUser';
import { CreateCase } from './CreateCase';

export const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, cases: 0, active: 0 });
  const [loading, setLoading] = useState(true);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateCase, setShowCreateCase] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [usersRes, casesRes, statsRes] = await Promise.all([
        userAPI.getUsers(),
        caseAPI.getCases(),
        caseAPI.getStatistics(),
      ]);
      
      console.log('Users response:', usersRes.data);
      console.log('Cases response:', casesRes.data);
      console.log('Stats response:', statsRes.data);
      
      setStats({
        users: usersRes.data.data.pagination?.total || 0,
        cases: casesRes.data.data.pagination?.total || 0,
        active: statsRes.data.data.statistics?.active || 0,
      });
    } catch (error: any) {
      console.error('Failed to load stats:', error);
      console.error('Error response:', error.response?.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
            <p className="text-gray-600 mt-1">System overview and management</p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Users</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.users}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Cases</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.cases}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <FolderOpen className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Cases</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {loading ? '...' : stats.active}
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Activity className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => navigate('/admin/users')}
                  className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowCreateUser(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Add User
                </button>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Create and manage user accounts, assign roles, and configure permissions.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Case Management</h3>
              <div className="flex gap-2">
                <button 
                  onClick={() => navigate('/admin/cases')}
                  className="flex items-center gap-2 px-4 py-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                >
                  View All
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setShowCreateCase(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  Create Case
                </button>
              </div>
            </div>
            <p className="text-gray-600 text-sm">
              Create new cases and assign them to investigating officers.
            </p>
          </div>
        </div>

      {showCreateUser && (
        <CreateUser
          onClose={() => setShowCreateUser(false)}
          onSuccess={loadStats}
        />
      )}

      {showCreateCase && (
        <CreateCase
          onClose={() => setShowCreateCase(false)}
          onSuccess={loadStats}
        />
      )}
    </div>
  );
};
