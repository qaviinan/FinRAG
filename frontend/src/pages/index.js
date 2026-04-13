import Head from 'next/head';
import { Key, Send, Settings, Trash, Zap, ZapOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import WelcomeScreen from '../components/WelcomeScreen';
import MessageRenderer from '../components/MessageRenderer';
import LoadingAnimation from '../components/LoadingAnimation';
import RaptorTreePanel from '../components/RaptorTreePanel';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

export default function SynthWave() {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [raptorEnabled, setRaptorEnabled] = useState(true);
  const [raptorMode, setRaptorMode] = useState('rag-only');
  // Track the last user query so feedback can log it
  const lastQueryRef = useRef('');

  // ── Session + message persistence ──────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('sessionId') || uuidv4();
    localStorage.setItem('sessionId', stored);
    setSessionId(stored);

    const saved = localStorage.getItem('messages');
    setMessages(saved ? JSON.parse(saved) : []);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('messages', JSON.stringify(messages));
    }
  }, [messages]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleNewChat = () => {
    localStorage.removeItem('sessionId');
    localStorage.removeItem('messages');
    const newId = uuidv4();
    localStorage.setItem('sessionId', newId);
    setSessionId(newId);
    setMessages([]);
    setIsTyping(false);
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };

  const handleSampleQuery = (query) => {
    setInputText(query);
    setIsTyping(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const userInput = inputText.trim();
    if (!userInput) return;

    lastQueryRef.current = userInput;
    setMessages((prev) => [...prev, { type: 'user', content: `Q: ${userInput}` }]);
    setInputText('');
    setIsTyping(false);
    setLoading(true);

    fetch(`${API_BASE}/chat/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        query: userInput,
        use_raptor: raptorEnabled,
        mode: raptorMode,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        const { messages: newMsgs, response_id } = data;
        const enriched = (newMsgs || []).map((m) => ({ ...m, response_id }));
        setMessages((prev) => [...prev, ...enriched]);
      })
      .catch((err) => {
        console.error('Chat error:', err);
        setMessages((prev) => [
          ...prev,
          { type: 'text', content: 'Something went wrong. Please try again.' },
        ]);
      })
      .finally(() => setLoading(false));
  };

  // ── Feedback ────────────────────────────────────────────────────────────────
  const handleFeedback = (responseId, rating) => {
    fetch(`${API_BASE}/feedback/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        response_id: responseId,
        rating,
        query: lastQueryRef.current,
        session_id: sessionId,
      }),
    }).catch(console.error);

    // Optimistically mark the rating in state
    setMessages((prev) =>
      prev.map((m) =>
        m.response_id === responseId ? { ...m, userRating: rating } : m
      )
    );
  };

  // ── RAPTOR toggle pill ───────────────────────────────────────────────────────
  const RaptorToggle = () => (
    <button
      type="button"
      title={raptorEnabled ? 'RAPTOR on — click to disable' : 'RAPTOR off — click to enable'}
      onClick={() => setRaptorEnabled((v) => !v)}
      className={`
        flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold
        border transition-colors duration-150 select-none
        ${raptorEnabled
          ? 'bg-pink-500 border-pink-500 text-white'
          : 'bg-stone-700 border-stone-600 text-stone-400'}
      `}
    >
      {raptorEnabled ? <Zap className="w-3 h-3" /> : <ZapOff className="w-3 h-3" />}
      RAPTOR
    </button>
  );

  return (
    <>
      <Head>
        <title>FinRAG - Agent with trade know-how</title>
      </Head>
      <main>
        <div className="flex min-h-screen">
          {/* Left: sidebar (50%) */}
          <aside className="w-1/2 p-4 bg-base-100 border-r overflow-auto">
            <div className="z-20 bg-opacity-90 backdrop-blur sticky top-0 flex items-center gap-2 px-4 py-2">
              <Link href="https://anchorblock.vc" className="flex-0 btn btn-ghost px-2">
                Anchorblock
              </Link>
              <div className="flex-1" />
            </div>

            <div className="mt-4 flex flex-col space-y-2">
              <button className="btn btn-primary w-full" onClick={handleNewChat}>
                New Chat
              </button>
              <input placeholder="Search …" className="input w-full input-bordered" />
            </div>

            <div className="mt-4">
              <RaptorTreePanel apiBase={API_BASE} />
            </div>

            <div className="mt-4">
              <ul className="menu text-sm w-full p-2 rounded-box">
                <li>
                  <a>
                    <Trash className="h-5 w-5" />
                    Clear Conversations
                  </a>
                </li>
                <li>
                  <a>
                    <Key className="h-5 w-5" />
                    OpenAI API KEY
                  </a>
                </li>
                <li>
                  <a>
                    <Settings className="h-5 w-5" />
                    Settings
                  </a>
                </li>
              </ul>
            </div>
          </aside>

          {/* Right: chat (50%) */}
          <section className="w-1/2 flex flex-col bg-stone-200">
            <div className="top-0 flex h-20 w-full justify-center bg-opacity-0 backdrop-blur transition-all duration-100 text-base-content">
              <nav className="navbar w-full">
                <div className="flex flex-1 md:gap-1 lg:gap-2">
                  <span className="tooltip tooltip-bottom before:text-xs before:content-[attr(data-tip)]" data-tip="Menu">
                    <div className="btn btn-square btn-ghost lg:hidden">☰</div>
                  </span>
                </div>
              </nav>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              {messages.length === 0 && <WelcomeScreen onClickSample={handleSampleQuery} />}
              <div className="chat-messages w-full max-w-2xl">
                {messages.map((message, index) => (
                  <div key={index} className="message-box">
                    <MessageRenderer message={message} onFeedback={handleFeedback} />
                  </div>
                ))}
                {loading && <LoadingAnimation />}
              </div>
            </div>

            <div className="p-4 bg-stone-100">
              <div className="flex items-center justify-end mb-2">
                <span className="text-xs text-stone-500 mr-2">{raptorEnabled ? 'Hierarchical retrieval' : 'Flat RAG'}</span>
                <RaptorToggle />
                <select value={raptorMode} onChange={(e) => setRaptorMode(e.target.value)} className="select select-xs ml-2" title="RAG mode">
                  <option value="rag-only">RAG-only</option>
                  <option value="llm+rag">LLM+RAG</option>
                </select>
              </div>

              <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-2">
                <input type="text" value={inputText} className="input input-primary flex-1 bg-stone-900 text-sm" name="chatInput" placeholder="Type your message…" onChange={handleInputChange} />
                <button type="submit" className="btn btn-square border-0 bg-pink-500 shrink-0">
                  <Send className="w-5 h-5 text-white" />
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
