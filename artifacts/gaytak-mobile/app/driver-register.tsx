import { useAuth } from "@/contexts/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;

const VEHICLE_TYPES = [
  { id: "car", label: "\u0633\u064a\u0627\u0631\u0629" },
  { id: "van", label: "\u0641\u0627\u0646" },
  { id: "bike", label: "\u062f\u0631\u0627\u062c\u0629" },
];

export default function DriverRegisterScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();

  const [step, setStep] = useState(1);
  const [vehicleType, setVehicleType] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [vehicleColor, setVehicleColor] = useState("");

  const [licenseImage, setLicenseImage] = useState<string | null>(null);
  const [idCardImage, setIdCardImage] = useState<string | null>(null);
  const [vehicleDocImage, setVehicleDocImage] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function pickImage(setter: (uri: string) => void) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("\u0627\u0644\u0625\u0630\u0646 \u0645\u0637\u0644\u0648\u0628", "\u0646\u062d\u062a\u0627\u062c \u0625\u0630\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0645\u0639\u0631\u0636 \u0627\u0644\u0635\u0648\u0631");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 720 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (compressed.base64) {
        setter(`data:image/jpeg;base64,${compressed.base64}`);
      }
    }
  }

  async function uploadToServer(base64Image: string, docType: string): Promise<string> {
    const res = await fetch(`https://${DOMAIN}/api/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        base64: base64Image,
        path: `drivers/${user?.id}/${docType}_${Date.now()}.jpg`,
        contentType: "image/jpeg",
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.url) throw new Error(data.error || "Upload failed");
    return data.url;
  }

  async function handleSubmit() {
    if (!vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor) {
      Alert.alert("\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0646\u0627\u0642\u0635\u0629", "\u0623\u0643\u0645\u0644 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u0643\u0628\u0629");
      return;
    }
    if (!licenseImage || !idCardImage) {
      Alert.alert("\u0648\u062b\u0627\u0626\u0642 \u0646\u0627\u0642\u0635\u0629", "\u0627\u0631\u0641\u0639 \u0631\u062e\u0635\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629 \u0648\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0647\u0648\u064a\u0629");
      return;
    }
    if (!token) {
      Alert.alert("\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0637\u0644\u0648\u0628");
      return;
    }

    setSubmitting(true);
    setUploading(true);
    try {
      const [licenseUrl, idCardUrl, vehicleDocUrl] = await Promise.all([
        uploadToServer(licenseImage, "license"),
        uploadToServer(idCardImage, "id"),
        vehicleDocImage ? uploadToServer(vehicleDocImage, "vehicle") : Promise.resolve(null),
      ]);
      setUploading(false);

      const res = await fetch(`https://${DOMAIN}/api/driver/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          vehicleType,
          vehicleModel,
          vehiclePlate,
          vehicleColor,
          licenseImage: licenseUrl,
          idCardImage: idCardUrl,
          vehicleDocImage: vehicleDocUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        Alert.alert("\u2705 \u062a\u0645 \u0627\u0644\u062a\u0633\u062c\u064a\u0644!", "\u0648\u062b\u0627\u0626\u0642\u0643 \u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629. \u0633\u064a\u062a\u0645 \u062a\u0641\u0639\u064a\u0644 \u062d\u0633\u0627\u0628\u0643 \u0628\u0639\u062f \u0627\u0644\u062a\u062d\u0642\u0642.");
        router.back();
      } else {
        Alert.alert("\u062e\u0637\u0623", data.error || "\u0641\u0634\u0644 \u0627\u0644\u062a\u0633\u062c\u064a\u0644");
      }
    } catch (e: any) {
      Alert.alert("\u062e\u0637\u0623", e.message || "\u062a\u0639\u0630\u0631 \u0627\u0644\u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u062e\u0627\u062f\u0645");
    }
    setSubmitting(false);
    setUploading(false);
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-right" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          \u062a\u0633\u062c\u064a\u0644 \u0643\u0633\u0627\u0626\u0642
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        {/* Step indicator */}
        <View style={styles.stepRow}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.stepBar,
                { backgroundColor: s <= step ? colors.primary : colors.muted },
              ]}
            />
          ))}
        </View>

        {/* Step 1: Vehicle Info */}
        {step === 1 && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u0645\u0631\u0643\u0628\u0629
            </Text>

            <Text style={[styles.label, { color: colors.mutedForeground }]}>\u0646\u0648\u0639 \u0627\u0644\u0645\u0631\u0643\u0628\u0629</Text>
            <View style={styles.typeRow}>
              {VEHICLE_TYPES.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => {
                    setVehicleType(v.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[
                    styles.typeBtn,
                    {
                      backgroundColor: vehicleType === v.id ? colors.primary + "20" : colors.input,
                      borderColor: vehicleType === v.id ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: vehicleType === v.id ? colors.primary : colors.text, fontWeight: "700" }}>
                    {v.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>\u0627\u0644\u0645\u0648\u062f\u064a\u0644</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="\u0645\u062b\u0627\u0644: Peugeot 301"
              placeholderTextColor={colors.mutedForeground}
              value={vehicleModel}
              onChangeText={setVehicleModel}
            />

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>\u0627\u0644\u0644\u0648\u0646</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="\u0645\u062b\u0627\u0644: \u0623\u0628\u064a\u0636"
              placeholderTextColor={colors.mutedForeground}
              value={vehicleColor}
              onChangeText={setVehicleColor}
            />

            <Text style={[styles.label, { color: colors.mutedForeground, marginTop: 16 }]}>\u0631\u0642\u0645 \u0627\u0644\u0644\u0648\u062d\u0629</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text, borderColor: colors.border }]}
              placeholder="\u0645\u062b\u0627\u0644: 12345-06-16"
              placeholderTextColor={colors.mutedForeground}
              value={vehiclePlate}
              onChangeText={setVehiclePlate}
            />

            <TouchableOpacity
              onPress={() => setStep(2)}
              disabled={!vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor}
              style={[styles.nextBtn, { backgroundColor: colors.primary, opacity: !vehicleType || !vehicleModel || !vehiclePlate || !vehicleColor ? 0.5 : 1 }]}
            >
              <Text style={styles.nextText}>\u0627\u0644\u062a\u0627\u0644\u064a</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Documents */}
        {step === 2 && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              \u0627\u0644\u0648\u062b\u0627\u0626\u0642 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629
            </Text>

            {/* License */}
            <TouchableOpacity
              onPress={() => pickImage(setLicenseImage)}
              style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.docHeader}>
                <Feather name="credit-card" size={18} color={colors.primary} />
                <Text style={[styles.docTitle, { color: colors.text }]}>\u0631\u062e\u0635\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629</Text>
                <View style={[styles.badge, { backgroundColor: "#FF333320" }]}>
                  <Text style={[styles.badgeText, { color: "#FF3333" }]}>\u0645\u0637\u0644\u0648\u0628</Text>
                </View>
              </View>
              {licenseImage ? (
                <Image source={{ uri: licenseImage }} style={styles.docImage} contentFit="cover" />
              ) : (
                <View style={[styles.docPlaceholder, { borderColor: colors.border }]}>
                  <Feather name="upload" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.docPlaceholderText, { color: colors.mutedForeground }]}>
                    \u0627\u0636\u063a\u0637 \u0644\u0631\u0641\u0639 \u0635\u0648\u0631\u0629
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ID Card */}
            <TouchableOpacity
              onPress={() => pickImage(setIdCardImage)}
              style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.docHeader}>
                <Feather name="file-text" size={18} color={colors.primary} />
                <Text style={[styles.docTitle, { color: colors.text }]}>\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0647\u0648\u064a\u0629</Text>
                <View style={[styles.badge, { backgroundColor: "#FF333320" }]}>
                  <Text style={[styles.badgeText, { color: "#FF3333" }]}>\u0645\u0637\u0644\u0648\u0628</Text>
                </View>
              </View>
              {idCardImage ? (
                <Image source={{ uri: idCardImage }} style={styles.docImage} contentFit="cover" />
              ) : (
                <View style={[styles.docPlaceholder, { borderColor: colors.border }]}>
                  <Feather name="upload" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.docPlaceholderText, { color: colors.mutedForeground }]}>
                    \u0627\u0636\u063a\u0637 \u0644\u0631\u0641\u0639 \u0635\u0648\u0631\u0629
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Vehicle Doc (optional) */}
            <TouchableOpacity
              onPress={() => pickImage(setVehicleDocImage)}
              style={[styles.docCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={styles.docHeader}>
                <Feather name="camera" size={18} color={colors.primary} />
                <Text style={[styles.docTitle, { color: colors.text }]}>\u0631\u062e\u0635\u0629 \u0627\u0644\u0633\u064a\u0631</Text>
                <View style={[styles.badge, { backgroundColor: colors.muted + "40" }]}>
                  <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>\u0627\u062e\u062a\u064a\u0627\u0631\u064a</Text>
                </View>
              </View>
              {vehicleDocImage ? (
                <Image source={{ uri: vehicleDocImage }} style={styles.docImage} contentFit="cover" />
              ) : (
                <View style={[styles.docPlaceholder, { borderColor: colors.border }]}>
                  <Feather name="upload" size={24} color={colors.mutedForeground} />
                  <Text style={[styles.docPlaceholderText, { color: colors.mutedForeground }]}>
                    \u0627\u0636\u063a\u0637 \u0644\u0631\u0641\u0639 \u0635\u0648\u0631\u0629
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => setStep(1)} style={[styles.backBtn, { borderColor: colors.border }]}>
                <Text style={[styles.backText, { color: colors.text }]}>\u0631\u062c\u0648\u0639</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setStep(3)}
                disabled={!licenseImage || !idCardImage}
                style={[styles.nextBtn, { backgroundColor: colors.primary, opacity: !licenseImage || !idCardImage ? 0.5 : 1 }]}
              >
                <Text style={styles.nextText}>\u0627\u0644\u062a\u0627\u0644\u064a</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u062a\u0633\u062c\u064a\u0644
            </Text>

            <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>\u0646\u0648\u0639 \u0627\u0644\u0645\u0631\u0643\u0628\u0629</Text>
                <Text style={[styles.reviewValue, { color: colors.text }]}>
                  {VEHICLE_TYPES.find((v) => v.id === vehicleType)?.label}
                </Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>\u0627\u0644\u0645\u0648\u062f\u064a\u0644</Text>
                <Text style={[styles.reviewValue, { color: colors.text }]}>{vehicleModel}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>\u0627\u0644\u0644\u0648\u0646</Text>
                <Text style={[styles.reviewValue, { color: colors.text }]}>{vehicleColor}</Text>
              </View>
              <View style={styles.reviewRow}>
                <Text style={[styles.reviewLabel, { color: colors.mutedForeground }]}>\u0631\u0642\u0645 \u0627\u0644\u0644\u0648\u062d\u0629</Text>
                <Text style={[styles.reviewValue, { color: colors.text }]}>{vehiclePlate}</Text>
              </View>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.reviewRow}>
                <Feather name="check-circle" size={14} color="#00CC66" />
                <Text style={[styles.reviewValue, { color: colors.text }]}>\u0631\u062e\u0635\u0629 \u0627\u0644\u0642\u064a\u0627\u062f\u0629: \u0645\u0631\u0641\u0642\u0629</Text>
              </View>
              <View style={styles.reviewRow}>
                <Feather name="check-circle" size={14} color="#00CC66" />
                <Text style={[styles.reviewValue, { color: colors.text }]}>\u0628\u0637\u0627\u0642\u0629 \u0627\u0644\u0647\u0648\u064a\u0629: \u0645\u0631\u0641\u0642\u0629</Text>
              </View>
              {vehicleDocImage && (
                <View style={styles.reviewRow}>
                  <Feather name="check-circle" size={14} color="#00CC66" />
                  <Text style={[styles.reviewValue, { color: colors.text }]}>\u0631\u062e\u0635\u0629 \u0627\u0644\u0633\u064a\u0631: \u0645\u0631\u0641\u0642\u0629</Text>
                </View>
              )}
            </View>

            <View style={[styles.warningBox, { backgroundColor: "#FFAA0020", borderColor: "#FFAA0040" }]}>
              <Feather name="alert-triangle" size={16} color="#FFAA00" />
              <Text style={[styles.warningText, { color: "#FFAA00" }]}>
                \u0633\u064a\u062a\u0645 \u0645\u0631\u0627\u062c\u0639\u0629 \u0648\u062b\u0627\u0626\u0642\u0643 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062f\u0627\u0631\u0629. \u0642\u062f \u064a\u0633\u062a\u063a\u0631\u0642 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0633\u0627\u0639\u0629 \u0625\u0644\u0649 24 \u0633\u0627\u0639\u0629.
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity onPress={() => setStep(2)} style={[styles.backBtn, { borderColor: colors.border }]}>
                <Text style={[styles.backText, { color: colors.text }]}>\u0631\u062c\u0648\u0639</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || uploading}
                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: submitting || uploading ? 0.6 : 1 }]}
              >
                {uploading ? (
                  <ActivityIndicator color="#FFF" />
                ) : submitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.submitText}>\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0633\u062c\u064a\u0644</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  content: { flex: 1 },
  stepRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  stepBar: { flex: 1, height: 4, borderRadius: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 20 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 8 },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  typeRow: { flexDirection: "row", gap: 8 },
  typeBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  nextBtn: {
    marginTop: 24,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  nextText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
  docCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  docHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  docTitle: { flex: 1, fontSize: 14, fontWeight: "700" },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  docImage: { width: "100%", height: 160, borderRadius: 10 },
  docPlaceholder: {
    width: "100%",
    height: 120,
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  docPlaceholderText: { fontSize: 12 },
  buttonRow: { flexDirection: "row", gap: 12, marginTop: 20 },
  backText: { fontSize: 14, fontWeight: "700" },
  reviewCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  reviewLabel: { fontSize: 13 },
  reviewValue: { fontSize: 13, fontWeight: "700" },
  divider: { height: 1, marginVertical: 8 },
  warningBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  warningText: { flex: 1, fontSize: 12, lineHeight: 18 },
  submitBtn: {
    flex: 2,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitText: { color: "#FFF", fontSize: 16, fontWeight: "700" },
});
