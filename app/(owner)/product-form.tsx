import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Button, Input } from '../../src/components/ui';
import { colors, spacing } from '../../src/constants/theme';
import { supabase } from '../../src/lib/supabase';
import { upsertProduct } from '../../src/lib/api';
import { productPhotoPath, uploadImageFromUri } from '../../src/lib/storage';
import { useAuthStore } from '../../src/stores/authStore';

export default function ProductForm() {
  const { t } = useTranslation();
  const { id, catalogName, catalogMrp, catalogUnit, catalogId, barcode } =
    useLocalSearchParams<{
      id?: string;
      catalogName?: string;
      catalogMrp?: string;
      catalogUnit?: string;
      catalogId?: string;
      barcode?: string;
    }>();
  const store = useAuthStore((s) => s.store);
  const user = useAuthStore((s) => s.user);
  const [name, setName] = useState(catalogName ?? '');
  const [mrp, setMrp] = useState(catalogMrp ?? '');
  const [price, setPrice] = useState(catalogMrp ?? '');
  const [unit, setUnit] = useState(catalogUnit ?? 'pcs');
  const [category, setCategory] = useState('other');
  const [code, setCode] = useState(barcode ?? '');
  const [discount, setDiscount] = useState('0');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    void supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setName(data.name);
        setMrp(String(data.mrp));
        setPrice(String(data.selling_price));
        setUnit(data.unit);
        setCategory(data.category ?? 'other');
        setCode(data.barcode ?? '');
        setDiscount(String(data.discount_pct ?? 0));
        if (data.photo_url) setPhotoUri(data.photo_url);
      });
  }, [id]);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  };

  const onSave = async () => {
    if (!store || !name.trim() || !mrp || !price) {
      Alert.alert(t('required'));
      return;
    }
    const mrpN = parseFloat(mrp);
    let sell = parseFloat(price);
    const disc = parseFloat(discount) || 0;
    if (disc > 0) sell = Math.round(mrpN * (1 - disc / 100) * 100) / 100;

    setLoading(true);
    const { data: saved, error } = await upsertProduct({
      ...(id ? { id } : {}),
      store_id: store.id,
      catalog_id: catalogId || null,
      name: name.trim(),
      mrp: mrpN,
      selling_price: sell,
      discount_pct: disc,
      unit,
      category,
      barcode: code || null,
      stock_status: 'in_stock',
      is_active: true,
    });

    if (error || !saved) {
      setLoading(false);
      Alert.alert(t('error'), error?.message);
      return;
    }

    if (photoUri && user && !photoUri.startsWith('http')) {
      const { publicUrl, error: upErr } = await uploadImageFromUri(
        photoUri,
        'product-photos',
        productPhotoPath(user.id, store.id, saved.id)
      );
      if (upErr) Alert.alert(t('error'), upErr);
      else if (publicUrl) {
        await supabase.from('products').update({ photo_url: publicUrl }).eq('id', saved.id);
      }
    }

    setLoading(false);
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Input label={t('productName')} value={name} onChangeText={setName} />
      <Input label={t('mrp')} value={mrp} onChangeText={setMrp} keyboardType="decimal-pad" />
      <Input
        label={t('sellingPrice')}
        value={price}
        onChangeText={setPrice}
        keyboardType="decimal-pad"
      />
      <Input
        label={t('discount')}
        value={discount}
        onChangeText={setDiscount}
        keyboardType="decimal-pad"
      />
      <Input label={t('unit')} value={unit} onChangeText={setUnit} />
      <Input label={t('category')} value={category} onChangeText={setCategory} />
      <Input label="Barcode" value={code} onChangeText={setCode} />
      <Button
        title={photoUri ? '✓ ' + t('productPhoto') : t('productPhoto')}
        variant="ghost"
        onPress={pickPhoto}
      />
      <View style={{ height: spacing.md }} />
      <Button title={t('save')} onPress={onSave} loading={loading} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg },
});
