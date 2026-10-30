import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input } from './ui';
import { colors, spacing } from '../constants/theme';
import { OPENING_DAYS } from '../constants/openingHours';
import type { OpeningHours, OpeningHoursDay } from '../types/database';

const DAY_KEYS: Record<(typeof OPENING_DAYS)[number], string> = {
  mon: 'dayMon',
  tue: 'dayTue',
  wed: 'dayWed',
  thu: 'dayThu',
  fri: 'dayFri',
  sat: 'daySat',
  sun: 'daySun',
};

export function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: OpeningHours;
  onChange: (next: OpeningHours) => void;
}) {
  const { t } = useTranslation();

  const patchDay = (day: (typeof OPENING_DAYS)[number], patch: Partial<OpeningHoursDay>) => {
    onChange({
      ...value,
      [day]: { ...value[day], ...patch },
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('openingHours')}</Text>
      {OPENING_DAYS.map((day) => {
        const d = value[day];
        const closed = d.closed === true;
        return (
          <View key={day} style={styles.row}>
            <View style={styles.dayCol}>
              <Text style={styles.dayLabel}>{t(DAY_KEYS[day])}</Text>
              <View style={styles.closedRow}>
                <Text style={styles.closedLabel}>{t('closedToday')}</Text>
                <Switch
                  value={closed}
                  onValueChange={(v) => patchDay(day, { closed: v })}
                  trackColor={{ true: colors.border, false: colors.primarySoft }}
                  thumbColor={closed ? colors.textMuted : colors.primary}
                />
              </View>
            </View>
            {!closed ? (
              <View style={styles.times}>
                <Input
                  label={t('openTime')}
                  value={d.open}
                  onChangeText={(open) => patchDay(day, { open })}
                  placeholder="08:00"
                  containerStyle={styles.timeInput}
                />
                <Input
                  label={t('closeTime')}
                  value={d.close}
                  onChangeText={(close) => patchDay(day, { close })}
                  placeholder="21:00"
                  containerStyle={styles.timeInput}
                />
              </View>
            ) : (
              <Pressable onPress={() => patchDay(day, { closed: false })}>
                <Text style={styles.closedBadge}>{t('closedToday')}</Text>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginVertical: spacing.md },
  title: {
    fontWeight: '700',
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  dayCol: { marginBottom: spacing.xs },
  dayLabel: { fontWeight: '800', fontSize: 16, color: colors.text },
  closedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  closedLabel: { color: colors.textMuted, fontSize: 13 },
  times: { flexDirection: 'row', gap: 8 },
  timeInput: { flex: 1, marginBottom: 0 },
  closedBadge: {
    color: colors.textMuted,
    fontWeight: '600',
    paddingVertical: spacing.sm,
  },
});
