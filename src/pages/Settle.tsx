import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import type { BetDetail } from '../lib/types.js';

export default function Settle() {
  const navigate = useNavigate();
  const params = useParams();
  const betId = Number(params.betId);
  const [bet, setBet] = useState<BetDetail | null>(null);
  const [winnerOptionId, setWinnerOptionId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBet() {
      setLoading(true);
      setError(null);

      try {
        const detail = await api.getBet(betId);
        setBet(detail);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Could not load bet.');
      } finally {
        setLoading(false);
      }
    }

    void loadBet();
  }, [betId]);

  async function handleSettle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!winnerOptionId) {
      setError('Choose a winning option first.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await api.settleBet(betId, { winnerOptionId });
      navigate(`/bets/${betId}`);
    } catch (settleError) {
      setError(settleError instanceof Error ? settleError.message : 'Could not settle bet.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      {loading ? <div className="card muted">Loading settlement view…</div> : null}
      {error ? <div className="card error">{error}</div> : null}

      {bet ? (
        <section className="card stack">
          <div className="row">
            <div>
              <h1 className="page-title">Settle “{bet.title}”</h1>
              <p className="muted">Only the original creator can finish the bet and reveal the full result.</p>
            </div>
            <Link className="button-ghost" to={`/bets/${bet.id}`}>
              Back to bet
            </Link>
          </div>

          <form className="stack" onSubmit={handleSettle}>
            <div className="list">
              {bet.options.map((option) => (
                <label key={option.id} className="option-tile">
                  <input
                    type="radio"
                    name="winnerOptionId"
                    value={option.id}
                    checked={winnerOptionId === option.id}
                    onChange={() => setWinnerOptionId(option.id)}
                  />
                  <div>
                    <strong>{option.label}</strong>
                    <div className="muted">{option.pickCount ?? 0} visible picks</div>
                  </div>
                </label>
              ))}
            </div>

            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Settling…' : 'Settle bet'}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
