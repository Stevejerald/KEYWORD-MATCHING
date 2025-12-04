import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/analyzer.css"; // <-- new stylesheet

const API_BASE =
  import.meta.env.VITE_API_BASE ||
  process.env.REACT_APP_API_BASE ||
  "http://127.0.0.1:8000";

function humanizeMatchType(t) {
  if (!t) return t;
  return t.replace("_", " ").toUpperCase();
}

export default function Analyzer() {
  const [text, setText] = useState("");
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const prev = document.body.style.margin;
    document.body.style.margin = "0";
    return () => { document.body.style.margin = prev; };
  }, []);

  const analyze = async () => {
    setError(null);
    setResult(null);

    if (!text || !text.trim()) {
      setError("Please enter a problem statement to analyze.");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/api/analyze`, { text, category });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || "Request failed");
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result || !result.matches) return;
    const rows = [["phrase", "category", "match_type", "weight", "matched_text"]];
    result.matches.forEach(m => {
      rows.push([m.phrase, m.category, m.match_type, m.weight, m.matched_text]);
    });
    const csv = rows
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "analyzer_matches.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const highlightPreview = () => {
    if (!result) return null;
    const tokens = result.matches
      .map(m => m.matched_text)
      .join(" ")
      .split(/[, ]+/)
      .filter(Boolean);

    let out = text;
    const uniqueToks = Array.from(new Set(tokens)).sort((a, b) => b.length - a.length);
    uniqueToks.forEach(tok => {
      try {
        const safeTok = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const re = new RegExp(`(${safeTok})`, "ig");
        out = out.replace(re, "<mark>$1</mark>");
      } catch (e) {}
    });
    return { __html: out };
  };

  return (
    <div className="analyzer-root">
      <div className="analyzer-card">
        <h2 className="analyzer-title">Meril Keyword Model</h2>

        <div className="analyzer-controls">
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="select"
          >
            <option value="all">All categories</option>
            <option value="diagnostic">Diagnostic</option>
            <option value="endo">Endo</option>
          </select>

          <button onClick={analyze} disabled={loading} className="btn primary">
            {loading ? "Analyzing…" : "Analyze Tender"}
          </button>

          <button
            onClick={() => {
              setText("");
              setResult(null);
              setError(null);
            }}
            className="btn"
          >
            Clear
          </button>
        </div>

        <textarea
          placeholder="Paste problem statement (one or multiple lines). Example: Hemorrhoid Stapler (V2)"
          value={text}
          onChange={e => setText(e.target.value)}
          rows={6}
          className="textarea"
        />

        {error && <div className="error">{error}</div>}

        {result && (
          <div className="result-panel">
            <div className="result-top">
              <div>
                <div className="muted">Relevant</div>
                <div className={`result-badge ${result.relevant ? "yes" : "no"}`}>
                  {result.relevant ? "YES" : "NO"} — {result.score_pct}%
                </div>
              </div>

              <div className="progress-wrap">
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${result.score_pct}%` }}
                  />
                </div>
                <div className="muted small">Top category: {Object.keys(result.category_scores || {}).length ? Object.entries(result.category_scores).sort((a,b)=>b[1]-a[1])[0][0] : "—"}</div>
              </div>

              <button onClick={exportCSV} className="btn outline">Export CSV</button>
            </div>

            <hr className="divider" />

            <div className="content-grid">
              <div>
                <h4 className="section-title">Matches ({result.matches.length})</h4>
                <div className="table-scroll">
                  <table className="matches-table">
                    <thead>
                      <tr>
                        <th>Phrase</th>
                        <th>Type</th>
                        <th>Weight</th>
                        <th>Matched</th>
                        <th>Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.matches.map((m, i) => (
                        <tr key={i}>
                          <td>{m.phrase}</td>
                          <td>{humanizeMatchType(m.match_type)}</td>
                          <td>{m.weight}</td>
                          <td className="matched">{m.matched_text}</td>
                          <td>{m.category}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <aside>
                <h4 className="section-title">Preview</h4>
                <div className="preview-box" dangerouslySetInnerHTML={highlightPreview()} />

                <h4 className="section-title" style={{ marginTop: 14 }}>Category Scores</h4>
                <div className="category-list">
                  {Object.entries(result.category_scores || {}).map(([cat, v]) => (
                    <div key={cat} className="category-row">
                      <div className="cat-name">{cat}</div>
                      <div className="cat-bar-bg">
                        <div className="cat-bar-fill" style={{ width: `${Math.min(100, v)}%` }} />
                      </div>
                      <div className="cat-val">{v}</div>
                    </div>
                  ))}
                </div>
              </aside>
            </div>
          </div>
        )}

        {!result && !error && (
          <div className="hint">Paste a problem statement and press <strong>Analyze Tender</strong>.</div>
        )}
      </div>
    </div>
  );
}
