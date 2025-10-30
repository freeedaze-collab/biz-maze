// 省略: 先頭の import, 型などはそのまま
// ...
  const classify = async () => {
    setClassifying(true);
    try {
      await supabase.functions.invoke("classify-usage", { body: {} });
    } catch (e) {
      console.warn("classify error:", e);
    } finally {
      await load();
      setClassifying(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      await supabase.functions.invoke("sync-wallet-transactions", { body: {} });
    } catch (e) {
      console.warn("sync error:", e);
    } finally {
      await load();
      setSyncing(false);
    }
  };

  const onChangeUsage = async (txId: number, key: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("transaction_usage_labels")
      .upsert({ tx_id: txId, user_id: user.id, confirmed_key: key }, { onConflict: "user_id,tx_id" });
    if (error) { console.warn("label save error:", error); return; }

    try {
      await supabase.functions.invoke("generate-journal-entries", { body: { tx_ids: [txId] } });
    } catch (e) {
      console.warn("generate error:", e);
    }
    await load();
  };
// ...
