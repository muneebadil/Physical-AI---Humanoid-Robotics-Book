import React, { useEffect, useRef, useState } from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import clsx from 'clsx';

import styles from './Chatbot.module.css';
import { generateGeminiReply } from './gemini';

const LOADING_TEXT = 'Wait, fetching response from RAG...';
const ASSISTANT_NAME = 'RAG Chatbot';

function uuid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Chatbot() {
  const { siteConfig } = useDocusaurusContext();
  const keyFromConfig = siteConfig?.customFields?.geminiApiKey ?? null;
  const keyFromWindow = typeof window !== 'undefined' ? window.__GEMINI_API_KEY__ : null;
  const geminiApiKey = (keyFromConfig || keyFromWindow || '').trim() || null;

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => [
    {
      id: uuid(),
      role: 'assistant',
      text: 'Ask me anything. I’ll answer briefly and concisely.',
    },
  ]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);

  const canUseDirectClientKey = Boolean(geminiApiKey);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => inputRef.current?.focus(), 120);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, isOpen]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isBusy) return;

    setError(null);
    setInput('');
    setIsBusy(true);

    const userMsg = { id: uuid(), role: 'user', text };
    const loadingId = uuid();
    const loadingMsg = { id: loadingId, role: 'assistant', text: LOADING_TEXT, isLoading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    try {
      const reply = await generateGeminiReply({
        message: text,
        history: [...messages, userMsg],
        apiKey: canUseDirectClientKey ? geminiApiKey : null,
      });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId ? { ...m, text: reply || 'No response returned.', isLoading: false } : m,
        ),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === loadingId
            ? {
                ...m,
                text: msg || "Sorry — I couldn't fetch a response right now. Please try again.",
                isLoading: false,
                isError: true,
              }
            : m,
        ),
      );
    } finally {
      setIsBusy(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        <span className={styles.fabIcon} aria-hidden="true">
          {isOpen ? '×' : '💬'}
        </span>
        <span className={styles.fabLabel}>{isOpen ? 'Close' : 'Chat'}</span>
      </button>

      <div className={clsx(styles.panel, isOpen && styles.panelOpen)} role="dialog" aria-modal="false">
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            <div className={styles.headerDot} aria-hidden="true" />
            <div>
              <div className={styles.headerName}>{ASSISTANT_NAME}</div>
              <div className={styles.headerSub}>
                {canUseDirectClientKey ? 'RAG dev mode (client key)' : 'Secure mode (server proxy)'}
              </div>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={() => setIsOpen(false)} aria-label="Close">
            ×
          </button>
        </div>

        <div className={styles.messages} ref={listRef}>
          {messages.map((m) => (
            <div
              key={m.id}
              className={clsx(
                styles.msgRow,
                m.role === 'user' ? styles.msgRowUser : styles.msgRowBot,
              )}
            >
              <div
                className={clsx(
                  styles.bubble,
                  m.role === 'user' ? styles.bubbleUser : styles.bubbleBot,
                  m.isLoading && styles.bubbleLoading,
                  m.isError && styles.bubbleError,
                )}
              >
                {m.text}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.composer}>
          <textarea
            ref={inputRef}
            className={styles.input}
            placeholder="Type a message…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            disabled={isBusy}
          />
          <button
            type="button"
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={isBusy || !input.trim()}
          >
            Send
          </button>
        </div>

        {error ? <div className={styles.errorBar}>Error: {error}</div> : null}
      </div>
    </>
  );
}

