import React, { useState } from 'react';
import {
  Users,
  MessageSquare,
  CheckCircle2,
  Clock,
  Shield,
  GitBranch,
  Send,
  Plus,
  Radio,
  FileCheck2,
  AlertCircle,
  Eye,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import {
  CollaborationEngine,
  CloudProjectState,
  UserRole,
  ApprovalStatus,
} from '../engine/collaborationEngine';

export const CloudCollaborationPanel: React.FC = () => {
  const [projectState, setProjectState] = useState<CloudProjectState>(() =>
    CollaborationEngine.createDefaultCloudProject()
  );

  const [activeTab, setActiveTab] = useState<'TEAM' | 'COMMENTS' | 'REVIEWS'>('TEAM');

  // New Comment Form state
  const [commentTarget, setCommentTarget] = useState<string>('MainFlange');
  const [commentText, setCommentText] = useState<string>('');

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const updated = CollaborationEngine.addComment(
      projectState,
      commentTarget,
      'Dr. Sarah Chen',
      'LEAD_ENGINEER',
      commentText
    );
    setProjectState(updated);
    setCommentText('');
  };

  const handleReviewDecision = (reviewerName: string, decision: ApprovalStatus) => {
    if (projectState.reviewTickets.length === 0) return;
    const ticket = projectState.reviewTickets[0];
    const updatedTicket = CollaborationEngine.updateReviewDecision(ticket, reviewerName, decision);

    setProjectState(prev => ({
      ...prev,
      reviewTickets: [updatedTicket],
    }));
  };

  return (
    <div className="bg-slate-900 text-slate-100 p-6 rounded-xl border border-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-sky-400" />
            <h2 className="text-xl font-bold tracking-tight">Cloud Realtime Collaboration & Design Review</h2>
            <span className="px-2.5 py-0.5 text-xs font-mono bg-sky-950 text-sky-400 border border-sky-800 rounded-full">
              PATCH-SECP-027
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Realtime multi-user B-Rep feature locking, active presence indicators, feature comments, revision history snapshots & formal design approval chains.
          </p>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-sky-950/60 border border-sky-800 text-sky-300 rounded-lg text-xs font-mono">
            <Radio className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            Realtime Sync Active ({projectState.syncedRevision})
          </div>
        </div>
      </div>

      {/* Cloud Project Info Bar */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 font-semibold text-slate-200">
          <GitBranch className="w-4 h-4 text-sky-400" />
          Project: <span className="font-mono text-sky-300">{projectState.projectName}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
          <span>Branch: <strong className="text-emerald-400">{projectState.activeBranch}</strong></span>
          <span>Members Online: <strong className="text-sky-300">{projectState.teamMembers.filter(m => m.isOnline).length} / {projectState.teamMembers.length}</strong></span>
          <span>Pending Approvals: <strong className="text-amber-400">{projectState.reviewTickets.filter(r => r.status === 'PENDING_REVIEW').length}</strong></span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab('TEAM')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'TEAM'
              ? 'border-sky-500 text-sky-400 bg-sky-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" /> Team Presence ({projectState.teamMembers.length})
        </button>

        <button
          onClick={() => setActiveTab('COMMENTS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'COMMENTS'
              ? 'border-sky-500 text-sky-400 bg-sky-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" /> CAD Feature Comments ({projectState.comments.length})
        </button>

        <button
          onClick={() => setActiveTab('REVIEWS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold border-b-2 transition-all ${
            activeTab === 'REVIEWS'
              ? 'border-sky-500 text-sky-400 bg-sky-950/30'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileCheck2 className="w-4 h-4" /> Formal Sign-off & Approvals ({projectState.reviewTickets.length})
        </button>
      </div>

      {/* Tab 1: Realtime Team Presence & Roles */}
      {activeTab === 'TEAM' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projectState.teamMembers.map(member => (
            <div
              key={member.id}
              className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-bold text-slate-300 border border-slate-700">
                    {member.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <span
                    className={`w-3 h-3 rounded-full absolute bottom-0 right-0 border-2 border-slate-950 ${
                      member.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-100">{member.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 border border-slate-800 text-sky-400 rounded">
                      {member.role}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">{member.email}</span>
                </div>
              </div>

              {/* Active CAD Feature Node */}
              <div className="text-right font-mono text-[11px]">
                {member.isOnline && member.activeFeatureNodeId ? (
                  <span className="text-amber-400 bg-amber-950/40 px-2 py-1 rounded border border-amber-800/60 block">
                    Editing: {member.activeFeatureNodeId}
                  </span>
                ) : (
                  <span className="text-slate-500">Last seen: {member.lastActiveTime}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Feature Thread Comments */}
      {activeTab === 'COMMENTS' && (
        <div className="flex flex-col gap-6">
          {/* Post Comment Form */}
          <form onSubmit={handlePostComment} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-sky-400" /> Add Comment to CAD B-Rep Entity
            </h3>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={commentTarget}
                onChange={e => setCommentTarget(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-sky-300 font-mono focus:outline-none"
              >
                <option value="MainFlange">MainFlange (Outer Ring)</option>
                <option value="Pocket001">Pocket001 (Cooling Recess)</option>
                <option value="ImpellerShaft">ImpellerShaft (Center Bore)</option>
                <option value="AssemblyRoot">Assembly Root</option>
              </select>

              <input
                type="text"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder="Write engineering feedback or design comment..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
              />

              <button
                type="submit"
                className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" /> Post Comment
              </button>
            </div>
          </form>

          {/* Comment Stream */}
          <div className="flex flex-col gap-3">
            {projectState.comments.map(comment => (
              <div key={comment.id} className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-200">{comment.authorName}</span>
                    <span className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                      {comment.authorRole}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">on target:</span>
                    <span className="text-xs font-mono font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                      {comment.targetEntityId}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">{comment.timestamp}</span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed font-sans">{comment.content}</p>

                {/* Comment Replies if any */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-800/60 flex flex-col gap-2 pl-4 border-l-2 border-sky-500/50">
                    {comment.replies.map((reply, idx) => (
                      <div key={idx} className="text-xs flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200">{reply.authorName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{reply.timestamp}</span>
                        </div>
                        <p className="text-slate-400">{reply.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Formal Design Approvals & Sign-off Chain */}
      {activeTab === 'REVIEWS' && (
        <div className="flex flex-col gap-6">
          {projectState.reviewTickets.map(ticket => (
            <div key={ticket.id} className="bg-slate-950 p-5 rounded-lg border border-slate-800 flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-sky-400">{ticket.id}</span>
                    <span className="text-xs font-mono px-2 py-0.5 bg-slate-900 text-slate-300 border border-slate-800 rounded">
                      Tag: {ticket.versionTag}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-100 mt-1">{ticket.title}</h3>
                </div>

                <span
                  className={`px-3 py-1 text-xs font-mono font-bold rounded-full border ${
                    ticket.status === 'APPROVED'
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                      : ticket.status === 'CHANGES_REQUESTED'
                      ? 'bg-amber-950 text-amber-400 border-amber-800'
                      : 'bg-sky-950 text-sky-400 border-sky-800'
                  }`}
                >
                  {ticket.status}
                </span>
              </div>

              <p className="text-xs text-slate-300">{ticket.description}</p>

              {/* Approval Chain Matrix */}
              <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col gap-3">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Required Governance Sign-off Chain
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {ticket.approvalChain.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg border flex flex-col justify-between gap-2 ${
                        item.decision === 'APPROVED'
                          ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-300'
                          : item.decision === 'CHANGES_REQUESTED'
                          ? 'bg-amber-950/30 border-amber-800/60 text-amber-300'
                          : 'bg-slate-950 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold">{item.reviewerName}</span>
                        <span className="text-[10px] font-mono opacity-80">{item.role}</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono mt-2 pt-2 border-t border-slate-800/80">
                        <span>Status: <strong>{item.decision}</strong></span>
                        {item.signedTimestamp && <span>Signed: {item.signedTimestamp}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons to Sign Off */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => handleReviewDecision('Dr. Sarah Chen', 'CHANGES_REQUESTED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-950 hover:bg-amber-900 text-amber-300 border border-amber-800 rounded-lg text-xs font-semibold transition-all"
                >
                  <X className="w-3.5 h-3.5" /> Request Engineering Changes
                </button>

                <button
                  onClick={() => handleReviewDecision('Dr. Sarah Chen', 'APPROVED')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow-lg shadow-emerald-600/20"
                >
                  <Check className="w-3.5 h-3.5" /> Approve & Cryptographically Sign
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
