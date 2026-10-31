import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { OptimizedList } from '../../src/components/OptimizedList';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { formatINR } from '../../src/lib/format';
import {
  fetchLedger,
  recordKhataPayment,
  upsertKhataAccount,
} from '../../src/lib/api';
import { supabase } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/authStore';
import type { KhataAccount, KhataLedgerEntry } from '../../src/types/database';
import { notifyLocal } from '../../src/lib/notifications';

export default function KhataDetail() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const [account, setAccount] = useState<KhataAccount | null>(null);
  const [ledger, setLedger] = useState<KhataLedgerEntry[]>([]);
  const [amount, setAmount] = useState('');
  const [limit, setLimit] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(() => {
    if (!id) return;
    void supabase
      .from('khata_accounts')
      .select('*, customer:users(id,full_name,phone)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          setAccount(data as KhataAccount);
          setLimit(String(data.credit_limit));
        }
      });
    void fetchLedger(id).then(({ data }) => setLedger(data));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!account || !user) return <View style={styles.screen} />;

  const customer = account.customer as { full_name?: string; phone?: string } | undefined;

  return (
    <OptimizedList
      flex
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={ledger}
      estimatedItemSize={64}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.name}>
            {customer?.full_name || customer?.phone}
          </Text>
          <Text style={styles.balance}>
            {t('creditBalance')}: {formatINR(Number(account.balance))}
          </Text>

          <Input
            label={t('creditLimit')}
            value={limit}
            onChangeText={setLimit}
            keyboardType="decimal-pad"
          />
          <Button
            title={t('setCreditLimit')}
            variant="secondary"
            large={false}
            onPress={async () => {
              await upsertKhataAccount({
                store_id: account.store_id,
                customer_id: account.customer_id,
                credit_limit: parseFloat(limit) || 0,
                is_enabled: true,
              });
              load();
            }}
          />

          <View style={{ height: spacing.md }} />
          <Input
            label={t('recordPayment')}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t('amount')}
          />
          <Input label={t('note')} value={note} onChangeText={setNote} />
          <Button
            title={t('recordPayment')}
            onPress={async () => {
              const amt = parseFloat(amount);
              if (!amt) return Alert.alert(t('required'));
              const { error } = await recordKhataPayment({
                account_id: account.id,
                store_id: account.store_id,
                customer_id: account.customer_id,
                amount: amt,
                method: 'upi',
                note,
                created_by: user.id,
              });
              if (error) Alert.alert(t('error'), error.message);
              else {
                setAmount('');
                setNote('');
                load();
              }
            }}
          />
          <View style={{ height: spacing.sm }} />
          <Button
            title={t('sendReminder')}
            variant="ghost"
            onPress={async () => {
              await notifyLocal(
                t('khataTitle'),
                `${customer?.full_name || ''}: ${formatINR(Number(account.balance))}`
              );
              await supabase
                .from('khata_accounts')
                .update({ last_reminder_at: new Date().toISOString() })
                .eq('id', account.id);
              Alert.alert(t('success'));
            }}
          />
          <Text style={styles.history}>{t('paymentHistory')}</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.entry}>
          <View>
            <Text style={styles.entryType}>
              {item.entry_type === 'debit' ? '−' : '+'} {formatINR(Number(item.amount))}
            </Text>
            <Text style={styles.entryNote}>{item.note}</Text>
          </View>
          <Text style={styles.entryDate}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
  name: { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  balance: { fontSize: 18, fontWeight: '700', color: colors.accent, marginBottom: spacing.lg },
  history: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
    fontWeight: '700',
    fontSize: 16,
  },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryType: { fontWeight: '700', fontSize: 16 },
  entryNote: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  entryDate: { color: colors.textMuted, fontSize: 12 },
});
