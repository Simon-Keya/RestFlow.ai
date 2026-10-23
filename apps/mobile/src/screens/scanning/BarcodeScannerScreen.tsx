// apps/mobile/src/screens/scanning/BarcodeScannerScreen.tsx
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  CameraView,
  useCameraPermissions,
  BarcodeScanningResult,
} from 'expo-camera';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, spacing } from '../../lib/theme';

type RootStackParamList = {
  Receive: { scannedItemId?: string };
  BarcodeScanner: undefined;
};

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'BarcodeScanner'
>;

export default function BarcodeScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);

    const data = result.data;

    Alert.alert('Barcode Scanned', `Data: ${data}`, [
      {
        text: 'Use This',
        onPress: () => {
          navigation.navigate('Receive', { scannedItemId: data });
          setScanned(false);
        },
      },
      {
        text: 'Scan Again',
        onPress: () => setScanned(false),
      },
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          setScanned(false);
          navigation.goBack();
        },
      },
    ]);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Checking camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>
          Camera access is required to scan barcodes.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.buttonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: [
            'qr',
            'ean13',
            'ean8',
            'code128',
            'code39',
            'upc_a',
            'upc_e',
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={styles.overlay}>
        <View style={styles.scannerFrame} />
        <Text style={styles.instruction}>
          Align barcode or QR code inside the frame
        </Text>
      </View>

      {scanned && (
        <View style={styles.rescanContainer}>
          <TouchableOpacity
            style={styles.rescanButton}
            onPress={() => setScanned(false)}
          >
            <Text style={styles.rescanButtonText}>Scan Again</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
    fontSize: 16,
  },
  errorText: {
    color: colors.danger,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scannerFrame: {
    width: 280,
    height: 280,
    borderWidth: 4,
    borderColor: colors.success,
    borderRadius: 16,
  },
  instruction: {
    color: '#fff',
    fontSize: 17,
    marginTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    textAlign: 'center',
  },
  rescanContainer: {
    position: 'absolute',
    bottom: spacing.xl * 1.5,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rescanButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 1.5,
    borderRadius: 30,
  },
  rescanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    marginTop: spacing.md,
  },
  secondaryButton: {
    backgroundColor: colors.textSecondary,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});