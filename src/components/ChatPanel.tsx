'use client';

import React, { useRef, useState } from 'react';
import { Send, MessageCircle, Navigation, User, Database } from 'lucide-react';
import { ChatMessage, CommuteProfile, Verdict } from '@/types/commute';

interface ChatPanelProps {
  verdict: Verdict;
  profile: CommuteProfile;
  scenario: 'normal' | 'delay' | 'reroute';
}

export function ChatPanel({ verdict, profile, scenario }: ChatPanelProps) {
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
  const messageSequence = useRef(0);

  const nextMessageId = (sender: 'user' | 'agent') => {
    messageSequence.current += 1;
    return `${sender[0]}-${messageSequence.current}`;
  };

  const samplePrompts = [
    'Can I grab coffee and still make it?',
    'Is it worth taking the ferry today?',
    'Why did the departure time shift?',
  ];

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || inputValue;
    if (!query.trim()) return;

    const userMsg: ChatMessage = {
      id: nextMessageId('user'),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue('');
    setIsTyping(true);

    try {
      const history = messages.map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          profile,
          scenario,
          history,
        }),
      });

      const data = await res.json();
      const agentMsg: ChatMessage = {
        id: nextMessageId('agent'),
        sender: 'agent',
        text: data.reply || 'Live telemetry retrieved.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dataCitations: data.dataCitations || [],
      };

      setMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.warn('Chat request error, using fallback:', err);
      const fallbackMsg: ChatMessage = {
        id: nextMessageId('agent'),
        sender: 'agent',
        text: `Based on live feed telemetry, ${verdict.primaryRoute.name} is recommended for departure at ${verdict.leaveByTime} AM with an allocated safety buffer of ${verdict.primaryRoute.bufferMinutes} minutes.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dataCitations: [
          { source: 'Buffer Margin', metric: `+${verdict.primaryRoute.bufferMinutes}m` },
          { source: 'Line Reliability', metric: `${verdict.primaryRoute.reliabilityRate}%` },
        ],
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xs flex flex-col h-full min-h-[460px]">
      {/* Header matching Concourse ChatInterface */}
      <div className="flex items-center gap-2 pb-3 border-b border-zinc-100">
        <MessageCircle className="h-5 w-5 text-zinc-900" />
        <div>
          <h3 className="text-base font-semibold text-zinc-900">Chat with Waypoint</h3>
          <p className="text-xs text-zinc-500">Ask follow-up questions about routes, timing, and delays.</p>
        </div>
      </div>

      {/* Suggested quick chips */}
      <div className="py-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
        {samplePrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSend(prompt)}
            className="text-[11px] shrink-0 px-2.5 py-1 rounded-full border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 transition"
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
                    ? 'bg-zinc-100 text-zinc-800 border border-zinc-200'
                    : 'bg-zinc-900 text-white'
                }`}
              >
                {isAgent ? <Navigation className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                  isAgent
                    ? 'bg-zinc-100 text-zinc-900 border border-zinc-200'
                    : 'bg-zinc-900 text-white'
                }`}
              >
                <p>{msg.text}</p>

                {/* Data citations */}
                {msg.dataCitations && msg.dataCitations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-zinc-200/60 flex flex-wrap gap-1.5">
                    {msg.dataCitations.map((cite, ci) => (
                      <span
                        key={ci}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-white text-zinc-700 border border-zinc-200"
                      >
                        <Database className="h-2.5 w-2.5 text-zinc-500" />
                        <span className="font-semibold text-zinc-600">{cite.source}:</span>
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
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-zinc-400 animate-ping" />
            <span>Consulting transit feeds & reasoning...</span>
          </div>
        )}
      </div>

      {/* Input bar matching Concourse */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-3 border-t border-zinc-100 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask Waypoint anything about your commute..."
          className="flex-1 bg-zinc-50 text-xs text-zinc-900 border border-zinc-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-1 focus:ring-zinc-900"
        />
        <button
          type="submit"
          className="p-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white transition disabled:opacity-50"
          disabled={!inputValue.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}
