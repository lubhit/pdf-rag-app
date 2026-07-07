import { useState, useRef, useEffect } from 'react';
import './App.css';
import { recordAudio, speechToText, textToSpeech, playAudio } from './speechService';

const API_URL = 'http://localhost:8001/chat';

function App() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([]); // { role, text, sources?, isVoice? }
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef(null);
  const cancelledRef = useRef(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, transcribing]);

  const ask = async (text, isVoice = false) => {
    const q = text.trim();
    if (!q || loading) return;

    setMessages((m) => [...m, { role: 'user', text: q, isVoice }]);
    setQuestion('');
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const data = await res.json();

      setMessages((m) => [
        ...m,
        { role: 'assistant', text: data.answer, sources: data.sources || [], isVoice },
      ]);

      if (isVoice) {
        try {
          playAudio(await textToSpeech(data.answer));
        } catch (err) {
          console.error('TTS failed:', err);
        }
      }
    } catch (err) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: `Something went wrong: ${err.message}. Is the backend running on port 8001?`,
          sources: [],
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      cancelledRef.current = false;
      recorderRef.current = await recordAudio();
      setRecording(true);
    } catch (err) {
      alert(`Microphone access denied: ${err.message}`);
    }
  };

  // Stop and send: transcribe, then ask in voice mode.
  const stopAndSend = async () => {
    setRecording(false);
    setTranscribing(true);
    try {
      const blob = await recorderRef.current.stop();
      if (cancelledRef.current) return; // user cancelled — drop it
      const transcript = await speechToText(blob);
      if (transcript.trim()) ask(transcript, true);
    } catch (err) {
      alert(`Voice input failed: ${err.message}`);
    } finally {
      setTranscribing(false);
    }
  };

  // Cancel: stop the mic but throw the audio away.
  const cancelRecording = async () => {
    cancelledRef.current = true;
    setRecording(false);
    try {
      await recorderRef.current.stop();
    } catch {
      /* ignore */
    }
  };

  const replay = async (text) => {
    try {
      playAudio(await textToSpeech(text));
    } catch (err) {
      alert(`Playback failed: ${err.message}`);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      ask(question, false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>PDF RAG</h1>
        <p>Ask questions about your ingested documents — type or speak</p>
      </header>

      <div className="chat">
        {messages.length === 0 && !loading && !recording && !transcribing && (
          <div className="empty">Type a question, or tap the mic and speak.</div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            <div className="bubble">
              <p>
                {msg.isVoice && <span className="voice-badge">🎤</span>}
                {msg.text}
              </p>

              {msg.role === 'assistant' && msg.sources !== undefined && (
                <button
                  className="replay-btn"
                  onClick={() => replay(msg.text)}
                  title="Play answer aloud"
                >
                  🔊 Play
                </button>
              )}

              {msg.sources && msg.sources.length > 0 && (
                <div className="sources">
                  <span className="sources-label">Sources</span>
                  <ul>
                    {msg.sources.map((s, j) => (
                      <li key={j}>
                        <strong>{s.source_file}</strong> — chunk {s.chunk_number}
                        {typeof s.score === 'number' && (
                          <span className="score"> ({s.score.toFixed(3)})</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {transcribing && (
          <div className="message user">
            <div className="bubble thinking">Transcribing…</div>
          </div>
        )}

        {loading && (
          <div className="message assistant">
            <div className="bubble thinking">Thinking…</div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {recording && (
        <div className="recording-bar">
          <span className="rec-dot" /> Recording…
          <div className="rec-actions">
            <button className="cancel-btn" onClick={cancelRecording}>
              Cancel
            </button>
            <button className="send-btn" onClick={stopAndSend}>
              Stop &amp; send
            </button>
          </div>
        </div>
      )}

      <div className="composer">
        <button
          className="voice-btn"
          onClick={startRecording}
          disabled={loading || recording || transcribing}
          title="Speak your question"
        >
          🎤
        </button>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about your documents…"
          disabled={loading || recording || transcribing}
        />
        <button
          onClick={() => ask(question, false)}
          disabled={loading || recording || transcribing || !question.trim()}
        >
          Ask
        </button>
      </div>
    </div>
  );
}

export default App;
