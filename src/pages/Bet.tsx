import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAppShell } from '../lib/app-shell.js';
import type { BetDetail } from '../lib/types.js';

export default function Bet() {
  const { bootstrap } = useAppShell();
  const params = useParams();
  const betId = Number(params.betId);
  const currentUserId = bootstrap.currentUser.id;
  const [bet, setBet] = useState<BetDetail | null>(null);
  const [customOptionLabel, setCustomOptionLabel] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyOptionId, setBusyOptionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadBet() {
    if (!Number.isInteger(betId) || betId <= 0) {
      return;
    }

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

  useEffect(() => {
    void loadBet();
  }, [betId]);

  const myCurrentOptionId = bet?.myPick?.optionId ?? null;
  const isCreator = bet?.createdBy === currentUserId;
  const winningOption = bet?.options.find((option) => option.id === bet.winnerOptionId) ?? null;

  const visibleParticipantPicks = useMemo(() => {
    if (!bet) {
      return [];
    }

    return bet.picks.filter((pick) => pick.optionId !== null);
  }, [bet]);

  async function handlePick(optionId: number) {
    setBusyOptionId(optionId);
    setError(null);

    try {
      await api.joinBet(betId);
      await api.submitPick(betId, { optionId });
      await loadBet();
    } catch (pickError) {
      setError(pickError instanceof Error ? pickError.message : 'Could not submit your pick.');
    } finally {
      setBusyOptionId(null);
    }
  }

  async function handleAddCustomOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customOptionLabel.trim()) {
      return;
    }

    setError(null);

    try {
      const option = await api.addCustomOption(betId, { label: customOptionLabel });
      setCustomOptionLabel('');
      await handlePick(option.id);
    } catch (optionError) {
      setError(optionError instanceof Error ? optionError.message : 'Could not add custom option.');
    }
  }

  return (
    <div className="stack">
      {loading ? <div className="card muted">Loading bet…</div> : null}
      {error ? <div className="card error">{error}</div> : null}

      {bet ? (
        <>
          <section className="card stack">
            <div className="row">
              <div>
                <h1 className="page-title">{bet.title}</h1>
                <p className="muted">{bet.description || 'No description provided.'}</p>
              </div>
              <span className="pill pill-accent">{bet.status}</span>
            </div>

            <div className="meta">
              <span className="pill">{bet.type === 'yes_no' ? 'Yes / No' : 'Open value'}</span>
              <span className="pill">{bet.blind ? 'Blind mode' : 'Open picks'}</span>
              <span className="pill">{bet.participantCount} participants</span>
            </div>

            {bet.blind && bet.status === 'open' && !isCreator ? (
              <div className="list-item">
                <strong>Blind bet is active.</strong>
                <div className="muted">
                  You can see your own pick, but not anyone else’s until the creator settles this bet.
                </div>
              </div>
            ) : null}

            {bet.hiddenUserIds.length > 0 ? (
              <div className="list-item">
                <strong>Hidden from user IDs:</strong> {bet.hiddenUserIds.join(', ')}
              </div>
            ) : null}
          </section>

          <section className="card stack">
            <div>
              <h2 className="section-title">Pick your side</h2>
              <p className="muted">Joining and picking are combined in the mobile flow.</p>
            </div>

            <div className="list">
              {bet.options.map((option) => {
                const isActive = myCurrentOptionId === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`option-tile${isActive ? ' active' : ''}`}
                    disabled={bet.status === 'settled' || busyOptionId === option.id}
                    onClick={() => void handlePick(option.id)}
                  >
                    <div style={{ flex: 1 }}>
                      <strong>{option.label}</strong>
                      <div className="muted">
                        {option.isCustom ? 'Custom option' : 'Standard option'}
                        {typeof option.pickCount === 'number' ? ` · ${option.pickCount} picks` : ''}
                      </div>
                    </div>
                    {isActive ? <span className="pill pill-accent">Your pick</span> : null}
                  </button>
                );
              })}
            </div>

            {bet.type === 'open_value' && bet.status === 'open' ? (
              <form className="stack" onSubmit={handleAddCustomOption}>
                <div className="field">
                  <label htmlFor="custom-option">Add your own option</label>
                  <input
                    id="custom-option"
                    className="input"
                    placeholder="20:05"
                    value={customOptionLabel}
                    onChange={(event) => setCustomOptionLabel(event.target.value)}
                  />
                </div>
                <button className="button-secondary" type="submit">
                  Add option and pick it
                </button>
              </form>
            ) : null}
          </section>

          <section className="card stack">
            <div className="row">
              <div>
                <h2 className="section-title">Visible picks</h2>
                <p className="muted">
                  Blind mode is enforced by the API, so this list only contains what the current user is allowed to
                  see.
                </p>
              </div>
              {bet.canSettle ? (
                <Link className="button" to={`/bets/${bet.id}/settle`}>
                  Settle bet
                </Link>
              ) : null}
            </div>

            {visibleParticipantPicks.length === 0 ? (
              <div className="empty-state">No visible picks yet.</div>
            ) : (
              <div className="list">
                {visibleParticipantPicks.map((pick) => {
                  const option = bet.options.find((entry) => entry.id === pick.optionId);
                  const isWinner = bet.status === 'settled' && pick.optionId === bet.winnerOptionId;

                  return (
                    <div key={pick.id} className="list-item row">
                      <div>
                        <strong>{pick.displayName}</strong>
                        <div className="muted">{option?.label ?? 'No pick selected yet'}</div>
                      </div>
                      {isWinner ? <span className="pill pill-accent">Winner</span> : null}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {bet.status === 'settled' && bet.settlement ? (
            <section className="card stack">
              <div>
                <h2 className="section-title">Settlement</h2>
                <p className="muted">Full picks are revealed after settlement, including blind bets.</p>
              </div>

              <div className="meta">
                <span className="pill pill-accent">Winner: {winningOption?.label ?? 'Unknown option'}</span>
                <span className="pill">{bet.settlement.totalPot} in the pot</span>
                <span className="pill">{bet.settlement.winnerCount} winners</span>
                <span className="pill">
                  {bet.settlement.payoutPerWinner === null
                    ? 'No winning picks'
                    : `${bet.settlement.payoutPerWinner.toFixed(2)} each`}
                </span>
              </div>

              {bet.winners.length === 0 ? (
                <div className="empty-state">Nobody picked the winning option.</div>
              ) : (
                <div className="list">
                  {bet.winners.map((winner) => (
                    <div key={winner.id} className="list-item row">
                      <div>
                        <strong>{winner.displayName}</strong>
                        <div className="muted">{winningOption?.label ?? 'Winning option'}</div>
                      </div>
                      <span className="pill pill-accent">Winner</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
