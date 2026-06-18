import { NativeModules, Platform } from "react-native";

const { GaytakCall } = NativeModules;

interface RideData {
  rideId: string;
  fromAddress: string;
  toAddress: string;
  price: string;
}

export function showIncomingCall(data: RideData) {
  if (Platform.OS === "android" && GaytakCall) {
    GaytakCall.showIncomingCall(data);
  }
}
