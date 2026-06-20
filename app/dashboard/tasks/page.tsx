'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useFirm } from '@/contexts/FirmContext';
import { apiFetch } from '@/utils/apiFetch';

const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low:    { label: 'Low',    color: 'bg-gray-100 text-gray-600',       dot: 'bg-gray-400' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-700',   dot: 'bg-yellow-400' },
  high:   { label: 'High',   color: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
  urgent: { label: 'Urgent', color: 'bg-red-100 text-red-700',         dot: 'bg-red-500' },
};

const STATUS_NEXT: Record<string, string> = {
  todo:        'in_progress',
  in_progress: 'done',
  blocked:     'in_progress',
  done:        'todo',
};

const STATUS_ACTIONS: Record<string, string> = {
  todo:        'Start',
  in_progress: 'Complete',
  blocked:     'Unblock',
  done:        'Reopen',
};

const STATUSES = [
  { id: 'todo',        label: 'To Do' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'blocked',     label: 'Blocked' },
  { id: 'done',        label: 'Done' },
];

interface Task {
  id: string;
  title: string;
  description: string | null;
  client_org_id: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  period_year: number | null;
  period_month: number | null;
  comment_count: number;
  created_at: string;
}

interface TaskComment {
  id: string;
  task_id: string;
  user_id: string;
  user_name: string | null;
  body: string;
  created_at: string;
}

function isOverdue(due_date: string | null, status: string) {
  if (!due_date || status === 'done') return false;
  return due_date < new Date().toISOString().split('T')[0];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function MyTasksPage() {
  const { clients } = useFirm();
  const [tasks, setTasks]               = useState<Task[]>([]);
  const [loading, setLoading]           = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [updating, setUpdating]         = useState<string | null>(null);

  // Detail modal
  const [selectedTask, setSelectedTask]           = useState<Task | null>(null);
  const [comments, setComments]                   = useState<TaskComment[]>([]);
  const [commentsLoading, setCommentsLoading]     = useState(false);
  const [newComment, setNewComment]               = useState('');
  const [commenterName, setCommenterName]         = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentEndRef = useRef<HTMLDivElement>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const url  = filterStatus === 'open' ? '/api/tasks?mine=true' : '/api/tasks?mine=true&status=done';
      const res  = await apiFetch(url);
      const json = await res.json();
      if (json.success) setTasks(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const loadComments = useCallback(async (taskId: string) => {
    setCommentsLoading(true);
    try {
      const res  = await apiFetch(`/api/tasks/comments?task_id=${taskId}`);
      const json = await res.json();
      if (json.success) setComments(json.data ?? []);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const openDetail = (task: Task) => {
    setSelectedTask(task);
    setComments([]);
    setNewComment('');
    loadComments(task.id);
  };

  useEffect(() => {
    if (comments.length > 0) {
      commentEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments]);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;
    setSubmittingComment(true);
    try {
      const res  = await apiFetch('/api/tasks/comments', {
        method: 'POST',
        body: JSON.stringify({ task_id: selectedTask.id, body: newComment, user_name: commenterName || null }),
      });
      const json = await res.json();
      if (json.success) {
        setComments(prev => [...prev, json.data]);
        setNewComment('');
        setTasks(prev => prev.map(t =>
          t.id === selectedTask.id ? { ...t, comment_count: t.comment_count + 1 } : t
        ));
        setSelectedTask(prev => prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev);
      }
    } finally {
      setSubmittingComment(false);
    }
  };

  const advanceStatus = async (task: Task) => {
    const next = STATUS_NEXT[task.status] ?? 'todo';
    setUpdating(task.id);
    try {
      const res  = await apiFetch('/api/tasks', {
        method: 'PATCH',
        body: JSON.stringify({ id: task.id, status: next }),
      });
      const json = await res.json();
      if (json.success) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
        if (selectedTask?.id === task.id) setSelectedTask(prev => prev ? { ...prev, status: next } : prev);
      }
    } finally {
      setUpdating(null);
    }
  };

  const markBlocked = async (task: Task) => {
    setUpdating(task.id);
    try {
      await apiFetch('/api/tasks', {
        method: 'PATCH',
        body: JSON.stringify({ id: task.id, status: 'blocked' }),
      });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'blocked' } : t));
      if (selectedTask?.id === task.id) setSelectedTask(prev => prev ? { ...prev, status: 'blocked' } : prev);
    } finally {
      setUpdating(null);
    }
  };

  const clientNameByOrg = (orgId: string | null) => {
    if (!orgId) return null;
    return clients.find(c => c.organization_id === orgId)?.organizations?.name ?? null;
  };

  const open     = tasks.filter(t => t.status !== 'done');
  const done     = tasks.filter(t => t.status === 'done');
  const overdue  = open.filter(t => isOverdue(t.due_date, t.status));
  const displayed = filterStatus === 'open' ? open : done;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-corporate-dark">My Tasks</h1>
          {overdue.length > 0 && (
            <p className="text-sm text-red-600 font-medium mt-0.5">{overdue.length} overdue</p>
          )}
        </div>
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
          <button
            onClick={() => setFilterStatus('open')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'open' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Open ({open.length})
          </button>
          <button
            onClick={() => setFilterStatus('done')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === 'done' ? 'bg-primary-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Done ({done.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-xl border border-gray-100 h-20 animate-pulse" />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 text-sm">{filterStatus === 'open' ? 'You\'re all caught up!' : 'No completed tasks yet.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(task => {
            const overdue  = isOverdue(task.due_date, task.status);
            const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
            const clientName = clientNameByOrg(task.client_org_id);

            return (
              <div
                key={task.id}
                className={`bg-white rounded-2xl border shadow-sm p-5 ${overdue ? 'border-red-200' : 'border-gray-100'}`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${priority.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => openDetail(task)}
                        className={`text-sm font-semibold leading-snug text-left hover:underline ${task.status === 'done' ? 'line-through text-gray-400' : 'text-corporate-dark'}`}
                      >
                        {task.title}
                      </button>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {task.status === 'in_progress' && (
                          <button
                            onClick={() => markBlocked(task)}
                            disabled={updating === task.id}
                            className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                          >
                            Block
                          </button>
                        )}
                        <button
                          onClick={() => advanceStatus(task)}
                          disabled={updating === task.id}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            task.status === 'done'
                              ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                              : 'bg-primary-600 hover:bg-primary-700 text-white'
                          }`}
                        >
                          {updating === task.id ? '...' : STATUS_ACTIONS[task.status]}
                        </button>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{task.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {clientName && (
                        <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{clientName}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priority.color}`}>{priority.label}</span>
                      {task.status === 'blocked' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Blocked</span>
                      )}
                      {task.due_date && (
                        <span className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-gray-500'}`}>
                          {overdue ? 'Overdue · ' : 'Due '}{new Date(task.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {task.comment_count > 0 && (
                        <button
                          onClick={() => openDetail(task)}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-3 3-3-3z" />
                          </svg>
                          {task.comment_count}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task detail + comments modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 flex-shrink-0">
              <div className="flex-1 pr-4">
                <h2 className="text-base font-bold text-gray-900 leading-snug">{selectedTask.title}</h2>
                {clientNameByOrg(selectedTask.client_org_id) && (
                  <p className="text-xs text-primary-600 font-medium mt-0.5">{clientNameByOrg(selectedTask.client_org_id)}</p>
                )}
              </div>
              <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors flex-shrink-0">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Task info */}
            <div className="px-6 py-4 border-b border-gray-50 flex-shrink-0 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_CONFIG[selectedTask.priority]?.color ?? ''}`}>
                  {PRIORITY_CONFIG[selectedTask.priority]?.label}
                </span>
                <div className="flex items-center gap-2">
                  {selectedTask.status === 'in_progress' && (
                    <button
                      onClick={() => markBlocked(selectedTask)}
                      disabled={updating === selectedTask.id}
                      className="text-xs text-orange-600 hover:text-orange-700 font-medium px-2.5 py-1.5 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                    >
                      Block
                    </button>
                  )}
                  <button
                    onClick={() => advanceStatus(selectedTask)}
                    disabled={updating === selectedTask.id}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                      selectedTask.status === 'done'
                        ? 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 border border-gray-200'
                        : 'bg-primary-600 hover:bg-primary-700 text-white'
                    }`}
                  >
                    {updating === selectedTask.id ? '...' : STATUS_ACTIONS[selectedTask.status]}
                  </button>
                </div>
                {selectedTask.due_date && (
                  <span className={`text-xs font-medium ${isOverdue(selectedTask.due_date, selectedTask.status) ? 'text-red-600' : 'text-gray-500'}`}>
                    Due {new Date(selectedTask.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
              {selectedTask.description && (
                <p className="text-sm text-gray-600 leading-relaxed">{selectedTask.description}</p>
              )}
              {selectedTask.assigned_to_name && (
                <p className="text-xs text-gray-400">Assigned to {selectedTask.assigned_to_name}</p>
              )}
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 min-h-0">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Comments {comments.length > 0 && `(${comments.length})`}
              </p>
              {commentsLoading ? (
                <div className="space-y-2">
                  {[...Array(2)].map((_, i) => <div key={i} className="h-12 bg-gray-50 rounded-xl animate-pulse" />)}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No comments yet.</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-xl px-4 py-3">
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-gray-700">{c.user_name ?? 'Team member'}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.body}</p>
                  </div>
                ))
              )}
              <div ref={commentEndRef} />
            </div>

            {/* Add comment */}
            <form onSubmit={submitComment} className="px-6 py-4 border-t border-gray-100 flex-shrink-0 space-y-2">
              <input
                type="text"
                value={commenterName}
                onChange={e => setCommenterName(e.target.value)}
                className="input-field text-sm"
                placeholder="Your name (optional)"
              />
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  className="input-field flex-1 resize-none text-sm"
                  rows={2}
                  placeholder="Add a comment..."
                />
                <button
                  type="submit"
                  disabled={submittingComment || !newComment.trim()}
                  className="flex-shrink-0 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white px-4 rounded-xl text-sm font-medium transition-colors"
                >
                  {submittingComment ? '...' : 'Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
