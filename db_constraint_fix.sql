-- 現状の制約を削除して、アセットやインデックスを含めた新しい制約を作成します。
-- これにより、同じトランザクション内での複数トークンの移動が記録可能になります。

-- 1. 古い制約の削除（インデックス名も含む可能性があるので念のため両方）
ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_composite_key;
DROP INDEX IF EXISTS wallet_transactions_composite_key;

-- 2. 新しい、より柔軟な制約の作成
-- user_id, tx_hash, chain, asset, direction, log_index の組み合わせをユニークにします。
ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_composite_key 
UNIQUE (user_id, tx_hash, chain, asset, direction, log_index);
