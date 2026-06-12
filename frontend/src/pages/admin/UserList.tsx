import { useState, useEffect } from 'react';
import { Search, UserPen, KeyRound, UserPlus } from 'lucide-react';
import { userAPI } from '../../lib/api';
import { CreateUser } from './CreateUser';
import { EditUserModal } from './EditUserModal';
import { ResetPasswordModal } from './ResetPasswordModal';

export const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const params = roleFilter ? { role: roleFilter } : {};
      const response = await userAPI.getUsers(params);
      setUsers(response.data.data.users || []);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user: any) =>
    user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-gray-600 dark:text-slate-400 font-medium">Manage system users and permissions</p>
          </div>
          <button
            onClick={() => setShowCreateUser(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm font-medium text-sm"
          >
            <UserPlus className="w-4 h-4" />
            Add User
          </button>
        </div>

        <div className="glass-panel bg-white/70 dark:bg-white/5 backdrop-blur-xl rounded-2xl shadow-sm dark:shadow-none border border-gray-100 dark:border-white/10">
          <div className="p-4 border-b border-gray-200 dark:border-white/10 flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-slate-500" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-slate-500"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-white/10 bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Roles</option>
              <option value="admin">Admin</option>
              <option value="investigating_officer">Investigating Officer</option>
              <option value="supervisor">Supervisor</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-500">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-500">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-white/10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Badge/Unit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-800">
                  {filteredUsers.map((user: any, idx: number) => (
                    <tr key={user.id} className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition ${idx % 2 === 1 ? 'bg-gray-50/50 dark:bg-white/[0.02]' : ''}`}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-xs font-bold">
                            {user.fullName.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{user.fullName}</div>
                            <div className="text-sm text-gray-500 dark:text-slate-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.role === 'admin' ? 'bg-purple-100 dark:bg-purple-500/10 text-purple-800 dark:text-purple-300' :
                          user.role === 'investigating_officer' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-800 dark:text-blue-300' :
                          'bg-green-100 dark:bg-emerald-500/10 text-green-800 dark:text-emerald-300'
                        }`}>
                          {user.role === 'admin' ? 'Admin' :
                           user.role === 'investigating_officer' ? 'IO' :
                           'Supervisor'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <div className="text-gray-900 dark:text-white">{user.badgeNumber || '-'}</div>
                          <div className="text-gray-500 dark:text-slate-500">{user.unit || '-'}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          user.isActive ? 'bg-green-100 dark:bg-emerald-500/10 text-green-800 dark:text-emerald-300' : 'bg-red-100 dark:bg-red-500/10 text-red-800 dark:text-red-300'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowEditModal(true);
                            }}
                            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/10 rounded-lg transition"
                            title="Edit User"
                          >
                            <UserPen className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetPasswordModal(true);
                            }}
                            className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-500/10 rounded-lg transition"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {showCreateUser && (
        <CreateUser
          onClose={() => setShowCreateUser(false)}
          onSuccess={loadUsers}
        />
      )}

      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={loadUsers}
        />
      )}

      {showResetPasswordModal && selectedUser && (
        <ResetPasswordModal
          user={selectedUser}
          onClose={() => {
            setShowResetPasswordModal(false);
            setSelectedUser(null);
          }}
        />
      )}
    </div>
  );
};
