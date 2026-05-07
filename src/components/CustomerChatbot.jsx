import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { apiRequest } from '../utils/api';

const initialAssistantMessage =
  '\u0623\u0647\u0644\u064b\u0627! \u0623\u0646\u0627 \u0645\u0633\u0627\u0639\u062f Athar. \u0628\u0642\u062f\u0631 \u0623\u0633\u0627\u0639\u062f\u0643 \u0641\u064a \u0627\u0644\u062a\u0635\u0641\u062d \u0648\u0627\u0644\u0634\u0631\u0627\u0621 \u0648\u0627\u0644\u062a\u062a\u0628\u0639.';

const assistantFallbackReply =
  '\u0622\u0633\u0641\u060c \u0645\u0627 \u0642\u062f\u0631\u062a \u0623\u0641\u0647\u0645 \u0627\u0644\u0637\u0644\u0628 \u0628\u0634\u0643\u0644 \u0643\u0627\u0645\u0644. \u062d\u0627\u0648\u0644 \u0635\u064a\u0627\u063a\u062a\u0647 \u0628\u0637\u0631\u064a\u0642\u0629 \u062b\u0627\u0646\u064a\u0629.';
const assistantErrorReply =
  '\u0645\u0624\u0642\u062a\u064b\u0627 \u0641\u064a \u0645\u0634\u0643\u0644\u0629 \u0628\u0627\u0644\u0627\u062a\u0635\u0627\u0644. \u062c\u0631\u0651\u0628 \u0645\u0631\u0629 \u062b\u0627\u0646\u064a\u0629 \u0628\u0639\u062f \u0644\u062d\u0638\u0627\u062a.';

const CustomerChatbot = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      text: initialAssistantMessage,
    },
  ]);

  const page = location.pathname || '/';
  const hiddenPrefixes = ['/admin', '/employee-dashboard', '/delivery-dashboard', '/delivery/profile'];
  const isCustomerPage = !hiddenPrefixes.some((prefix) => page.startsWith(prefix));

  const sendMessage = async () => {
    const text = input.trim();

    if (!text || loading) {
      return;
    }

    setMessages((current) => [...current, { id: `u-${Date.now()}`, role: 'user', text }]);
    setInput('');
    setLoading(true);

    try {
      const response = await apiRequest('/api/chatbot/message', {
        method: 'POST',
        body: {
          message: text,
          page,
        },
      });

      const assistantText =
        String(response?.data?.answer || response?.answer || response?.message || '').trim() ||
        assistantFallbackReply;

      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: assistantText,
        },
      ]);
    } catch (_error) {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: assistantErrorReply,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isCustomerPage) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-1rem)] flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {open ? (
        <section className="heritage-panel flex h-[min(70vh,560px)] w-[min(24rem,calc(100vw-1rem))] flex-col overflow-hidden rounded-[28px]">
          <header className="border-b border-line bg-white/95 px-4 py-3">
            <p className="text-sm font-semibold text-ink">Athar Assistant</p>
            <p className="mt-1 text-xs text-ink-soft">
              {
                '\u0645\u0633\u0627\u0639\u062f \u0633\u0631\u064a\u0639 \u0644\u0634\u0631\u062d \u0627\u0644\u0635\u0641\u062d\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629\u060c \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a\u060c \u0648\u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0637\u0644\u0628.'
              }
            </p>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-cream/60 p-3">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-xl px-3 py-2 text-sm ${
                  message.role === 'user'
                    ? 'ml-8 border border-rose/30 bg-blush text-ink'
                    : 'mr-8 border border-line bg-white text-ink shadow-sm'
                }`}
              >
                <p>{message.text}</p>
              </article>
            ))}
            {loading ? <p className="text-xs text-muted">Athar Assistant is typing...</p> : null}
          </div>

          <form
            className="flex items-center gap-2 border-t border-line bg-white/95 p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void sendMessage();
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={'\u0627\u0643\u062a\u0628 \u0633\u0624\u0627\u0644\u0643...'}
              className="w-full rounded-full border border-line bg-cream px-4 py-2.5 text-sm text-ink outline-none transition focus:border-rose"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-full bg-blush px-4 py-2 text-xs font-semibold text-ink transition hover:bg-rose disabled:cursor-not-allowed disabled:opacity-60"
            >
              {'\u0625\u0631\u0633\u0627\u0644'}
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full bg-blush px-5 py-3 text-sm font-semibold text-ink shadow-card transition hover:bg-rose"
      >
        {open
          ? '\u0625\u063a\u0644\u0627\u0642 \u0627\u0644\u0634\u0627\u062a'
          : '\u0627\u0633\u0623\u0644 \u0645\u0633\u0627\u0639\u062f Athar'}
      </button>
    </div>
  );
};

export default CustomerChatbot;
