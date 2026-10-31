import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

export type OptimizedListProps<T> = FlashListProps<T> & {
  estimatedItemSize: number;
  style?: StyleProp<ViewStyle>;
  /** Wrap list when parent is not already flex:1 (FlashList needs bounded height). */
  flex?: boolean;
  containerStyle?: ViewStyle;
};

/**
 * FlashList wrapper with sensible defaults for iOS and Android scroll performance.
 */
export function OptimizedList<T>({
  flex = true,
  containerStyle,
  contentContainerStyle,
  style,
  ...props
}: OptimizedListProps<T>) {
  const list = (
    <FlashList
      {...props}
      style={
        StyleSheet.flatten([flex ? styles.flex : undefined, style]) ?? undefined
      }
      contentContainerStyle={contentContainerStyle}
      removeClippedSubviews={Platform.OS === 'android'}
      drawDistance={250}
    />
  );

  if (!flex) return list;

  return <View style={[styles.flex, containerStyle]}>{list}</View>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
