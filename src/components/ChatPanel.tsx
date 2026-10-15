'use client';

import React, { useState } from 'react';
import { Send, Bot, User, Sparkles, Database, Coffee, HelpCircle, ArrowRight } from 'lucide-react';
import { ChatMessage, Verdict } from '@/types/commute';

interface ChatPanelProps {
  verdict: Verdict;
}

export function ChatPanel({ verdict }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'agent',
      text: `Hello! I'm monitoring your corridor (${verdict.primaryRoute.name}). Current verdict is ${verdict.state.toUpperCase()} with leave-by at ${verdict.leaveByTime} AM. What would you like to check?`,
      timestamp: '08:00 AM',
      dataCitations: [
        { source: 'PATH Live Feed', metric: '4-min headway' },
        { source: 'NJT Historical OTP', metric: '94% on-time' },
      ],
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const samplePrompts = [
    'Can I grab coffee and still make it?',
    'Is it worth taking the ferry today?',
    'Why did the departure time shift?',
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulated grounded agent response (will connect to Nebius Token Factory route in Phase 4)
    setTimeout(() => {
      let replyText = '';
      let citations: { source: string; metric: string }[] = [];

      if (query.toLowerCase().includes('coffee')) {
        if (verdict.state === 'comfortable') {
          replyText = `Yes, but keep it quick. You have an 11-minute buffer window before your 8:14 AM recommended departure. A quick 4-5 minute coffee stop at Hoboken Terminal leaves you with a 6-minute margin.`;
          citations = [
            { source: 'Buffer Calculation', metric: '+11m buffer available' },
            { source: 'Walking Estimate', metric: '2m walk to PATH turnstiles' },
          ];
        } else {
          replyText = `Not recommended. Your verdict is currently ${verdict.state.toUpperCase()} with departure in ${verdict.countdownMinutes} minutes. Even a 3-minute delay risks missing the target arrival window.`;
          citations = [
            { source: 'Buffer Calculation', metric: 'Only 3m safety margin remaining' },
          ];
        }
      } else if (query.toLowerCase().includes('ferry')) {
        replyText = `The NY Waterway Ferry at 14th St departs at 8:20 AM and takes 12 mins to Midtown W 39th St. It is 98% reliable with zero tunnel congestion, but costs $9.00 vs $2.75 for PATH. In the current conditions, your primary route is faster, but Ferry remains on standby as Plan B.`;
        citations = [
          { source: 'NY Waterway Realtime', metric: 'Next ferry: 08:20 AM' },
          { source: 'Cost Comparison', metric: '$9.00 vs $2.75' },
        ];
      } else {
        replyText = `Based on live GTFS-RT feed updates received ${verdict.freshnessTimestamp}, the primary line (${verdict.primaryRoute.name}) is operating with ${verdict.primaryRoute.reliabilityRate}% historical reliability. Your arrive-by target of 09:00 AM is protected with a ${verdict.primaryRoute.bufferMinutes}-minute safety buffer.`;
        citations = [
          { source: 'GTFS-RT Feed', metric: verdict.freshnessTimestamp },
          { source: 'Reliability Index', metric: `${verdict.primaryRoute.reliabilityRate}% on-time` },
        ];
      }

      const agentMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        sender: 'agent',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dataCitations: citations,
      };

      setMessages((prev) => [...prev, agentMsg]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div className="rounded-2xl glass-panel p-5 border border-white/10 flex flex-col h-full min-h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Waypoint Commute Assistant
              <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                Nemotron
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Strictly grounded in transit telemetry</p>
          </div>
        </div>
      </div>

      {/* Suggested quick chips */}
      <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {samplePrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            className="text-[11px] shrink-0 px-2.5 py-1 rounded-full bg-slate-900 border border-white/10 hover:border-cyan-500/40 text-slate-300 hover:text-white transition"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 py-2">
        {messages.map((msg) => {
          const isAgent = msg.sender === 'agent';
          return (
            <div
              key={msg.id}
              className={`flex items-start gap-2.5 ${isAgent ? '' : 'flex-row-reverse'}`}
            >
              <div
                className={`w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold ${
                  isAgent
                    ? 'bg-cyan-600/30 text-cyan-300 border border-cyan-500/30'
                    : 'bg-indigo-600 text-white'
                }`}
              >
                {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>

              <div
                className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed ${
                  isAgent
                    ? 'bg-slate-900/80 border border-white/10 text-slate-200'
                    : 'bg-cyan-600 text-white font-medium'
                }`}
              >
                <p>{msg.text}</p>

                {/* Grounded data citations */}
                {msg.dataCitations && msg.dataCitations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                    {msg.dataCitations.map((cite, ci) => (
                      <span
                        key={ci}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10"
                      >
                        <Database className="h-2.5 w-2.5 text-cyan-400" />
                        <span className="font-semibold text-slate-400">{cite.source}:</span>
                        <span>{cite.metric}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Consulting transit feeds & Nemotron...</span>
          </div>
        )}
      </div>

      {/* Input row */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-3 border-t border-white/10 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask a question about your commute..."
          className="flex-1 bg-slate-900/90 text-xs text-slate-200 border border-white/10 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        />
        <button
          type="submit"
          className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white transition disabled:opacity-50"
          disabled={!inputValue.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
