// apps/mobile/src/components/kitchen/TimerDisplay.tsx
import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { colors, typography } from '../../lib/theme';

type Props = {
  startedAt: string;
};

export default function TimerDisplay({ startedAt }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const start = new Date(startedAt).getTime();
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  const isLate = minutes >= 15;

  return (
    <Text style={[styles.timer, isLate && styles.late]}>
      ⏱ {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      {isLate ? '  (LATE)' : ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  timer: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 4,
  },
  late: {
    color: colors.danger,
    fontWeight: '700',
  },
});