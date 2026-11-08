-- Correct only synthetic fixtures for the forex and cryptocurrency market scope.
-- Real broker history is never rewritten by this migration.
UPDATE sim_positions
SET symbol = 'AUDUSD', description = 'Australian Dollar / US Dollar', entry = 0.65318,
    market = CASE id WHEN 'sim-position-0-2' THEN 0.65948 ELSE 0.65428 END
WHERE id IN ('sim-position-0-2', 'sim-position-2-1') AND symbol = 'XAUUSD';

UPDATE sim_commands
SET symbol = 'BTCUSD'
WHERE id IN ('sim-command-0-rejected', 'sim-command-1-rejected', 'sim-command-2-rejected', 'sim-command-history-rejected')
  AND symbol = 'XAUUSD';

UPDATE sim_trade_history
SET symbol = 'AUDUSD', average_entry_price = 0.65318, average_exit_price = 0.64718,
    original_stop = 0.64838, target = 0.66278, requested_price = 0.65318,
    fills_json = json_set(fills_json, '$[0].price', 0.65318, '$[1].price', 0.64718),
    facts_json = json_set(facts_json, '$[0].detail', 'Manual close recorded at 0.64718.')
WHERE id = 'sim-outcome-manual-loss-v1' AND version = 1 AND environment = 'SIMULATED' AND symbol = 'XAUUSD';

UPDATE sim_trade_history
SET symbol = 'BTCUSD', strategy = 'Session pullback', requested_price = 65000.00
WHERE id = 'sim-outcome-rejected-v1' AND version = 1 AND environment = 'SIMULATED' AND symbol = 'XAUUSD';
