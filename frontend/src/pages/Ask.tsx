import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { askQuestion, useAskSuggestions } from '@/api/client';
import { formatINR } from '@/lib/indianFormats';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  relevantMetrics?: Record<string, any>;
  sources?: string[];
}

const DEFAULT_SUGGESTIONS = [
  'इस महीने सबसे ज्यादा खर्च किस श्रेणी में हुआ? (Highest spending category)',
  'Show me anomalous or off-hours vendor transactions.',
  'Who are our top 5 supplier accounts by total spend?',
  'How much can we save by consolidating vendor price variances?',
  'Travel vs Office Supplies का खर्च अनुपात क्या है?',
  'What is our projected expense spend for next month?',
];

export const Ask: React.FC = () => {
  const { t } = useTranslation();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: suggestionsData } = useAskSuggestions();
  const suggestions =
    suggestionsData?.suggestions && suggestionsData.suggestions.length > 0
      ? suggestionsData.suggestions
      : DEFAULT_SUGGESTIONS;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'नमस्ते! 🙏 **मैं स्वदेशी सहायक (Swadeshi Sahayak) हूँ** — आपका AI बही-खाता विश्लेषक और वित्तीय सलाहकार।\n\nमैं सीधे आपके **स्वदेशी खाता लेजर (SQLite DB)** से जुड़ा हूँ और भारतीय व्यापार लेखांकन (Indian GST & Kirana accounting) पर प्रशिक्षित हूँ। आप मुझसे अपने खर्चों, सप्लायर दामों में अंतर (vendor price variance), संदिग्ध लेन-देन (anomalies) या अगले महीने के खर्च के पूर्वानुमान के बारे में हिंदी, अंग्रेजी या हिंग्लिश में पूछ सकते हैं।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      sources: ['Swadeshi Khata DB: data/receiptradar.db (5,000 SMB Ledger Entries)'],
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await askQuestion(textToSend);
      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        content: response.answer || 'लेजर का विश्लेषण पूर्ण हुआ, परंतु कोई निश्चित निष्कर्ष नहीं निकला।',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        relevantMetrics: response.relevant_metrics,
        sources: response.sources_cited || ['Swadeshi Khata Ledger'],
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **विश्लेषण त्रुटि:** ${err.message}. कृपया सुनिश्चित करें कि बैकएंड सर्वर पोर्ट 8000 पर सक्रिय है।`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content:
          'इतिहास रीसेट हो गया है। आप अपने व्यापार या बही-खाते के बारे में क्या जानना चाहते हैं?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8.5rem)]">
      {/* 1. SECTION HEADER */}
      <div className="shrink-0">
        <SectionHeader
          title="Swadeshi Sahayak Copilot (स्वदेशी सहायक)"
          subtitle="Conversational financial intelligence grounded in your verified ledger facts & Gemini AI"
          icon="💬"
          badge={<StatusBadge label="Ledger Live Sync" variant="brand" dot />}
          actions={
            <button
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#0A0A0A] hover:bg-[#111111] text-[#A59E92] hover:text-[#F5EFE6] text-xs font-mono border border-[#1C1C1F] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5 text-[#656057]" />
              <span>Clear Chat</span>
            </button>
          }
        />
      </div>

      {/* 2. CHAT STREAM CONTAINER */}
      <div className="flex-1 flex flex-col overflow-hidden rounded bg-[#0A0A0A] border border-[#1C1C1F]">
        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'flex gap-3 max-w-[88%]',
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
                {/* Avatar */}
                <div
                  className={cn(
                    'w-7 h-7 rounded flex items-center justify-center text-xs shrink-0 font-mono',
                    isUser
                      ? 'bg-[#F5EFE6] text-black font-bold'
                      : 'bg-[#111111] border border-[#FF9933]/40 text-[#FF9933]'
                  )}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div className="space-y-1.5">
                  <div
                    className={cn(
                      'rounded p-3.5 text-xs sm:text-sm leading-relaxed',
                      isUser
                        ? 'bg-[#1C1C1F] text-[#F5EFE6] font-medium border border-[#2A2A2E]'
                        : 'bg-[#000000] border border-[#1C1C1F] text-[#F5EFE6] space-y-3 font-body'
                    )}
                  >
                    {/* Message Body */}
                    <div className="whitespace-pre-line leading-relaxed">
                      {msg.content}
                    </div>

                    {/* Structured Metrics Chips */}
                    {!isUser && msg.relevantMetrics && (
                      <div className="pt-2 border-t border-[#1C1C1F] grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {msg.relevantMetrics.total_spend_inr !== undefined && (
                          <div className="p-2 rounded bg-[#0A0A0A] border border-[#1C1C1F]">
                            <span className="text-[10px] text-[#656057] uppercase font-mono block">
                              Total Audited
                            </span>
                            <span className="font-mono font-semibold text-[#FF9933] text-xs">
                              {formatINR(msg.relevantMetrics.total_spend_inr)}
                            </span>
                          </div>
                        )}
                        {msg.relevantMetrics.top_spending_category && (
                          <div className="p-2 rounded bg-[#0A0A0A] border border-[#1C1C1F]">
                            <span className="text-[10px] text-[#656057] uppercase font-mono block">
                              Top Category
                            </span>
                            <span className="font-semibold text-[#F5EFE6] text-xs uppercase truncate block font-mono">
                              {msg.relevantMetrics.top_spending_category}
                            </span>
                          </div>
                        )}
                        {msg.relevantMetrics.anomalous_transactions !== undefined && (
                          <div className="p-2 rounded bg-[#0A0A0A] border border-[#1C1C1F]">
                            <span className="text-[10px] text-[#656057] uppercase font-mono block">
                              Anomalies Flagged
                            </span>
                            <span className="font-mono font-semibold text-[#B3202A] text-xs">
                              {msg.relevantMetrics.anomalous_transactions} records
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Sources citation footer */}
                    {!isUser && msg.sources && msg.sources.length > 0 && (
                      <div className="pt-1.5 flex items-center justify-between text-[10px] text-[#656057] font-mono border-t border-[#1C1C1F]">
                        <span className="truncate">Source: {msg.sources.join(', ')}</span>
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="hover:text-[#F5EFE6] transition-colors p-1"
                          title="Copy reply"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-[#138808]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-[#656057] font-mono block px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </motion.div>
            );
          })}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs font-mono text-[#A59E92] p-2"
            >
              <div className="w-2 h-2 rounded-full bg-[#FF9933] animate-pulse" />
              <span>Swadeshi Sahayak is auditing ledger & formulating answer...</span>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div className="px-4 py-2 border-t border-[#1C1C1F] bg-[#000000]/60 overflow-x-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#656057] uppercase shrink-0">
            Suggested:
          </span>
          {suggestions.slice(0, 4).map((sug, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sug)}
              className="shrink-0 px-2.5 py-1 rounded text-[11px] font-body bg-[#111111] hover:bg-[#1C1C1F] text-[#A59E92] hover:text-[#F5EFE6] border border-[#1C1C1F] transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-[#1C1C1F] bg-[#000000] flex items-center gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="खर्च, सप्लायर या विसंगति के बारे में पूछें... (e.g., 'Highest expense this month?')"
            className="flex-1 bg-[#0A0A0A] border border-[#1C1C1F] rounded px-3 py-2 text-xs text-[#F5EFE6] placeholder-[#656057] focus:outline-none focus:border-[#FF9933] font-body"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputQuery.trim() || isLoading}
            className="px-4 py-2 rounded bg-[#FF9933] hover:bg-[#e08528] text-black font-semibold text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>भेजें / Send</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Ask;
