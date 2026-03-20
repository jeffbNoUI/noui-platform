import { useState, useEffect, useRef } from 'react';
import { C, BODY } from '@/lib/designSystem';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const initialMessages: ChatMessage[] = [
  { role: 'assistant', text: 'Good morning. How can I help with your retirement planning today?' },
];

const suggestions = ['When can I retire?', 'Explain my benefit formula', 'Survivor benefits'];

function renderBoldText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ fontWeight: 700, color: C.navy }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

export default function AIChatPanel() {
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!chatInput.trim()) return;
    setMessages((prev) => [...prev, { role: 'user', text: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: "I'm looking into that for you now. Based on your current service credit and the benefit formula (2.0% x years x final average salary), I can provide a detailed breakdown. Give me just a moment\u2026",
        },
      ]);
    }, 1200);
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 80,
        height: 'calc(100vh - 108px)',
        display: 'flex',
        flexDirection: 'column',
        background: C.cardBg,
        border: `1px solid ${C.border}`,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.borderLight}`,
          background: C.cardBgWarm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${C.sage}, ${C.sageDark})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              color: '#fff',
            }}
          >
            &#10022;
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>NoUI Pension Advisor</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: C.sage,
                  animation: 'breathe 2s infinite',
                }}
              />
              <span style={{ fontSize: 11, color: C.textTertiary }}>Always available</span>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 16px 8px' }}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              marginBottom: 14,
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '88%',
                padding: '11px 15px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user' ? C.navy : C.cardBgWarm,
                color: msg.role === 'user' ? C.textOnDark : C.text,
                fontSize: 13,
                lineHeight: 1.55,
                border: msg.role === 'user' ? 'none' : `1px solid ${C.borderLight}`,
              }}
            >
              {renderBoldText(msg.text)}
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Suggestions */}
      <div style={{ padding: '0 16px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {suggestions.map((q, i) => (
          <button
            key={i}
            onClick={() => setChatInput(q)}
            style={{
              padding: '5px 12px',
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.pageBg,
              color: C.textSecondary,
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: BODY,
              transition: 'all 0.15s ease',
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 16px 16px' }}>
        <div className="portal-chat-input-wrap">
          <input
            className="portal-chat-input"
            placeholder="Ask about your pension benefits\u2026"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="portal-send-btn" onClick={handleSend} disabled={!chatInput.trim()}>
            &#8593;
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 8, fontSize: 10, color: C.textTertiary }}>
          Powered by NoUI &middot; Your data never leaves Denver's secure infrastructure
        </div>
      </div>
    </div>
  );
}
