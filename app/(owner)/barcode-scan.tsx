import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { findCatalogByBarcode } from '../../src/lib/api';

export default function BarcodeScan() {
  const { t, i18n } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  if (!permission) return <View style={styles.screen} />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.msg}>Camera permission needed for barcode scan</Text>
        <Button title={t('continue')} onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'qr'],
        }}
        onBarcodeScanned={async ({ data }) => {
          if (locked) return;
          setLocked(true);
          const item = await findCatalogByBarcode(data);
          if (item) {
            const name = i18n.language === 'hi' ? item.name_hi : item.name_en;
            router.replace({
              pathname: '/(owner)/product-form',
              params: {
                catalogId: item.id,
                catalogName: name,
                catalogMrp: String(item.default_mrp ?? ''),
                catalogUnit: item.unit,
                barcode: data,
              },
            });
          } else {
            router.replace({
              pathname: '/(owner)/product-form',
              params: { barcode: data },
            });
          }
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.hint}>{t('scanBarcode')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.black },
  camera: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.bg,
  },
  msg: { marginBottom: spacing.lg, textAlign: 'center', color: colors.text },
  overlay: {
    position: 'absolute',
    bottom: 48,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hint: {
    backgroundColor: colors.overlay,
    color: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    fontWeight: '700',
  },
});
