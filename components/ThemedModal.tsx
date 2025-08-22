import { useTheme } from "@/contexts/settingProvider";
import { useEffect, useState } from "react";
import { Modal, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { ThemedText } from "./ThemedText";

type ModalType = "confirm" | "prompt";

interface ModalProps  {
    visible: boolean;
    type: ModalType | 'custom';
    title?: string;
    message?: string;
    placeholder?: string; // used for prompt
    confirmText?: string;
    cancelText?: string;
    onConfirm?: (value?: string) => void;
    onCancel?: () => void;
    customContent?: React.ReactNode;
    style?: {
        container?: object;
        title?: object;
        message?: object;
        input?: object;
        button?: object;
        confirmButton?: object;
        cancelButton?: object;
        buttonText?: object;
    };
}

export const ThemedModal = ({
visible,
type,
title,
message,
placeholder,
confirmText = "OK",
cancelText = "Cancel",
onConfirm,
onCancel,
customContent,
style = {},
}: ModalProps) => {

    const [value,setValue] = useState('');
    const { colors } = useTheme()
    
    useEffect(()=> {
        if(!visible) setValue('');
    }, [visible]);

    return(
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.container, {backgroundColor: colors.bg}, style.container]}>
            {title && <ThemedText variant="title" style={[styles.title, style.title]}>{title}</ThemedText>}
            
            {type === "custom" && customContent ? (
              customContent
            ) : (
              <>
                {message && <ThemedText variant="secondary" style={[styles.message, style.message]}>{message}</ThemedText>}

                {type === "prompt" && (
                  <TextInput
                    style={[styles.input, {borderColor: colors.border, color: colors.text}, style.input]}
                    placeholder={placeholder}
                    value={value}
                    onChangeText={setValue}
                  />
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.button, {backgroundColor: colors.surface}, style.cancelButton]}
                    onPress={onCancel}
                  >
                    <ThemedText variant="default" style={[{color: colors.text, fontWeight: "bold"}, style.buttonText]}>
                      {cancelText}
                    </ThemedText>
                  </TouchableOpacity>

                  {type !== "custom" && (
                    <TouchableOpacity
                      style={[styles.button, {backgroundColor: colors.accent}, style.confirmButton]}
                      onPress={() => {
                        if (type === "prompt") {
                          onConfirm?.(value);
                        } else {
                          onConfirm?.();
                        }
                      }}
                    >
                      <ThemedText variant="default" style={[{color: colors.text, fontWeight: "bold"}, style.buttonText]}>
                        {confirmText}
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    );

}


const styles = StyleSheet.create({
    overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "80%",
    borderRadius: 12,
    padding: 20,
  },
  title: {
    fontWeight: "bold",
    marginBottom: 8,
  },
  message: {
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 16,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 8,
  },
});